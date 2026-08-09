import type { Prisma } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { runSerializableTransaction } from '../../utils/transaction-retry.js';
import {
  defaultComponentConceptLifecycleDeps,
  type ComponentConceptLifecycleDeps,
} from '../taxonomy/component-concept-assignment.repository.js';
import {
  defaultProjectTopicLifecycleDeps,
  type ProjectTopicLifecycleDeps,
} from '../taxonomy/project-concept-assignment.repository.js';
import type {
  LearningProjectsQuery,
  MyLearningProjectsQuery,
  UpdateProjectBuildItemInput,
} from './learning-projects.validation.js';
import {
  setBuildItemLinkedReservationId,
  validateBuildItemForReservationLink,
} from './learning-projects.build-reservation-linking.js';
import { resolveBuildItemStepUnlockReadinessFromState } from './learning-projects.build-item-state.js';
import { projectBuildInclude } from './learning-projects.project-build.includes.js';
import {
  ACTIVE_PROJECT_BUILD_STATUSES,
  EDITABLE_LEARNING_PROJECT_SUBMISSION_STATUSES,
  RESUBMITTABLE_LEARNING_PROJECT_STATUSES,
  SUBMITTABLE_LEARNING_PROJECT_STATUSES,
  isLearningProjectSubmissionEditable,
} from './learning-project-status.policy.js';

export { projectBuildInclude } from './learning-projects.project-build.includes.js';
import {
  mapNormalizedComponentToCreateData,
  type NormalizedSubmitComponent,
} from './learning-projects.submit-components.js';

const clientOrPrisma = (client?: Prisma.TransactionClient) => client ?? prisma;

const publicProjectWhere: Prisma.LearningProjectWhereInput = {
  status: 'PUBLISHED',
  hiddenAt: null,
  archivedAt: null,
  category: {
    isActive: true,
    categoryType: {
      in: ['PROJECT', 'BOTH'],
    },
  },
};

const buildSearchClauses = (q: string): Prisma.LearningProjectWhereInput[] => [
  {
    title: {
      contains: q,
      mode: 'insensitive',
    },
  },
  {
    shortDescription: {
      contains: q,
      mode: 'insensitive',
    },
  },
  {
    description: {
      contains: q,
      mode: 'insensitive',
    },
  },
  {
    tags: {
      some: {
        tag: {
          contains: q,
          mode: 'insensitive',
        },
      },
    },
  },
  {
    category: {
      nameEn: {
        contains: q,
        mode: 'insensitive',
      },
    },
  },
  {
    category: {
      nameAr: {
        contains: q,
        mode: 'insensitive',
      },
    },
  },
];

const buildLearningProjectsWhere = (
  query: LearningProjectsQuery,
): Prisma.LearningProjectWhereInput => {
  const where: Prisma.LearningProjectWhereInput = {
    ...publicProjectWhere,
  };

  if (query.categoryId) {
    where.categoryId = query.categoryId;
  }

  if (query.difficulty) {
    where.difficulty = query.difficulty;
  }

  if (query.tag) {
    where.tags = {
      some: {
        tag: {
          equals: query.tag,
          mode: 'insensitive',
        },
      },
    };
  }

  if (query.q) {
    where.OR = buildSearchClauses(query.q);
  }

  return where;
};

export const LEARNING_PROJECT_BROWSE_CANDIDATE_LIMIT = 200;

export const findLearningProjectBrowseCandidates = async (
  query: LearningProjectsQuery,
) => {
  const where = buildLearningProjectsWhere(query);

  return prisma.learningProject.findMany({
    where,
    include: learningProjectListInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    take: LEARNING_PROJECT_BROWSE_CANDIDATE_LIMIT,
  });
};

const learningProjectListInclude = {
  category: {
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
      isActive: true,
      categoryType: true,
    },
  },
  createdByUser: {
    select: {
      displayName: true,
      email: true,
    },
  },
  tags: {
    select: {
      tag: true,
    },
    orderBy: {
      tag: 'asc' as const,
    },
  },
} satisfies Prisma.LearningProjectInclude;

const learningProjectDetailInclude = {
  category: {
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
      isActive: true,
      categoryType: true,
    },
  },
  createdByUser: {
    select: {
      displayName: true,
      email: true,
    },
  },
  images: {
    select: {
      id: true,
      imageUrl: true,
      sortOrder: true,
    },
    orderBy: {
      sortOrder: 'asc' as const,
    },
  },
  requiredComponents: {
    select: {
      id: true,
      categoryId: true,
      componentName: true,
      materialType: true,
      quantity: true,
      unit: true,
      componentRole: true,
      isRequired: true,
      canBeSubstituted: true,
      notes: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'asc' as const,
    },
  },
  steps: {
    select: {
      id: true,
      stepNumber: true,
      title: true,
      description: true,
      imageUrl: true,
    },
    orderBy: {
      stepNumber: 'asc' as const,
    },
  },
  links: {
    select: {
      id: true,
      linkType: true,
      url: true,
      title: true,
      sourceName: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'asc' as const,
    },
  },
  tags: {
    select: {
      tag: true,
    },
    orderBy: {
      tag: 'asc' as const,
    },
  },
} satisfies Prisma.LearningProjectInclude;

const myLearningProjectDetailInclude = {
  ...learningProjectDetailInclude,
  requiredComponents: {
    select: {
      id: true,
      categoryId: true,
      componentName: true,
      materialType: true,
      quantity: true,
      unit: true,
      componentRole: true,
      isRequired: true,
      canBeSubstituted: true,
      searchKeywords: true,
      alternativeKeywords: true,
      providedByUser: true,
      confirmedByUser: true,
      generatedOrSuggestedByAi: true,
      reviewStatus: true,
      notes: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'asc' as const,
    },
  },
} satisfies Prisma.LearningProjectInclude;

export const findLearningProjects = async (query: LearningProjectsQuery) => {
  const where = buildLearningProjectsWhere(query);
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.learningProject.findMany({
      where,
      include: learningProjectListInclude,
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: query.limit,
    }),
    prisma.learningProject.count({ where }),
  ]);

  return { items, total };
};

export const findSavedLearningProjects = async (
  query: LearningProjectsQuery,
  userId: string,
) => {
  const where: Prisma.LearningProjectWhereInput = {
    ...buildLearningProjectsWhere(query),
    saves: {
      some: {
        userId,
      },
    },
  };
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.learningProject.findMany({
      where,
      include: learningProjectListInclude,
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: query.limit,
    }),
    prisma.learningProject.count({ where }),
  ]);

  return { items, total };
};

export const findFollowedLearningProjects = async (
  query: LearningProjectsQuery,
  userId: string,
) => {
  const where: Prisma.LearningProjectWhereInput = {
    ...buildLearningProjectsWhere(query),
    follows: {
      some: {
        userId,
      },
    },
  };
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.learningProject.findMany({
      where,
      include: learningProjectListInclude,
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: query.limit,
    }),
    prisma.learningProject.count({ where }),
  ]);

  return { items, total };
};

export const findMyLearningProjectSubmissions = async (
  query: MyLearningProjectsQuery,
  userId: string,
) => {
  const where: Prisma.LearningProjectWhereInput = {
    createdBy: userId,
    ...(query.status ? { status: query.status } : {}),
  };
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.learningProject.findMany({
      where,
      include: learningProjectListInclude,
      orderBy: [
        { submittedAt: 'desc' },
        { updatedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      skip,
      take: query.limit,
    }),
    prisma.learningProject.count({ where }),
  ]);

  return { items, total };
};

export const findMyLearningProjectSubmissionById = async (
  id: string,
  userId: string,
) => {
  return prisma.learningProject.findFirst({
    where: {
      id,
      createdBy: userId,
    },
    include: myLearningProjectDetailInclude,
  });
};

export const findLearningProjectById = async (id: string) => {
  return prisma.learningProject.findFirst({
    where: {
      id,
      ...publicProjectWhere,
    },
    include: learningProjectDetailInclude,
  });
};

export const findPublicLearningProjectById = async (id: string) => {
  return prisma.learningProject.findFirst({
    where: {
      id,
      ...publicProjectWhere,
    },
    select: {
      id: true,
    },
  });
};

export const findProjectBuild = async (
  projectId: string,
  learnerId: string,
  buildId?: string,
) => {
  const { findProjectBuildForLearner } = await import(
    './project-build-lifecycle.js'
  );
  return findProjectBuildForLearner({ projectId, learnerId, buildId });
};

export const findOwnedProjectBuildByBuildId = async (
  buildId: string,
  learnerId: string,
) => {
  return prisma.projectBuild.findFirst({
    where: {
      id: buildId,
      learnerId,
    },
    include: projectBuildInclude,
  });
};

export const findActiveProjectBuildsForLearner = async (learnerId: string) => {
  return prisma.projectBuild.findMany({
    where: {
      learnerId,
      status: 'IN_PROGRESS',
    },
    include: projectBuildInclude,
    orderBy: {
      updatedAt: 'desc',
    },
    take: 10,
  });
};

export const startProjectBuild = async (
  projectId: string,
  learnerId: string,
) => {
  const { startOrReturnProjectBuild } = await import(
    './project-build-lifecycle.js'
  );
  return startOrReturnProjectBuild(projectId, learnerId);
};

export const startProjectBuildAgain = async (
  projectId: string,
  learnerId: string,
) => {
  const { createProjectBuildAttempt } = await import(
    './project-build-lifecycle.js'
  );
  return createProjectBuildAttempt(projectId, learnerId);
};

export const updateProjectBuildItem = async (input: {
  projectId: string;
  learnerId: string;
  itemId: string;
  status: UpdateProjectBuildItemInput['status'];
  learnerNote?: string | null;
}) => {
  const build = await prisma.$transaction(async (tx) => {
    const item = await tx.projectBuildItem.findFirst({
      where: {
        id: input.itemId,
        build: {
          projectId: input.projectId,
          learnerId: input.learnerId,
          project: {
            is: publicProjectWhere,
          },
        },
      },
      select: {
        id: true,
        buildId: true,
      },
    });

    if (!item) {
      return null;
    }

    await tx.projectBuildItem.update({
      where: {
        id: item.id,
      },
      data: {
        status: input.status,
        learnerNote: input.learnerNote,
      },
    });

    return item;
  });

  return build
    ? prisma.projectBuild.findUniqueOrThrow({
        where: { id: build.buildId },
        include: projectBuildInclude,
      })
    : null;
};

export const findLearnerBuildItem = async (input: {
  projectId: string;
  learnerId: string;
  itemId: string;
}) =>
  prisma.projectBuildItem.findFirst({
    where: {
      id: input.itemId,
      build: {
        projectId: input.projectId,
        learnerId: input.learnerId,
        project: {
          is: publicProjectWhere,
        },
      },
    },
    include: {
      requiredComponent: {
        select: {
          id: true,
          categoryId: true,
          componentName: true,
          materialType: true,
          componentRole: true,
          searchKeywords: true,
          alternativeKeywords: true,
        },
      },
      linkedReservation: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

export const linkBuildItemMaterial = async (input: {
  projectId: string;
  learnerId: string;
  itemId: string;
  materialId: string;
}) => {
  const build = await prisma.$transaction(async (tx) => {
    const item = await tx.projectBuildItem.findFirst({
      where: {
        id: input.itemId,
        build: {
          projectId: input.projectId,
          learnerId: input.learnerId,
          project: {
            is: publicProjectWhere,
          },
        },
      },
      select: {
        id: true,
        buildId: true,
        linkedMaterialId: true,
      },
    });

    if (!item) {
      return null;
    }

    await tx.projectBuildItem.update({
      where: { id: item.id },
      data: {
        linkedMaterialId: input.materialId,
        linkedMaterialAt: new Date(),
        dismissedAcquiredReservationId: null,
      },
    });

    return item;
  });

  return build
    ? prisma.projectBuild.findUniqueOrThrow({
        where: { id: build.buildId },
        include: projectBuildInclude,
      })
    : null;
};

export const unlinkBuildItemMaterial = async (input: {
  projectId: string;
  learnerId: string;
  itemId: string;
  clearReservationLink: boolean;
}) => {
  const build = await prisma.$transaction(async (tx) => {
    const item = await tx.projectBuildItem.findFirst({
      where: {
        id: input.itemId,
        build: {
          projectId: input.projectId,
          learnerId: input.learnerId,
          project: {
            is: publicProjectWhere,
          },
        },
      },
      select: {
        id: true,
        buildId: true,
      },
    });

    if (!item) {
      return null;
    }

    await tx.projectBuildItem.update({
      where: { id: item.id },
      data: {
        linkedMaterialId: null,
        linkedMaterialAt: null,
        ...(input.clearReservationLink
          ? { linkedReservationId: null }
          : {}),
      },
    });

    return item;
  });

  return build
    ? prisma.projectBuild.findUniqueOrThrow({
        where: { id: build.buildId },
        include: projectBuildInclude,
      })
    : null;
};

export const removeAcquiredBuildItemAllocation = async (input: {
  projectId: string;
  learnerId: string;
  itemId: string;
  materialId: string;
  reservationId: string;
}) => {
  const result = await prisma.$transaction(async (tx) => {
    const item = await tx.projectBuildItem.findFirst({
      where: {
        id: input.itemId,
        linkedMaterialId: input.materialId,
        linkedReservationId: input.reservationId,
        build: {
          projectId: input.projectId,
          learnerId: input.learnerId,
          status: { not: 'ARCHIVED' },
          project: {
            is: publicProjectWhere,
          },
        },
      },
      select: {
        id: true,
        buildId: true,
      },
    });

    if (!item) {
      return null;
    }

    const cleared = await tx.projectBuildItem.updateMany({
      where: {
        id: item.id,
        linkedMaterialId: input.materialId,
        linkedReservationId: input.reservationId,
      },
      data: {
        linkedMaterialId: null,
        linkedReservationId: null,
        linkedMaterialAt: null,
        dismissedAcquiredReservationId: input.reservationId,
      },
    });

    if (cleared.count !== 1) {
      return null;
    }

    return item;
  });

  return result;
};

export const linkBuildItemReservation = async (input: {
  projectId: string;
  learnerId: string;
  itemId: string;
  reservationId: string;
}) => {
  const build = await prisma.$transaction(async (tx) => {
    const buildItem = await tx.projectBuildItem.findFirst({
      where: {
        id: input.itemId,
        build: {
          projectId: input.projectId,
          learnerId: input.learnerId,
          project: {
            is: publicProjectWhere,
          },
        },
      },
      select: {
        id: true,
        buildId: true,
        linkedMaterialId: true,
        linkedReservationId: true,
        requiredComponent: {
          select: {
            quantity: true,
            unit: true,
          },
        },
      },
    });

    if (!buildItem) {
      throw new AppError('Project build item not found', 404, 'NOT_FOUND');
    }

    const reservation = await tx.reservation.findFirst({
      where: {
        id: input.reservationId,
        requesterId: input.learnerId,
      },
      select: {
        id: true,
        materialId: true,
        quantityRequested: true,
        status: true,
      },
    });

    if (!reservation) {
      throw new AppError('Reservation not found', 404, 'NOT_FOUND');
    }

    if (
      !buildItem.linkedMaterialId ||
      buildItem.linkedMaterialId !== reservation.materialId
    ) {
      throw new AppError(
        'Reservation material does not match the linked build item material',
        400,
        'BUILD_ITEM_MATERIAL_MISMATCH',
      );
    }

    if (
      buildItem.linkedReservationId &&
      buildItem.linkedReservationId === reservation.id
    ) {
      return { id: buildItem.buildId };
    }

    const material = await tx.material.findUnique({
      where: { id: reservation.materialId },
      select: { unit: true },
    });

    if (!material) {
      throw new AppError('Material not found', 404, 'NOT_FOUND');
    }

    const validation = await validateBuildItemForReservationLink(tx, {
      learnerId: input.learnerId,
      buildItemId: buildItem.id,
      materialId: reservation.materialId,
      ignoreReservationId: reservation.id,
      reservationId: reservation.id,
      quantityRequested: reservation.quantityRequested,
      materialUnit: material.unit,
    });

    if (!validation.ok) {
      switch (validation.code) {
        case 'BUILD_ITEM_NOT_FOUND':
          throw new AppError('Project build item not found', 404, 'NOT_FOUND');
        case 'BUILD_ITEM_MATERIAL_MISMATCH':
          throw new AppError(
            'Reservation material does not match the linked build item material',
            400,
            'BUILD_ITEM_MATERIAL_MISMATCH',
          );
        case 'ACTIVE_BUILD_ITEM_RESERVATION':
          throw new AppError(
            'This build checklist item already has an active linked reservation',
            409,
            'ACTIVE_BUILD_ITEM_RESERVATION',
          );
        case 'INSUFFICIENT_QUANTITY':
          throw new AppError(
            'Reserved quantity is insufficient for this build item',
            400,
            'INSUFFICIENT_QUANTITY',
          );
        case 'RESERVATION_ALREADY_ALLOCATED':
          throw new AppError(
            'This reservation is already linked to another build item',
            409,
            'RESERVATION_ALREADY_ALLOCATED',
          );
        case 'INCOMPATIBLE_UNIT':
          throw new AppError(
            'Material unit is not compatible with the required component unit',
            400,
            'INCOMPATIBLE_UNIT',
          );
        default:
          throw new AppError(
            'Unable to link reservation to build item',
            500,
            'INTERNAL_ERROR',
          );
      }
    }

    await setBuildItemLinkedReservationId(tx, buildItem.id, reservation.id);

    return { id: buildItem.buildId };
  });

  return prisma.projectBuild.findUniqueOrThrow({
    where: { id: build.id },
    include: projectBuildInclude,
  });
};

export const countLikesByProjectIds = async (projectIds: string[]) => {
  if (projectIds.length === 0) {
    return new Map<string, number>();
  }

  const groups = await prisma.projectLike.groupBy({
    by: ['projectId'],
    where: { projectId: { in: projectIds } },
    _count: { _all: true },
  });

  return new Map(groups.map((group) => [group.projectId, group._count._all]));
};

export const findLikedProjectIds = async (
  userId: string | undefined,
  projectIds: string[],
) => {
  if (!userId || projectIds.length === 0) {
    return new Set<string>();
  }

  const likes = await prisma.projectLike.findMany({
    where: {
      userId,
      projectId: { in: projectIds },
    },
    select: {
      projectId: true,
    },
  });

  return new Set(likes.map((like) => like.projectId));
};

export const findSavedProjectIds = async (
  userId: string | undefined,
  projectIds: string[],
) => {
  if (!userId || projectIds.length === 0) {
    return new Set<string>();
  }

  const saves = await prisma.projectSave.findMany({
    where: {
      userId,
      projectId: { in: projectIds },
    },
    select: {
      projectId: true,
    },
  });

  return new Set(saves.map((save) => save.projectId));
};

export const countFollowsByProjectIds = async (projectIds: string[]) => {
  if (projectIds.length === 0) {
    return new Map<string, number>();
  }

  const groups = await prisma.projectFollow.groupBy({
    by: ['projectId'],
    where: { projectId: { in: projectIds } },
    _count: { _all: true },
  });

  return new Map(groups.map((group) => [group.projectId, group._count._all]));
};

export const findFollowedProjectIds = async (
  userId: string | undefined,
  projectIds: string[],
) => {
  if (!userId || projectIds.length === 0) {
    return new Set<string>();
  }

  const follows = await prisma.projectFollow.findMany({
    where: {
      userId,
      projectId: { in: projectIds },
    },
    select: {
      projectId: true,
    },
  });

  return new Set(follows.map((follow) => follow.projectId));
};

export const setProjectLiked = async (
  projectId: string,
  userId: string,
  client?: Prisma.TransactionClient,
): Promise<boolean> => {
  const result = await clientOrPrisma(client).projectLike.createMany({
    data: [{ projectId, userId }],
    skipDuplicates: true,
  });
  return result.count > 0;
};

export const unsetProjectLiked = async (
  projectId: string,
  userId: string,
  client?: Prisma.TransactionClient,
): Promise<boolean> => {
  const result = await clientOrPrisma(client).projectLike.deleteMany({
    where: {
      projectId,
      userId,
    },
  });
  return result.count > 0;
};

export const countLikesForProject = async (projectId: string) => {
  return prisma.projectLike.count({
    where: { projectId },
  });
};

export const setProjectSaved = async (
  projectId: string,
  userId: string,
  client?: Prisma.TransactionClient,
): Promise<boolean> => {
  const result = await clientOrPrisma(client).projectSave.createMany({
    data: [{ projectId, userId }],
    skipDuplicates: true,
  });
  return result.count > 0;
};

export const unsetProjectSaved = async (
  projectId: string,
  userId: string,
  client?: Prisma.TransactionClient,
): Promise<boolean> => {
  const result = await clientOrPrisma(client).projectSave.deleteMany({
    where: {
      projectId,
      userId,
    },
  });
  return result.count > 0;
};

export const setProjectFollowed = async (
  projectId: string,
  userId: string,
  client?: Prisma.TransactionClient,
): Promise<boolean> => {
  const result = await clientOrPrisma(client).projectFollow.createMany({
    data: [{ projectId, userId }],
    skipDuplicates: true,
  });
  return result.count > 0;
};

export const unsetProjectFollowed = async (
  projectId: string,
  userId: string,
  client?: Prisma.TransactionClient,
): Promise<boolean> => {
  const result = await clientOrPrisma(client).projectFollow.deleteMany({
    where: {
      projectId,
      userId,
    },
  });
  return result.count > 0;
};

export const countFollowsForProject = async (projectId: string) => {
  return prisma.projectFollow.count({
    where: { projectId },
  });
};

export const summarizeReviewsByProjectIds = async (projectIds: string[]) => {
  if (projectIds.length === 0) {
    return new Map<string, { average: number; count: number }>();
  }

  const groups = await prisma.projectUserReview.groupBy({
    by: ['projectId'],
    where: { projectId: { in: projectIds } },
    _avg: { rating: true },
    _count: { _all: true },
  });

  return new Map(
    groups.map((group) => [
      group.projectId,
      {
        average: group._avg.rating ?? 0,
        count: group._count._all,
      },
    ]),
  );
};

export const findRecentReviewsForProject = async (
  projectId: string,
  limit = 5,
) => {
  return prisma.projectUserReview.findMany({
    where: { projectId },
    select: {
      id: true,
      projectId: true,
      userId: true,
      rating: true,
      comment: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          displayName: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });
};

export const findReviewForViewer = async (
  projectId: string,
  userId: string | undefined,
) => {
  if (!userId) {
    return null;
  }

  return prisma.projectUserReview.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
    select: {
      id: true,
      projectId: true,
      userId: true,
      rating: true,
      comment: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          displayName: true,
          email: true,
        },
      },
    },
  });
};

export const upsertProjectReview = async (input: {
  projectId: string;
  userId: string;
  rating: number;
  comment: string | null;
}) => {
  return prisma.projectUserReview.upsert({
    where: {
      projectId_userId: {
        projectId: input.projectId,
        userId: input.userId,
      },
    },
    create: {
      projectId: input.projectId,
      userId: input.userId,
      rating: input.rating,
      comment: input.comment,
    },
    update: {
      rating: input.rating,
      comment: input.comment,
    },
    select: {
      id: true,
      projectId: true,
      userId: true,
      rating: true,
      comment: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          displayName: true,
          email: true,
        },
      },
    },
  });
};

export const deleteProjectReview = async (
  projectId: string,
  userId: string,
) => {
  await prisma.projectUserReview.deleteMany({
    where: {
      projectId,
      userId,
    },
  });
};

export const createLearningProjectForReview = async (input: {
  createdBy: string;
  categoryId: string;
  title: string;
  shortDescription: string;
  description: string;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  estimatedDurationMinutes?: number;
  coverImageUrl?: string | null;
  requiredComponents?: NormalizedSubmitComponent[];
  steps?: { title: string; description: string }[];
  links?: { url: string; title?: string }[];
  client?: Prisma.TransactionClient;
  topicLifecycleDeps?: ProjectTopicLifecycleDeps;
  componentLifecycleDeps?: ComponentConceptLifecycleDeps;
}) => {
  const now = new Date();
  const client = clientOrPrisma(input.client);
  const topicLifecycleDeps =
    input.topicLifecycleDeps ?? defaultProjectTopicLifecycleDeps;
  const componentLifecycleDeps =
    input.componentLifecycleDeps ?? defaultComponentConceptLifecycleDeps;

  const project = await client.learningProject.create({
    data: {
      categoryId: input.categoryId,
      createdBy: input.createdBy,
      title: input.title,
      shortDescription: input.shortDescription,
      description: input.description,
      difficulty: input.difficulty,
      estimatedDurationMinutes: input.estimatedDurationMinutes,
      coverImageUrl: input.coverImageUrl ?? null,
      status: 'PENDING_REVIEW',
      submittedAt: now,
      requiredComponents: input.requiredComponents?.length
        ? {
            create: input.requiredComponents.map((component) =>
              mapNormalizedComponentToCreateData(component),
            ),
          }
        : undefined,
      steps: input.steps?.length
        ? {
            create: input.steps.map((step, index) => ({
              stepNumber: index + 1,
              title: step.title,
              description: step.description,
            })),
          }
        : undefined,
      links: input.links?.length
        ? {
            create: input.links.map((link) => ({
              linkType: 'OTHER',
              url: link.url,
              title: link.title,
            })),
          }
        : undefined,
    },
    select: {
      id: true,
      categoryId: true,
      title: true,
      status: true,
      submittedAt: true,
    },
  });

  await topicLifecycleDeps.reconcileLearningProjectTopics(
    client,
    project.id,
    project.categoryId,
  );

  await componentLifecycleDeps.reconcileLearningProjectComponents(
    client,
    project.id,
  );

  return {
    id: project.id,
    title: project.title,
    status: project.status,
    submittedAt: project.submittedAt,
  };
};

export const updateMyLearningProjectSubmission = async (input: {
  id: string;
  userId: string;
  categoryId?: string;
  title?: string;
  shortDescription?: string;
  description?: string;
  difficulty?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  estimatedDurationMinutes?: number;
  coverImageUrl?: string | null;
  requiredComponents?: Array<{
    id?: string;
    component: NormalizedSubmitComponent;
  }>;
  steps?: { title: string; description: string }[];
  links?: { url: string; title?: string }[];
  topicLifecycleDeps?: ProjectTopicLifecycleDeps;
  componentLifecycleDeps?: ComponentConceptLifecycleDeps;
}) => {
  const topicLifecycleDeps =
    input.topicLifecycleDeps ?? defaultProjectTopicLifecycleDeps;
  const componentLifecycleDeps =
    input.componentLifecycleDeps ?? defaultComponentConceptLifecycleDeps;

  const updated = await runSerializableTransaction(async (tx) => {
    const existing = await tx.learningProject.findFirst({
      where: {
        id: input.id,
        createdBy: input.userId,
      },
      select: {
        id: true,
        status: true,
        requiredComponents: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!existing) {
      return null;
    }

    if (!isLearningProjectSubmissionEditable(existing.status)) {
      return null;
    }

    const projectUpdateData: Prisma.LearningProjectUpdateManyMutationInput = {};

    if (input.title !== undefined) {
      projectUpdateData.title = input.title;
    }
    if (input.shortDescription !== undefined) {
      projectUpdateData.shortDescription = input.shortDescription;
    }
    if (input.description !== undefined) {
      projectUpdateData.description = input.description;
    }
    if (input.difficulty !== undefined) {
      projectUpdateData.difficulty = input.difficulty;
    }
    if (input.estimatedDurationMinutes !== undefined) {
      projectUpdateData.estimatedDurationMinutes = input.estimatedDurationMinutes;
    }
    if (input.coverImageUrl !== undefined) {
      projectUpdateData.coverImageUrl = input.coverImageUrl;
    }

    if (existing.status === 'PENDING_REVIEW') {
      projectUpdateData.reviewNote = null;
      projectUpdateData.changesRequestedReason = null;
      projectUpdateData.rejectionReason = null;
    }

    const projectUpdate = await tx.learningProject.updateMany({
      where: {
        id: input.id,
        createdBy: input.userId,
        status: {
          in: [...EDITABLE_LEARNING_PROJECT_SUBMISSION_STATUSES],
        },
      },
      data: projectUpdateData,
    });

    if (projectUpdate.count === 0) {
      return null;
    }

    if (input.categoryId !== undefined) {
      await tx.learningProject.update({
        where: { id: input.id },
        data: { categoryId: input.categoryId },
      });
    }

    const committed = await tx.learningProject.findUniqueOrThrow({
      where: { id: input.id },
      select: { categoryId: true },
    });

    await topicLifecycleDeps.reconcileLearningProjectTopics(
      tx,
      input.id,
      committed.categoryId,
    );

    if (input.requiredComponents !== undefined) {
      const existingIds = new Set(
        existing.requiredComponents.map((component) => component.id),
      );
      const keepIds = input.requiredComponents
        .map((entry) => entry.id)
        .filter((id): id is string => Boolean(id && existingIds.has(id)));

      await tx.projectRequiredComponent.deleteMany({
        where: {
          projectId: input.id,
          ...(keepIds.length > 0 ? { id: { notIn: keepIds } } : {}),
        },
      });

      for (const entry of input.requiredComponents) {
        const data = mapNormalizedComponentToCreateData(entry.component);

        if (entry.id && existingIds.has(entry.id)) {
          await tx.projectRequiredComponent.update({
            where: { id: entry.id },
            data: {
              componentName: data.componentName,
              materialType: data.materialType,
              quantity: data.quantity,
              unit: data.unit,
              componentRole: data.componentRole,
              isRequired: data.isRequired,
              canBeSubstituted: data.canBeSubstituted,
              category: entry.component.categoryId
                ? { connect: { id: entry.component.categoryId } }
                : { disconnect: true },
              searchKeywords: data.searchKeywords,
              notes: data.notes,
              providedByUser: true,
              confirmedByUser: false,
              reviewStatus: 'PENDING_REVIEW',
            },
          });
          continue;
        }

        await tx.projectRequiredComponent.create({
          data: {
            projectId: input.id,
            componentName: entry.component.name,
            materialType: entry.component.materialType,
            quantity: entry.component.quantity,
            unit: entry.component.unit,
            componentRole: entry.component.componentRole,
            isRequired: entry.component.isRequired,
            canBeSubstituted: entry.component.canBeSubstituted,
            categoryId: entry.component.categoryId,
            searchKeywords: entry.component.searchKeywords,
            notes: entry.component.notes,
            providedByUser: true,
            confirmedByUser: false,
            reviewStatus: 'PENDING_REVIEW',
          },
        });
      }

      await componentLifecycleDeps.reconcileLearningProjectComponents(
        tx,
        input.id,
      );
    }

    if (input.steps !== undefined) {
      await tx.projectStep.deleteMany({ where: { projectId: input.id } });
      if (input.steps.length > 0) {
        await tx.projectStep.createMany({
          data: input.steps.map((step, index) => ({
            projectId: input.id,
            stepNumber: index + 1,
            title: step.title,
            description: step.description,
          })),
        });
      }
    }

    if (input.links !== undefined) {
      await tx.projectLink.deleteMany({ where: { projectId: input.id } });
      if (input.links.length > 0) {
        await tx.projectLink.createMany({
          data: input.links.map((link) => ({
            projectId: input.id,
            linkType: 'OTHER',
            url: link.url,
            title: link.title,
          })),
        });
      }
    }

    return { id: input.id };
  });

  return updated
    ? prisma.learningProject.findFirst({
        where: {
          id: updated.id,
          createdBy: input.userId,
        },
        include: myLearningProjectDetailInclude,
      })
    : null;
};

export const applyReviewedAuthoringProposalToMyDraft = async (input: {
  id: string;
  userId: string;
  expectedUpdatedAt: Date;
  categoryId: string;
  title: string;
  shortDescription: string;
  description: string;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  estimatedDurationMinutes?: number;
  coverImageUrl?: string | null;
  requiredComponents: Array<{ component: NormalizedSubmitComponent }>;
  steps: { title: string; description: string }[];
  links?: { url: string; title?: string }[];
}) => {
  const current = await prisma.learningProject.findFirst({
    where: {
      id: input.id,
      createdBy: input.userId,
      status: 'DRAFT',
      updatedAt: input.expectedUpdatedAt,
    },
    select: { id: true },
  });

  if (!current) {
    return null;
  }

  const { expectedUpdatedAt: _expectedUpdatedAt, ...updateInput } = input;
  return updateMyLearningProjectSubmission(updateInput);
};

export const resubmitMyLearningProjectSubmission = async (
  id: string,
  userId: string,
) => {
  return prisma.learningProject.updateMany({
    where: {
      id,
      createdBy: userId,
      status: { in: [...RESUBMITTABLE_LEARNING_PROJECT_STATUSES] },
    },
    data: {
      status: 'PENDING_REVIEW',
      submittedAt: new Date(),
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: null,
      changesRequestedReason: null,
      rejectionReason: null,
    },
  });
};

export const submitMyLearningProjectDraft = async (input: {
  id: string;
  userId: string;
  client?: Prisma.TransactionClient;
}) => {
  const db = input.client ?? prisma;
  const updated = await db.learningProject.updateMany({
    where: {
      id: input.id,
      createdBy: input.userId,
      status: { in: [...SUBMITTABLE_LEARNING_PROJECT_STATUSES] },
    },
    data: {
      status: 'PENDING_REVIEW',
      submittedAt: new Date(),
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: null,
      changesRequestedReason: null,
      rejectionReason: null,
    },
  });

  if (updated.count === 0) {
    return null;
  }

  return db.learningProject.findFirst({
    where: {
      id: input.id,
      createdBy: input.userId,
    },
    include: myLearningProjectDetailInclude,
  });
};

export const findProjectCategoryForSubmit = async (categoryId: string) =>
  prisma.category.findFirst({
    where: {
      id: categoryId,
      isActive: true,
      categoryType: { in: ['PROJECT', 'BOTH'] },
    },
    select: { id: true },
  });

export const findMaterialCategoriesForSubmit = async (categoryIds: string[]) => {
  if (categoryIds.length === 0) {
    return [] as { id: string }[];
  }

  return prisma.category.findMany({
    where: {
      id: { in: categoryIds },
      isActive: true,
      categoryType: { in: ['MATERIAL', 'BOTH'] },
    },
    select: { id: true },
  });
};

export const completeProjectBuildStep = async (input: {
  projectId: string;
  learnerId: string;
  stepId: string;
}): Promise<{ buildId: string; noOp: boolean; completed?: boolean }> => {
  return prisma.$transaction(async (tx) => {
    const build = await tx.projectBuild.findFirst({
      where: {
        projectId: input.projectId,
        learnerId: input.learnerId,
        status: { in: [...ACTIVE_PROJECT_BUILD_STATUSES] },
      },
      select: {
        id: true,
        status: true,
        items: {
          select: {
            status: true,
            linkedMaterialId: true,
            linkedMaterial: {
              select: {
                unit: true,
              },
            },
            requiredComponent: {
              select: {
                quantity: true,
                unit: true,
                componentRole: true,
              },
            },
            linkedReservation: {
              select: {
                id: true,
                materialId: true,
                status: true,
                quantityRequested: true,
              },
            },
          },
        },
      },
    });

    if (!build) {
      throw new AppError('Project build not found.', 404, 'BUILD_NOT_FOUND');
    }

    if (build.status === 'PAUSED') {
      throw new AppError(
        'Resume the build before completing steps.',
        409,
        'BUILD_PAUSED',
      );
    }

    if (build.status !== 'IN_PROGRESS') {
      throw new AppError('Project build is not editable.', 409, 'BUILD_NOT_EDITABLE');
    }

    const projectSteps = await tx.projectStep.findMany({
      where: { projectId: input.projectId },
      orderBy: { stepNumber: 'asc' },
      select: { id: true, stepNumber: true },
    });

    const targetStep = projectSteps.find((step) => step.id === input.stepId);
    if (!targetStep) {
      throw new AppError('Project step not found.', 404, 'NOT_FOUND');
    }

    const progressRows = await tx.projectBuildStepProgress.findMany({
      where: { buildId: build.id },
      select: {
        projectStepId: true,
        completedAt: true,
      },
    });

    const completedStepIds = new Set(
      progressRows
        .filter((row) => row.completedAt != null)
        .map((row) => row.projectStepId),
    );

    if (completedStepIds.has(input.stepId)) {
      return { buildId: build.id, noOp: true };
    }

    const allMaterialsReady = build.items.every((item) =>
      resolveBuildItemStepUnlockReadinessFromState({
        status: item.status,
        componentRole: item.requiredComponent.componentRole,
        requiredQuantity: item.requiredComponent.quantity.toNumber(),
        requiredUnit: item.requiredComponent.unit,
        materialUnit: item.linkedMaterial?.unit ?? null,
        linkedReservation: item.linkedReservation,
      }).isReadyForStepUnlock,
    );

    if (!allMaterialsReady) {
      throw new AppError(
        'All required materials must be ready before completing build steps.',
        409,
        'BUILD_MATERIALS_NOT_READY',
      );
    }

    const firstIncompleteStep = projectSteps.find(
      (step) => !completedStepIds.has(step.id),
    );

    if (!firstIncompleteStep || firstIncompleteStep.id !== input.stepId) {
      throw new AppError(
        'Only the current build step can be completed.',
        409,
        'BUILD_STEP_LOCKED',
      );
    }

    const completedAt = new Date();
    await tx.projectBuildStepProgress.upsert({
      where: {
        buildId_projectStepId: {
          buildId: build.id,
          projectStepId: input.stepId,
        },
      },
      create: {
        buildId: build.id,
        projectStepId: input.stepId,
        startedAt: completedAt,
        completedAt,
      },
      update: {
        completedAt,
      },
    });

    const completedAfter = new Set([...completedStepIds, input.stepId]);
    const allStepsCompleted =
      projectSteps.length > 0 &&
      projectSteps.every((step) => completedAfter.has(step.id));

    if (allStepsCompleted) {
      await tx.projectBuild.update({
        where: { id: build.id },
        data: {
          status: 'COMPLETED',
          completedAt,
          pausedAt: null,
        },
      });
    }

    return { buildId: build.id, noOp: false, completed: allStepsCompleted };
  });
};

export const finalizeCompletedBuildSnapshot = async (buildId: string) => {
  const build = await prisma.projectBuild.findUniqueOrThrow({
    where: { id: buildId },
    include: projectBuildInclude,
  });
  const { createProjectBuildCompletionSnapshot } = await import(
    './project-build-completion-snapshot.js'
  );
  await createProjectBuildCompletionSnapshot(build);
};

export const updateOwnedProjectBuildItemsStatusBatch = async (input: {
  projectId: string;
  buildId: string;
  learnerId: string;
  targetStatus: 'ALREADY_OWNED' | 'MISSING';
  items: Array<{
    buildItemId: string;
    previousStatus: string;
  }>;
}) => {
  if (input.items.length === 0) {
    throw new AppError('No build items selected for update.', 400, 'VALIDATION_ERROR');
  }

  return prisma.$transaction(async (tx) => {
    const build = await tx.projectBuild.findFirst({
      where: {
        id: input.buildId,
        learnerId: input.learnerId,
        projectId: input.projectId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!build) {
      throw new AppError('Project build not found.', 404, 'BUILD_NOT_FOUND');
    }

    if (build.status === 'ARCHIVED') {
      throw new AppError('Project build is not editable.', 409, 'BUILD_NOT_EDITABLE');
    }

    const itemIds = [...new Set(input.items.map((item) => item.buildItemId))];
    const existingItems = await tx.projectBuildItem.findMany({
      where: {
        buildId: input.buildId,
        id: { in: itemIds },
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (existingItems.length !== itemIds.length) {
      throw new AppError(
        'One or more build items are no longer part of this build.',
        409,
        'AI_ACTION_CONFLICT',
      );
    }

    const existingById = new Map(existingItems.map((item) => [item.id, item]));

    for (const item of input.items) {
      const current = existingById.get(item.buildItemId);
      if (!current) {
        throw new AppError(
          'One or more build items are no longer part of this build.',
          409,
          'AI_ACTION_CONFLICT',
        );
      }

      if (current.status !== item.previousStatus) {
        throw new AppError(
          'Build item state changed before the action could be confirmed.',
          409,
          'AI_ACTION_CONFLICT',
        );
      }

      if (current.status === input.targetStatus) {
        continue;
      }

      await tx.projectBuildItem.update({
        where: { id: item.buildItemId },
        data: { status: input.targetStatus },
      });
    }

    return { buildId: build.id };
  });
};

export const findGuideConversationIdForBuild = async (
  userId: string,
  buildId: string,
) =>
  prisma.aiConversation.findFirst({
    where: {
      userId,
      projectBuildId: buildId,
    },
    select: {
      id: true,
    },
  });

export const insertLearnerAuthoringDraft = async (
  tx: Prisma.TransactionClient,
  input: {
    createdBy: string;
    categoryId: string;
    difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
    title: string;
    shortDescription: string;
    description: string;
  },
) =>
  tx.learningProject.create({
    data: {
      createdBy: input.createdBy,
      categoryId: input.categoryId,
      title: input.title,
      shortDescription: input.shortDescription,
      description: input.description,
      difficulty: input.difficulty,
      status: 'DRAFT',
    },
    select: {
      id: true,
      title: true,
      status: true,
      updatedAt: true,
    },
  });

export const findOwnedDraftProjectForAuthoring = async (
  projectId: string,
  userId: string,
) =>
  prisma.learningProject.findFirst({
    where: {
      id: projectId,
      createdBy: userId,
      status: 'DRAFT',
    },
    select: {
      id: true,
      title: true,
      status: true,
      updatedAt: true,
    },
  });

export const createAuthoringConversationForDraft = async (input: {
  userId: string;
  learningProjectId: string;
  locale: string;
  title: string | null;
}) =>
  prisma.aiConversation.create({
    data: {
      userId: input.userId,
      mode: 'PROJECT_AUTHORING',
      locale: input.locale,
      title: input.title,
      projectBuildId: null,
      learningProjectId: input.learningProjectId,
    },
    select: {
      id: true,
      mode: true,
      learningProjectId: true,
      updatedAt: true,
    },
  });
