import type { Prisma } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';
import type {
  LearningProjectsQuery,
  UpdateProjectBuildItemInput,
} from './learning-projects.validation.js';

const clientOrPrisma = (client?: Prisma.TransactionClient) => client ?? prisma;

const publicProjectWhere: Prisma.LearningProjectWhereInput = {
  status: 'PUBLISHED',
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

const projectBuildInclude = {
  project: {
    select: {
      id: true,
      title: true,
      shortDescription: true,
      coverImageUrl: true,
    },
  },
  items: {
    include: {
      linkedMaterial: {
        select: {
          id: true,
          title: true,
          condition: true,
          status: true,
          isFree: true,
          price: true,
          currency: true,
          pickupAllowed: true,
          deliveryAllowed: true,
          ownerId: true,
          materialType: true,
          category: {
            select: {
              id: true,
              nameEn: true,
              nameAr: true,
            },
          },
          location: {
            select: {
              city: true,
              area: true,
            },
          },
          images: {
            orderBy: [{ isCover: 'desc' as const }, { sortOrder: 'asc' as const }],
            take: 1,
            select: {
              imageUrl: true,
              isCover: true,
            },
          },
          supplierProfile: {
            select: {
              publicName: true,
              supplierType: true,
              verificationStatus: true,
              user: {
                select: {
                  displayName: true,
                },
              },
            },
          },
          owner: {
            select: {
              displayName: true,
            },
          },
        },
      },
      linkedReservation: {
        select: {
          id: true,
          status: true,
          materialId: true,
        },
      },
      requiredComponent: {
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
          searchKeywords: true,
          category: {
            select: {
              id: true,
              nameEn: true,
              nameAr: true,
            },
          },
          createdAt: true,
        },
      },
    },
    orderBy: {
      requiredComponent: {
        createdAt: 'asc' as const,
      },
    },
  },
} satisfies Prisma.ProjectBuildInclude;

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
) => {
  return prisma.projectBuild.findUnique({
    where: {
      projectId_learnerId: {
        projectId,
        learnerId,
      },
    },
    include: projectBuildInclude,
  });
};

export const startProjectBuild = async (
  projectId: string,
  learnerId: string,
) => {
  return prisma.$transaction(async (tx) => {
    const project = await tx.learningProject.findFirst({
      where: {
        id: projectId,
        ...publicProjectWhere,
      },
      select: {
        id: true,
        requiredComponents: {
          select: {
            id: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!project) {
      return null;
    }

    const build = await tx.projectBuild.upsert({
      where: {
        projectId_learnerId: {
          projectId,
          learnerId,
        },
      },
      create: {
        projectId,
        learnerId,
        items: project.requiredComponents.length
          ? {
              create: project.requiredComponents.map((component) => ({
                requiredComponentId: component.id,
              })),
            }
          : undefined,
      },
      update: {},
      select: {
        id: true,
      },
    });

    if (project.requiredComponents.length > 0) {
      await tx.projectBuildItem.createMany({
        data: project.requiredComponents.map((component) => ({
          buildId: build.id,
          requiredComponentId: component.id,
        })),
        skipDuplicates: true,
      });
    }

    return tx.projectBuild.findUnique({
      where: {
        id: build.id,
      },
      include: projectBuildInclude,
    });
  });
};

export const updateProjectBuildItem = async (input: {
  projectId: string;
  learnerId: string;
  itemId: string;
  status: UpdateProjectBuildItemInput['status'];
  learnerNote?: string | null;
}) => {
  return prisma.$transaction(async (tx) => {
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

    return tx.projectBuild.findUnique({
      where: {
        id: item.buildId,
      },
      include: projectBuildInclude,
    });
  });
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
          searchKeywords: true,
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
  return prisma.$transaction(async (tx) => {
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
      },
    });

    return tx.projectBuild.findUnique({
      where: { id: item.buildId },
      include: projectBuildInclude,
    });
  });
};

export const unlinkBuildItemMaterial = async (input: {
  projectId: string;
  learnerId: string;
  itemId: string;
  clearReservationLink: boolean;
}) => {
  return prisma.$transaction(async (tx) => {
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

    return tx.projectBuild.findUnique({
      where: { id: item.buildId },
      include: projectBuildInclude,
    });
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

export const setProjectLiked = async (projectId: string, userId: string) => {
  await prisma.projectLike.upsert({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
    create: {
      projectId,
      userId,
    },
    update: {},
  });
};

export const unsetProjectLiked = async (projectId: string, userId: string) => {
  await prisma.projectLike.deleteMany({
    where: {
      projectId,
      userId,
    },
  });
};

export const countLikesForProject = async (projectId: string) => {
  return prisma.projectLike.count({
    where: { projectId },
  });
};

export const setProjectSaved = async (projectId: string, userId: string) => {
  await prisma.projectSave.upsert({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
    create: {
      projectId,
      userId,
    },
    update: {},
  });
};

export const unsetProjectSaved = async (projectId: string, userId: string) => {
  await prisma.projectSave.deleteMany({
    where: {
      projectId,
      userId,
    },
  });
};

export const setProjectFollowed = async (projectId: string, userId: string) => {
  await prisma.projectFollow.upsert({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
    create: {
      projectId,
      userId,
    },
    update: {},
  });
};

export const unsetProjectFollowed = async (
  projectId: string,
  userId: string,
) => {
  await prisma.projectFollow.deleteMany({
    where: {
      projectId,
      userId,
    },
  });
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
  requiredComponents?: {
    name: string;
    quantity?: number;
    unit?: string;
    notes?: string;
    isRequired?: boolean;
  }[];
  steps?: { title: string; description: string }[];
  links?: { url: string; title?: string }[];
  client?: Prisma.TransactionClient;
}) => {
  const now = new Date();
  const client = clientOrPrisma(input.client);

  return client.learningProject.create({
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
            create: input.requiredComponents.map((component) => ({
              componentName: component.name,
              materialType: 'General',
              quantity: component.quantity ?? 1,
              unit: component.unit ?? 'piece',
              componentRole: 'REQUIRED_MATERIAL',
              isRequired: component.isRequired ?? true,
              notes: component.notes,
            })),
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
      title: true,
      status: true,
      submittedAt: true,
    },
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
