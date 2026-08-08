import { AppError } from "../../utils/app-error.js";
import { prisma } from "../../database/prisma.js";
import { decimalToNumber } from "../../utils/decimal.js";
import * as supplierRepository from "./supplier.repository.js";
import { computeMaterialDemandMetrics } from "./supplier.material-demand-metrics.js";
import { mapReservationFulfillmentLabel } from "../reservations/reservation-delivery.js";
import {
  assertCanMarkMaterialUnavailable,
  assertCanRestoreMaterial,
  getMaterialModerationPolicy,
} from "../admin-materials/admin-materials.moderation-policy.js";
import {
  resolveSupplierContext,
} from "./supplier-material-scope.js";
import {
  computeAvailableQuantity,
  getHeldQuantitiesByMaterialIds,
  toDecimal,
} from "../reservations/reservations.quantity.js";
import type {
  SupplierMaterialsQuery,
  UpdateSupplierMaterialInput,
} from "./supplier.validation.js";
import { getRelatedProjectsForOwnedMaterial } from "./supplier-related-projects.js";
import { getSupplierCategoryDemand } from "./supplier.category-demand.js";
import { loadMaterialConceptIdsForPersistence } from "./supplier-material-create.helpers.js";

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

export const STALE_MATERIAL_UPDATE_MESSAGE =
  "This material was updated elsewhere. Refresh and try again.";

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

export const getSupplierMaterialRelatedProjects = async (
  userId: string,
  materialId: string,
  limit: number,
) => {
  const scope = await resolveSupplierContext(userId);
  const material =
    await supplierRepository.findSupplierOwnedMaterialForRelatedProjects(
      scope,
      materialId,
    );

  if (!material) {
    throw new AppError("Material not found", 404, "NOT_FOUND");
  }

  return getRelatedProjectsForOwnedMaterial(material, limit);
};

export const getSupplierCategoryDemandInsights = async (
  userId: string,
  limit: number,
) => {
  // Auth/role already enforced by middleware; resolve context for supplier session validity.
  // Aggregation is intentionally platform-wide and does not use supplier identity.
  await resolveSupplierContext(userId);
  return getSupplierCategoryDemand(limit);
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

  const finalTitle = input.title;
  const titleChanged = material.title !== finalTitle;
  const expectedUpdatedAt = material.updatedAt;
  const updateData = {
    title: finalTitle,
    description: input.description,
    quantity: input.quantity,
    unit: input.unit,
    condition: input.condition,
    pickupAllowed: input.pickupAllowed,
    deliveryAllowed: input.deliveryAllowed,
    pickupNotes: input.pickupNotes ?? null,
    suggestedUses: input.suggestedUses ?? null,
  };

  const updateResult = await prisma.$transaction(async (client) => {
    const replaceConceptIds = titleChanged
      ? await loadMaterialConceptIdsForPersistence({
          client,
          finalCategoryId: material.categoryId,
          finalMaterialType: material.materialType,
          finalTitle,
        })
      : undefined;

    return supplierRepository.updateSupplierMaterialWithConcepts({
      client,
      scope,
      materialId,
      expectedUpdatedAt,
      updateData,
      replaceConceptIds,
    });
  });

  if (updateResult.status === "not_found") {
    throw new AppError("Material not found", 404, "NOT_FOUND");
  }

  if (updateResult.status === "stale") {
    throw new AppError(STALE_MATERIAL_UPDATE_MESSAGE, 409, "CONFLICT");
  }

  return mapSupplierOwnedMaterial(
    { ...material, ...updateResult.material },
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
