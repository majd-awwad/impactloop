import type { Prisma } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';
import {
  computeAvailableQuantity,
  decimalToNumber,
  getHeldQuantitiesByMaterialIds,
  toDecimal,
} from '../reservations/reservations.quantity.js';
import {
  findFollowedProjectIds,
  findLikedProjectIds,
  findSavedProjectIds,
} from '../learning-projects/learning-projects.repository.js';

import type {
  LearnerHomeMaterialCandidate,
  LearnerHomeProjectCandidate,
  LearnerHomeSavedLocationContext,
  LearnerHomeSavedProjectComponent,
  LearnerBehaviorContext,
  LearnerBehaviorMaterialSignal,
  LearnerBehaviorProjectSignal,
} from './learner-home.types.js';

const publicProjectWhere: Prisma.LearningProjectWhereInput = {
  status: 'PUBLISHED',
  category: {
    isActive: true,
    categoryType: {
      in: ['PROJECT', 'BOTH'],
    },
  },
};

const availableMaterialWhere: Prisma.MaterialWhereInput = {
  status: 'AVAILABLE',
  category: {
    isActive: true,
    categoryType: {
      in: ['MATERIAL', 'BOTH'],
    },
  },
};

const materialPoolInclude = {
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
    },
  },
  tags: {
    select: {
      tag: true,
    },
  },
  supplierProfile: {
    select: {
      publicName: true,
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
  _count: {
    select: {
      likes: true,
    },
  },
} satisfies Prisma.MaterialInclude;

const projectPoolInclude = {
  category: {
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
    },
  },
  tags: {
    select: {
      tag: true,
    },
  },
  requiredComponents: {
    select: {
      id: true,
      categoryId: true,
      componentName: true,
      materialType: true,
      searchKeywords: true,
    },
  },
  _count: {
    select: {
      likes: true,
      saves: true,
      userReviews: true,
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
          status: true,
        },
      },
      linkedReservation: {
        select: {
          id: true,
          status: true,
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
          category: {
            select: {
              id: true,
              nameEn: true,
              nameAr: true,
            },
          },
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

const parseSearchKeywords = (value: Prisma.JsonValue | null | undefined) => {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const resolveSupplierName = (material: {
  supplierProfile: {
    publicName: string | null;
    user: { displayName: string };
  } | null;
  owner: { displayName: string };
}) =>
  material.supplierProfile?.publicName?.trim() ||
  material.supplierProfile?.user.displayName ||
  material.owner.displayName;

const mapMaterialCandidate = (
  material: Awaited<ReturnType<typeof loadMaterialPool>>[number],
  availableQuantity: number,
): LearnerHomeMaterialCandidate => {
  const primaryImageUrl = material.images[0]?.imageUrl ?? null;

  const mapped = {
    id: material.id,
    title: material.title,
    description: material.description,
    category: {
      id: material.category.id,
      nameEn: material.category.nameEn,
      nameAr: material.category.nameAr,
    },
    condition: material.condition,
    status: material.status,
    quantity: decimalToNumber(material.quantity),
    availableQuantity,
    unit: material.unit,
    isFree: material.isFree,
    price: material.price == null ? null : decimalToNumber(material.price),
    city: material.location.city,
    area: material.location.area,
    deliveryAvailable: material.deliveryAllowed,
    pickupAllowed: material.pickupAllowed,
    imageUrl: primaryImageUrl,
    primaryImageUrl,
    supplierName: resolveSupplierName(material),
    viewsCount: material.viewsCount,
    likesCount: material._count.likes,
    isLiked: false,
    createdAt: material.createdAt.toISOString(),
  };

  return {
    id: material.id,
    ownerId: material.ownerId,
    title: material.title,
    description: material.description,
    materialType: material.materialType,
    categoryId: material.category.id,
    categoryNameEn: material.category.nameEn,
    categoryNameAr: material.category.nameAr,
    status: material.status,
    isFree: material.isFree,
    deliveryAllowed: material.deliveryAllowed,
    pickupAllowed: material.pickupAllowed,
    viewsCount: material.viewsCount,
    likesCount: material._count.likes,
    city: material.location.city,
    area: material.location.area,
    tags: material.tags.map((entry) => entry.tag),
    createdAt: material.createdAt,
    availableQuantity,
    mapped,
  };
};

export const loadLearnerInterests = async (userId: string) => {
  const profile = await prisma.learnerProfile.findUnique({
    where: { userId },
    select: {
      interests: true,
    },
  });

  return profile?.interests ?? [];
};

export const loadDefaultSavedLocation = async (
  userId: string,
): Promise<LearnerHomeSavedLocationContext> => {
  const savedLocation = await prisma.userSavedLocation.findFirst({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    select: {
      location: {
        select: {
          city: true,
          area: true,
        },
      },
    },
  });

  return {
    city: savedLocation?.location.city ?? null,
    area: savedLocation?.location.area ?? null,
  };
};

export const loadSavedProjectComponents = async (
  userId: string,
): Promise<LearnerHomeSavedProjectComponent[]> => {
  const saves = await prisma.projectSave.findMany({
    where: {
      userId,
      project: publicProjectWhere,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 12,
    select: {
      project: {
        select: {
          id: true,
          title: true,
          requiredComponents: {
            select: {
              id: true,
              categoryId: true,
              componentName: true,
              materialType: true,
              searchKeywords: true,
            },
          },
        },
      },
    },
  });

  return saves.flatMap((save) =>
    save.project.requiredComponents.map((component) => ({
      projectId: save.project.id,
      projectTitle: save.project.title,
      componentId: component.id,
      componentName: component.componentName,
      categoryId: component.categoryId,
      materialType: component.materialType,
      searchKeywords: parseSearchKeywords(component.searchKeywords),
    })),
  );
};

export const loadMaterialPool = async (take = 160) =>
  prisma.material.findMany({
    where: availableMaterialWhere,
    include: materialPoolInclude,
    orderBy: [{ viewsCount: 'desc' }, { createdAt: 'desc' }],
    take,
  });

export const loadMaterialCandidates = async () => {
  const materials = await loadMaterialPool();
  const heldByMaterialId = await getHeldQuantitiesByMaterialIds(
    materials.map((material) => material.id),
  );

  return materials
    .map((material) => {
      const heldQuantity =
        heldByMaterialId.get(material.id) ?? toDecimal(0);
      const availableQuantity = decimalToNumber(
        computeAvailableQuantity(material.quantity, heldQuantity),
      );

      return mapMaterialCandidate(material, availableQuantity);
    })
    .filter((material) => material.availableQuantity > 0);
};

export const loadProjectPool = async (take = 120) =>
  prisma.learningProject.findMany({
    where: publicProjectWhere,
    include: projectPoolInclude,
    orderBy: [{ createdAt: 'desc' }],
    take,
  });

export const loadProjectCandidates = async (
  userId: string,
): Promise<LearnerHomeProjectCandidate[]> => {
  const projects = await loadProjectPool();
  const projectIds = projects.map((project) => project.id);
  const [reviewSummaries, likedProjectIds, savedProjectIds, followedProjectIds] =
    await Promise.all([
      loadReviewSummaries(projectIds),
      findLikedProjectIds(userId, projectIds),
      findSavedProjectIds(userId, projectIds),
      findFollowedProjectIds(userId, projectIds),
    ]);

  return projects.map((project) => {
    const reviewSummary = reviewSummaries.get(project.id);
    const mapped = {
      id: project.id,
      title: project.title,
      shortDescription: project.shortDescription,
      category: {
        id: project.category.id,
        nameEn: project.category.nameEn,
        nameAr: project.category.nameAr,
      },
      difficulty: project.difficulty,
      estimatedDurationMinutes: project.estimatedDurationMinutes,
      coverImageUrl: project.coverImageUrl,
      authorName: '',
      tags: project.tags.map((tag) => tag.tag),
      ratingSummary:
        reviewSummary && reviewSummary.count > 0
          ? {
              average: Math.round(reviewSummary.average * 10) / 10,
              count: reviewSummary.count,
            }
          : null,
      likesCount: project._count.likes,
      isLiked: likedProjectIds.has(project.id),
      isSaved: savedProjectIds.has(project.id),
      followersCount: 0,
      isFollowing: followedProjectIds.has(project.id),
      createdAt: project.createdAt.toISOString(),
    };

    return {
      id: project.id,
      title: project.title,
      shortDescription: project.shortDescription,
      difficulty: project.difficulty,
      estimatedDurationMinutes: project.estimatedDurationMinutes,
      coverImageUrl: project.coverImageUrl,
      categoryId: project.category.id,
      categoryNameEn: project.category.nameEn,
      categoryNameAr: project.category.nameAr,
      tags: project.tags.map((tag) => tag.tag),
      createdAt: project.createdAt,
      likesCount: project._count.likes,
      savesCount: project._count.saves,
      reviewCount: reviewSummary?.count ?? project._count.userReviews,
      reviewAverage: reviewSummary?.average ?? 0,
      requiredComponents: project.requiredComponents.map((component) => ({
        id: component.id,
        categoryId: component.categoryId,
        componentName: component.componentName,
        materialType: component.materialType,
        searchKeywords: parseSearchKeywords(component.searchKeywords),
      })),
      mapped,
    };
  });
};

const loadReviewSummaries = async (projectIds: string[]) => {
  if (projectIds.length === 0) {
    return new Map<string, { average: number; count: number }>();
  }

  const groups = await prisma.projectUserReview.groupBy({
    by: ['projectId'],
    where: {
      projectId: { in: projectIds },
    },
    _avg: {
      rating: true,
    },
    _count: {
      _all: true,
    },
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

export const loadSavedProjectsForLearner = async (
  userId: string,
  limit = 8,
) => {
  const saves = await prisma.projectSave.findMany({
    where: {
      userId,
      project: publicProjectWhere,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
    select: {
      createdAt: true,
      project: {
        include: projectPoolInclude,
      },
    },
  });

  const projectIds = saves.map((save) => save.project.id);
  const [reviewSummaries, likedProjectIds, followedProjectIds] =
    await Promise.all([
      loadReviewSummaries(projectIds),
      findLikedProjectIds(userId, projectIds),
      findFollowedProjectIds(userId, projectIds),
    ]);

  return saves.map((save) => {
    const project = save.project;
    const reviewSummary = reviewSummaries.get(project.id);

    return {
      score: 0,
      reasons: ['Saved by you'],
      type: 'project' as const,
      project: {
        id: project.id,
        title: project.title,
        shortDescription: project.shortDescription,
        category: {
          id: project.category.id,
          nameEn: project.category.nameEn,
          nameAr: project.category.nameAr,
        },
        difficulty: project.difficulty,
        estimatedDurationMinutes: project.estimatedDurationMinutes,
        coverImageUrl: project.coverImageUrl,
        authorName: '',
        tags: project.tags.map((tag) => tag.tag),
        ratingSummary:
          reviewSummary && reviewSummary.count > 0
            ? {
                average: Math.round(reviewSummary.average * 10) / 10,
                count: reviewSummary.count,
              }
            : null,
        likesCount: project._count.likes,
        isLiked: likedProjectIds.has(project.id),
        isSaved: true,
        followersCount: 0,
        isFollowing: followedProjectIds.has(project.id),
        createdAt: project.createdAt.toISOString(),
      },
    };
  });
};

export const loadInProgressBuilds = async (userId: string, limit = 6) =>
  prisma.projectBuild.findMany({
    where: {
      learnerId: userId,
      status: 'IN_PROGRESS',
      project: publicProjectWhere,
    },
    include: projectBuildInclude,
    orderBy: {
      updatedAt: 'desc',
    },
    take: limit,
  });

export const countSavedProjects = async (userId: string) =>
  prisma.projectSave.count({
    where: {
      userId,
      project: publicProjectWhere,
    },
  });

const materialBehaviorSelect = {
  id: true,
  title: true,
  description: true,
  materialType: true,
  category: {
    select: {
      nameEn: true,
      nameAr: true,
    },
  },
  tags: {
    select: {
      tag: true,
    },
  },
} satisfies Prisma.MaterialSelect;

const projectBehaviorSelect = {
  id: true,
  title: true,
  shortDescription: true,
  category: {
    select: {
      nameEn: true,
      nameAr: true,
    },
  },
  tags: {
    select: {
      tag: true,
    },
  },
  requiredComponents: {
    select: {
      componentName: true,
      materialType: true,
      category: {
        select: {
          nameEn: true,
        },
      },
    },
  },
} satisfies Prisma.LearningProjectSelect;

const mapMaterialBehaviorSignal = (material: {
  id: string;
  title: string;
  description: string;
  materialType: string;
  category: { nameEn: string; nameAr: string };
  tags: Array<{ tag: string }>;
}): LearnerBehaviorMaterialSignal => ({
  materialId: material.id,
  title: material.title,
  description: material.description,
  materialType: material.materialType,
  categoryNameEn: material.category.nameEn,
  categoryNameAr: material.category.nameAr,
  tags: material.tags.map((entry) => entry.tag),
});

const mapProjectBehaviorSignal = (project: {
  id: string;
  title: string;
  shortDescription: string;
  category: { nameEn: string; nameAr: string };
  tags: Array<{ tag: string }>;
  requiredComponents: Array<{
    componentName: string;
    materialType: string;
    category: { nameEn: string } | null;
  }>;
}): LearnerBehaviorProjectSignal => ({
  projectId: project.id,
  title: project.title,
  shortDescription: project.shortDescription,
  categoryNameEn: project.category.nameEn,
  categoryNameAr: project.category.nameAr,
  tags: project.tags.map((entry) => entry.tag),
  components: project.requiredComponents.map((component) => ({
    componentName: component.componentName,
    materialType: component.materialType,
    categoryNameEn: component.category?.nameEn ?? null,
  })),
});

const dedupeMaterialSignals = (
  signals: LearnerBehaviorMaterialSignal[],
): LearnerBehaviorMaterialSignal[] => {
  const seen = new Set<string>();
  const selected: LearnerBehaviorMaterialSignal[] = [];

  for (const signal of signals) {
    if (seen.has(signal.materialId)) {
      continue;
    }

    seen.add(signal.materialId);
    selected.push(signal);
  }

  return selected;
};

const ACTIVE_RESERVATION_STATUSES = [
  'PENDING',
  'AWAITING_LEARNER_CONFIRMATION',
  'AWAITING_SUPPLIER_CONFIRMATION',
  'ACCEPTED',
  'COMPLETED',
] as const;

export const loadLearnerBehaviorContext = async (
  userId: string,
): Promise<LearnerBehaviorContext> => {
  const [
    likedMaterialRows,
    viewedMaterialRows,
    reservedMaterialRows,
    savedProjectRows,
    likedProjectRows,
    followedProjectRows,
    inProgressBuildRows,
  ] = await Promise.all([
    prisma.materialLike.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        material: {
          select: materialBehaviorSelect,
        },
      },
    }),
    prisma.materialView.findMany({
      where: { viewerUserId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        materialId: true,
        material: {
          select: materialBehaviorSelect,
        },
      },
    }),
    prisma.reservation.findMany({
      where: {
        requesterId: userId,
        status: { in: [...ACTIVE_RESERVATION_STATUSES] },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        material: {
          select: materialBehaviorSelect,
        },
      },
    }),
    prisma.projectSave.findMany({
      where: {
        userId,
        project: publicProjectWhere,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        project: {
          select: projectBehaviorSelect,
        },
      },
    }),
    prisma.projectLike.findMany({
      where: {
        userId,
        project: publicProjectWhere,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        project: {
          select: projectBehaviorSelect,
        },
      },
    }),
    prisma.projectFollow.findMany({
      where: {
        userId,
        project: publicProjectWhere,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        project: {
          select: projectBehaviorSelect,
        },
      },
    }),
    prisma.projectBuild.findMany({
      where: {
        learnerId: userId,
        status: 'IN_PROGRESS',
        project: publicProjectWhere,
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: {
        project: {
          select: projectBehaviorSelect,
        },
      },
    }),
  ]);

  const viewedMaterials: LearnerBehaviorMaterialSignal[] = [];
  for (const row of viewedMaterialRows) {
    viewedMaterials.push(mapMaterialBehaviorSignal(row.material));
  }

  return {
    likedMaterials: likedMaterialRows.map((row) =>
      mapMaterialBehaviorSignal(row.material),
    ),
    viewedMaterials,
    reservedMaterials: dedupeMaterialSignals(
      reservedMaterialRows.map((row) => mapMaterialBehaviorSignal(row.material)),
    ),
    savedProjects: savedProjectRows.map((row) =>
      mapProjectBehaviorSignal(row.project),
    ),
    likedProjects: likedProjectRows.map((row) =>
      mapProjectBehaviorSignal(row.project),
    ),
    followedProjects: followedProjectRows.map((row) =>
      mapProjectBehaviorSignal(row.project),
    ),
    inProgressBuildProjects: inProgressBuildRows.map((row) =>
      mapProjectBehaviorSignal(row.project),
    ),
  };
};
