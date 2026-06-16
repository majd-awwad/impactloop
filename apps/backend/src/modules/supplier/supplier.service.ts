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
import * as supplierRepository from './supplier.repository.js';
import type { UpdateSupplierProfileInput } from './supplier.validation.js';

const MISSING_PROFILE_MESSAGE =
  'Complete your supplier profile to start listing materials.';

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
