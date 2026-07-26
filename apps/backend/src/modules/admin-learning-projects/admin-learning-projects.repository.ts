import type { LearningProjectStatus, Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';

import {
  defaultComponentConceptLifecycleDeps,
  type ComponentConceptLifecycleDeps,
} from '../taxonomy/component-concept-assignment.repository.js';
import {
  defaultProjectTopicLifecycleDeps,
  type ProjectTopicLifecycleDeps,
} from '../taxonomy/project-concept-assignment.repository.js';
import { assertEditableProjectStatus } from './admin-learning-projects.component-enrichment.js';
import type { AdminLearningProjectsListQuery } from './admin-learning-projects.validation.js';
import { AppError } from '../../utils/app-error.js';
import { runSerializableTransaction } from '../../utils/transaction-retry.js';

const startOfUtcDay = (date: Date) => {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
};

const buildDateRange = (dateFrom?: string, dateTo?: string) => {
  if (!dateFrom && !dateTo) return undefined;

  const createdAt: Prisma.DateTimeFilter = {};
  if (dateFrom) {
    const parsed = new Date(dateFrom);
    if (!Number.isNaN(parsed.getTime())) {
      createdAt.gte = startOfUtcDay(parsed);
    }
  }
  if (dateTo) {
    const parsed = new Date(dateTo);
    if (!Number.isNaN(parsed.getTime())) {
      const end = startOfUtcDay(parsed);
      end.setUTCHours(23, 59, 59, 999);
      createdAt.lte = end;
    }
  }

  return Object.keys(createdAt).length > 0 ? createdAt : undefined;
};

const authorSelect = {
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

const reviewerSelect = {
  id: true,
  displayName: true,
  email: true,
} as const;

export const adminLearningProjectListInclude = {
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
  _count: {
    select: {
      requiredComponents: true,
      steps: true,
      images: true,
      links: true,
    },
  },
} satisfies Prisma.LearningProjectInclude;

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
    },
  },
  requiredComponents: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
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
      linkType: true,
      url: true,
      title: true,
      sourceName: true,
    },
  },
  tags: {
    orderBy: { tag: 'asc' as const },
    select: { tag: true },
  },
} satisfies Prisma.LearningProjectInclude;

export type AdminLearningProjectListRecord = Prisma.LearningProjectGetPayload<{
  include: typeof adminLearningProjectListInclude;
}>;

export type AdminLearningProjectDetailRecord = Prisma.LearningProjectGetPayload<{
  include: typeof adminLearningProjectDetailInclude;
}>;

const buildSearchWhere = (
  search?: string,
): Prisma.LearningProjectWhereInput | undefined => {
  const normalized = search?.trim();
  if (!normalized) return undefined;

  return {
    OR: [
      { title: { contains: normalized, mode: 'insensitive' } },
      { shortDescription: { contains: normalized, mode: 'insensitive' } },
      { description: { contains: normalized, mode: 'insensitive' } },
      {
        createdByUser: {
          displayName: { contains: normalized, mode: 'insensitive' },
        },
      },
      {
        createdByUser: { email: { contains: normalized, mode: 'insensitive' } },
      },
      {
        category: { nameEn: { contains: normalized, mode: 'insensitive' } },
      },
      {
        category: { nameAr: { contains: normalized, mode: 'insensitive' } },
      },
    ],
  };
};

export const buildAdminLearningProjectsWhere = (
  query: AdminLearningProjectsListQuery,
): Prisma.LearningProjectWhereInput => {
  const and: Prisma.LearningProjectWhereInput[] = [];

  const searchWhere = buildSearchWhere(query.search);
  if (searchWhere) and.push(searchWhere);

  if (query.status) {
    and.push({ status: query.status as LearningProjectStatus });
  }

  if (query.categoryId) {
    and.push({ categoryId: query.categoryId });
  }

  if (query.difficulty) {
    and.push({ difficulty: query.difficulty });
  }

  const createdAt = buildDateRange(query.dateFrom, query.dateTo);
  if (createdAt) and.push({ createdAt });

  return and.length > 0 ? { AND: and } : {};
};

export const countAdminLearningProjectsSummary = async () => {
  const [
    total,
    pendingReview,
    published,
    changesRequested,
    rejectedHidden,
  ] = await Promise.all([
    prisma.learningProject.count(),
    prisma.learningProject.count({ where: { status: 'PENDING_REVIEW' } }),
    prisma.learningProject.count({ where: { status: 'PUBLISHED' } }),
    prisma.learningProject.count({ where: { status: 'CHANGES_REQUESTED' } }),
    prisma.learningProject.count({
      where: { status: { in: ['REJECTED', 'HIDDEN', 'ARCHIVED'] } },
    }),
  ]);

  return {
    total,
    pendingReview,
    published,
    changesRequested,
    rejectedHidden,
  };
};

export const listAdminLearningProjects = async (
  query: AdminLearningProjectsListQuery,
) => {
  const where = buildAdminLearningProjectsWhere(query);
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.learningProject.findMany({
      where,
      include: adminLearningProjectListInclude,
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: query.limit,
    }),
    prisma.learningProject.count({ where }),
  ]);

  return { items, total };
};

export const findAdminLearningProjectById = async (id: string) => {
  return prisma.learningProject.findUnique({
    where: { id },
    include: adminLearningProjectDetailInclude,
  });
};

export const updateLearningProjectModeration = async (
  id: string,
  data: Prisma.LearningProjectUpdateInput,
) => {
  const updated = await prisma.learningProject.update({
    where: { id },
    data,
    select: { id: true },
  });

  return prisma.learningProject.findUniqueOrThrow({
    where: { id: updated.id },
    include: adminLearningProjectDetailInclude,
  });
};

const APPROVE_FROM_STATUSES: LearningProjectStatus[] = [
  'PENDING_REVIEW',
  'CHANGES_REQUESTED',
  'REJECTED',
];

export const approveLearningProjectInTransaction = async (
  client: Prisma.TransactionClient,
  input: {
    id: string;
    moderationData: Prisma.LearningProjectUncheckedUpdateManyInput;
    topicLifecycleDeps?: ProjectTopicLifecycleDeps;
    componentLifecycleDeps?: ComponentConceptLifecycleDeps;
  },
) => {
  const topicLifecycleDeps =
    input.topicLifecycleDeps ?? defaultProjectTopicLifecycleDeps;
  const componentLifecycleDeps =
    input.componentLifecycleDeps ?? defaultComponentConceptLifecycleDeps;

  const updated = await client.learningProject.updateMany({
    where: {
      id: input.id,
      status: { in: APPROVE_FROM_STATUSES },
    },
    data: input.moderationData,
  });

  if (updated.count === 0) {
    throw new AppError(
      'Cannot approve while project status is not eligible for approval.',
      400,
      'INVALID_STATUS_TRANSITION',
    );
  }

  const project = await client.learningProject.findUniqueOrThrow({
    where: { id: input.id },
    select: { categoryId: true, status: true },
  });

  await topicLifecycleDeps.reconcileLearningProjectTopics(
    client,
    input.id,
    project.categoryId,
  );

  await componentLifecycleDeps.reconcileLearningProjectComponents(
    client,
    input.id,
  );

  return { id: input.id };
};

export const createLearningProjectAuthorNotification = async (input: {
  userId: string;
  title: string;
  body: string;
  projectId: string;
}) =>
  prisma.notification.create({
    data: {
      userId: input.userId,
      notificationType: 'LEARNING_PROJECT_MODERATION',
      title: input.title,
      body: input.body,
      relatedEntityType: 'LEARNING_PROJECT',
      relatedEntityId: input.projectId,
    },
  });

export const listProjectCategoriesForAdmin = async () =>
  prisma.category.findMany({
    where: {
      isActive: true,
      categoryType: { in: ['PROJECT', 'BOTH'] },
    },
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
    },
    orderBy: { nameEn: 'asc' },
  });

export const listMaterialCategoriesForAdmin = async () =>
  prisma.category.findMany({
    where: {
      isActive: true,
      categoryType: { in: ['MATERIAL', 'BOTH'] },
    },
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
    },
    orderBy: { nameEn: 'asc' },
  });

export const updateAdminLearningProjectComponent = async (input: {
  projectId: string;
  componentId: string;
  data: Prisma.ProjectRequiredComponentUpdateInput;
  componentLifecycleDeps?: ComponentConceptLifecycleDeps;
}) => {
  const componentLifecycleDeps =
    input.componentLifecycleDeps ?? defaultComponentConceptLifecycleDeps;

  return runSerializableTransaction(async (tx) => {
    const project = await tx.learningProject.findUniqueOrThrow({
      where: { id: input.projectId },
      select: { id: true, status: true },
    });
    assertEditableProjectStatus(project.status);

    const existing = await tx.projectRequiredComponent.findFirst({
      where: {
        id: input.componentId,
        projectId: input.projectId,
      },
      select: { id: true },
    });

    if (!existing) {
      return null;
    }

    await tx.projectRequiredComponent.update({
      where: { id: input.componentId },
      data: input.data,
    });

    const committedComponent = await tx.projectRequiredComponent.findUniqueOrThrow({
      where: { id: input.componentId },
      select: {
        id: true,
        componentName: true,
        materialType: true,
      },
    });

    await componentLifecycleDeps.reconcileProjectRequiredComponent(
      tx,
      committedComponent.id,
    );

    return tx.projectRequiredComponent.findUniqueOrThrow({
      where: { id: input.componentId },
    });
  });
};
