import type { Prisma } from '../../generated/prisma/client.js';

export const authorSelect = {
  id: true,
  displayName: true,
  email: true,
  roles: {
    select: {
      role: true,
      isPrimary: true,
    },
    orderBy: {
      createdAt: 'asc' as const,
    },
  },
} as const;

export const reviewerSelect = {
  id: true,
  displayName: true,
  email: true,
} as const;

export const adminLearningProjectDetailInclude = {
  category: {
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
    },
  },
  createdByUser: {
    select: authorSelect,
  },
  reviewedByUser: {
    select: reviewerSelect,
  },
  images: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      id: true,
      imageUrl: true,
      sortOrder: true,
      createdAt: true,
    },
  },
  requiredComponents: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      createdAt: true,
      componentName: true,
      materialType: true,
      quantity: true,
      unit: true,
      componentRole: true,
      isRequired: true,
      canBeSubstituted: true,
      categoryId: true,
      searchKeywords: true,
      alternativeKeywords: true,
      notes: true,
      providedByUser: true,
      confirmedByUser: true,
      reviewStatus: true,
      category: {
        select: {
          id: true,
          nameEn: true,
          nameAr: true,
          isActive: true,
          categoryType: true,
        },
      },
    },
  },
  steps: {
    orderBy: { stepNumber: 'asc' as const },
    select: {
      id: true,
      stepNumber: true,
      title: true,
      description: true,
      imageUrl: true,
    },
  },
  links: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      createdAt: true,
      linkType: true,
      url: true,
      title: true,
      sourceName: true,
    },
  },
  tags: {
    orderBy: { tag: 'asc' as const },
    select: { id: true, tag: true },
  },
} satisfies Prisma.LearningProjectInclude;

export type AdminLearningProjectDetailRecord = Prisma.LearningProjectGetPayload<{
  include: typeof adminLearningProjectDetailInclude;
}>;
