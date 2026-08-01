import type { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "../../database/prisma.js";

type PrismaClientLike = typeof prisma | Prisma.TransactionClient;

export const findPendingKnownPriceRuleRequest = async (input: {
  materialTypeId: string;
  requestedByUserId: string;
}) => {
  return prisma.priceRuleRequest.findFirst({
    where: {
      materialTypeId: input.materialTypeId,
      requestedByUserId: input.requestedByUserId,
      status: "PENDING",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      aiResultJson: true,
    },
  });
};

export const findPendingUnknownPriceRuleRequest = async (input: {
  normalizedMaterialName: string;
  categoryId: string;
  unit: string;
  requestedByUserId: string;
}) => {
  return prisma.priceRuleRequest.findFirst({
    where: {
      normalizedMaterialName: input.normalizedMaterialName,
      categoryId: input.categoryId,
      unit: input.unit,
      requestedByUserId: input.requestedByUserId,
      status: "PENDING",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      aiResultJson: true,
    },
  });
};

export const createKnownPriceRuleRequest = async (input: {
  materialTypeId: string;
  requestedByUserId: string;
  listingDraftJson?: object | null;
}) => {
  return prisma.priceRuleRequest.create({
    data: {
      materialTypeId: input.materialTypeId,
      requestedByUserId: input.requestedByUserId,
      status: "PENDING",
      listingDraftJson: input.listingDraftJson ?? undefined,
    },
    select: {
      id: true,
      status: true,
    },
  });
};

export const createUnknownPriceRuleRequest = async (input: {
  materialName: string;
  normalizedMaterialName: string;
  categoryId: string;
  unit: string;
  condition?: string | null;
  quantity?: number | null;
  supplierPriceNis?: number | null;
  requestedByUserId: string;
  listingDraftJson?: object | null;
}) => {
  return prisma.priceRuleRequest.create({
    data: {
      materialName: input.materialName,
      normalizedMaterialName: input.normalizedMaterialName,
      categoryId: input.categoryId,
      unit: input.unit,
      condition:
        input.condition as Prisma.PriceRuleRequestCreateInput["condition"],
      quantity: input.quantity ?? null,
      supplierPriceNis: input.supplierPriceNis ?? null,
      requestedByUserId: input.requestedByUserId,
      status: "PENDING",
      listingDraftJson: input.listingDraftJson ?? undefined,
    },
    select: {
      id: true,
      status: true,
    },
  });
};

export const updatePriceRuleRequestAiResult = async (input: {
  id: string;
  aiSuggestedUnit?: string | null;
  aiSuggestedMaxUnitPriceNis?: number | null;
  aiSuggestedMaxTotalPriceNis?: number | null;
  aiSuggestedAliasesJson?: string[] | null;
  aiResultJson?: Record<string, unknown> | null;
}) => {
  return prisma.priceRuleRequest.update({
    where: { id: input.id },
    data: {
      aiSuggestedUnit: input.aiSuggestedUnit ?? null,
      aiSuggestedMaxUnitPriceNis: input.aiSuggestedMaxUnitPriceNis ?? null,
      aiSuggestedMaxTotalPriceNis: input.aiSuggestedMaxTotalPriceNis ?? null,
      aiSuggestedAliasesJson: input.aiSuggestedAliasesJson as
        | Prisma.InputJsonValue
        | undefined,
      aiResultJson: input.aiResultJson as Prisma.InputJsonValue | undefined,
    },
    select: {
      id: true,
      status: true,
      aiResultJson: true,
    },
  });
};

export const findPendingAiProposedPriceRule = async (input: {
  materialTypeId: string;
  unit: string;
}) => {
  return prisma.materialPriceRule.findFirst({
    where: {
      materialTypeId: input.materialTypeId,
      unit: input.unit,
      sourceType: "AI_PROPOSED",
      status: "PENDING_REVIEW",
      isActive: false,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      isActive: true,
      sourceType: true,
    },
  });
};

export const createAiProposedPriceRule = async (input: {
  materialTypeId: string;
  unit: string;
  maxAllowedUnitPriceNis: number;
  maxAllowedTotalPriceNis: number | null;
  confidence: number | null;
  sourceNote: string | null;
}) => {
  return prisma.materialPriceRule.create({
    data: {
      materialTypeId: input.materialTypeId,
      currency: "NIS",
      unit: input.unit,
      maxAllowedUnitPriceNis: input.maxAllowedUnitPriceNis,
      maxAllowedTotalPriceNis: input.maxAllowedTotalPriceNis,
      sourceType: "AI_PROPOSED",
      status: "PENDING_REVIEW",
      isActive: false,
      confidence: input.confidence,
      sourceNote: input.sourceNote,
    },
    select: {
      id: true,
      status: true,
      isActive: true,
      sourceType: true,
    },
  });
};

export const listPriceRuleRequestsForSupplier = async (userId: string) => {
  return prisma.priceRuleRequest.findMany({
    where: { requestedByUserId: userId },
    include: {
      category: { select: { id: true, nameEn: true } },
      materialType: { select: { id: true, nameEn: true, defaultUnit: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const findPriceRuleRequestByIdForOwner = async (
  id: string,
  userId: string,
  client?: PrismaClientLike,
) => {
  return (client ?? prisma).priceRuleRequest.findFirst({
    where: {
      id,
      requestedByUserId: userId,
    },
    include: {
      category: { select: { id: true, nameEn: true, nameAr: true } },
      materialType: { select: { id: true, nameEn: true, defaultUnit: true } },
    },
  });
};

export const updatePriceRuleRequestDraftJson = async (input: {
  id: string;
  listingDraftJson: object;
}) => {
  return prisma.priceRuleRequest.update({
    where: { id: input.id },
    data: { listingDraftJson: input.listingDraftJson },
  });
};

/**
 * Atomically consumes an unpublished owner-scoped price-rule request.
 * Binds to the exact authorized snapshot via expectedUpdatedAt.
 * Returns the number of rows updated; callers must treat 0 as conflict and
 * roll back the surrounding transaction.
 */
export const markPriceRuleRequestPublished = async (input: {
  id: string;
  materialId: string;
  requestedByUserId: string;
  expectedUpdatedAt: Date;
  client?: PrismaClientLike;
}): Promise<{ count: number }> => {
  return (input.client ?? prisma).priceRuleRequest.updateMany({
    where: {
      id: input.id,
      requestedByUserId: input.requestedByUserId,
      publishedMaterialId: null,
      updatedAt: input.expectedUpdatedAt,
    },
    data: {
      publishedMaterialId: input.materialId,
      publishedAt: new Date(),
    },
  });
};
