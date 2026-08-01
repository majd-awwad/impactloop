import { Prisma } from "../../generated/prisma/index.js";
import { prisma } from "../../database/prisma.js";

type PrismaClientLike = typeof prisma | Prisma.TransactionClient;

export const findPendingCategoryRequest = async (input: {
  requestedByUserId: string;
  normalizedRequestedName: string;
}) => {
  return prisma.categoryRequest.findFirst({
    where: {
      requestedByUserId: input.requestedByUserId,
      normalizedRequestedName: input.normalizedRequestedName,
      status: "PENDING",
    },
    orderBy: { createdAt: "desc" },
  });
};

export const createCategoryRequest = async (input: {
  requestedName: string;
  normalizedRequestedName: string;
  requestedByUserId: string;
  listingDraftJson: object;
}) => {
  return prisma.categoryRequest.create({
    data: {
      requestedName: input.requestedName,
      normalizedRequestedName: input.normalizedRequestedName,
      requestedByUserId: input.requestedByUserId,
      listingDraftJson: input.listingDraftJson,
      status: "PENDING",
    },
  });
};

export const updateCategoryRequestDraftJson = async (input: {
  id: string;
  listingDraftJson: object;
}) => {
  return prisma.categoryRequest.update({
    where: { id: input.id },
    data: { listingDraftJson: input.listingDraftJson },
  });
};

export const listCategoryRequestsWithDrafts = async (userId: string) => {
  return prisma.categoryRequest.findMany({
    where: {
      requestedByUserId: userId,
      listingDraftJson: { not: Prisma.DbNull },
    },
    include: {
      approvedCategory: true,
    },
    orderBy: { createdAt: "desc" },
  });
};

export const findCategoryRequestByIdForOwner = async (
  id: string,
  userId: string,
  client?: PrismaClientLike,
) => {
  return (client ?? prisma).categoryRequest.findFirst({
    where: {
      id,
      requestedByUserId: userId,
    },
    include: {
      approvedCategory: true,
    },
  });
};

/**
 * Atomically consumes an unpublished approved owner-scoped category request.
 * Binds to the exact authorized snapshot via expectedUpdatedAt and
 * expectedApprovedCategoryId.
 * Returns the number of rows updated; callers must treat 0 as conflict and
 * roll back the surrounding transaction.
 */
export const markCategoryRequestPublished = async (input: {
  id: string;
  materialId: string;
  requestedByUserId: string;
  expectedUpdatedAt: Date;
  expectedApprovedCategoryId: string;
  client?: PrismaClientLike;
}): Promise<{ count: number }> => {
  return (input.client ?? prisma).categoryRequest.updateMany({
    where: {
      id: input.id,
      requestedByUserId: input.requestedByUserId,
      status: "APPROVED",
      approvedCategoryId: input.expectedApprovedCategoryId,
      publishedMaterialId: null,
      updatedAt: input.expectedUpdatedAt,
    },
    data: {
      publishedMaterialId: input.materialId,
      publishedAt: new Date(),
    },
  });
};
