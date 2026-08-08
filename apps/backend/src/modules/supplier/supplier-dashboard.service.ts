import type { RecentActivityDto, SupplierDashboardDto } from "./dto/supplier-dashboard.dto.js";
import {
  emptyDashboardStats,
  emptyProjectSupportStats,
  normalizeVerificationStatus,
} from "./dto/supplier-dashboard.dto.js";
import { getSupplierProjectSupportSummary } from "./supplier-project-impact.js";
import { env } from "../../config/env.js";
import { prisma } from "../../database/prisma.js";
import * as supplierRepository from "./supplier.repository.js";
import {
  buildSupplierMaterialWhere,
  resolveSupplierContext,
} from "./supplier-material-scope.js";
import { MISSING_PROFILE_MESSAGE } from "./supplier-material-create.helpers.js";

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
