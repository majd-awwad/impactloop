import type { Prisma } from '../../generated/prisma/index.js';

import { prisma } from '../../database/prisma.js';
import {
  NOTIFICATION_ACTION_TYPES,
  NOTIFICATION_ENTITY_TYPES,
} from '../notifications/notification-identifiers.js';
import { normalizeCategoryNameForComparison } from './admin-approvals.validation.js';

export const countApprovalsSummary = async () => {
  const [category, price] = await Promise.all([
    prisma.categoryRequest.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.priceRuleRequest.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
  ]);

  return { category, price };
};

const categoryRequestInclude = {
  requestedBy: {
    select: {
      id: true,
      displayName: true,
      email: true,
      supplierProfile: {
        select: {
          id: true,
          publicName: true,
          organizationProfile: {
            select: { organizationName: true },
          },
        },
      },
    },
  },
  approvedCategory: {
    select: { id: true, nameEn: true, nameAr: true },
  },
} satisfies Prisma.CategoryRequestInclude;

export type CategoryRequestRecord = Prisma.CategoryRequestGetPayload<{
  include: typeof categoryRequestInclude;
}>;

export const listCategoryRequestsForAdmin = async (input: {
  where: Prisma.CategoryRequestWhereInput;
  skip: number;
  take: number;
}) => {
  const [items, total] = await Promise.all([
    prisma.categoryRequest.findMany({
      where: input.where,
      include: categoryRequestInclude,
      orderBy: { createdAt: 'desc' },
      skip: input.skip,
      take: input.take,
    }),
    prisma.categoryRequest.count({ where: input.where }),
  ]);

  return { items, total };
};

export const findCategoryRequestByIdForAdmin = async (id: string) => {
  return prisma.categoryRequest.findUnique({
    where: { id },
    include: categoryRequestInclude,
  });
};

export const listActiveMaterialFamilyOptions = async () =>
  prisma.taxonomyConcept.findMany({
    where: { conceptType: 'MATERIAL_FAMILY', status: 'ACTIVE' },
    select: {
      id: true,
      canonicalKey: true,
      conceptType: true,
      status: true,
      labelEn: true,
      labelAr: true,
    },
    orderBy: [{ labelEn: 'asc' }, { canonicalKey: 'asc' }],
  });

const approvalCategorySelect = {
  id: true,
  nameEn: true,
  nameAr: true,
  categoryType: true,
  isActive: true,
  materialFamilyConceptId: true,
  materialFamilyConcept: {
    select: {
      id: true,
      canonicalKey: true,
      conceptType: true,
      status: true,
      labelEn: true,
      labelAr: true,
    },
  },
  _count: { select: { materials: true } },
} satisfies Prisma.CategorySelect;

export type ApprovalCategoryRecord = Prisma.CategoryGetPayload<{
  select: typeof approvalCategorySelect;
}>;

export const listActiveMaterialCategoryOptions = async (
  client: typeof prisma | Prisma.TransactionClient = prisma,
) =>
  client.category.findMany({
    where: {
      isActive: true,
      categoryType: { in: ['MATERIAL', 'BOTH'] },
      materialFamilyConcept: {
        is: { conceptType: 'MATERIAL_FAMILY', status: 'ACTIVE' },
      },
    },
    select: approvalCategorySelect,
    orderBy: [{ nameEn: 'asc' }, { id: 'asc' }],
    take: 500,
  });

export type ApprovalCategoryMatchType = 'EXACT_NAME' | 'PARTIAL_TOKEN';

export type ApprovalCategorySuggestion = {
  category: ApprovalCategoryRecord;
  matchType: ApprovalCategoryMatchType;
};

const ENGLISH_STOP_WORDS = new Set(['and', 'for', 'the', 'with']);
const ARABIC_STOP_WORDS = new Set(['في', 'من', 'على', 'مع', 'و']);

const comparisonTokens = (value: string, language: 'EN' | 'AR') =>
  normalizeCategoryNameForComparison(value, language)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => {
      if (language === 'AR') {
        return token.length >= 2 && !ARABIC_STOP_WORDS.has(token);
      }
      return token.length >= 3 && !ENGLISH_STOP_WORDS.has(token);
    });

export const findSuggestedCategoryForApproval = (
  categories: readonly ApprovalCategoryRecord[],
  requestedName: string,
): ApprovalCategorySuggestion | null => {
  if (!requestedName.trim()) return null;
  const requestedEn = normalizeCategoryNameForComparison(requestedName, 'EN');
  const requestedAr = normalizeCategoryNameForComparison(requestedName, 'AR');
  const exact = categories.find(
    (category) =>
      normalizeCategoryNameForComparison(category.nameEn, 'EN') === requestedEn ||
      normalizeCategoryNameForComparison(category.nameAr, 'AR') === requestedAr,
  );
  if (exact) return { category: exact, matchType: 'EXACT_NAME' };

  const requestedEnTokens = new Set(comparisonTokens(requestedName, 'EN'));
  const requestedArTokens = new Set(comparisonTokens(requestedName, 'AR'));
  const ranked = categories
    .map((category) => {
      const englishOverlap = comparisonTokens(category.nameEn, 'EN').filter(
        (token) => requestedEnTokens.has(token),
      ).length;
      const arabicOverlap = comparisonTokens(category.nameAr, 'AR').filter(
        (token) => requestedArTokens.has(token),
      ).length;
      return { category, overlap: Math.max(englishOverlap, arabicOverlap) };
    })
    .filter((candidate) => candidate.overlap > 0)
    .sort(
      (left, right) =>
        right.overlap - left.overlap ||
        left.category.nameEn.localeCompare(right.category.nameEn, 'en') ||
        left.category.id.localeCompare(right.category.id),
    );
  return ranked[0]
    ? { category: ranked[0].category, matchType: 'PARTIAL_TOKEN' }
    : null;
};

export const findCategoryRequestByIdForApproval = async (
  tx: Prisma.TransactionClient,
  id: string,
) =>
  tx.categoryRequest.findUnique({
    where: { id },
    include: categoryRequestInclude,
  });

export const findTaxonomyConceptByIdForApproval = async (
  tx: Prisma.TransactionClient,
  id: string,
) =>
  tx.taxonomyConcept.findUnique({
    where: { id },
    select: {
      id: true,
      canonicalKey: true,
      conceptType: true,
      status: true,
      labelEn: true,
      labelAr: true,
    },
  });

export const findExistingCategoryByIdForApproval = async (
  tx: Prisma.TransactionClient,
  id: string,
) =>
  tx.category.findUnique({
    where: { id },
    select: approvalCategorySelect,
  });

export const findCategoryNameConflictForApproval = async (
  tx: Prisma.TransactionClient,
  input: { nameEn: string; nameAr: string },
) => {
  const proposedEn = normalizeCategoryNameForComparison(input.nameEn, 'EN');
  const proposedAr = normalizeCategoryNameForComparison(input.nameAr, 'AR');
  const categories = await tx.category.findMany({
    where: { categoryType: { in: ['MATERIAL', 'BOTH'] } },
    select: approvalCategorySelect,
  });

  for (const category of categories) {
    for (const [storedField, storedValue] of [
      ['nameEn', category.nameEn],
      ['nameAr', category.nameAr],
    ] as const) {
      if (
        normalizeCategoryNameForComparison(storedValue, 'EN') === proposedEn
      ) {
        return { category, proposedField: 'nameEn' as const, storedField };
      }
      if (
        normalizeCategoryNameForComparison(storedValue, 'AR') === proposedAr
      ) {
        return { category, proposedField: 'nameAr' as const, storedField };
      }
    }
  }
  return null;
};

export const createOwnedMaterialCategoryForApproval = async (
  tx: Prisma.TransactionClient,
  input: { nameEn: string; nameAr: string; materialFamilyConceptId: string },
) =>
  tx.category.create({
    data: {
      nameEn: input.nameEn,
      nameAr: input.nameAr,
      parentId: null,
      materialFamilyConceptId: input.materialFamilyConceptId,
      projectTopicConceptId: null,
      categoryType: 'MATERIAL',
      isActive: true,
    },
  });

export const markPendingCategoryRequestApproved = async (
  tx: Prisma.TransactionClient,
  input: { requestId: string; approvedCategoryId: string },
) => {
  const update = await tx.categoryRequest.updateMany({
    where: { id: input.requestId, status: 'PENDING' },
    data: {
      status: 'APPROVED',
      approvedCategoryId: input.approvedCategoryId,
      moderatorNote: null,
    },
  });

  if (update.count !== 1) return null;

  return tx.categoryRequest.findUniqueOrThrow({
    where: { id: input.requestId },
    include: categoryRequestInclude,
  });
};

export const createCategoryApprovalNotification = async (
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    requestId: string;
    requestedName: string;
    adminId: string;
    resolutionMode: 'USE_EXISTING_CATEGORY' | 'CREATE_NEW_CATEGORY';
    categoryNameEn: string;
    categoryNameAr: string;
  },
) =>
  tx.notification.upsert({
    where: { eventKey: `material-review:category:${input.requestId}:APPROVED` },
    create: {
      userId: input.userId,
      notificationType: 'CATEGORY_REQUEST_UPDATE',
      title: 'Category request approved',
      body:
        input.resolutionMode === 'USE_EXISTING_CATEGORY'
          ? `Your category request "${input.requestedName}" was approved using the existing marketplace category "${input.categoryNameEn}" / "${input.categoryNameAr}".`
          : `Your category request "${input.requestedName}" was approved and the new marketplace category "${input.categoryNameEn}" / "${input.categoryNameAr}" was created.`,
      relatedEntityType: NOTIFICATION_ENTITY_TYPES.CATEGORY_REQUEST,
      relatedEntityId: input.requestId,
      eventKey: `material-review:category:${input.requestId}:APPROVED`,
      entityType: NOTIFICATION_ENTITY_TYPES.CATEGORY_REQUEST,
      entityId: input.requestId,
      actionType: NOTIFICATION_ACTION_TYPES.CONTINUE_LISTING,
      actorId: input.adminId,
    },
    update: {},
  });

export type CategoryApprovalActivityInput = {
  adminId: string;
  requestId: string;
  requestedName: string;
  resolutionMode: 'USE_EXISTING_CATEGORY' | 'CREATE_NEW_CATEGORY';
  categoryNameEn: string;
  categoryNameAr: string;
  approvedCategoryId: string;
  supplierEmail: string;
  adminJustification?: string | null;
  sharedNameAcknowledged: boolean;
  concept: {
    id: string;
    canonicalKey: string;
    conceptType: string;
    status: string;
  };
};

export const createCategoryApprovalActivity = async (
  tx: Prisma.TransactionClient,
  input: CategoryApprovalActivityInput,
) =>
  tx.adminActivityLog.create({
    data: {
      actorUserId: input.adminId,
      action: 'CATEGORY_REQUEST_APPROVED',
      targetType: 'CATEGORY_REQUEST',
      targetId: input.requestId,
      targetLabel: `${input.categoryNameEn} / ${input.categoryNameAr}`,
      metadata: {
        requestedName: input.requestedName,
        resolutionMode: input.resolutionMode,
        ...(input.resolutionMode === 'USE_EXISTING_CATEGORY'
          ? {
              selectedCategoryId: input.approvedCategoryId,
              selectedCategoryNameEn: input.categoryNameEn,
              selectedCategoryNameAr: input.categoryNameAr,
            }
          : {
              createdCategoryId: input.approvedCategoryId,
              finalNameEn: input.categoryNameEn,
              finalNameAr: input.categoryNameAr,
              adminJustification: input.adminJustification ?? null,
              sharedNameAcknowledged: input.sharedNameAcknowledged,
            }),
        approvedCategoryId: input.approvedCategoryId,
        supplierEmail: input.supplierEmail,
        materialFamilyConceptId: input.concept.id,
        materialFamilyCanonicalKey: input.concept.canonicalKey,
        materialFamilyConceptType: input.concept.conceptType,
        materialFamilyConceptStatus: input.concept.status,
      },
    },
  });

export const rejectCategoryRequest = async (input: {
  requestId: string;
  adminNote: string;
  suggestedCategoryId?: string | null;
}) => {
  return prisma.categoryRequest.update({
    where: { id: input.requestId },
    data: {
      status: 'REJECTED',
      moderatorNote: input.adminNote,
    },
    include: categoryRequestInclude,
  });
};

const priceRequestInclude = {
  requestedBy: {
    select: {
      id: true,
      displayName: true,
      email: true,
      supplierProfile: {
        select: {
          id: true,
          publicName: true,
          organizationProfile: { select: { organizationName: true } },
        },
      },
    },
  },
  category: {
    select: { id: true, nameEn: true, nameAr: true },
  },
  materialType: {
    select: { id: true, nameEn: true, defaultUnit: true },
  },
  publishedMaterial: {
    select: { id: true, title: true },
  },
} satisfies Prisma.PriceRuleRequestInclude;

export type PriceRuleRequestRecord = Prisma.PriceRuleRequestGetPayload<{
  include: typeof priceRequestInclude;
}>;

export const listPriceRuleRequestsForAdmin = async (input: {
  where: Prisma.PriceRuleRequestWhereInput;
  skip: number;
  take: number;
}) => {
  const [items, total] = await Promise.all([
    prisma.priceRuleRequest.findMany({
      where: input.where,
      include: priceRequestInclude,
      orderBy: { createdAt: 'desc' },
      skip: input.skip,
      take: input.take,
    }),
    prisma.priceRuleRequest.count({ where: input.where }),
  ]);

  return { items, total };
};

export const findPriceRuleRequestByIdForAdmin = async (id: string) => {
  return prisma.priceRuleRequest.findUnique({
    where: { id },
    include: priceRequestInclude,
  });
};

export const updatePriceRuleRequestDecision = async (input: {
  id: string;
  status: 'APPROVED' | 'REJECTED';
  moderatorNote: string | null;
  approvedMaxAllowedUnitPriceNis: number | null;
}) => {
  const updated = await prisma.priceRuleRequest.update({
    where: { id: input.id },
    data: {
      status: input.status,
      moderatorNote: input.moderatorNote,
      adminApprovedMaxUnitPriceNis: input.approvedMaxAllowedUnitPriceNis,
    },
    select: { id: true },
  });

  return prisma.priceRuleRequest.findUniqueOrThrow({
    where: { id: updated.id },
    include: priceRequestInclude,
  });
};

