import type { Prisma } from '../../generated/prisma/index.js';

import { prisma } from '../../database/prisma.js';

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

export const approveCategoryRequest = async (input: {
  requestId: string;
  category: {
    nameEn: string;
    nameAr: string;
    parentId?: string | null;
  };
  adminNote: string | null;
}) => {
  return prisma.$transaction(async (tx) => {
    const createdCategory = await tx.category.create({
      data: {
        nameEn: input.category.nameEn,
        nameAr: input.category.nameAr,
        parentId: input.category.parentId ?? null,
        categoryType: 'MATERIAL',
        isActive: true,
      },
    });

    const updatedRequest = await tx.categoryRequest.update({
      where: { id: input.requestId },
      data: {
        status: 'APPROVED',
        approvedCategoryId: createdCategory.id,
        moderatorNote: input.adminNote,
      },
      include: categoryRequestInclude,
    });

    return { createdCategory, updatedRequest };
  });
};

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

