import type { Prisma } from '../generated/prisma/client.js';

import { prisma } from '../database/prisma.js';

const RECENT_LOOKUP_WINDOW_MS = 24 * 60 * 60 * 1000;

export const findRecentSuccessfulAiLookupLog = async (normalizedQuery: string) => {
  const since = new Date(Date.now() - RECENT_LOOKUP_WINDOW_MS);

  return prisma.aiPriceLookupLog.findFirst({
    where: {
      normalizedQuery,
      createdAt: { gte: since },
      status: 'SUCCESS',
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const createAiPriceLookupLog = async (input: {
  query: string;
  normalizedQuery: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'PENDING_REVIEW';
  resultJson?: Record<string, unknown> | null;
  costEstimate?: number | null;
}) => {
  return prisma.aiPriceLookupLog.create({
    data: {
      query: input.query,
      normalizedQuery: input.normalizedQuery,
      status: input.status,
      resultJson: input.resultJson as Prisma.InputJsonValue | undefined,
      costEstimate: input.costEstimate ?? null,
    },
  });
};

export const buildUnknownMaterialPriceReviewLookupKey = (input: {
  normalizedMaterialName: string;
  categoryId: string;
  userId: string;
  unit: string;
}) =>
  `price-review:${input.normalizedMaterialName}:${input.categoryId}:${input.unit}:${input.userId}`;

export const buildPriceRuleReviewLookupKey = (materialTypeId: string) =>
  `price-rule-review:${materialTypeId}`;
