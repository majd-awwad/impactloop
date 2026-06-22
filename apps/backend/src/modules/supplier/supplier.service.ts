import type {
  RecentActivityDto,
  SupplierDashboardDto,
} from './dto/supplier-dashboard.dto.js';
import type {
  SupplierOrganizationProfileDto,
  SupplierProfileDetailsDto,
  SupplierProfileLocationDto,
  SupplierProfileResponseDto,
} from './dto/supplier-profile.dto.js';

import {
  emptyDashboardStats,
  normalizeVerificationStatus,
} from './dto/supplier-dashboard.dto.js';

import { AppError } from '../../utils/app-error.js';
import { decimalToNumber } from '../../utils/decimal.js';
import * as categoriesRepository from '../categories/categories.repository.js';
import * as categoryRequestsRepository from '../category-requests/category-requests.repository.js';
import * as priceRuleRequestsRepository from '../price-rule-requests/price-rule-requests.repository.js';
import { resolveApprovedMaxUnitPriceNis } from '../price-rule-requests/price-rule-request-pricing.js';
import { checkMaterialPrice, resolveMaterialReferenceForCreate } from '../materials/materials.service.js';
import * as supplierRepository from './supplier.repository.js';
import type {
  CreateSupplierMaterialInput,
  SupplierMaterialsQuery,
  UpdateSupplierMaterialInput,
  UpdateSupplierProfileInput,
} from './supplier.validation.js';

const MISSING_PROFILE_MESSAGE =
  'Complete your supplier profile to start listing materials.';

const MISSING_PICKUP_LOCATION_MESSAGE =
  'Add a default pickup location before listing materials.';

const deriveMaterialSourceType = (supplierType: string | null) => {
  switch (supplierType) {
    case 'WORKSHOP':
      return 'WORKSHOP_SURPLUS' as const;
    case 'FACTORY':
      return 'FACTORY_SURPLUS' as const;
    case 'EDUCATIONAL_INSTITUTION':
      return 'EDUCATIONAL_INSTITUTION' as const;
    case 'INDIVIDUAL_SUPPLIER':
      // TODO: MVP fallback. Revisit when the source enum can distinguish individual suppliers.
      return 'STUDENT_LEFTOVER' as const;
    case 'STUDENT_SUPPLIER':
    default:
      return 'STUDENT_LEFTOVER' as const;
  }
};

const assertSourceRequestPublishable = async (
  userId: string,
  input: CreateSupplierMaterialInput,
) => {
  if (input.sourceCategoryRequestId) {
    const request = await categoryRequestsRepository.findCategoryRequestByIdForOwner(
      input.sourceCategoryRequestId,
      userId,
    );

    if (!request) {
      throw new AppError('Category request not found', 404, 'NOT_FOUND');
    }

    if (request.publishedMaterialId) {
      throw new AppError(
        'This listing was already completed.',
        409,
        'CONFLICT',
      );
    }
  }

  if (input.sourcePriceRuleRequestId) {
    const request =
      await priceRuleRequestsRepository.findPriceRuleRequestByIdForOwner(
        input.sourcePriceRuleRequestId,
        userId,
      );

    if (!request) {
      throw new AppError('Price rule request not found', 404, 'NOT_FOUND');
    }

    if (request.publishedMaterialId) {
      throw new AppError(
        'This listing was already completed.',
        409,
        'CONFLICT',
      );
    }

    if (!input.isFree && input.price != null) {
      const maxAllowed = resolveApprovedMaxUnitPriceNis(request);
      if (maxAllowed != null && input.price > maxAllowed) {
        const unit = request.unit ?? request.materialType?.defaultUnit ?? 'unit';
        throw new AppError(
          `Unit price must be ${maxAllowed} NIS or less.`,
          400,
          'VALIDATION_ERROR',
          { maxAllowedPrice: maxAllowed, approvedUnit: unit },
        );
      }
    }
  }
};

const markSourceRequestPublished = async (
  materialId: string,
  input: CreateSupplierMaterialInput,
) => {
  if (input.sourceCategoryRequestId) {
    await categoryRequestsRepository.markCategoryRequestPublished({
      id: input.sourceCategoryRequestId,
      materialId,
    });
  }

  if (input.sourcePriceRuleRequestId) {
    await priceRuleRequestsRepository.markPriceRuleRequestPublished({
      id: input.sourcePriceRuleRequestId,
      materialId,
    });
  }
};

const mapCreatedMaterial = (material: Awaited<
  ReturnType<typeof supplierRepository.createSupplierMaterial>
>) => ({
  id: material.id,
  title: material.title,
  status: material.status,
  isFree: material.isFree,
  price: decimalToNumber(material.price),
  currency: material.currency,
  materialType: material.materialType,
  materialTypeId: material.materialTypeId,
  customMaterialType: material.customMaterialType,
  priceRuleId: material.priceRuleId,
  priceCheckedAt: material.priceCheckedAt?.toISOString() ?? null,
  maxAllowedPriceAtCheck: decimalToNumber(material.maxAllowedPriceAtCheck),
  category: {
    id: material.category.id,
    nameEn: material.category.nameEn,
    nameAr: material.category.nameAr,
  },
  images: material.images.map((image) => ({
    id: image.id,
    imageUrl: image.imageUrl,
    sortOrder: image.sortOrder,
    isCover: image.isCover,
  })),
  createdAt: material.createdAt.toISOString(),
});

const buildRecentActivity = (
  notifications: Awaited<
    ReturnType<typeof supplierRepository.findRecentNotifications>
  >,
  reservations: Awaited<
    ReturnType<typeof supplierRepository.findRecentReservationsForActivity>
  >,
): RecentActivityDto[] => {
  const notificationItems: RecentActivityDto[] = notifications.map((item) => ({
    id: item.id,
    type: 'NOTIFICATION',
    title: item.title,
    body: item.body,
    createdAt: item.createdAt.toISOString(),
  }));

  const reservationItems: RecentActivityDto[] = reservations.map((item) => ({
    id: item.id,
    type: 'RESERVATION',
    title: `Reservation ${item.status.toLowerCase()}`,
    body: item.material.title,
    createdAt: item.createdAt.toISOString(),
  }));

  return [...notificationItems, ...reservationItems]
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )
    .slice(0, 3);
};

export const getSupplierDashboard = async (
  userId: string,
): Promise<SupplierDashboardDto> => {
  const supplierProfile =
    await supplierRepository.findSupplierProfileForDashboard(userId);

  const [
    materialGroups,
    reservationGroups,
    reusedAggregate,
    reviewAggregate,
    unreadNotifications,
    recentMaterials,
    upcomingPickups,
    recentNotifications,
    recentReservations,
  ] = await Promise.all([
    supplierRepository.countMaterialsByStatus(userId),
    supplierRepository.countReservationsByStatus(userId),
    supplierRepository.aggregateReusedMaterials(userId),
    supplierRepository.aggregateSupplierReviews(userId),
    supplierRepository.countUnreadNotifications(userId),
    supplierRepository.findRecentMaterials(userId),
    supplierRepository.findUpcomingPickups(userId),
    supplierRepository.findRecentNotifications(userId),
    supplierRepository.findRecentReservationsForActivity(userId),
  ]);

  const materialStats =
    supplierRepository.foldMaterialStatusCounts(materialGroups);
  const reservationStats =
    supplierRepository.foldReservationStatusCounts(reservationGroups);

  const stats = {
    materials: materialStats,
    reservations: reservationStats,
    impact: {
      reusedMaterials: reusedAggregate._count._all,
      reusedQuantity: supplierRepository.sumReusedQuantity(reusedAggregate),
    },
    reviews: {
      averageRating: reviewAggregate._avg.rating ?? 0,
      totalReviews: reviewAggregate._count._all,
    },
    notifications: {
      unread: unreadNotifications,
    },
  };

  const recentMaterialsDto = recentMaterials.map((material) => ({
    id: material.id,
    title: material.title,
    status: material.status,
    quantity:
      typeof material.quantity === 'number'
        ? material.quantity
        : material.quantity.toNumber(),
    unit: material.unit,
    viewsCount: material.viewsCount,
    categoryName: material.category?.nameEn ?? null,
    coverImageUrl: material.images[0]?.imageUrl ?? null,
    createdAt: material.createdAt.toISOString(),
  }));

  const upcomingPickupsDto = upcomingPickups.map((pickup) => ({
    id: pickup.id,
    materialTitle: pickup.material.title,
    requesterName: pickup.requester.displayName,
    quantityRequested:
      typeof pickup.quantityRequested === 'number'
        ? pickup.quantityRequested
        : pickup.quantityRequested.toNumber(),
    pickupWindowStart: pickup.pickupWindowStart?.toISOString() ?? null,
    pickupWindowEnd: pickup.pickupWindowEnd?.toISOString() ?? null,
  }));

  const recentActivity = buildRecentActivity(
    recentNotifications,
    recentReservations,
  );

  if (!supplierProfile) {
    return {
      hasSupplierProfile: false,
      message: MISSING_PROFILE_MESSAGE,
      stats,
      recentMaterials: recentMaterialsDto,
      upcomingPickups: upcomingPickupsDto,
      recentActivity,
    };
  }

  const defaultLocation = supplierProfile.defaultPickupLocation
    ? {
        id: supplierProfile.defaultPickupLocation.id,
        city: supplierProfile.defaultPickupLocation.city,
        area: supplierProfile.defaultPickupLocation.area,
        visibility: supplierProfile.defaultPickupLocation.visibility,
        isApproximate: supplierProfile.defaultPickupLocation.isApproximate,
      }
    : null;

  const organization = supplierProfile.organizationProfile
    ? {
        organizationName:
          supplierProfile.organizationProfile.organizationName,
        organizationType:
          supplierProfile.organizationProfile.organizationType,
      }
    : null;

  return {
    hasSupplierProfile: true,
    supplier: {
      id: supplierProfile.id,
      userId: supplierProfile.userId,
      publicName: supplierProfile.publicName ?? '',
      supplierType: supplierProfile.supplierType ?? '',
      description: supplierProfile.description,
      verificationStatus: normalizeVerificationStatus(
        supplierProfile.verificationStatus,
      ),
      defaultLocation,
      organization,
    },
    stats,
    recentMaterials: recentMaterialsDto,
    upcomingPickups: upcomingPickupsDto,
    recentActivity,
  };
};

export const createSupplierMaterial = async (
  userId: string,
  input: CreateSupplierMaterialInput,
) => {
  const supplierProfile =
    await supplierRepository.findSupplierProfileForMaterialCreate(userId);

  if (!supplierProfile) {
    throw new AppError(MISSING_PROFILE_MESSAGE, 400, 'VALIDATION_ERROR');
  }

  if (!supplierProfile.defaultPickupLocationId) {
    throw new AppError(
      MISSING_PICKUP_LOCATION_MESSAGE,
      400,
      'VALIDATION_ERROR',
    );
  }

  await assertSourceRequestPublishable(userId, input);
  const sourceType = deriveMaterialSourceType(supplierProfile.supplierType);

  const requestedCategory = await categoriesRepository.findCategoryById(
    input.categoryId,
  );

  if (!requestedCategory) {
    throw new AppError('Category not found', 404, 'NOT_FOUND');
  }

  const requestedOtherCategory = categoriesRepository.isOtherCategory(
    requestedCategory.nameEn,
  );
  const materialName = input.materialName.trim();

  if (input.isFree) {
    if (input.price != null && input.price > 0) {
      throw new AppError(
        'Free listings cannot include a price.',
        400,
        'VALIDATION_ERROR',
      );
    }

    const resolved = await resolveMaterialReferenceForCreate({
      materialName,
      categoryId: input.categoryId,
      isFree: true,
    });

    const matchedType = resolved.materialType;
    const displayMaterialType = matchedType?.nameEn ?? materialName;

    const material = await supplierRepository.createSupplierMaterial({
      ownerId: userId,
      supplierProfileId: supplierProfile.id,
      categoryId: matchedType?.categoryId ?? input.categoryId,
      locationId: supplierProfile.defaultPickupLocationId,
      title: input.title,
      description: input.description,
      materialType: displayMaterialType,
      materialTypeId: matchedType?.id ?? null,
      customMaterialType: matchedType ? null : materialName,
      quantity: input.quantity,
      unit: input.unit,
      condition: input.condition,
      sourceType,
      isFree: true,
      price: null,
      currency: 'NIS',
      pickupAllowed: input.pickupAllowed,
      deliveryAllowed: false,
      pickupNotes: input.pickupNotes ?? null,
      suggestedUses: input.suggestedUses ?? null,
      imageUrls: input.imageUrls,
    });

    await markSourceRequestPublished(material.id, input);

    return mapCreatedMaterial(material);
  }

  if (requestedOtherCategory) {
    throw new AppError(
      'Paid listings need a reviewed category/material. Submit this material for review before publishing.',
      400,
      'VALIDATION_ERROR',
      { reason: 'PAID_OTHER_NOT_ALLOWED' },
    );
  }

  const resolved = await resolveMaterialReferenceForCreate({
    materialName,
    categoryId: input.categoryId,
    isFree: false,
  });

  const materialType = resolved.materialType;

  if (!materialType) {
    throw new AppError(
      'We could not verify this paid material yet. Submit it for review.',
      400,
      'VALIDATION_ERROR',
      { reason: 'MATERIAL_REVIEW_REQUIRED' },
    );
  }

  const priceCheck = await checkMaterialPrice({
    isFree: false,
    categoryId: materialType.categoryId,
    materialName,
    condition: input.condition,
    quantity: input.quantity,
    unit: input.unit,
    price: input.price,
    currency: input.currency,
  });

  if (!priceCheck.allowed) {
    throw new AppError(priceCheck.message, 400, 'VALIDATION_ERROR', {
      reason: priceCheck.reason,
      maxAllowedPrice: priceCheck.maxAllowedPrice,
      matchedReference: priceCheck.matchedReference,
      candidates: priceCheck.candidates,
      approvedUnit: priceCheck.approvedUnit,
    });
  }

  const material = await supplierRepository.createSupplierMaterial({
    ownerId: userId,
    supplierProfileId: supplierProfile.id,
    categoryId: materialType.categoryId,
    locationId: supplierProfile.defaultPickupLocationId,
    title: input.title,
    description: input.description,
    materialType: materialType.nameEn,
    materialTypeId: materialType.id,
    customMaterialType: null,
    quantity: input.quantity,
    unit: input.unit,
    condition: input.condition,
    sourceType,
    isFree: false,
    price: input.price,
    currency: 'NIS',
    pickupAllowed: input.pickupAllowed,
    deliveryAllowed: false,
    pickupNotes: input.pickupNotes ?? null,
    suggestedUses: input.suggestedUses ?? null,
    priceRuleId: priceCheck.priceRuleId ?? null,
    priceCheckedAt: new Date(),
    maxAllowedPriceAtCheck: priceCheck.maxAllowedPrice ?? null,
    imageUrls: input.imageUrls,
  });

  await markSourceRequestPublished(material.id, input);

  return mapCreatedMaterial(material);
};

export const getEmptySupplierDashboard = (): SupplierDashboardDto => ({
  hasSupplierProfile: false,
  message: MISSING_PROFILE_MESSAGE,
  stats: emptyDashboardStats(),
  recentMaterials: [],
  upcomingPickups: [],
  recentActivity: [],
});

const mapLocation = (location: {
  id: string;
  country: string;
  city: string;
  area: string | null;
  addressLine: string | null;
  latitude: { toNumber(): number } | number | null;
  longitude: { toNumber(): number } | number | null;
  visibility: string | null;
  isApproximate: boolean;
  locationType: string | null;
} | null): SupplierProfileLocationDto | null => {
  if (!location) {
    return null;
  }

  return {
    id: location.id,
    country: location.country,
    city: location.city,
    area: location.area,
    addressLine: location.addressLine,
    latitude:
      location.latitude == null
        ? null
        : typeof location.latitude === 'number'
          ? location.latitude
          : location.latitude.toNumber(),
    longitude:
      location.longitude == null
        ? null
        : typeof location.longitude === 'number'
          ? location.longitude
          : location.longitude.toNumber(),
    visibility: location.visibility,
    isApproximate: location.isApproximate,
    locationType: location.locationType,
  };
};

const mapOrganizationProfile = (organization: {
  id: string;
  organizationName: string;
  organizationType: string;
  contactPersonName: string | null;
  workingDays: unknown;
  workingHours: unknown;
  verificationDocumentStatus: string | null;
  businessLocation: {
    id: string;
    country: string;
    city: string;
    area: string | null;
    addressLine: string | null;
    latitude: { toNumber(): number } | number | null;
    longitude: { toNumber(): number } | number | null;
    visibility: string | null;
    isApproximate: boolean;
    locationType: string | null;
  } | null;
} | null): SupplierOrganizationProfileDto | null => {
  if (!organization) {
    return null;
  }

  return {
    id: organization.id,
    organizationName: organization.organizationName,
    organizationType: organization.organizationType,
    contactPersonName: organization.contactPersonName,
    workingDays: organization.workingDays,
    workingHours: organization.workingHours,
    verificationDocumentStatus: organization.verificationDocumentStatus,
    businessLocation: mapLocation(organization.businessLocation),
  };
};

const mapSupplierProfile = (supplierProfile: {
  id: string;
  publicName: string | null;
  supplierType: string | null;
  description: string | null;
  verificationStatus: string;
  defaultPickupLocation: {
    id: string;
    country: string;
    city: string;
    area: string | null;
    addressLine: string | null;
    latitude: { toNumber(): number } | number | null;
    longitude: { toNumber(): number } | number | null;
    visibility: string | null;
    isApproximate: boolean;
    locationType: string | null;
  } | null;
  organizationProfile: {
    id: string;
    organizationName: string;
    organizationType: string;
    contactPersonName: string | null;
    workingDays: unknown;
    workingHours: unknown;
    verificationDocumentStatus: string | null;
    businessLocation: {
      id: string;
      country: string;
      city: string;
      area: string | null;
      addressLine: string | null;
      latitude: { toNumber(): number } | number | null;
      longitude: { toNumber(): number } | number | null;
      visibility: string | null;
      isApproximate: boolean;
      locationType: string | null;
    } | null;
  } | null;
}): SupplierProfileDetailsDto => {
  return {
    id: supplierProfile.id,
    publicName: supplierProfile.publicName ?? '',
    supplierType: supplierProfile.supplierType ?? '',
    description: supplierProfile.description,
    verificationStatus: supplierProfile.verificationStatus,
    defaultPickupLocation: mapLocation(supplierProfile.defaultPickupLocation),
    organizationProfile: mapOrganizationProfile(
      supplierProfile.organizationProfile,
    ),
  };
};

const mapSupplierProfileResponse = (record: Awaited<
  ReturnType<typeof supplierRepository.findSupplierProfileDetailsByUserId>
>): SupplierProfileResponseDto => {
  if (!record) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  return {
    hasSupplierProfile: record.supplierProfile !== null,
    user: {
      id: record.id,
      displayName: record.displayName,
      email: record.email,
      profileImageUrl: record.profileImageUrl,
    },
    supplier: record.supplierProfile
      ? mapSupplierProfile(record.supplierProfile)
      : null,
  };
};

export const getSupplierProfile = async (
  userId: string,
): Promise<SupplierProfileResponseDto> => {
  const record = await supplierRepository.findSupplierProfileDetailsByUserId(
    userId,
  );

  return mapSupplierProfileResponse(record);
};

export const updateSupplierProfile = async (
  userId: string,
  input: UpdateSupplierProfileInput,
): Promise<SupplierProfileResponseDto> => {
  const record = await supplierRepository.upsertSupplierProfileDetails(
    userId,
    input,
  );

  return mapSupplierProfileResponse(record);
};

export type SupplierMaterialDeleteBlockedReason =
  | 'REUSED_HISTORY'
  | 'ACTIVE_REQUESTS';

export const DELETE_REUSED_MATERIAL_MESSAGE =
  'Cannot delete reused material history.';

export const DELETE_ACTIVE_REQUESTS_MESSAGE =
  'Cannot delete a material with active requests.';

export const resolveSupplierMaterialDeleteEligibility = (
  status: string,
  blockingReservationCount: number,
): {
  canDelete: boolean;
  deleteBlockedReason: SupplierMaterialDeleteBlockedReason | null;
} => {
  if (status === 'REUSED') {
    return { canDelete: false, deleteBlockedReason: 'REUSED_HISTORY' };
  }

  if (status === 'PENDING_RESERVATION' || status === 'RESERVED') {
    return { canDelete: false, deleteBlockedReason: 'ACTIVE_REQUESTS' };
  }

  if (status !== 'AVAILABLE' && status !== 'UNAVAILABLE') {
    return { canDelete: false, deleteBlockedReason: 'ACTIVE_REQUESTS' };
  }

  if (blockingReservationCount > 0) {
    return { canDelete: false, deleteBlockedReason: 'ACTIVE_REQUESTS' };
  }

  return { canDelete: true, deleteBlockedReason: null };
};

type SupplierOwnedMaterialRecord = Awaited<
  ReturnType<typeof supplierRepository.findSupplierMaterials>
>['items'][number];

const mapSupplierOwnedMaterial = (
  material: SupplierOwnedMaterialRecord,
  blockingReservationCount = 0,
) => ({
  id: material.id,
  title: material.title,
  description: material.description,
  category: material.category
    ? {
        id: material.category.id,
        nameEn: material.category.nameEn,
        nameAr: material.category.nameAr,
      }
    : null,
  materialType: material.materialType,
  status: material.status,
  condition: material.condition,
  quantity:
    typeof material.quantity === 'number'
      ? material.quantity
      : material.quantity.toNumber(),
  unit: material.unit,
  isFree: material.isFree,
  price: decimalToNumber(material.price),
  currency: material.currency,
  location: {
    city: material.location.city,
    area: material.location.area,
    addressLine: material.location.addressLine,
  },
  pickupAllowed: material.pickupAllowed,
  deliveryAllowed: material.deliveryAllowed,
  pickupNotes: material.pickupNotes,
  suggestedUses: material.suggestedUses,
  images: material.images.map((image) => ({
    imageUrl: image.imageUrl,
    isCover: image.isCover,
    sortOrder: image.sortOrder,
  })),
  viewsCount: material.viewsCount,
  createdAt: material.createdAt.toISOString(),
  updatedAt: material.updatedAt.toISOString(),
  ...resolveSupplierMaterialDeleteEligibility(
    material.status,
    blockingReservationCount,
  ),
});

export const getSupplierMaterials = async (
  userId: string,
  query: SupplierMaterialsQuery,
) => {
  const [result, summary, categories] = await Promise.all([
    supplierRepository.findSupplierMaterials(userId, query),
    supplierRepository.findSupplierMaterialsSummary(userId),
    supplierRepository.findSupplierMaterialCategories(userId),
  ]);

  const blockingReservationCounts =
    await supplierRepository.countBlockingReservationsByMaterialIds(
      result.items.map((item) => item.id),
    );

  const totalPages =
    result.total === 0 ? 0 : Math.ceil(result.total / query.limit);

  return {
    items: result.items.map((item) =>
      mapSupplierOwnedMaterial(
        item,
        blockingReservationCounts.get(item.id) ?? 0,
      ),
    ),
    pagination: {
      page: query.page,
      limit: query.limit,
      totalItems: result.total,
      totalPages,
    },
    summary,
    categoryFacets: categories,
    categories,
  };
};

export const getSupplierMaterial = async (userId: string, materialId: string) => {
  const material = await supplierRepository.findSupplierOwnedMaterialById(
    userId,
    materialId,
  );

  if (!material) {
    throw new AppError('Material not found', 404, 'NOT_FOUND');
  }

  const blockingReservationCount =
    await supplierRepository.countBlockingReservationsForMaterial(materialId);

  return mapSupplierOwnedMaterial(material, blockingReservationCount);
};

export const updateSupplierMaterial = async (
  userId: string,
  materialId: string,
  input: UpdateSupplierMaterialInput,
) => {
  const updated = await supplierRepository.updateSupplierOwnedMaterial(
    userId,
    materialId,
    {
      title: input.title,
      description: input.description,
      quantity: input.quantity,
      unit: input.unit,
      condition: input.condition,
      pickupAllowed: input.pickupAllowed,
      deliveryAllowed: input.deliveryAllowed,
      pickupNotes: input.pickupNotes ?? null,
      suggestedUses: input.suggestedUses ?? null,
    },
  );

  if (!updated) {
    throw new AppError('Material not found', 404, 'NOT_FOUND');
  }

  const blockingReservationCount =
    await supplierRepository.countBlockingReservationsForMaterial(materialId);

  return mapSupplierOwnedMaterial(updated, blockingReservationCount);
};

export const deleteSupplierMaterial = async (
  userId: string,
  materialId: string,
) => {
  const material = await supplierRepository.findSupplierOwnedMaterialById(
    userId,
    materialId,
  );

  if (!material) {
    throw new AppError('Material not found', 404, 'NOT_FOUND');
  }

  const blockingReservationCount =
    await supplierRepository.countBlockingReservationsForMaterial(materialId);
  const eligibility = resolveSupplierMaterialDeleteEligibility(
    material.status,
    blockingReservationCount,
  );

  if (!eligibility.canDelete) {
    throw new AppError(
      eligibility.deleteBlockedReason === 'REUSED_HISTORY'
        ? DELETE_REUSED_MATERIAL_MESSAGE
        : DELETE_ACTIVE_REQUESTS_MESSAGE,
      409,
      'CONFLICT',
    );
  }

  await supplierRepository.deleteSupplierOwnedMaterial(materialId);
};
