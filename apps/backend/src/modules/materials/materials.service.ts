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
  suggestCrossCategoryMaterialReference,
} from '../../services/material-reference-matching.service.js';
import { AppError } from '../../utils/app-error.js';
import { decimalToNumber, roundCurrency } from '../../utils/decimal.js';
import type { AccessTokenPayload } from '../../utils/jwt.js';
import { isOtherCategory } from '../categories/categories.repository.js';
import { cardMaterialImageUrl } from '../../utils/material-image-url.js';
import * as categoriesRepository from '../categories/categories.repository.js';
import * as materialTypesRepository from '../material-types/material-types.repository.js';
import {
  mapLearnerReservation,
  resolvePickupCodeVisibilityByReservationIds,
} from '../reservations/reservations.service.js';
import { isElectronicPaymentEnforced } from '../payments/payments.policy.js';
import * as reservationsRepository from '../reservations/reservations.repository.js';
import {
  ACTIVE_HOLD_STATUSES,
  computeAvailableQuantity,
  decimalToNumber as quantityDecimalToNumber,
  getHeldQuantitiesByMaterialIds,
  toDecimal,
} from '../reservations/reservations.quantity.js';
import { resolveSavedLocationCoordinates } from '../locations/locations.service.js';
import { invalidateLearnerHomeCache } from '../learner-home/learner-home.service.js';
import { normalizeSupplierVerificationStatus } from '../supplier/supplier-verification.status.js';
import {
  commitRecommendationMaterialView,
  commitRecommendationToggleTransition,
  resolveRecommendationSourceOperationId,
} from '../recommendation-events/recommendation-events.service.js';
import * as publicSuppliersRepository from '../public-suppliers/public-suppliers.repository.js';
import { summarizeSupplierReviewsByUserIds } from '../reservations/reservation-reviews.repository.js';

import * as materialsRepository from './materials.repository.js';
import {
  findLearnerAcquiredMaterialAccess,
  findMaterialDetailForAcquiredLearner,
} from './materials.acquired-access.js';
import type {
  LikedMaterialsQuery,
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
  | 'CATEGORY_MISMATCH_SUGGESTION'
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

export type CategorySuggestionDto = {
  materialType: MatchedReferenceDto;
  confidence: string;
  category: {
    id: string;
    nameEn: string;
    nameAr: string | null;
  };
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
  categorySuggestion?: CategorySuggestionDto | null;
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
    categorySuggestion?: CategorySuggestionDto | null;
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
  categorySuggestion: options.categorySuggestion ?? null,
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
    const categorySuggestion = await suggestCrossCategoryMaterialReference({
      materialName,
      selectedCategoryId: input.categoryId,
    });
    if (categorySuggestion) {
      return {
        ok: false,
        result: buildBlockedResult(
          'CATEGORY_MISMATCH_SUGGESTION',
          `No match in the selected category. Did you mean "${categorySuggestion.materialType.nameEn}" under ${categorySuggestion.category.nameEn}? Confirm the category to continue.`,
          {
            candidates: [mapMatchedReferenceDto(categorySuggestion.materialType)],
            matchedReference: mapMatchedReferenceDto(categorySuggestion.materialType),
            categorySuggestion: {
              materialType: mapMatchedReferenceDto(categorySuggestion.materialType),
              confidence: categorySuggestion.confidence,
              category: categorySuggestion.category,
            },
          },
        ),
      };
    }
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

type MaterialSupplierProfileForSummary = {
  id: string;
  publicName: string | null;
  avatarImageUrl: string | null;
  user: {
    displayName: string;
    profileImageUrl: string | null;
  };
  defaultPickupLocation: {
    city: string;
    area: string | null;
  } | null;
  organizationProfile: {
    businessLocation: {
      city: string;
      area: string | null;
    } | null;
  } | null;
};

const resolveMaterialSupplierDisplayName = (
  supplierProfile: MaterialSupplierProfileForSummary,
) => {
  return (
    supplierProfile.publicName?.trim() ||
    supplierProfile.user.displayName?.trim() ||
    'ImpactLoop supplier'
  );
};

const resolveMaterialSupplierAvatarUrl = (
  supplierProfile: MaterialSupplierProfileForSummary,
) => {
  return supplierProfile.avatarImageUrl ?? supplierProfile.user.profileImageUrl ?? null;
};

const resolveMaterialSupplierCity = (
  supplierProfile: MaterialSupplierProfileForSummary,
) => {
  return (
    supplierProfile.defaultPickupLocation?.city ??
    supplierProfile.organizationProfile?.businessLocation?.city ??
    null
  );
};

const resolveMaterialSupplierArea = (
  supplierProfile: MaterialSupplierProfileForSummary,
) => {
  return (
    supplierProfile.defaultPickupLocation?.area ??
    supplierProfile.organizationProfile?.businessLocation?.area ??
    null
  );
};

const mapMaterialSupplierSummary = (
  supplierProfile: MaterialSupplierProfileForSummary,
  followedSupplierIds: Set<string>,
  options: { followersCount?: number } = {},
) => {
  const summary = {
    id: supplierProfile.id,
    displayName: resolveMaterialSupplierDisplayName(supplierProfile),
    avatarUrl: resolveMaterialSupplierAvatarUrl(supplierProfile),
    city: resolveMaterialSupplierCity(supplierProfile),
    area: resolveMaterialSupplierArea(supplierProfile),
    isFollowedByViewer: followedSupplierIds.has(supplierProfile.id),
  };

  if (options.followersCount !== undefined) {
    return {
      ...summary,
      followersCount: options.followersCount,
    };
  }

  return summary;
};

const collectSupplierProfileIds = (
  materials: Array<{ supplierProfile: { id: string } | null }>,
) => {
  const ids = new Set<string>();

  for (const material of materials) {
    if (material.supplierProfile?.id) {
      ids.add(material.supplierProfile.id);
    }
  }

  return [...ids];
};

const attachSupplierSummariesToMappedMaterials = async <
  TMaterial extends { supplierProfile: MaterialSupplierProfileForSummary | null },
  TMapped extends Record<string, unknown>,
>(
  rawMaterials: TMaterial[],
  mappedMaterials: TMapped[],
  viewer?: AccessTokenPayload,
  options: { includeFollowersCountForSingle?: boolean } = {},
) => {
  const supplierProfileIds = collectSupplierProfileIds(rawMaterials);
  const followedSupplierIds =
    await publicSuppliersRepository.findFollowedSupplierIds(
      viewer?.sub,
      supplierProfileIds,
    );

  let followersCountBySupplierId = new Map<string, number>();

  if (
    options.includeFollowersCountForSingle &&
    supplierProfileIds.length === 1
  ) {
    const supplierProfileId = supplierProfileIds[0]!;
    const followersCount =
      await publicSuppliersRepository.countSupplierFollowers(supplierProfileId);
    followersCountBySupplierId = new Map([[supplierProfileId, followersCount]]);
  }

  return mappedMaterials.map((mapped, index) => {
    const supplierProfile = rawMaterials[index]?.supplierProfile;

    if (!supplierProfile?.id) {
      return mapped;
    }

    return {
      ...mapped,
      supplier: mapMaterialSupplierSummary(
        supplierProfile,
        followedSupplierIds,
        {
          followersCount: followersCountBySupplierId.get(supplierProfile.id),
        },
      ),
    };
  });
};

const resolvePrimaryImageUrl = (material: {
  images: { imageUrl: string; isCover?: boolean }[];
}) => {
  const cover = material.images.find((image) => image.isCover);
  const original = cover?.imageUrl ?? material.images[0]?.imageUrl ?? null;
  return original ? cardMaterialImageUrl(original) : null;
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

const approximateCoordinate = (
  value: Parameters<typeof decimalToNumber>[0] | null,
) => {
  if (value == null) return null;

  const numeric = decimalToNumber(value);
  if (numeric == null) return null;

  return Math.round(numeric * 100) / 100;
};

const approximateDistanceKm = (distanceKm: number | null | undefined) => {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return null;

  return Math.round(distanceKm * 10) / 10;
};

const mapMaterialRatingSummary = (
  summary: { average: number; count: number } | undefined,
) => {
  if (!summary || summary.count <= 0) {
    return null;
  }

  return Math.round(summary.average * 10) / 10;
};

const loadSupplierRatingSummariesForMaterials = async (
  materials: Array<{ ownerId: string }>,
) => summarizeSupplierReviewsByUserIds(materials.map((material) => material.ownerId));

export const mapMaterial = (
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
      latitude?: Parameters<typeof decimalToNumber>[0] | null;
      longitude?: Parameters<typeof decimalToNumber>[0] | null;
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
  engagement: {
    likesCount?: number;
    isLiked?: boolean;
  } = {},
  options: {
    includeApproximateLocation?: boolean;
    distanceKm?: number | null;
    ratingSummary?: number | null;
  } = {},
) => {
  const quantity = toDecimal(material.quantity);
  const availableQuantity = computeAvailableQuantity(quantity, heldQuantity);
  const primaryImageUrl = resolvePrimaryImageUrl(material);

  const mapped = {
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
    ratingSummary: options.ratingSummary ?? null,
    viewsCount: material.viewsCount,
    likesCount: engagement.likesCount ?? 0,
    isLiked: engagement.isLiked ?? false,
    createdAt: material.createdAt.toISOString(),
  };

  if (!options.includeApproximateLocation) {
    return mapped;
  }

  const approximateLatitude = approximateCoordinate(
    material.location.latitude ?? null,
  );
  const approximateLongitude = approximateCoordinate(
    material.location.longitude ?? null,
  );

  return {
    ...mapped,
    approximateLatitude,
    approximateLongitude,
    approximateDistanceKm: approximateDistanceKm(options.distanceKm),
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

export const getMaterials = async (
  query: MaterialsQuery,
  viewer?: AccessTokenPayload,
  options: { supplierProfileId?: string } = {},
) => {
  let viewerCoordinates: materialsRepository.ViewerCoordinates | undefined;

  if (query.savedLocationId) {
    if (!viewer) {
      throw new AppError(
        'Authentication required to use a saved location',
        401,
        'UNAUTHENTICATED',
      );
    }

    viewerCoordinates = await resolveSavedLocationCoordinates(
      viewer.sub,
      query.savedLocationId,
    );
  } else if (query.latitude != null && query.longitude != null) {
    viewerCoordinates = {
      latitude: query.latitude,
      longitude: query.longitude,
    };
  }

  if (query.sort === 'nearest' && !viewerCoordinates) {
    throw new AppError(
      'Nearest sorting requires latitude/longitude or a saved location',
      400,
      'VALIDATION_ERROR',
    );
  }

  const result = await materialsRepository.findMaterials(
    query,
    viewerCoordinates,
    options.supplierProfileId,
  );
  const materialIds = result.items.map((item) => item.id);

  const [heldByMaterialId, likesByMaterialId, likedMaterialIds, ratingSummaries] =
    await Promise.all([
      getHeldQuantitiesByMaterialIds(materialIds),
      materialsRepository.countLikesByMaterialIds(materialIds),
      materialsRepository.findLikedMaterialIds(viewer?.sub, materialIds),
      loadSupplierRatingSummariesForMaterials(result.items),
    ]);

  const mappedItems = result.items.map((item) =>
    mapMaterial(
      item,
      heldByMaterialId.get(item.id) ?? toDecimal(0),
      {
        likesCount: likesByMaterialId.get(item.id) ?? 0,
        isLiked: likedMaterialIds.has(item.id),
      },
      {
        includeApproximateLocation: true,
        distanceKm: result.distanceByMaterialId.get(item.id),
        ratingSummary: mapMaterialRatingSummary(
          ratingSummaries.get(item.ownerId),
        ),
      },
    ),
  );

  const items = await attachSupplierSummariesToMappedMaterials(
    result.items,
    mappedItems,
    viewer,
  );

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages: result.total === 0 ? 0 : Math.ceil(result.total / query.limit),
    },
  };
};

export type LikedMaterialsServiceDependencies = {
  findVisibleLikedMaterials: (
    userId: string,
    query: LikedMaterialsQuery,
  ) => Promise<
    Awaited<ReturnType<typeof materialsRepository.findVisibleLikedMaterials>>
  >;
  countVisibleLikedMaterials: (userId: string) => Promise<number>;
  getHeldQuantitiesByMaterialIds: (
    materialIds: string[],
  ) => Promise<Awaited<ReturnType<typeof getHeldQuantitiesByMaterialIds>>>;
};

export const createLikedMaterialsService = (
  dependencies: LikedMaterialsServiceDependencies,
) => async (userId: string, query: LikedMaterialsQuery) => {
  const [likes, total] = await Promise.all([
    dependencies.findVisibleLikedMaterials(userId, query),
    dependencies.countVisibleLikedMaterials(userId),
  ]);
  const materialIds = likes.map((like) => like.materialId);
  const heldByMaterialId =
    await dependencies.getHeldQuantitiesByMaterialIds(materialIds);

  return {
    items: likes.map((like) => ({
      likedAt: like.createdAt.toISOString(),
      material: mapMaterial(
        like.material,
        heldByMaterialId.get(like.materialId) ?? toDecimal(0),
        {
          likesCount: like.material._count.likes,
          isLiked: true,
        },
      ),
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
};

export const getLikedMaterials = createLikedMaterialsService({
  findVisibleLikedMaterials: materialsRepository.findVisibleLikedMaterials,
  countVisibleLikedMaterials: materialsRepository.countVisibleLikedMaterials,
  getHeldQuantitiesByMaterialIds,
});

export const getMaterialById = async (
  id: string,
  viewer?: AccessTokenPayload,
  abortSignal?: AbortSignal,
) => {
  let material = await materialsRepository.findMaterialById(id);
  let acquiredReservation:
    | Awaited<ReturnType<typeof findLearnerAcquiredMaterialAccess>>
    | null = null;

  if (!material && viewer?.roles.includes('LEARNER')) {
    acquiredReservation = await findLearnerAcquiredMaterialAccess({
      requesterId: viewer.sub,
      materialId: id,
    });

    if (acquiredReservation) {
      material = await findMaterialDetailForAcquiredLearner(id);
    }
  }

  if (!material) {
    throw new AppError('Material not found', 404, 'NOT_FOUND');
  }
  assertRequestActive(abortSignal);

  const [heldByMaterialId, likesByMaterialId] = await Promise.all([
    getHeldQuantitiesByMaterialIds([material.id]),
    materialsRepository.countLikesByMaterialIds([material.id]),
  ]);
  const ratingSummaries = await loadSupplierRatingSummariesForMaterials([
    material,
  ]);
  assertRequestActive(abortSignal);
  const heldQuantity = heldByMaterialId.get(material.id) ?? toDecimal(0);
  const mappedMaterial = mapMaterial(
    material,
    heldQuantity,
    {
      likesCount: likesByMaterialId.get(material.id) ?? 0,
      isLiked: false,
    },
    {
      ratingSummary: mapMaterialRatingSummary(
        ratingSummaries.get(material.ownerId),
      ),
    },
  );
  const detailFields = mapMaterialDetailFields(material);
  const [materialWithSupplier] = await attachSupplierSummariesToMappedMaterials(
    [material],
    [mappedMaterial],
    undefined,
    { includeFollowersCountForSingle: true },
  );

  const publicDetail = {
    ...materialWithSupplier,
    ...detailFields,
  };

  if (!viewer) {
    return publicDetail;
  }

  if (acquiredReservation) {
    const [likedMaterialIds, followedSupplierIds] = await Promise.all([
      materialsRepository.findLikedMaterialIds(viewer.sub, [material.id]),
      publicSuppliersRepository.findFollowedSupplierIds(
        viewer.sub,
        material.supplierProfileId ? [material.supplierProfileId] : [],
      ),
    ]);
    const publicSupplier =
      'supplier' in publicDetail ? publicDetail.supplier : undefined;

    return {
      ...publicDetail,
      materialId: material.id,
      isLiked: likedMaterialIds.has(material.id),
      supplierFollowed: material.supplierProfileId
        ? followedSupplierIds.has(material.supplierProfileId)
        : false,
      isAcquiredView: true,
      acquiredQuantity: quantityDecimalToNumber(acquiredReservation.quantityRequested),
      acquiredReservationId: acquiredReservation.id,
      acquiredReservationStatus: acquiredReservation.status,
      acquiredReservationCompletedAt:
        acquiredReservation.completedAt?.toISOString() ?? null,
      isOwnMaterial: false,
      canReserve: false,
      reserveBlockReason: 'ACQUIRED' as const,
      reservation: null,
      ...(publicSupplier
        ? {
            supplier: {
              ...publicSupplier,
              isFollowedByViewer: material.supplierProfileId
                ? followedSupplierIds.has(material.supplierProfileId)
                : false,
            },
          }
        : {}),
    };
  }

  const viewerState = await getMaterialViewerState(id, viewer);
  const publicSupplier =
    'supplier' in publicDetail ? publicDetail.supplier : undefined;
  return {
    ...publicDetail,
    ...viewerState,
    ...(publicSupplier
      ? {
          supplier: {
            ...publicSupplier,
            isFollowedByViewer: viewerState.supplierFollowed,
          },
        }
      : {}),
  };
};

export const getMaterialViewerState = async (
  id: string,
  viewer: AccessTokenPayload,
  abortSignal?: AbortSignal,
) => {
  const material = await materialsRepository.findMaterialById(id);
  if (!material) {
    throw new AppError('Material not found', 404, 'NOT_FOUND');
  }
  assertRequestActive(abortSignal);

  const isLearner = viewer.roles.includes('LEARNER');
  const [heldByMaterialId, likedMaterialIds, followedSupplierIds, reservation] =
    await Promise.all([
      getHeldQuantitiesByMaterialIds([material.id]),
      materialsRepository.findLikedMaterialIds(viewer.sub, [material.id]),
      publicSuppliersRepository.findFollowedSupplierIds(
        viewer.sub,
        material.supplierProfileId ? [material.supplierProfileId] : [],
      ),
      isLearner
        ? reservationsRepository.findActiveLearnerReservationForMaterial(
            viewer.sub,
            material.id,
          )
        : Promise.resolve(null),
    ]);
  assertRequestActive(abortSignal);
  const availableQuantity = computeAvailableQuantity(
    material.quantity,
    heldByMaterialId.get(material.id) ?? toDecimal(0),
  ).toNumber();
  const reserve = await buildMaterialReserveEnrichment(
    material,
    availableQuantity,
    viewer,
  );

  const pickupCodeAllowedById = reservation
    ? await resolvePickupCodeVisibilityByReservationIds([reservation.id])
    : new Map<string, boolean>();

  return {
    materialId: material.id,
    isLiked: likedMaterialIds.has(material.id),
    supplierFollowed: material.supplierProfileId
      ? followedSupplierIds.has(material.supplierProfileId)
      : false,
    ...reserve,
    reservation: reservation
      ? mapLearnerReservation(reservation, null, {
          paymentAllowsPickupCode:
            pickupCodeAllowedById.get(reservation.id) ??
            !isElectronicPaymentEnforced(),
        })
      : null,
  };
};

export const recordMaterialViewById = async (
  id: string,
  operationKey: string,
  viewer?: AccessTokenPayload,
) => {
  const isLearner = viewer?.roles.includes('LEARNER') === true;
  if (viewer?.sub && isLearner) {
    const committed = await commitRecommendationMaterialView({
      learnerId: viewer.sub,
      materialId: id,
      sourceOperationId: operationKey,
      apply: async (tx) => {
        const recorded = await materialsRepository.recordMaterialViewOperation(
          id,
          viewer.sub,
          'material_detail',
          tx,
          operationKey,
        );
        if (!recorded) {
          throw new AppError('Material not found', 404, 'NOT_FOUND');
        }
        return recorded;
      },
    });
    if (committed.response.recorded && !committed.replayed) {
      invalidateLearnerHomeCache(viewer.sub);
    }
    return committed.response;
  }

  const recorded = await materialsRepository.recordIdempotentMaterialView({
    id,
    viewerUserId: viewer?.sub,
    operationKey,
  });
  if (!recorded) {
    throw new AppError('Material not found', 404, 'NOT_FOUND');
  }
  return recorded;
};

export const mapFocusedMaterialCards = async (
  records: Awaited<
    ReturnType<typeof materialsRepository.findRelatedMaterials>
  >['category'],
  viewer?: AccessTokenPayload,
) => {
  const ids = records.map((item) => item.id);
  const [held, likes, liked, ratingSummaries] = await Promise.all([
    getHeldQuantitiesByMaterialIds(ids),
    materialsRepository.countLikesByMaterialIds(ids),
    materialsRepository.findLikedMaterialIds(viewer?.sub, ids),
    loadSupplierRatingSummariesForMaterials(records),
  ]);
  return records.map((item) =>
    mapMaterial(item, held.get(item.id) ?? toDecimal(0), {
      likesCount: likes.get(item.id) ?? 0,
      isLiked: liked.has(item.id),
    }, {
      ratingSummary: mapMaterialRatingSummary(
        ratingSummaries.get(item.ownerId),
      ),
    }),
  );
};

export const getRelatedMaterials = async (
  id: string,
  limit: number,
  viewer?: AccessTokenPayload,
  abortSignal?: AbortSignal,
) => {
  const material = await materialsRepository.findMaterialById(id);
  if (!material) {
    throw new AppError('Material not found', 404, 'NOT_FOUND');
  }
  assertRequestActive(abortSignal);
  const related = await materialsRepository.findRelatedMaterials(material, limit);
  assertRequestActive(abortSignal);
  const [category, nearby] = await Promise.all([
    mapFocusedMaterialCards(related.category, viewer),
    mapFocusedMaterialCards(related.nearby, viewer),
  ]);
  return { category, nearby };
};

const assertRequestActive = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    throw new AppError('Client closed request', 499, 'CLIENT_CLOSED_REQUEST');
  }
};

export const likeMaterialById = async (id: string, userId: string) => {
  const material = await materialsRepository.findPublicMaterialById(id);

  if (!material) {
    throw new AppError('Material not found', 404, 'NOT_FOUND');
  }

  const { response, replayed } = await commitRecommendationToggleTransition({
    learnerId: userId,
    actionType: 'MATERIAL_LIKE',
    entityType: 'MATERIAL',
    entityId: id,
    resourceType: 'material-like',
    apply: (tx) => materialsRepository.setMaterialLiked(id, userId, tx),
    buildResponse: async (tx, active) => ({
      materialId: id,
      likesCount: await tx.materialLike.count({ where: { materialId: id } }),
      isLiked: active,
    }),
  });

  if (!replayed) {
    invalidateLearnerHomeCache(userId);
  }

  return response;
};

export const unlikeMaterialById = async (id: string, userId: string) => {
  const material = await materialsRepository.findPublicMaterialById(id);

  if (!material) {
    throw new AppError('Material not found', 404, 'NOT_FOUND');
  }

  const { response, replayed } = await commitRecommendationToggleTransition({
    learnerId: userId,
    actionType: 'MATERIAL_UNLIKE',
    entityType: 'MATERIAL',
    entityId: id,
    resourceType: 'material-unlike',
    apply: (tx) => materialsRepository.unsetMaterialLiked(id, userId, tx),
    buildResponse: async (tx, active) => ({
      materialId: id,
      likesCount: await tx.materialLike.count({ where: { materialId: id } }),
      isLiked: active,
    }),
  });

  if (!replayed) {
    invalidateLearnerHomeCache(userId);
  }

  return response;
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

  // Ambiguous matches need confirmation for free and paid — never silently
  // collapse to customMaterialType / first candidate.
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

  const categorySuggestion = await suggestCrossCategoryMaterialReference({
    materialName: input.materialName,
    selectedCategoryId: input.categoryId,
  });

  if (input.isFree) {
    return {
      matchResult,
      materialType: null,
      categorySuggestion,
    };
  }

  throw new AppError(
    categorySuggestion
      ? `No match in the selected category. Did you mean "${categorySuggestion.materialType.nameEn}" under ${categorySuggestion.category.nameEn}? Confirm the category to continue.`
      : 'This paid material needs admin price review before publishing.',
    400,
    'VALIDATION_ERROR',
    {
      reason: categorySuggestion
        ? 'CATEGORY_MISMATCH_SUGGESTION'
        : 'MATERIAL_REVIEW_REQUIRED',
      ...(categorySuggestion
        ? {
            categorySuggestion: {
              materialType: mapMatchedReferenceDto(categorySuggestion.materialType),
              confidence: categorySuggestion.confidence,
              category: categorySuggestion.category,
            },
          }
        : {}),
    },
  );
};
