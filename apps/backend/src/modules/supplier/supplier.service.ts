import type {
  RecentActivityDto,
  SupplierDashboardDto,
} from "./dto/supplier-dashboard.dto.js";
import type {
  SupplierOrganizationProfileDto,
  SupplierProfileDetailsDto,
  SupplierProfileLocationDto,
  SupplierProfileResponseDto,
  SupplierProfileManagementResponseDto,
} from "./dto/supplier-profile.dto.js";

import {
  emptyDashboardStats,
  emptyProjectSupportStats,
  normalizeVerificationStatus,
} from "./dto/supplier-dashboard.dto.js";
import { getSupplierProjectSupportSummary } from "./supplier-project-impact.js";
import {
  buildSupplierManagementVerification,
  calculateSupplierEssentialsCompletion,
  normalizeWorkingDays,
  normalizeWorkingHours,
} from './supplier-profile-management.js';

import { AppError } from "../../utils/app-error.js";
import { env } from "../../config/env.js";
import { prisma } from "../../database/prisma.js";
import { decimalToNumber } from "../../utils/decimal.js";
import { createNotification } from "../notifications/notifications.repository.js";
import type { Prisma } from "../../generated/prisma/client.js";
import * as categoriesRepository from "../categories/categories.repository.js";
import * as categoryRequestsRepository from "../category-requests/category-requests.repository.js";
import * as priceRuleRequestsRepository from "../price-rule-requests/price-rule-requests.repository.js";
import { evaluateApprovedPriceRuleRequest } from "../price-rule-requests/price-rule-request-pricing.js";
import {
  checkMaterialPrice,
  calculateMaxAllowedPrice,
  resolveMaterialReferenceForCreate,
} from "../materials/materials.service.js";
import * as materialTypesRepository from "../material-types/material-types.repository.js";
import { matchMaterialReference } from "../../services/material-reference-matching.service.js";
import {
  runIdempotentOperation,
  SUPPLIER_CREATE_MATERIAL_SCOPE,
} from "../../services/idempotency.service.js";
import * as supplierRepository from "./supplier.repository.js";
import { computeMaterialDemandMetrics } from "./supplier.material-demand-metrics.js";
import { mapReservationFulfillmentLabel } from "../reservations/reservation-delivery.js";
import { TaxonomyFoundationRepository } from "../taxonomy/taxonomy-foundation.repository.js";
import {
  projectLoadedConceptsForAssignment,
  resolveFreeMaterialConceptIds,
} from "../taxonomy/material-concept-assignment-publish.js";
import { applyConditionPriceMultiplier } from "../../constants/material-condition-factors.js";
import {
  assertCanMarkMaterialUnavailable,
  assertCanRestoreMaterial,
  getMaterialModerationPolicy,
} from "../admin-materials/admin-materials.moderation-policy.js";
import {
  buildSupplierMaterialWhere,
  resolveSupplierContext,
} from "./supplier-material-scope.js";
import { assertSupplierCanPublishMaterials } from "../supplier-verification/supplier-verification.service.js";
import {
  computeAvailableQuantity,
  getHeldQuantitiesByMaterialIds,
  toDecimal,
} from "../reservations/reservations.quantity.js";
import type {
  CreateSupplierMaterialInput,
  SupplierFollowersQuery,
  SupplierMaterialsQuery,
  UpdateSupplierMaterialInput,
  UpdateSupplierProfileInput,
  UpdateSupplierProfileImagesInput,
} from "./supplier.validation.js";

const MISSING_PROFILE_MESSAGE =
  "Complete your supplier profile to start listing materials.";

const MISSING_PICKUP_LOCATION_MESSAGE =
  "Add a default pickup location before listing materials.";

const ORG_PICKUP_OVERRIDE_MESSAGE =
  "Organization suppliers must use the profile pickup location for all listings.";

const SOURCE_REQUEST_CONSUMED_MESSAGE =
  "This listing was already completed.";

type SupplierProfileForMaterialCreate = NonNullable<
  Awaited<
    ReturnType<typeof supplierRepository.findSupplierProfileForMaterialCreate>
  >
>;

const assertOrganizationPickupPolicy = (
  input: CreateSupplierMaterialInput,
  supplierType: string | null,
) => {
  if (!supplierRepository.isOrganizationSupplierType(supplierType ?? "")) {
    return;
  }

  const useDefaultPickupLocation = input.useDefaultPickupLocation ?? true;

  if (!useDefaultPickupLocation || input.pickupLocation != null) {
    throw new AppError(ORG_PICKUP_OVERRIDE_MESSAGE, 400, "VALIDATION_ERROR", {
      reason: "ORG_PICKUP_OVERRIDE_NOT_ALLOWED",
    });
  }
};

const resolveMaterialPickupLocationId = async (
  supplierProfile: SupplierProfileForMaterialCreate,
  input: CreateSupplierMaterialInput,
  tx?: Prisma.TransactionClient,
): Promise<string> => {
  const defaultLocation = supplierProfile.defaultPickupLocation;
  const useDefaultPickupLocation = input.useDefaultPickupLocation ?? true;

  if (!defaultLocation || !supplierProfile.defaultPickupLocationId) {
    throw new AppError(
      MISSING_PICKUP_LOCATION_MESSAGE,
      400,
      "VALIDATION_ERROR",
    );
  }

  assertOrganizationPickupPolicy(input, supplierProfile.supplierType);

  if (
    supplierRepository.isOrganizationSupplierType(
      supplierProfile.supplierType ?? "",
    )
  ) {
    return supplierRepository.copyLocationRow(
      defaultLocation,
      "MATERIAL_PICKUP",
      tx,
    );
  }

  if (useDefaultPickupLocation || !input.pickupLocation) {
    return supplierRepository.copyLocationRow(
      defaultLocation,
      "MATERIAL_PICKUP",
      tx,
    );
  }

  return supplierRepository.createMaterialPickupLocation(
    input.pickupLocation,
    tx,
  );
};

const deriveMaterialSourceType = (supplierType: string | null) => {
  switch (supplierType) {
    case "WORKSHOP":
      return "WORKSHOP_SURPLUS" as const;
    case "FACTORY":
      return "FACTORY_SURPLUS" as const;
    case "EDUCATIONAL_INSTITUTION":
      return "EDUCATIONAL_INSTITUTION" as const;
    case "INDIVIDUAL_SUPPLIER":
      // TODO: MVP fallback. Revisit when the source enum can distinguish individual suppliers.
      return "STUDENT_LEFTOVER" as const;
    case "STUDENT_SUPPLIER":
    default:
      return "STUDENT_LEFTOVER" as const;
  }
};

const assertSourceRequestPublishable = async (
  userId: string,
  input: CreateSupplierMaterialInput,
) => {
  if (input.sourceCategoryRequestId) {
    const request =
      await categoryRequestsRepository.findCategoryRequestByIdForOwner(
        input.sourceCategoryRequestId,
        userId,
      );

    if (!request) {
      throw new AppError("Category request not found", 404, "NOT_FOUND");
    }

    if (request.publishedMaterialId) {
      throw new AppError(
        "This listing was already completed.",
        409,
        "CONFLICT",
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
      throw new AppError("Price rule request not found", 404, "NOT_FOUND");
    }

    if (request.publishedMaterialId) {
      throw new AppError(
        "This listing was already completed.",
        409,
        "CONFLICT",
      );
    }

    if (!input.isFree && input.price != null) {
      const acceptance = evaluateApprovedPriceRuleRequest(
        request,
        input.price,
        input.condition,
      );
      if (acceptance.ok === false && acceptance.reason === "PRICE_TOO_HIGH") {
        const unit =
          request.unit ?? request.materialType?.defaultUnit ?? "unit";
        throw new AppError(
          `Maximum allowed price is ${acceptance.maxAllowed} NIS per ${unit}.`,
          400,
          "VALIDATION_ERROR",
          {
            maxAllowedPrice: acceptance.maxAllowed,
            approvedUnit: unit,
            reason: "PRICE_TOO_HIGH",
          },
        );
      }
    }
  }
};

type SourceRequestSnapshots = {
  categoryRequest?: {
    id: string;
    expectedUpdatedAt: Date;
    approvedCategoryId: string;
  };
  priceRuleRequest?: {
    id: string;
    expectedUpdatedAt: Date;
  };
};

const markSourceRequestPublished = async (
  userId: string,
  materialId: string,
  snapshots: SourceRequestSnapshots,
  tx: Prisma.TransactionClient,
) => {
  if (snapshots.categoryRequest) {
    const result = await categoryRequestsRepository.markCategoryRequestPublished(
      {
        id: snapshots.categoryRequest.id,
        materialId,
        requestedByUserId: userId,
        expectedUpdatedAt: snapshots.categoryRequest.expectedUpdatedAt,
        expectedApprovedCategoryId: snapshots.categoryRequest.approvedCategoryId,
        client: tx,
      },
    );
    if (result.count === 0) {
      throw new AppError(SOURCE_REQUEST_CONSUMED_MESSAGE, 409, "CONFLICT");
    }
  }

  if (snapshots.priceRuleRequest) {
    const result =
      await priceRuleRequestsRepository.markPriceRuleRequestPublished({
        id: snapshots.priceRuleRequest.id,
        materialId,
        requestedByUserId: userId,
        expectedUpdatedAt: snapshots.priceRuleRequest.expectedUpdatedAt,
        client: tx,
      });
    if (result.count === 0) {
      throw new AppError(SOURCE_REQUEST_CONSUMED_MESSAGE, 409, "CONFLICT");
    }
  }
};

const resolveCreateMaterialConceptIds = async (input: {
  client: Prisma.TransactionClient;
  finalCategoryId: string;
  finalMaterialType: string;
  finalTitle: string;
}): Promise<string[]> => {
  const taxonomyRepository = new TaxonomyFoundationRepository();
  const ownedCategory =
    await taxonomyRepository.findCategoryForMaterialConceptAssignment(
      input.finalCategoryId,
      input.client,
    );
  const loadedConcepts =
    await taxonomyRepository.loadMaterialConceptAssignmentConcepts(
      input.client,
    );

  if (!ownedCategory) {
    throw new AppError("Category not found", 404, "NOT_FOUND");
  }

  return resolveFreeMaterialConceptIds({
    category: {
      id: ownedCategory.id,
      categoryType: ownedCategory.categoryType,
      isActive: ownedCategory.isActive,
      materialFamilyConceptId: ownedCategory.materialFamilyConceptId,
      materialFamilyConcept: ownedCategory.materialFamilyConcept
        ? {
            id: ownedCategory.materialFamilyConcept.id,
            canonicalKey: ownedCategory.materialFamilyConcept.canonicalKey,
            conceptType: ownedCategory.materialFamilyConcept.conceptType,
            status: ownedCategory.materialFamilyConcept.status,
          }
        : null,
    },
    materialType: input.finalMaterialType,
    title: input.finalTitle,
    concepts: projectLoadedConceptsForAssignment(loadedConcepts),
  });
};

const resolvePaidMaterialTypeFromPrr = async (
  priceRuleRequest: NonNullable<
    Awaited<
      ReturnType<typeof priceRuleRequestsRepository.findPriceRuleRequestByIdForOwner>
    >
  >,
  materialName: string,
  categoryId: string,
  client: Prisma.TransactionClient,
) => {
  let materialType = priceRuleRequest.materialType?.id
    ? await materialTypesRepository.findMaterialTypeById(
        priceRuleRequest.materialType.id,
        client,
      )
    : null;
  if (!materialType?.isActive) {
    const matchResult = await matchMaterialReference({
      materialName,
      categoryId,
      client,
    });
    if (matchResult.status === "MATCHED") {
      materialType = await materialTypesRepository.findMaterialTypeById(
        matchResult.materialType.id,
        client,
      );
      if (!materialType?.isActive) {
        materialType = null;
      }
    } else {
      materialType = null;
    }
  }
  return materialType;
};

const resolveOrdinaryPaidMaterialTypeInTx = async (input: {
  client: Prisma.TransactionClient;
  materialName: string;
  categoryId: string;
}) => {
  const matchResult = await matchMaterialReference({
    materialName: input.materialName,
    categoryId: input.categoryId,
    client: input.client,
  });

  if (matchResult.status === "AMBIGUOUS") {
    throw new AppError(
      "This paid material needs admin price review before publishing.",
      400,
      "VALIDATION_ERROR",
      { reason: "MATERIAL_REVIEW_REQUIRED" },
    );
  }

  if (matchResult.status !== "MATCHED") {
    throw new AppError(
      "This paid material needs admin price review before publishing.",
      400,
      "VALIDATION_ERROR",
      { reason: "MATERIAL_REVIEW_REQUIRED" },
    );
  }

  const materialType = await materialTypesRepository.findMaterialTypeById(
    matchResult.materialType.id,
    input.client,
  );

  if (!materialType?.isActive) {
    throw new AppError(
      "This paid material needs admin price review before publishing.",
      400,
      "VALIDATION_ERROR",
      { reason: "MATERIAL_REVIEW_REQUIRED" },
    );
  }

  return materialType;
};

const assertOrdinaryPaidPriceAllowedInTx = async (input: {
  client: Prisma.TransactionClient;
  materialType: NonNullable<
    Awaited<ReturnType<typeof materialTypesRepository.findMaterialTypeById>>
  >;
  unit: string;
  quantity: number;
  condition: CreateSupplierMaterialInput["condition"];
  price: number | null | undefined;
  currency: string | undefined;
}) => {
  if (input.currency !== "NIS") {
    throw new AppError("Paid listings must use NIS.", 400, "VALIDATION_ERROR", {
      reason: "INVALID_CURRENCY",
    });
  }

  if (input.price == null || input.price <= 0) {
    throw new AppError(
      "Paid listings must have a price greater than zero.",
      400,
      "VALIDATION_ERROR",
      { reason: "INVALID_PRICE" },
    );
  }

  const { materialType } = input;
  if (!materialType.isActive) {
    throw new AppError(
      "This paid material needs admin price review before publishing.",
      400,
      "VALIDATION_ERROR",
      { reason: "MATERIAL_REVIEW_REQUIRED" },
    );
  }

  const activeRule =
    await materialTypesRepository.findActivePriceRuleForMaterialType(
      materialType.id,
      input.unit,
      input.client,
    );

  if (!activeRule) {
    const activeRuleForDifferentUnit =
      await materialTypesRepository.findActivePriceRuleForMaterialType(
        materialType.id,
        undefined,
        input.client,
      );

    if (activeRuleForDifferentUnit) {
      throw new AppError(
        "Please use the approved unit for this material.",
        400,
        "VALIDATION_ERROR",
        {
          reason: "UNIT_MISMATCH",
          approvedUnit: activeRuleForDifferentUnit.unit,
        },
      );
    }

    throw new AppError(
      "This material needs an active price reference before paid listing.",
      400,
      "VALIDATION_ERROR",
      { reason: "PRICE_RULE_REQUIRED" },
    );
  }

  const baseMaxPrice = calculateMaxAllowedPrice({
    maxAllowedUnitPriceNis: decimalToNumber(activeRule.maxAllowedUnitPriceNis),
    maxAllowedTotalPriceNis: decimalToNumber(activeRule.maxAllowedTotalPriceNis),
    quantity: input.quantity,
    condition: "NEW",
  });

  const maxAllowedPrice =
    baseMaxPrice == null
      ? null
      : applyConditionPriceMultiplier(baseMaxPrice, input.condition);

  if (maxAllowedPrice == null || baseMaxPrice == null) {
    throw new AppError(
      "This material has an invalid active price reference.",
      400,
      "VALIDATION_ERROR",
      { reason: "PRICE_RULE_INVALID" },
    );
  }

  if (input.price > maxAllowedPrice) {
    throw new AppError(
      `The entered price is above the recommended maximum for this condition. Base max: ${baseMaxPrice} NIS, condition: ${input.condition}, adjusted max: ${maxAllowedPrice} NIS.`,
      400,
      "VALIDATION_ERROR",
      {
        reason: "PRICE_TOO_HIGH",
        maxAllowedPrice,
        approvedUnit: activeRule.unit,
      },
    );
  }

  return {
    materialType,
    priceRuleId: activeRule.id,
    maxAllowedPrice,
  };
};

const assertCategoryRequestPublishableInTx = (
  request: {
    status: string;
    approvedCategoryId: string | null;
    publishedMaterialId: string | null;
  },
  finalCategoryId: string,
) => {
  if (request.publishedMaterialId) {
    throw new AppError(SOURCE_REQUEST_CONSUMED_MESSAGE, 409, "CONFLICT");
  }

  if (request.status !== "APPROVED") {
    throw new AppError(SOURCE_REQUEST_CONSUMED_MESSAGE, 409, "CONFLICT", {
      reason: "CATEGORY_REQUEST_NOT_APPROVED",
    });
  }

  if (request.approvedCategoryId == null) {
    throw new AppError(SOURCE_REQUEST_CONSUMED_MESSAGE, 409, "CONFLICT", {
      reason: "CATEGORY_REQUEST_MISSING_APPROVED_CATEGORY",
    });
  }

  if (request.approvedCategoryId !== finalCategoryId) {
    throw new AppError(SOURCE_REQUEST_CONSUMED_MESSAGE, 409, "CONFLICT", {
      reason: "CATEGORY_REQUEST_AUTHORITY_MISMATCH",
    });
  }
};

const mapCreatedMaterial = (
  material: Awaited<
    ReturnType<typeof supplierRepository.createSupplierMaterial>
  >,
) => ({
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

type CreatedSupplierMaterialDto = ReturnType<typeof mapCreatedMaterial>;

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
    type: "NOTIFICATION",
    title: item.title,
    body: item.body,
    createdAt: item.createdAt.toISOString(),
  }));

  const reservationItems: RecentActivityDto[] = reservations.map((item) => ({
    id: item.id,
    type: "RESERVATION",
    title: `Reservation ${item.status.toLowerCase()}`,
    body: item.material.title,
    createdAt: item.createdAt.toISOString(),
  }));

  return [...notificationItems, ...reservationItems]
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    )
    .slice(0, 3);
};

export const getSupplierDashboard = async (
  userId: string,
): Promise<SupplierDashboardDto> => {
  const scope = await resolveSupplierContext(userId);
  const supplierProfile = scope.supplierProfileId
    ? await supplierRepository.findSupplierProfileForDashboard(userId)
    : null;

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
    totalViews,
    totalLikes,
    followersCount,
    scheduledPickups,
    mostViewedMaterial,
    highDemandMaterials,
    projectSupport,
  ] = await Promise.all([
    supplierRepository.countMaterialsByStatus(scope),
    supplierRepository.countReservationsByStatus(userId),
    supplierRepository.aggregateReusedMaterials(scope),
    supplierRepository.aggregateSupplierReviews(userId),
    supplierRepository.countUnreadNotifications(userId),
    supplierRepository.findRecentMaterials(scope),
    supplierRepository.findUpcomingPickups(userId),
    supplierRepository.findRecentNotifications(userId),
    supplierRepository.findRecentReservationsForActivity(userId),
    supplierRepository.countTotalViewsForSupplier(scope),
    supplierRepository.countTotalLikesForSupplier(scope),
    scope.supplierProfileId
      ? supplierRepository.countSupplierFollowers(scope.supplierProfileId)
      : Promise.resolve(0),
    supplierRepository.countScheduledPickups(userId),
    supplierRepository.findMostViewedMaterial(scope),
    supplierRepository.findHighDemandMaterials(scope),
    getSupplierProjectSupportSummary(userId),
  ]);

  if (env.nodeEnv !== "production") {
    const [ownerCount, profileCount, scopedCount] = await Promise.all([
      prisma.material.count({ where: { ownerId: userId } }),
      scope.supplierProfileId
        ? prisma.material.count({
            where: { supplierProfileId: scope.supplierProfileId },
          })
        : Promise.resolve(0),
      prisma.material.count({ where: buildSupplierMaterialWhere(scope) }),
    ]);

    console.debug("[supplier-dashboard]", {
      userId,
      supplierProfileId: scope.supplierProfileId,
      ownerCount,
      profileCount,
      scopedCount,
      materialStatsTotal: supplierRepository.foldMaterialStatusCounts(materialGroups)
        .total,
    });
  }

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
    engagement: {
      totalViews,
      totalLikes,
      followersCount,
    },
    operational: {
      scheduledPickups,
      activeMaterials: materialStats.available,
    },
  };

  const recentReservationRequestsDto: SupplierDashboardDto['recentReservationRequests'] =
    [];

  const mostViewedMaterialDto =
    totalViews > 0 && mostViewedMaterial
      ? {
          id: mostViewedMaterial.material.id,
          title: mostViewedMaterial.material.title,
          status: mostViewedMaterial.material.status,
          categoryName: mostViewedMaterial.material.category?.nameEn ?? null,
          coverImageUrl:
            mostViewedMaterial.material.images[0]?.imageUrl ?? null,
          viewsCount: mostViewedMaterial.viewsCount,
          demandCount: 0,
        }
      : null;

  const highDemandMaterialIds = highDemandMaterials.map(
    ({ material }) => material.id,
  );
  const highDemandViewCounts =
    await supplierRepository.countViewsByMaterialIds(highDemandMaterialIds);

  const highDemandMaterialsDto = highDemandMaterials.map(
    ({ material, demandCount }) => ({
      id: material.id,
      title: material.title,
      status: material.status,
      categoryName: material.category?.nameEn ?? null,
      coverImageUrl: material.images[0]?.imageUrl ?? null,
      viewsCount: highDemandViewCounts.get(material.id) ?? 0,
      demandCount,
    }),
  );

  const recentMaterialsDto = recentMaterials.map((material) => ({
    id: material.id,
    title: material.title,
    status: material.status,
    quantity:
      typeof material.quantity === "number"
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
      typeof pickup.quantityRequested === "number"
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
      projectSupport,
      recentMaterials: recentMaterialsDto,
      upcomingPickups: upcomingPickupsDto,
      recentActivity,
      recentReservationRequests: recentReservationRequestsDto,
      mostViewedMaterial: mostViewedMaterialDto,
      highDemandMaterials: highDemandMaterialsDto,
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
        organizationName: supplierProfile.organizationProfile.organizationName,
        organizationType: supplierProfile.organizationProfile.organizationType,
      }
    : null;

  return {
    hasSupplierProfile: true,
    supplier: {
      id: supplierProfile.id,
      userId: supplierProfile.userId,
      publicName: supplierProfile.publicName ?? "",
      supplierType: supplierProfile.supplierType ?? "",
      description: supplierProfile.description,
      verificationStatus: normalizeVerificationStatus(
        supplierProfile.verificationStatus,
      ),
      defaultLocation,
      organization,
    },
    stats,
    projectSupport,
    recentMaterials: recentMaterialsDto,
    upcomingPickups: upcomingPickupsDto,
    recentActivity,
    recentReservationRequests: recentReservationRequestsDto,
    mostViewedMaterial: mostViewedMaterialDto,
    highDemandMaterials: highDemandMaterialsDto,
  };
};

export const createSupplierMaterial = async (
  userId: string,
  input: CreateSupplierMaterialInput,
  tx?: Prisma.TransactionClient,
) => {
  const supplierProfile =
    await supplierRepository.findSupplierProfileForMaterialCreate(userId);

  if (!supplierProfile) {
    throw new AppError(MISSING_PROFILE_MESSAGE, 400, "VALIDATION_ERROR");
  }

  assertSupplierCanPublishMaterials({
    supplierType: supplierProfile.supplierType,
    verificationStatus: supplierProfile.verificationStatus,
  });

  if (!supplierProfile.defaultPickupLocationId) {
    throw new AppError(
      MISSING_PICKUP_LOCATION_MESSAGE,
      400,
      "VALIDATION_ERROR",
    );
  }

  await assertSourceRequestPublishable(userId, input);
  const sourceType = deriveMaterialSourceType(supplierProfile.supplierType);

  const requestedCategory = await categoriesRepository.findCategoryById(
    input.categoryId,
  );

  if (!requestedCategory) {
    throw new AppError("Category not found", 404, "NOT_FOUND");
  }

  const requestedOtherCategory = categoriesRepository.isOtherCategory(
    requestedCategory.nameEn,
  );
  const materialName = input.materialName.trim();

  if (input.isFree) {
    if (input.price != null && input.price > 0) {
      throw new AppError(
        "Free listings cannot include a price.",
        400,
        "VALIDATION_ERROR",
      );
    }

    const resolved = await resolveMaterialReferenceForCreate({
      materialName,
      categoryId: input.categoryId,
      isFree: true,
    });

    const matchedType = resolved.materialType;
    const displayMaterialType = matchedType?.nameEn ?? materialName;
    const finalCategoryId = matchedType?.categoryId ?? input.categoryId;
    const finalTitle = input.title;

    const persistFreeMaterial = async (client: Prisma.TransactionClient) => {
      const materialLocationId = await resolveMaterialPickupLocationId(
        supplierProfile,
        input,
        client,
      );

      const conceptIds = await resolveCreateMaterialConceptIds({
        client,
        finalCategoryId,
        finalMaterialType: displayMaterialType,
        finalTitle,
      });

      const snapshots: SourceRequestSnapshots = {};
      if (input.sourceCategoryRequestId) {
        const categoryRequest =
          await categoryRequestsRepository.findCategoryRequestByIdForOwner(
            input.sourceCategoryRequestId,
            userId,
            client,
          );
        if (!categoryRequest) {
          throw new AppError("Category request not found", 404, "NOT_FOUND");
        }
        assertCategoryRequestPublishableInTx(categoryRequest, finalCategoryId);
        snapshots.categoryRequest = {
          id: categoryRequest.id,
          expectedUpdatedAt: categoryRequest.updatedAt,
          approvedCategoryId: categoryRequest.approvedCategoryId!,
        };
      }
      if (input.sourcePriceRuleRequestId) {
        const priceRuleRequest =
          await priceRuleRequestsRepository.findPriceRuleRequestByIdForOwner(
            input.sourcePriceRuleRequestId,
            userId,
            client,
          );
        if (!priceRuleRequest) {
          throw new AppError("Price rule request not found", 404, "NOT_FOUND");
        }
        if (priceRuleRequest.publishedMaterialId) {
          throw new AppError(SOURCE_REQUEST_CONSUMED_MESSAGE, 409, "CONFLICT");
        }
        snapshots.priceRuleRequest = {
          id: priceRuleRequest.id,
          expectedUpdatedAt: priceRuleRequest.updatedAt,
        };
      }

      const material = await supplierRepository.createSupplierMaterial({
        ownerId: userId,
        supplierProfileId: supplierProfile.id,
        categoryId: finalCategoryId,
        locationId: materialLocationId,
        title: finalTitle,
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
        currency: "NIS",
        pickupAllowed: input.pickupAllowed,
        deliveryAllowed: input.deliveryAllowed,
        pickupNotes: input.pickupNotes ?? null,
        suggestedUses: input.suggestedUses ?? null,
        imageUrls: input.imageUrls,
        conceptIds,
        client,
      });

      await markSourceRequestPublished(userId, material.id, snapshots, client);

      return mapCreatedMaterial(material);
    };

    if (tx) {
      return persistFreeMaterial(tx);
    }

    return prisma.$transaction((client) => persistFreeMaterial(client));
  }

  if (requestedOtherCategory) {
    throw new AppError(
      "Paid listings need a reviewed category/material. Submit this material for review before publishing.",
      400,
      "VALIDATION_ERROR",
      { reason: "PAID_OTHER_NOT_ALLOWED" },
    );
  }

  // Fail-fast only: not the transaction-authoritative branch decision.
  if (input.sourcePriceRuleRequestId && input.price != null) {
    const priceRuleRequest =
      await priceRuleRequestsRepository.findPriceRuleRequestByIdForOwner(
        input.sourcePriceRuleRequestId,
        userId,
      );

    if (!priceRuleRequest) {
      throw new AppError("Price rule request not found", 404, "NOT_FOUND");
    }

    const acceptance = evaluateApprovedPriceRuleRequest(
      priceRuleRequest,
      input.price,
      input.condition,
    );

    if (acceptance.ok) {
      const approvedUnit =
        priceRuleRequest.unit ??
        priceRuleRequest.materialType?.defaultUnit ??
        null;
      if (
        approvedUnit &&
        input.unit.trim().toLowerCase() !== approvedUnit.trim().toLowerCase()
      ) {
        throw new AppError(
          `Please use the approved unit (${approvedUnit}) for this material.`,
          400,
          "VALIDATION_ERROR",
          { reason: "UNIT_MISMATCH", approvedUnit },
        );
      }
    } else if (acceptance.reason === "PRICE_TOO_HIGH") {
      const unit =
        priceRuleRequest.unit ??
        priceRuleRequest.materialType?.defaultUnit ??
        "unit";
      throw new AppError(
        `Maximum allowed price is ${acceptance.maxAllowed} NIS per ${unit}.`,
        400,
        "VALIDATION_ERROR",
        {
          maxAllowedPrice: acceptance.maxAllowed,
          approvedUnit: unit,
          reason: "PRICE_TOO_HIGH",
        },
      );
    } else if (acceptance.reason === "NO_APPROVED_MAX") {
      const resolved = await resolveMaterialReferenceForCreate({
        materialName,
        categoryId: input.categoryId,
        isFree: false,
      });
      const materialType = resolved.materialType;
      if (!materialType) {
        throw new AppError(
          "This paid material needs admin price review before publishing.",
          400,
          "VALIDATION_ERROR",
          { reason: "MATERIAL_REVIEW_REQUIRED" },
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
        throw new AppError(priceCheck.message, 400, "VALIDATION_ERROR", {
          reason: priceCheck.reason,
          maxAllowedPrice: priceCheck.maxAllowedPrice,
          matchedReference: priceCheck.matchedReference,
          candidates: priceCheck.candidates,
          approvedUnit: priceCheck.approvedUnit,
        });
      }
    }
  } else {
    const resolved = await resolveMaterialReferenceForCreate({
      materialName,
      categoryId: input.categoryId,
      isFree: false,
    });

    const materialType = resolved.materialType;

    if (!materialType) {
      throw new AppError(
        "This paid material needs admin price review before publishing.",
        400,
        "VALIDATION_ERROR",
        { reason: "MATERIAL_REVIEW_REQUIRED" },
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
      throw new AppError(priceCheck.message, 400, "VALIDATION_ERROR", {
        reason: priceCheck.reason,
        maxAllowedPrice: priceCheck.maxAllowedPrice,
        matchedReference: priceCheck.matchedReference,
        candidates: priceCheck.candidates,
        approvedUnit: priceCheck.approvedUnit,
      });
    }
  }

  const persistPaidMaterial = async (client: Prisma.TransactionClient) => {
    const snapshots: SourceRequestSnapshots = {};
    let loadedCategoryRequest: NonNullable<
      Awaited<
        ReturnType<typeof categoryRequestsRepository.findCategoryRequestByIdForOwner>
      >
    > | null = null;

    if (input.sourceCategoryRequestId) {
      loadedCategoryRequest =
        await categoryRequestsRepository.findCategoryRequestByIdForOwner(
          input.sourceCategoryRequestId,
          userId,
          client,
        );
      if (!loadedCategoryRequest) {
        throw new AppError("Category request not found", 404, "NOT_FOUND");
      }
    }

    let finalized: {
      finalCategoryId: string;
      finalMaterialType: string;
      materialTypeId: string | null;
      customMaterialType: string | null;
      priceRuleId: string | null;
      maxAllowedPriceAtCheck: number | null;
    } | null = null;

    if (input.sourcePriceRuleRequestId && input.price != null) {
      const priceRuleRequest =
        await priceRuleRequestsRepository.findPriceRuleRequestByIdForOwner(
          input.sourcePriceRuleRequestId,
          userId,
          client,
        );

      if (!priceRuleRequest) {
        throw new AppError("Price rule request not found", 404, "NOT_FOUND");
      }

      if (priceRuleRequest.publishedMaterialId) {
        throw new AppError(SOURCE_REQUEST_CONSUMED_MESSAGE, 409, "CONFLICT");
      }

      snapshots.priceRuleRequest = {
        id: priceRuleRequest.id,
        expectedUpdatedAt: priceRuleRequest.updatedAt,
      };

      const acceptance = evaluateApprovedPriceRuleRequest(
        priceRuleRequest,
        input.price,
        input.condition,
      );

      if (acceptance.ok) {
        const approvedUnit =
          priceRuleRequest.unit ??
          priceRuleRequest.materialType?.defaultUnit ??
          null;
        if (
          approvedUnit &&
          input.unit.trim().toLowerCase() !== approvedUnit.trim().toLowerCase()
        ) {
          throw new AppError(
            `Please use the approved unit (${approvedUnit}) for this material.`,
            400,
            "VALIDATION_ERROR",
            { reason: "UNIT_MISMATCH", approvedUnit },
          );
        }

        const materialType = await resolvePaidMaterialTypeFromPrr(
          priceRuleRequest,
          materialName,
          input.categoryId,
          client,
        );

        finalized = {
          finalCategoryId: materialType?.categoryId ?? input.categoryId,
          finalMaterialType: materialType?.nameEn ?? materialName,
          materialTypeId:
            materialType?.id ?? priceRuleRequest.materialTypeId ?? null,
          customMaterialType: materialType ? null : materialName,
          priceRuleId: null,
          maxAllowedPriceAtCheck: acceptance.maxAllowed,
        };
      } else if (acceptance.reason === "PRICE_TOO_HIGH") {
        const unit =
          priceRuleRequest.unit ??
          priceRuleRequest.materialType?.defaultUnit ??
          "unit";
        throw new AppError(
          `Maximum allowed price is ${acceptance.maxAllowed} NIS per ${unit}.`,
          400,
          "VALIDATION_ERROR",
          {
            maxAllowedPrice: acceptance.maxAllowed,
            approvedUnit: unit,
            reason: "PRICE_TOO_HIGH",
          },
        );
      }
      // NO_APPROVED_MAX falls through to ordinary branch below.
    }

    if (!finalized) {
      const materialType = await resolveOrdinaryPaidMaterialTypeInTx({
        client,
        materialName,
        categoryId: input.categoryId,
      });

      const authorized = await assertOrdinaryPaidPriceAllowedInTx({
        client,
        materialType,
        unit: input.unit,
        quantity: input.quantity,
        condition: input.condition,
        price: input.price,
        currency: input.currency,
      });

      finalized = {
        finalCategoryId: authorized.materialType.categoryId,
        finalMaterialType: authorized.materialType.nameEn,
        materialTypeId: authorized.materialType.id,
        customMaterialType: null,
        priceRuleId: authorized.priceRuleId,
        maxAllowedPriceAtCheck: authorized.maxAllowedPrice,
      };
    }

    const {
      finalCategoryId,
      finalMaterialType,
      materialTypeId,
      customMaterialType,
      priceRuleId,
      maxAllowedPriceAtCheck,
    } = finalized;

    if (loadedCategoryRequest) {
      assertCategoryRequestPublishableInTx(
        loadedCategoryRequest,
        finalCategoryId,
      );
      snapshots.categoryRequest = {
        id: loadedCategoryRequest.id,
        expectedUpdatedAt: loadedCategoryRequest.updatedAt,
        approvedCategoryId: loadedCategoryRequest.approvedCategoryId!,
      };
    }

    const materialLocationId = await resolveMaterialPickupLocationId(
      supplierProfile,
      input,
      client,
    );

    const conceptIds = await resolveCreateMaterialConceptIds({
      client,
      finalCategoryId,
      finalMaterialType,
      finalTitle: input.title,
    });

    const material = await supplierRepository.createSupplierMaterial({
      ownerId: userId,
      supplierProfileId: supplierProfile.id,
      categoryId: finalCategoryId,
      locationId: materialLocationId,
      title: input.title,
      description: input.description,
      materialType: finalMaterialType,
      materialTypeId,
      customMaterialType,
      quantity: input.quantity,
      unit: input.unit,
      condition: input.condition,
      sourceType,
      isFree: false,
      price: input.price,
      currency: "NIS",
      pickupAllowed: input.pickupAllowed,
      deliveryAllowed: input.deliveryAllowed,
      pickupNotes: input.pickupNotes ?? null,
      suggestedUses: input.suggestedUses ?? null,
      priceRuleId,
      priceCheckedAt: new Date(),
      maxAllowedPriceAtCheck,
      imageUrls: input.imageUrls,
      conceptIds,
      client,
    });

    await markSourceRequestPublished(userId, material.id, snapshots, client);

    return mapCreatedMaterial(material);
  };

  if (tx) {
    return persistPaidMaterial(tx);
  }

  return prisma.$transaction((client) => persistPaidMaterial(client));
};

export const createSupplierMaterialIdempotent = async (
  userId: string,
  input: CreateSupplierMaterialInput,
  idempotencyKey: string,
) => {
  const created = await runIdempotentOperation<CreatedSupplierMaterialDto>({
    userId,
    scope: SUPPLIER_CREATE_MATERIAL_SCOPE,
    key: idempotencyKey,
    payload: input,
    resourceType: "MATERIAL",
    getResourceId: (material) => material.id,
    handler: (tx) => createSupplierMaterial(userId, input, tx),
  });
  const createdMaterial = created.response;

  const publishNotifications: Promise<unknown>[] = [];
  if (input.sourceCategoryRequestId) {
    publishNotifications.push(
      createNotification({
          userId,
          notificationType: "CATEGORY_REQUEST_UPDATE",
          title: "Listing published",
          body: `${createdMaterial.title} was published from the approved category review.`,
          relatedEntityType: "CATEGORY_REQUEST",
          relatedEntityId: input.sourceCategoryRequestId,
          eventKey: `listing-published:category:${input.sourceCategoryRequestId}:${createdMaterial.id}`,
          entityType: "CATEGORY_REQUEST",
          entityId: input.sourceCategoryRequestId,
          actionType: "NONE",
          resolvedAt: new Date(),
          metadata: { publishedMaterialId: createdMaterial.id },
        }),
    );
  }
  if (input.sourcePriceRuleRequestId) {
    publishNotifications.push(
      createNotification({
          userId,
          notificationType: "PRICE_REQUEST_UPDATE",
          title: "Listing published",
          body: `${createdMaterial.title} was published from the approved price review.`,
          relatedEntityType: "PRICE_RULE_REQUEST",
          relatedEntityId: input.sourcePriceRuleRequestId,
          eventKey: `listing-published:price:${input.sourcePriceRuleRequestId}:${createdMaterial.id}`,
          entityType: "PRICE_RULE_REQUEST",
          entityId: input.sourcePriceRuleRequestId,
          actionType: "NONE",
          resolvedAt: new Date(),
          metadata: { publishedMaterialId: createdMaterial.id },
        }),
    );
  }

  await Promise.all(publishNotifications);
  return created;
};

export const getEmptySupplierDashboard = (): SupplierDashboardDto => ({
  hasSupplierProfile: false,
  message: MISSING_PROFILE_MESSAGE,
  stats: emptyDashboardStats(),
  projectSupport: emptyProjectSupportStats(),
  recentMaterials: [],
  upcomingPickups: [],
  recentActivity: [],
  recentReservationRequests: [],
  mostViewedMaterial: null,
  highDemandMaterials: [],
});

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
    throw new AppError('Create your supplier profile first.', 404, 'NOT_FOUND');
  }

  await supplierRepository.updateSupplierProfileImages(userId, input);
  return getSupplierProfile(userId);
};

export type SupplierMaterialMutationBlockedReason =
  | "REUSED_HISTORY"
  | "ACTIVE_REQUESTS";

export type SupplierMaterialDeleteBlockedReason =
  SupplierMaterialMutationBlockedReason;

export type SupplierMaterialEditBlockedReason =
  SupplierMaterialMutationBlockedReason;

export const DELETE_REUSED_MATERIAL_MESSAGE =
  "Cannot delete reused material history.";

export const DELETE_ACTIVE_REQUESTS_MESSAGE =
  "Cannot delete a material with active requests.";

export const EDIT_REUSED_MATERIAL_MESSAGE =
  "Cannot edit reused material history.";

export const EDIT_ACTIVE_REQUESTS_MESSAGE =
  "Cannot edit a material with active requests or blocked status.";

const resolveSupplierMaterialMutationEligibility = (
  status: string,
  blockingReservationCount: number,
): {
  canMutate: boolean;
  blockedReason: SupplierMaterialMutationBlockedReason | null;
} => {
  if (status === "REUSED") {
    return { canMutate: false, blockedReason: "REUSED_HISTORY" };
  }

  if (status === "PENDING_RESERVATION" || status === "RESERVED") {
    return { canMutate: false, blockedReason: "ACTIVE_REQUESTS" };
  }

  if (status !== "AVAILABLE" && status !== "UNAVAILABLE") {
    return { canMutate: false, blockedReason: "ACTIVE_REQUESTS" };
  }

  if (blockingReservationCount > 0) {
    return { canMutate: false, blockedReason: "ACTIVE_REQUESTS" };
  }

  return { canMutate: true, blockedReason: null };
};

export const resolveSupplierMaterialDeleteEligibility = (
  status: string,
  blockingReservationCount: number,
): {
  canDelete: boolean;
  deleteBlockedReason: SupplierMaterialDeleteBlockedReason | null;
} => {
  const eligibility = resolveSupplierMaterialMutationEligibility(
    status,
    blockingReservationCount,
  );

  return {
    canDelete: eligibility.canMutate,
    deleteBlockedReason: eligibility.blockedReason,
  };
};

export const resolveSupplierMaterialEditEligibility = (
  status: string,
): {
  canEdit: boolean;
  editBlockedReason: SupplierMaterialEditBlockedReason | null;
} => {
  if (status === 'REUSED') {
    return { canEdit: false, editBlockedReason: 'REUSED_HISTORY' };
  }

  return { canEdit: true, editBlockedReason: null };
};

type SupplierOwnedMaterialRecord = Awaited<
  ReturnType<typeof supplierRepository.findSupplierMaterials>
>["items"][number];

type SupplierMaterialEngagementExtras = {
  viewsCount?: number;
  likesCount?: number;
  pendingReservationsCount?: number;
  reservedReservationsCount?: number;
  activeRequestsCount?: number;
  completedReservationsCount?: number;
  reusedCount?: number;
  lastCompletedAt?: string | null;
  reservationsCount?: number;
  activeDemandScore?: number;
  demandScore?: number;
  demandScorePercent?: number;
  canMarkUnavailable?: boolean;
  canRestoreAvailable?: boolean;
  statusActionBlockedReason?: string | null;
};

const buildSupplierMaterialDemandExtras = (input: {
  viewsCount: number;
  likesCount: number;
  reservationCounts: supplierRepository.MaterialReservationDemandCounts;
  reusedCount: number;
  lastCompletedAt: Date | null;
}): SupplierMaterialEngagementExtras => {
  const metrics = computeMaterialDemandMetrics({
    viewsCount: input.viewsCount,
    likesCount: input.likesCount,
    pendingReservationsCount: input.reservationCounts.pendingReservationsCount,
    reservedReservationsCount: input.reservationCounts.reservedReservationsCount,
    completedReservationsCount: input.reservationCounts.completedReservationsCount,
    reusedCount: input.reusedCount,
  });

  return {
    viewsCount: metrics.viewsCount,
    likesCount: metrics.likesCount,
    pendingReservationsCount: metrics.pendingReservationsCount,
    reservedReservationsCount: metrics.reservedReservationsCount,
    activeRequestsCount: metrics.activeRequestsCount,
    completedReservationsCount: metrics.completedReservationsCount,
    reusedCount: metrics.reusedCount,
    lastCompletedAt: input.lastCompletedAt?.toISOString() ?? null,
    reservationsCount: metrics.reservationsCount,
    activeDemandScore: metrics.activeDemandScore,
    demandScore: metrics.demandScore,
    demandScorePercent: metrics.demandScorePercent,
  };
};

const mapSupplierOwnedMaterial = (
  material: SupplierOwnedMaterialRecord,
  blockingReservationCount = 0,
  likesCount = 0,
  extras: SupplierMaterialEngagementExtras = {},
  heldQuantityInput = toDecimal(0),
) => {
  const materialQuantity =
    typeof material.quantity === "number"
      ? toDecimal(material.quantity)
      : material.quantity;
  const heldQuantity = heldQuantityInput;
  const availableQuantity = computeAvailableQuantity(
    materialQuantity,
    heldQuantity,
  );

  return {
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
  quantity: decimalToNumber(materialQuantity),
  heldQuantity: decimalToNumber(heldQuantity),
  availableQuantity: decimalToNumber(availableQuantity),
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
  viewsCount: extras.viewsCount ?? material.viewsCount,
  likesCount: extras.likesCount ?? likesCount,
  pendingReservationsCount: extras.pendingReservationsCount ?? 0,
  reservedReservationsCount: extras.reservedReservationsCount ?? 0,
  activeRequestsCount: extras.activeRequestsCount ?? extras.reservationsCount ?? 0,
  completedReservationsCount: extras.completedReservationsCount ?? 0,
  reusedCount: extras.reusedCount ?? 0,
  lastCompletedAt: extras.lastCompletedAt ?? null,
  reservationsCount: extras.reservationsCount ?? extras.activeRequestsCount ?? 0,
  activeDemandScore: extras.activeDemandScore ?? 0,
  demandScore: extras.demandScore ?? 0,
  demandScorePercent: extras.demandScorePercent ?? extras.demandScore ?? 0,
  canMarkUnavailable: extras.canMarkUnavailable ?? false,
  canRestoreAvailable: extras.canRestoreAvailable ?? false,
  statusActionBlockedReason: extras.statusActionBlockedReason ?? null,
  createdAt: material.createdAt.toISOString(),
  updatedAt: material.updatedAt.toISOString(),
  ...resolveSupplierMaterialDeleteEligibility(
    material.status,
    blockingReservationCount,
  ),
  ...resolveSupplierMaterialEditEligibility(material.status),
  };
};

const resolveSupplierMaterialStatusActions = (
  status: string,
  activeReservationCount: number,
) => {
  const policy = getMaterialModerationPolicy(status);
  let statusActionBlockedReason = policy.lockReason;

  if (activeReservationCount > 0) {
    statusActionBlockedReason =
      "This action is not available while the material has active reservations.";
  }

  const canMarkUnavailable =
    policy.canMarkUnavailable && activeReservationCount === 0;
  const canRestoreAvailable =
    policy.canRestore && activeReservationCount === 0;

  return {
    canMarkUnavailable,
    canRestoreAvailable,
    statusActionBlockedReason,
  };
};

const mapMaterialReservationSummary = (
  reservation: supplierRepository.SupplierMaterialReservationRecord,
  unit: string,
) => {
  const latestDelivery = reservation.deliveries[0] ?? null;

  return {
    id: reservation.id,
    status: reservation.status,
    quantityRequested: Number(reservation.quantityRequested),
    unit,
    message: reservation.message,
    fulfillmentMethod: reservation.fulfillmentMethod,
    fulfillmentLabel: mapReservationFulfillmentLabel(
      reservation.fulfillmentMethod,
      reservation.deliveries.length,
    ),
    pickupWindowStart: reservation.pickupWindowStart?.toISOString() ?? null,
    pickupWindowEnd: reservation.pickupWindowEnd?.toISOString() ?? null,
    activeDelivery: latestDelivery
      ? {
          id: latestDelivery.id,
          status: latestDelivery.status,
        }
      : null,
    learner: {
      id: reservation.requester.id,
      displayName: reservation.requester.displayName,
    },
    createdAt: reservation.createdAt.toISOString(),
    canReview: reservation.status === "PENDING",
    canOpen: true,
  };
};

export const getSupplierMaterials = async (
  userId: string,
  query: SupplierMaterialsQuery,
) => {
  const scope = await resolveSupplierContext(userId);
  const [result, summary, categories] = await Promise.all([
    supplierRepository.findSupplierMaterials(scope, query),
    supplierRepository.findSupplierMaterialsSummary(scope),
    supplierRepository.findSupplierMaterialCategories(scope),
  ]);

  const materialIds = result.items.map((item) => item.id);

  const [blockingReservationCounts, likesByMaterial, viewsByMaterial, demandByMaterial, reuseByMaterial, heldByMaterialId] =
    await Promise.all([
      supplierRepository.countBlockingReservationsByMaterialIds(materialIds),
      supplierRepository.countLikesByMaterialIds(materialIds),
      supplierRepository.countViewsByMaterialIds(materialIds),
      supplierRepository.findReservationDemandByMaterialIds(materialIds),
      supplierRepository.findMaterialReuseSummaryByMaterialIds(materialIds),
      getHeldQuantitiesByMaterialIds(materialIds),
    ]);

  const totalPages =
    result.total === 0 ? 0 : Math.ceil(result.total / query.limit);

  return {
    items: result.items.map((item) => {
      const reservationCounts = demandByMaterial.get(item.id) ?? {
        pendingReservationsCount: 0,
        reservedReservationsCount: 0,
        completedReservationsCount: 0,
      };
      const reuse = reuseByMaterial.get(item.id) ?? {
        reusedCount: 0,
        lastCompletedAt: null,
      };
      const demandExtras = buildSupplierMaterialDemandExtras({
        viewsCount: viewsByMaterial.get(item.id) ?? 0,
        likesCount: likesByMaterial.get(item.id) ?? 0,
        reservationCounts,
        reusedCount: reuse.reusedCount,
        lastCompletedAt: reuse.lastCompletedAt,
      });
      const statusActions = resolveSupplierMaterialStatusActions(
        item.status,
        demandExtras.activeRequestsCount ?? 0,
      );

      return mapSupplierOwnedMaterial(
        item,
        blockingReservationCounts.get(item.id) ?? 0,
        likesByMaterial.get(item.id) ?? 0,
        {
          ...demandExtras,
          ...statusActions,
        },
        heldByMaterialId.get(item.id) ?? toDecimal(0),
      );
    }),
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

export const getSupplierMaterial = async (
  userId: string,
  materialId: string,
) => {
  const scope = await resolveSupplierContext(userId);
  const material = await supplierRepository.findSupplierOwnedMaterialById(
    scope,
    materialId,
  );

  if (!material) {
    throw new AppError("Material not found", 404, "NOT_FOUND");
  }

  const blockingReservationCount =
    await supplierRepository.countBlockingReservationsForMaterial(materialId);

  const materialIds = [materialId];
  const [likesCount, viewsCount, demandByMaterial, reuseByMaterial, activeReservationCount, reservations, heldByMaterialId] =
    await Promise.all([
      supplierRepository
        .countLikesByMaterialIds(materialIds)
        .then((map) => map.get(materialId) ?? 0),
      supplierRepository
        .countViewsByMaterialIds(materialIds)
        .then((map) => map.get(materialId) ?? 0),
      supplierRepository.findReservationDemandByMaterialIds(materialIds),
      supplierRepository.findMaterialReuseSummaryByMaterialIds(materialIds),
      supplierRepository.countActiveReservationsForMaterial(materialId),
      supplierRepository.findReservationsForSupplierMaterial(scope, materialId),
      getHeldQuantitiesByMaterialIds(materialIds),
    ]);

  const reservationCounts = demandByMaterial.get(materialId) ?? {
    pendingReservationsCount: 0,
    reservedReservationsCount: 0,
    completedReservationsCount: 0,
  };
  const reuse = reuseByMaterial.get(materialId) ?? {
    reusedCount: 0,
    lastCompletedAt: null,
  };
  const demandExtras = buildSupplierMaterialDemandExtras({
    viewsCount,
    likesCount,
    reservationCounts,
    reusedCount: reuse.reusedCount,
    lastCompletedAt: reuse.lastCompletedAt,
  });
  const statusActions = resolveSupplierMaterialStatusActions(
    material.status,
    activeReservationCount,
  );

  return {
    ...mapSupplierOwnedMaterial(
      material,
      blockingReservationCount,
      likesCount,
      {
        ...demandExtras,
        ...statusActions,
      },
      heldByMaterialId.get(materialId) ?? toDecimal(0),
    ),
    reservations: reservations.map((reservation) =>
      mapMaterialReservationSummary(reservation, material.unit),
    ),
  };
};

export const updateSupplierMaterial = async (
  userId: string,
  materialId: string,
  input: UpdateSupplierMaterialInput,
) => {
  const scope = await resolveSupplierContext(userId);
  const material = await supplierRepository.findSupplierOwnedMaterialById(
    scope,
    materialId,
  );

  if (!material) {
    throw new AppError("Material not found", 404, "NOT_FOUND");
  }

  const blockingReservationCount =
    await supplierRepository.countBlockingReservationsForMaterial(materialId);
  const eligibility = resolveSupplierMaterialEditEligibility(material.status);

  if (!eligibility.canEdit) {
    throw new AppError(EDIT_REUSED_MATERIAL_MESSAGE, 409, "CONFLICT");
  }

  const heldByMaterialId = await getHeldQuantitiesByMaterialIds([materialId]);
  const heldQuantity = heldByMaterialId.get(materialId) ?? toDecimal(0);
  const nextQuantity = toDecimal(input.quantity);

  if (nextQuantity.lt(heldQuantity)) {
    throw new AppError(
      "Quantity cannot be less than the amount currently held by active reservations.",
      400,
      "VALIDATION_ERROR",
    );
  }

  const updatedScalars = await supplierRepository.updateSupplierOwnedMaterial(
    scope,
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

  if (!updatedScalars) {
    throw new AppError("Material not found", 404, "NOT_FOUND");
  }

  return mapSupplierOwnedMaterial(
    { ...material, ...updatedScalars },
    blockingReservationCount,
    0,
    {},
    heldQuantity,
  );
};

export const deleteSupplierMaterial = async (
  userId: string,
  materialId: string,
) => {
  const scope = await resolveSupplierContext(userId);
  const material = await supplierRepository.findSupplierOwnedMaterialById(
    scope,
    materialId,
  );

  if (!material) {
    throw new AppError("Material not found", 404, "NOT_FOUND");
  }

  const blockingReservationCount =
    await supplierRepository.countBlockingReservationsForMaterial(materialId);
  const eligibility = resolveSupplierMaterialDeleteEligibility(
    material.status,
    blockingReservationCount,
  );

  if (!eligibility.canDelete) {
    throw new AppError(
      eligibility.deleteBlockedReason === "REUSED_HISTORY"
        ? DELETE_REUSED_MATERIAL_MESSAGE
        : DELETE_ACTIVE_REQUESTS_MESSAGE,
      409,
      "CONFLICT",
    );
  }

  await supplierRepository.deleteSupplierOwnedMaterial(materialId);
};

export const markSupplierMaterialUnavailable = async (
  userId: string,
  materialId: string,
) => {
  const scope = await resolveSupplierContext(userId);
  const material = await supplierRepository.findSupplierOwnedMaterialById(
    scope,
    materialId,
  );

  if (!material) {
    throw new AppError("Material not found", 404, "NOT_FOUND");
  }

  await assertCanMarkMaterialUnavailable(materialId, material.status);

  const updated = await supplierRepository.updateSupplierOwnedMaterialStatus(
    scope,
    materialId,
    "UNAVAILABLE",
  );

  if (!updated) {
    throw new AppError("Material not found", 404, "NOT_FOUND");
  }

  return getSupplierMaterial(userId, materialId);
};

export const restoreSupplierMaterialAvailable = async (
  userId: string,
  materialId: string,
) => {
  const scope = await resolveSupplierContext(userId);
  const material = await supplierRepository.findSupplierOwnedMaterialById(
    scope,
    materialId,
  );

  if (!material) {
    throw new AppError("Material not found", 404, "NOT_FOUND");
  }

  assertCanRestoreMaterial(material.status);

  const updated = await supplierRepository.updateSupplierOwnedMaterialStatus(
    scope,
    materialId,
    "AVAILABLE",
  );

  if (!updated) {
    throw new AppError("Material not found", 404, "NOT_FOUND");
  }

  return getSupplierMaterial(userId, materialId);
};
