import type {
  SupplierOrganizationProfileDto,
  SupplierProfileDetailsDto,
  SupplierProfileLocationDto,
  SupplierProfileManagementResponseDto,
  SupplierProfileResponseDto,
} from "./dto/supplier-profile.dto.js";
import { COMMON_ERROR_CODES } from "../../contracts/errors/common-error-codes.js";
import {
  buildSupplierManagementVerification,
  calculateSupplierEssentialsCompletion,
  normalizeWorkingDays,
  normalizeWorkingHours,
} from "./supplier-profile-management.js";
import { AppError } from "../../utils/app-error.js";
import { decimalToNumber } from "../../utils/decimal.js";
import { deleteReplacedProfileUpload } from "../uploads/local-upload-cleanup.js";
import * as supplierRepository from "./supplier.repository.js";
import { normalizeVerificationStatus } from "./dto/supplier-dashboard.dto.js";
import { resolveSupplierContext } from "./supplier-material-scope.js";
import type {
  SupplierFollowersQuery,
  UpdateSupplierProfileImagesInput,
  UpdateSupplierProfileInput,
} from "./supplier.validation.js";

const mapLocation = (
  location: {
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
  } | null,
): SupplierProfileLocationDto | null => {
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
        : typeof location.latitude === "number"
          ? location.latitude
          : location.latitude.toNumber(),
    longitude:
      location.longitude == null
        ? null
        : typeof location.longitude === "number"
          ? location.longitude
          : location.longitude.toNumber(),
    visibility: location.visibility,
    isApproximate: location.isApproximate,
    locationType: location.locationType,
  };
};

const mapOrganizationProfile = (
  organization: {
    id: string;
    organizationName: string;
    organizationType: string;
    contactPersonName: string | null;
    workingDays: unknown;
    workingHours: unknown;
    verificationDocumentStatus: string | null;
    verificationDocumentUrl: string | null;
    verificationDocumentName: string | null;
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
  } | null,
): SupplierOrganizationProfileDto | null => {
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
    verificationDocumentUrl: organization.verificationDocumentUrl,
    verificationDocumentName: organization.verificationDocumentName,
    businessLocation: mapLocation(organization.businessLocation),
  };
};

const resolveSupplierVerificationAdminNote = (
  verificationStatus: string,
  adminNote: string | null | undefined,
): string | null => {
  const normalized = normalizeVerificationStatus(verificationStatus);

  if (normalized !== "REJECTED" && normalized !== "CHANGES_REQUESTED") {
    return null;
  }

  const trimmed = adminNote?.trim();
  return trimmed ? trimmed : null;
};

const mapSupplierProfile = (supplierProfile: {
  id: string;
  publicName: string | null;
  supplierType: string | null;
  description: string | null;
  coverImageUrl: string | null;
  avatarImageUrl: string | null;
  verificationStatus: string;
  verificationAdminNote?: string | null;
  verificationReviewedAt?: Date | null;
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
    verificationDocumentUrl: string | null;
    verificationDocumentName: string | null;
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
    publicName: supplierProfile.publicName ?? "",
    supplierType: supplierProfile.supplierType ?? "",
    description: supplierProfile.description,
    coverImageUrl: supplierProfile.coverImageUrl,
    avatarImageUrl: supplierProfile.avatarImageUrl,
    verificationStatus: normalizeVerificationStatus(
      supplierProfile.verificationStatus,
    ),
    verificationAdminNote: resolveSupplierVerificationAdminNote(
      supplierProfile.verificationStatus,
      supplierProfile.verificationAdminNote,
    ),
    verificationReviewedAt:
      supplierProfile.verificationReviewedAt?.toISOString() ?? null,
    defaultPickupLocation: mapLocation(supplierProfile.defaultPickupLocation),
    organizationProfile: mapOrganizationProfile(
      supplierProfile.organizationProfile,
    ),
  };
};

const mapSupplierProfileResponse = (
  record: Awaited<
    ReturnType<typeof supplierRepository.findSupplierProfileDetailsByUserId>
  >,
  extras: {
    stats: SupplierProfileResponseDto['stats'];
    latestFollowers: SupplierProfileResponseDto['latestFollowers'];
    materialsPreview: SupplierProfileResponseDto['materialsPreview'];
  },
): SupplierProfileResponseDto => {
  if (!record) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
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
    stats: extras.stats,
    latestFollowers: extras.latestFollowers,
    materialsPreview: extras.materialsPreview,
  };
};

export const getSupplierProfile = async (
  userId: string,
): Promise<SupplierProfileResponseDto> => {
  const scope = await resolveSupplierContext(userId);
  const record =
    await supplierRepository.findSupplierProfileDetailsByUserId(userId);

  const supplierProfileId = scope.supplierProfileId;

  const [
    materialsSummary,
    totalReservations,
    totalLikes,
    totalViews,
    latestFollowers,
    materialsPreview,
  ] = await Promise.all([
    supplierRepository.findSupplierMaterialsSummary(scope),
    supplierRepository.countSupplierReservationsTotal(userId),
    supplierRepository.countTotalLikesForSupplier(scope),
    supplierRepository.countTotalViewsForSupplier(scope),
    supplierProfileId
      ? supplierRepository.listLatestSupplierFollowers(supplierProfileId, 5)
      : Promise.resolve([]),
    supplierRepository.findSupplierMaterialsPreview(scope, 4),
  ]);

  const previewIds = materialsPreview.map((material) => material.id);
  const [likesByMaterial, viewsByMaterial, reservationsByMaterial, followersCount] =
    await Promise.all([
      supplierRepository.countLikesByMaterialIds(previewIds),
      supplierRepository.countViewsByMaterialIds(previewIds),
      supplierRepository.countReservationsByMaterialIds(previewIds),
      supplierProfileId
        ? supplierRepository.countSupplierFollowers(supplierProfileId)
        : Promise.resolve(0),
    ]);

  const materialsPreviewDto = materialsPreview.map((material) => ({
    id: material.id,
    title: material.title,
    imageUrl: material.images[0]?.imageUrl ?? null,
    category: material.category
      ? {
          id: material.category.id,
          nameEn: material.category.nameEn,
          nameAr: material.category.nameAr,
        }
      : null,
    status: material.status,
    condition: material.condition,
    isFree: material.isFree,
    price: decimalToNumber(material.price),
    currency: material.currency,
    quantity:
      typeof material.quantity === 'number'
        ? material.quantity
        : material.quantity.toNumber(),
    unit: material.unit,
    location: material.location
      ? {
          city: material.location.city,
          area: material.location.area,
        }
      : null,
    pickupNotes: material.pickupNotes,
    pickupAllowed: material.pickupAllowed,
    deliveryAllowed: material.deliveryAllowed,
    createdAt: material.createdAt.toISOString(),
    viewsCount: viewsByMaterial.get(material.id) ?? 0,
    likesCount: likesByMaterial.get(material.id) ?? 0,
    reservationsCount: reservationsByMaterial.get(material.id) ?? 0,
  }));

  const latestFollowersDto = latestFollowers.map((row) => ({
    user: {
      id: row.followerUser.id,
      displayName: row.followerUser.displayName,
      email: row.followerUser.email,
      profileImageUrl: row.followerUser.profileImageUrl,
    },
    followedAt: row.createdAt.toISOString(),
  }));

  const stats = {
    materialsCount: materialsSummary.total,
    availableMaterialsCount: materialsSummary.available,
    reusedMaterialsCount: materialsSummary.reused,
    followersCount,
    totalViews,
    totalLikes,
    totalReservations,
  };

  return mapSupplierProfileResponse(record, {
    stats,
    latestFollowers: latestFollowersDto,
    materialsPreview: materialsPreviewDto,
  });
};

export const getSupplierProfileManagement = async (
  userId: string,
): Promise<SupplierProfileManagementResponseDto> => {
  const record =
    await supplierRepository.findSupplierProfileManagementByUserId(userId);

  return {
    hasSupplierProfile: record !== null,
    identity: record
      ? {
          supplierProfileId: record.id,
          publicName: record.publicName ?? '',
          supplierType: record.supplierType ?? '',
          description: record.description,
          avatarImageUrl: record.avatarImageUrl,
          coverImageUrl: record.coverImageUrl,
        }
      : null,
    pickupLocation: record ? mapLocation(record.defaultPickupLocation) : null,
    organization: record?.organizationProfile
      ? {
          id: record.organizationProfile.id,
          organizationName: record.organizationProfile.organizationName,
          organizationType: record.organizationProfile.organizationType,
          contactPersonName: record.organizationProfile.contactPersonName,
          workingDays: normalizeWorkingDays(record.organizationProfile.workingDays),
          workingHours: normalizeWorkingHours(record.organizationProfile.workingHours),
        }
      : null,
    verification: buildSupplierManagementVerification({
      rawStatus: record?.verificationStatus ?? 'NOT_REQUIRED',
      supplierType: record?.supplierType,
      adminNote: record?.verificationAdminNote,
      submittedAt: record?.verificationSubmittedAt,
      reviewedAt: record?.verificationReviewedAt,
    }),
    completion: calculateSupplierEssentialsCompletion({
      publicName: record?.publicName,
      supplierType: record?.supplierType,
      description: record?.description,
      pickupLocation: record?.defaultPickupLocation,
    }),
  };
};

export const getSupplierProfileFollowers = async (
  userId: string,
  query: SupplierFollowersQuery,
) => {
  const record =
    await supplierRepository.findSupplierProfileDetailsByUserId(userId);
  const supplierProfileId = record?.supplierProfile?.id ?? null;

  if (!supplierProfileId) {
    return {
      items: [],
      pagination: {
        page: query.page,
        limit: query.limit,
        total: 0,
        totalPages: 0,
      },
    };
  }

  const result = await supplierRepository.listSupplierFollowers({
    supplierProfileId,
    page: query.page,
    limit: query.limit,
  });

  const totalPages =
    result.total === 0 ? 0 : Math.ceil(result.total / query.limit);

  return {
    items: result.items.map((row) => ({
      user: {
        id: row.followerUser.id,
        displayName: row.followerUser.displayName,
        email: row.followerUser.email,
        profileImageUrl: row.followerUser.profileImageUrl,
      },
      followedAt: row.createdAt.toISOString(),
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages,
    },
  };
};

export const updateSupplierProfile = async (
  userId: string,
  input: UpdateSupplierProfileInput,
): Promise<SupplierProfileResponseDto> => {
  await supplierRepository.upsertSupplierProfileDetails(userId, input);
  return getSupplierProfile(userId);
};

export const updateSupplierProfileImages = async (
  userId: string,
  input: UpdateSupplierProfileImagesInput,
): Promise<SupplierProfileResponseDto> => {
  const existing =
    await supplierRepository.findSupplierProfileDetailsByUserId(userId);
  if (!existing) {
    throw new AppError(
      'Create your supplier profile first.',
      404,
      COMMON_ERROR_CODES.notFound,
    );
  }

  await supplierRepository.updateSupplierProfileImages(userId, input);

  if (input.avatarImageUrl !== undefined) {
    deleteReplacedProfileUpload(
      existing.supplierProfile?.avatarImageUrl,
      input.avatarImageUrl,
    );
  }

  if (input.coverImageUrl !== undefined) {
    deleteReplacedProfileUpload(
      existing.supplierProfile?.coverImageUrl,
      input.coverImageUrl,
    );
  }

  return getSupplierProfile(userId);
};
