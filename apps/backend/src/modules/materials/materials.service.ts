import type { MaterialCondition } from '../../generated/prisma/client.js';

import {
  DEFAULT_CURRENCY,
  DEFAULT_CURRENCY_SYMBOL,
  applyConditionPriceMultiplier,
  conditionPriceMultiplier,
} from '../../constants/material-condition-factors.js';
import { MATERIAL_LISTING_POLICY } from '../../constants/material-listing-policy.js';
import { prisma } from '../../database/prisma.js';
import {
  mapMatchedReferenceDto,
  matchMaterialReference,
} from '../../services/material-reference-matching.service.js';
import { AppError } from '../../utils/app-error.js';
import { decimalToNumber, roundCurrency } from '../../utils/decimal.js';
import type { AccessTokenPayload } from '../../utils/jwt.js';
import { isOtherCategory } from '../categories/categories.repository.js';
import * as categoriesRepository from '../categories/categories.repository.js';
import * as materialTypesRepository from '../material-types/material-types.repository.js';
import {
  ACTIVE_HOLD_STATUSES,
  computeAvailableQuantity,
  decimalToNumber as quantityDecimalToNumber,
  getHeldQuantitiesByMaterialIds,
  toDecimal,
} from '../reservations/reservations.quantity.js';
import { normalizeSupplierVerificationStatus } from '../supplier/supplier-verification.status.js';

import * as materialsRepository from './materials.repository.js';
import type {
  MaterialsQuery,
  PriceCheckInput,
} from './materials.validation.js';

export type PriceCheckReason =
  | 'PRICE_RULE_REQUIRED'
  | 'UNIT_MISMATCH'
  | 'PRICE_TOO_HIGH'
  | 'PAID_OTHER_NOT_ALLOWED'
  | 'MATERIAL_REVIEW_REQUIRED'
  | 'AMBIGUOUS_MATERIAL_MATCH'
  | 'INVALID_CURRENCY'
  | 'INVALID_PRICE'
  | 'CATEGORY_NOT_FOUND'
  | 'PRICE_RULE_INVALID'
  | 'MATERIAL_TYPE_REQUIRED'
  | 'OTHER_NOT_ALLOWED_FOR_PAID'
  | 'MATERIAL_TYPE_NOT_FOUND';

export type MatchedReferenceDto = {
  id: string;
  nameEn: string;
  nameAr: string | null;
  unit: string;
};

export type PriceCheckResult = {
  allowed: boolean;
  reason?: PriceCheckReason;
  currency: string;
  currencySymbol: string;
  maxAllowedPrice?: number | null;
  baseMaxPrice?: number | null;
  baseSuggestedPrice?: number | null;
  selectedCondition?: MaterialCondition;
  conditionMultiplier?: number;
  adjustedSuggestedPrice?: number | null;
  adjustedMaxPrice?: number | null;
  submittedPrice?: number | null;
  isWithinAdjustedRange?: boolean;
  source?: 'RULE' | 'AI' | 'ADMIN_REVIEW' | null;
  priceRuleId?: string | null;
  materialTypeId?: string | null;
  matchedReference?: MatchedReferenceDto | null;
  approvedUnit?: string | null;
  candidates: MatchedReferenceDto[];
  message: string;
};

const buildConditionPriceBreakdown = (
  input: PriceCheckInput,
  baseMaxPrice: number,
  source: 'RULE' | 'AI' | 'ADMIN_REVIEW',
) => {
  const multiplier = conditionPriceMultiplier(input.condition);
  const adjustedMaxPrice = applyConditionPriceMultiplier(
    baseMaxPrice,
    input.condition,
  );

  return {
    baseMaxPrice,
    baseSuggestedPrice: baseMaxPrice,
    selectedCondition: input.condition,
    conditionMultiplier: multiplier,
    adjustedSuggestedPrice: adjustedMaxPrice,
    adjustedMaxPrice,
    submittedPrice: input.price ?? null,
    isWithinAdjustedRange:
      input.price != null ? input.price <= adjustedMaxPrice : undefined,
    source,
    maxAllowedPrice: adjustedMaxPrice,
  };
};

const formatConditionLabel = (condition: MaterialCondition) =>
  condition
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const getListingPolicy = () => MATERIAL_LISTING_POLICY;

const buildAllowedResult = (
  input: PriceCheckInput,
  baseMaxPrice: number,
  priceRuleId: string | null = null,
  materialTypeId: string | null = null,
  matchedReference: MatchedReferenceDto | null = null,
  source: 'RULE' | 'AI' | 'ADMIN_REVIEW' = 'RULE',
): PriceCheckResult => ({
  allowed: true,
  currency: DEFAULT_CURRENCY,
  currencySymbol: DEFAULT_CURRENCY_SYMBOL,
  priceRuleId,
  materialTypeId,
  matchedReference,
  candidates: [],
  message: 'Price verified.',
  ...buildConditionPriceBreakdown(input, baseMaxPrice, source),
});

const buildBlockedResult = (
  reason: PriceCheckReason,
  message: string,
  options: {
    input?: PriceCheckInput;
    baseMaxPrice?: number | null;
    source?: 'RULE' | 'AI' | 'ADMIN_REVIEW' | null;
    maxAllowedPrice?: number | null;
    priceRuleId?: string | null;
    materialTypeId?: string | null;
    matchedReference?: MatchedReferenceDto | null;
    approvedUnit?: string | null;
    candidates?: MatchedReferenceDto[];
  } = {},
): PriceCheckResult => ({
  allowed: false,
  reason,
  currency: DEFAULT_CURRENCY,
  currencySymbol: DEFAULT_CURRENCY_SYMBOL,
  priceRuleId: options.priceRuleId ?? null,
  materialTypeId: options.materialTypeId ?? null,
  matchedReference: options.matchedReference ?? null,
  approvedUnit: options.approvedUnit ?? null,
  candidates: options.candidates ?? [],
  message,
  ...(options.input != null && options.baseMaxPrice != null
    ? buildConditionPriceBreakdown(
        options.input,
        options.baseMaxPrice,
        options.source ?? 'RULE',
      )
    : {
        maxAllowedPrice: options.maxAllowedPrice ?? null,
        source: options.source ?? null,
      }),
});

export const calculateMaxAllowedPrice = (input: {
  maxAllowedUnitPriceNis: number | null;
  maxAllowedTotalPriceNis: number | null;
  quantity: number;
  condition: MaterialCondition;
}): number | null => {
  const conditionFactor = conditionPriceMultiplier(input.condition);
  const candidateCaps: number[] = [];

  if (input.maxAllowedUnitPriceNis != null) {
    candidateCaps.push(
      roundCurrency(input.maxAllowedUnitPriceNis * conditionFactor),
    );
  }

  if (input.maxAllowedTotalPriceNis != null && input.quantity > 0) {
    candidateCaps.push(
      roundCurrency(
        (input.maxAllowedTotalPriceNis / input.quantity) * conditionFactor,
      ),
    );
  }

  if (candidateCaps.length > 0) {
    return roundCurrency(Math.min(...candidateCaps));
  }

  return null;
};

const resolveMaterialTypeForPaidCheck = async (
  input: PriceCheckInput,
): Promise<
  | {
      ok: true;
      materialType: NonNullable<
        Awaited<ReturnType<typeof materialTypesRepository.findMaterialTypeById>>
      >;
      confidence?: 'EXACT' | 'ALIAS' | 'PARTIAL';
    }
  | { ok: false; result: PriceCheckResult }
> => {
  if (input.materialTypeId) {
    const materialType = await materialTypesRepository.findMaterialTypeById(
      input.materialTypeId,
    );

    if (!materialType || !materialType.isActive) {
      return {
        ok: false,
        result: buildBlockedResult(
          'MATERIAL_REVIEW_REQUIRED',
          'We could not verify this paid material yet. Submit it for review.',
        ),
      };
    }

    return { ok: true, materialType };
  }

  const materialName = input.materialName?.trim();

  if (!materialName) {
    return {
      ok: false,
      result: buildBlockedResult(
        'MATERIAL_REVIEW_REQUIRED',
        'We could not verify this paid material yet. Submit it for review.',
      ),
    };
  }

  const matchResult = await matchMaterialReference({
    materialName,
    categoryId: input.categoryId,
  });

  if (matchResult.status === 'NO_MATCH') {
    return {
      ok: false,
      result: buildBlockedResult(
        'MATERIAL_REVIEW_REQUIRED',
        'We could not verify this paid material yet. Submit it for review.',
      ),
    };
  }

  if (matchResult.status === 'AMBIGUOUS') {
    return {
      ok: false,
      result: buildBlockedResult(
        'AMBIGUOUS_MATERIAL_MATCH',
        'We found multiple possible matches. Please clarify the material name or category.',
        {
          candidates: matchResult.candidates.map(mapMatchedReferenceDto),
        },
      ),
    };
  }

  const materialType = await materialTypesRepository.findMaterialTypeById(
    matchResult.materialType.id,
  );

  if (!materialType || !materialType.isActive) {
    return {
      ok: false,
      result: buildBlockedResult(
        'MATERIAL_REVIEW_REQUIRED',
        'We could not verify this paid material yet. Submit it for review.',
      ),
    };
  }

  return {
    ok: true,
    materialType,
    confidence: matchResult.confidence,
  };
};

const runPriceRuleCheck = async (
  input: PriceCheckInput,
  materialType: NonNullable<
    Awaited<ReturnType<typeof materialTypesRepository.findMaterialTypeById>>
  >,
): Promise<PriceCheckResult> => {
  const matchedReference = mapMatchedReferenceDto({
    id: materialType.id,
    nameEn: materialType.nameEn,
    nameAr: materialType.nameAr,
    defaultUnit: materialType.defaultUnit,
    categoryId: materialType.categoryId,
  });

  const activeRule =
    await materialTypesRepository.findActivePriceRuleForMaterialType(
      materialType.id,
      input.unit,
    );

  if (!activeRule) {
    const activeRuleForDifferentUnit =
      await materialTypesRepository.findActivePriceRuleForMaterialType(
        materialType.id,
      );

    if (activeRuleForDifferentUnit) {
      return buildBlockedResult(
        'UNIT_MISMATCH',
        'Please use the approved unit for this material.',
        {
          materialTypeId: materialType.id,
          matchedReference,
          approvedUnit: activeRuleForDifferentUnit.unit,
        },
      );
    }

    return buildBlockedResult(
      'PRICE_RULE_REQUIRED',
      'This material needs an active price reference before paid listing.',
      {
        materialTypeId: materialType.id,
        matchedReference,
      },
    );
  }

  const baseMaxPrice = calculateMaxAllowedPrice({
    maxAllowedUnitPriceNis: decimalToNumber(activeRule.maxAllowedUnitPriceNis),
    maxAllowedTotalPriceNis: decimalToNumber(activeRule.maxAllowedTotalPriceNis),
    quantity: input.quantity,
    condition: 'NEW',
  });

  const maxAllowedPrice =
    baseMaxPrice == null
      ? null
      : applyConditionPriceMultiplier(baseMaxPrice, input.condition);

  if (maxAllowedPrice == null || baseMaxPrice == null) {
    return buildBlockedResult(
      'PRICE_RULE_INVALID',
      'This material has an invalid active price reference.',
      {
        materialTypeId: materialType.id,
        matchedReference,
      },
    );
  }

  if (input.price == null || input.price <= 0) {
    return buildBlockedResult(
      'INVALID_PRICE',
      'Paid listings must have a price greater than zero.',
    );
  }

  if (input.price > maxAllowedPrice) {
    const unitLabel = activeRule.unit;
    const conditionLabel = formatConditionLabel(input.condition);
    return buildBlockedResult(
      'PRICE_TOO_HIGH',
      `The entered price is above the recommended maximum for this condition. Base max: ${baseMaxPrice} NIS, condition: ${conditionLabel}, adjusted max: ${maxAllowedPrice} NIS.`,
      {
        input,
        baseMaxPrice,
        source: 'RULE',
        materialTypeId: materialType.id,
        matchedReference,
        approvedUnit: unitLabel,
      },
    );
  }

  return buildAllowedResult(
    input,
    baseMaxPrice,
    activeRule.id,
    materialType.id,
    matchedReference,
    'RULE',
  );
};

const resolveSupplierName = (material: {
  supplierProfile: {
    publicName: string | null;
    user: { displayName: string };
  } | null;
  owner: { displayName: string };
}) => {
  return (
    material.supplierProfile?.publicName ??
    material.supplierProfile?.user.displayName ??
    material.owner.displayName ??
    null
  );
};

const resolvePrimaryImageUrl = (material: {
  images: { imageUrl: string; isCover?: boolean }[];
}) => {
  const cover = material.images.find((image) => image.isCover);
  return cover?.imageUrl ?? material.images[0]?.imageUrl ?? null;
};

type PublicMaterialImageRecord = {
  id: string;
  imageUrl: string;
  sortOrder: number;
  isCover: boolean;
  createdAt: Date;
};

const mapPublicMaterialImages = (images: PublicMaterialImageRecord[]) => {
  const sorted = [...images].sort((left, right) => {
    if (left.isCover !== right.isCover) {
      return left.isCover ? -1 : 1;
    }

    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.createdAt.getTime() - right.createdAt.getTime();
  });

  return sorted.map((image, index) => ({
    id: image.id,
    url: image.imageUrl,
    isCover: image.isCover,
    isPrimary: image.isCover || index === 0,
    sortOrder: image.sortOrder,
  }));
};

const mapMaterial = (
  material: {
    id: string;
    title: string;
    description: string;
    category: {
      id: string;
      nameEn: string;
      nameAr: string;
    };
    condition: MaterialCondition;
    status: string;
    quantity: Parameters<typeof toDecimal>[0];
    unit: string;
    isFree: boolean;
    price: Parameters<typeof decimalToNumber>[0] | null;
    location: {
      city: string;
      area: string | null;
    };
    deliveryAllowed: boolean;
    pickupAllowed: boolean;
    images: { imageUrl: string }[];
    supplierProfile: {
      publicName: string | null;
      user: { displayName: string };
    } | null;
    owner: { displayName: string };
    viewsCount: number;
    createdAt: Date;
  },
  heldQuantity = toDecimal(0),
) => {
  const quantity = toDecimal(material.quantity);
  const availableQuantity = computeAvailableQuantity(quantity, heldQuantity);
  const primaryImageUrl = resolvePrimaryImageUrl(material);

  return {
    id: material.id,
    title: material.title,
    description: material.description,
    category: {
      id: material.category.id,
      nameEn: material.category.nameEn,
      nameAr: material.category.nameAr,
    },
    condition: material.condition,
    status: material.status,
    quantity: quantityDecimalToNumber(quantity),
    availableQuantity: quantityDecimalToNumber(availableQuantity),
    unit: material.unit,
    isFree: material.isFree,
    price: material.price == null ? null : decimalToNumber(material.price),
    city: material.location.city,
    area: material.location.area,
    deliveryAvailable: material.deliveryAllowed,
    pickupAllowed: material.pickupAllowed,
    imageUrl: primaryImageUrl,
    primaryImageUrl,
    supplierName: resolveSupplierName(material),
    ratingSummary: null,
    viewsCount: material.viewsCount,
    createdAt: material.createdAt.toISOString(),
  };
};

export type MaterialReserveBlockReason =
  | 'OWN_MATERIAL'
  | 'NOT_LEARNER'
  | 'UNAVAILABLE'
  | 'OPEN_RESERVATION_EXISTS';

type MaterialDetailRecord = NonNullable<
  Awaited<ReturnType<typeof materialsRepository.findMaterialById>>
>;

const resolvePublicSupplierVerified = (
  supplierProfile: MaterialDetailRecord['supplierProfile'],
) => {
  if (!supplierProfile?.verificationStatus) {
    return false;
  }

  const status = normalizeSupplierVerificationStatus(
    supplierProfile.verificationStatus,
  );

  return status === 'APPROVED' || status === 'NOT_REQUIRED';
};

const mapMaterialDetailFields = (material: MaterialDetailRecord) => ({
  pickupNotes: material.pickupNotes?.trim() || null,
  suggestedUses: material.suggestedUses?.trim() || null,
  sourceType: material.sourceType,
  supplierType: material.supplierProfile?.supplierType ?? null,
  supplierVerified: resolvePublicSupplierVerified(material.supplierProfile),
  images: mapPublicMaterialImages(material.images),
});

const buildMaterialReserveEnrichment = async (
  material: MaterialDetailRecord,
  availableQuantity: number,
  viewer: AccessTokenPayload,
) => {
  const isOwnMaterial = material.ownerId === viewer.sub;

  if (isOwnMaterial) {
    return {
      isOwnMaterial: true as const,
      canReserve: false as const,
      reserveBlockReason: 'OWN_MATERIAL' as const,
    };
  }

  const isLearner = viewer.roles.includes('LEARNER');
  if (!isLearner) {
    return {
      isOwnMaterial: false as const,
      canReserve: false as const,
      reserveBlockReason: 'NOT_LEARNER' as const,
    };
  }

  const isAvailable =
    availableQuantity > 0 &&
    material.status !== 'REUSED' &&
    material.status !== 'UNAVAILABLE';

  if (!isAvailable) {
    return {
      isOwnMaterial: false as const,
      canReserve: false as const,
      reserveBlockReason: 'UNAVAILABLE' as const,
    };
  }

  const openLearnerReservationCount = await prisma.reservation.count({
    where: {
      materialId: material.id,
      requesterId: viewer.sub,
      status: { in: [...ACTIVE_HOLD_STATUSES] },
    },
  });

  if (openLearnerReservationCount > 0) {
    return {
      isOwnMaterial: false as const,
      canReserve: false as const,
      reserveBlockReason: 'OPEN_RESERVATION_EXISTS' as const,
    };
  }

  return {
    isOwnMaterial: false as const,
    canReserve: true as const,
    reserveBlockReason: null,
  };
};

export const getMaterials = async (query: MaterialsQuery) => {
  const result = await materialsRepository.findMaterials(query);
  const heldByMaterialId = await getHeldQuantitiesByMaterialIds(
    result.items.map((item) => item.id),
  );

  return {
    items: result.items.map((item) =>
      mapMaterial(item, heldByMaterialId.get(item.id) ?? toDecimal(0)),
    ),
    pagination: {
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages: result.total === 0 ? 0 : Math.ceil(result.total / query.limit),
    },
  };
};

export const getMaterialById = async (
  id: string,
  viewer?: AccessTokenPayload,
) => {
  const material = await materialsRepository.findMaterialById(id);

  if (!material) {
    throw new AppError('Material not found', 404, 'NOT_FOUND');
  }

  const incremented = await materialsRepository.incrementMaterialViewsCount(
    material.id,
  );

  const heldByMaterialId = await getHeldQuantitiesByMaterialIds([material.id]);
  const heldQuantity = heldByMaterialId.get(material.id) ?? toDecimal(0);
  const mappedMaterial = mapMaterial(
    { ...material, viewsCount: incremented.viewsCount },
    heldQuantity,
  );
  const detailFields = mapMaterialDetailFields(material);

  if (!viewer) {
    return {
      ...mappedMaterial,
      ...detailFields,
    };
  }

  const reserveEnrichment = await buildMaterialReserveEnrichment(
    material,
    mappedMaterial.availableQuantity,
    viewer,
  );

  return {
    ...mappedMaterial,
    ...detailFields,
    ...reserveEnrichment,
  };
};

export const checkMaterialPrice = async (
  input: PriceCheckInput,
): Promise<PriceCheckResult> => {
  const category = await categoriesRepository.findCategoryById(input.categoryId);

  if (!category) {
    return buildBlockedResult(
      'CATEGORY_NOT_FOUND',
      'Selected category was not found. Choose a category and try again.',
    );
  }

  if (input.isFree) {
    const materialName = input.materialName?.trim();
    let matchedReference: MatchedReferenceDto | null = null;
    let materialTypeId: string | null = input.materialTypeId ?? null;

    if (materialName) {
      const matchResult = await matchMaterialReference({
        materialName,
        categoryId: input.categoryId,
      });

      if (matchResult.status === 'MATCHED') {
        matchedReference = mapMatchedReferenceDto(matchResult.materialType);
        materialTypeId = matchResult.materialType.id;
      }
    } else if (input.materialTypeId) {
      const materialType = await materialTypesRepository.findMaterialTypeById(
        input.materialTypeId,
      );

      if (materialType?.isActive) {
        matchedReference = mapMatchedReferenceDto({
          id: materialType.id,
          nameEn: materialType.nameEn,
          nameAr: materialType.nameAr,
          defaultUnit: materialType.defaultUnit,
          categoryId: materialType.categoryId,
        });
      }
    }

    return {
      allowed: true,
      currency: DEFAULT_CURRENCY,
      currencySymbol: DEFAULT_CURRENCY_SYMBOL,
      maxAllowedPrice: null,
      priceRuleId: null,
      materialTypeId,
      matchedReference,
      candidates: [],
      message: 'Free listing allowed.',
    };
  }

  if (input.currency !== DEFAULT_CURRENCY) {
    return buildBlockedResult(
      'INVALID_CURRENCY',
      'Paid listings must use NIS.',
    );
  }

  if (input.price == null || input.price <= 0) {
    return buildBlockedResult(
      'INVALID_PRICE',
      'Paid listings must have a price greater than zero.',
    );
  }

  if (isOtherCategory(category.nameEn)) {
    return buildBlockedResult(
      'PAID_OTHER_NOT_ALLOWED',
      'Paid listings cannot use Other. Submit this material for review.',
    );
  }

  const resolved = await resolveMaterialTypeForPaidCheck(input);

  if (!resolved.ok) {
    return resolved.result;
  }

  return runPriceRuleCheck(input, resolved.materialType);
};

export const resolveMaterialReferenceForCreate = async (input: {
  materialName: string;
  categoryId: string;
  isFree: boolean;
}) => {
  const matchResult = await matchMaterialReference({
    materialName: input.materialName,
    categoryId: input.categoryId,
  });

  if (matchResult.status === 'MATCHED') {
    const materialType = await materialTypesRepository.findMaterialTypeById(
      matchResult.materialType.id,
    );

    if (materialType?.isActive) {
      return {
        matchResult,
        materialType,
      };
    }
  }

  if (input.isFree) {
    return {
      matchResult,
      materialType: null,
    };
  }

  if (matchResult.status === 'AMBIGUOUS') {
    throw new AppError(
      'We found multiple possible matches. Please clarify the material name or category.',
      400,
      'VALIDATION_ERROR',
      {
        reason: 'AMBIGUOUS_MATERIAL_MATCH',
        candidates: matchResult.candidates.map(mapMatchedReferenceDto),
      },
    );
  }

  throw new AppError(
    'This paid material needs admin price review before publishing.',
    400,
    'VALIDATION_ERROR',
    {
      reason: 'MATERIAL_REVIEW_REQUIRED',
    },
  );
};
