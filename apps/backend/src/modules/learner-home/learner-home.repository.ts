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
import {
  buildLearnerAffinityProfile,
  extractAffinityTermsFromMaterial,
  getAffinityProfileTerms,
} from './learner-home.affinity.js';
import {
  getInterestSearchTermsForKey,
  normalizeInterestToken,
  resolveInterestKey,
} from './learner-interest-taxonomy.js';

import type {
  LearnerHomeMaterialCandidate,
  LearnerHomeProjectCandidate,
  LearnerHomeSavedLocationContext,
  LearnerHomeSavedProjectComponent,
  LearnerBehaviorContext,
  LearnerBehaviorMaterialSignal,
  LearnerBehaviorProjectSignal,
} from './learner-home.types.js';

export const HOME_MATERIAL_POOL_CAP = 120;
export const BROWSE_MATERIAL_POOL_CAP = 400;

const MAX_CANDIDATE_SEARCH_TERMS = 28;
const MAX_CATEGORY_FILTER_IDS = 24;

export type MaterialCandidateLoadInput = {
  interests: string[];
  savedComponents: LearnerHomeSavedProjectComponent[];
  behavior: LearnerBehaviorContext;
  savedLocation: LearnerHomeSavedLocationContext;
  poolCap: number;
};

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

const materialPoolSelect = {
  id: true,
  ownerId: true,
  title: true,
  description: true,
  materialType: true,
  quantity: true,
  unit: true,
  condition: true,
  status: true,
  isFree: true,
  price: true,
  pickupAllowed: true,
  deliveryAllowed: true,
  viewsCount: true,
  createdAt: true,
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
} satisfies Prisma.MaterialSelect;

const projectCardSelect = {
  id: true,
  title: true,
  shortDescription: true,
  difficulty: true,
  estimatedDurationMinutes: true,
  coverImageUrl: true,
  createdAt: true,
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
} satisfies Prisma.LearningProjectSelect;

const projectCandidateSelect = {
  ...projectCardSelect,
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
} satisfies Prisma.LearningProjectSelect;

const savedProjectSelect = {
  ...projectCardSelect,
  _count: {
    select: {
      likes: true,
    },
  },
} satisfies Prisma.LearningProjectSelect;

const projectBuildSelect = {
  id: true,
  projectId: true,
  status: true,
  startedAt: true,
  completedAt: true,
  updatedAt: true,
  project: {
    select: {
      id: true,
      title: true,
      shortDescription: true,
      coverImageUrl: true,
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
    },
  },
  items: {
    select: {
      id: true,
      requiredComponentId: true,
      status: true,
      linkedReservation: {
        select: {
          status: true,
        },
      },
      requiredComponent: {
        select: {
          id: true,
          componentName: true,
          materialType: true,
          quantity: true,
          unit: true,
        },
      },
    },
    orderBy: {
      requiredComponent: {
        createdAt: 'asc' as const,
      },
    },
  },
} satisfies Prisma.ProjectBuildSelect;

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
  material: Awaited<ReturnType<typeof loadMaterialPoolRows>>[number],
  availableQuantity: number,
): LearnerHomeMaterialCandidate => {
  const primaryImageUrl = material.images[0]?.imageUrl ?? null;

  const mapped = {
    id: material.id,
    title: material.title,
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

type SavedProjectComponentSourceRows = Array<{
  project: {
    id: string;
    title: string;
    requiredComponents: Array<{
      id: string;
      categoryId: string | null;
      componentName: string;
      materialType: string;
      searchKeywords: Prisma.JsonValue | null;
    }>;
  };
}>;

export const mapSavedProjectComponentsFromBehaviorRows = (
  saves: SavedProjectComponentSourceRows,
): LearnerHomeSavedProjectComponent[] =>
  saves.flatMap((save) =>
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

const tokenizeCandidateTerm = (value: string) =>
  normalizeInterestToken(value)
    .split(/[\s,;/|]+/)
    .filter((token) => token.length >= 3);

export const collectMaterialCandidateSearchTerms = (
  input: Pick<
    MaterialCandidateLoadInput,
    'interests' | 'savedComponents' | 'behavior'
  >,
) => {
  const terms = new Set<string>();

  for (const interest of input.interests) {
    const key = resolveInterestKey(interest);
    if (!key) {
      continue;
    }

    for (const term of getInterestSearchTermsForKey(key)) {
      if (term.length >= 3) {
        terms.add(term);
      }
    }
  }

  for (const component of input.savedComponents) {
    for (const source of [
      component.componentName,
      component.materialType,
      ...component.searchKeywords,
    ]) {
      const normalized = normalizeInterestToken(source);
      if (normalized.length >= 3) {
        terms.add(normalized);
      }

      for (const token of tokenizeCandidateTerm(source)) {
        terms.add(token);
      }
    }
  }

  const behaviorMaterials = [
    ...input.behavior.likedMaterials,
    ...input.behavior.reservedMaterials,
    ...input.behavior.viewedMaterials,
  ];

  for (const signal of behaviorMaterials) {
    for (const term of extractAffinityTermsFromMaterial(signal)) {
      if (term.length >= 3) {
        terms.add(term);
      }
    }

    for (const tag of signal.tags) {
      const normalized = normalizeInterestToken(tag);
      if (normalized.length >= 3) {
        terms.add(normalized);
      }
    }

    for (const token of tokenizeCandidateTerm(signal.title)) {
      terms.add(token);
    }

    const materialType = normalizeInterestToken(signal.materialType);
    if (materialType.length >= 4) {
      terms.add(materialType);
    }
  }

  const affinityTerms = getAffinityProfileTerms(
    buildLearnerAffinityProfile({
      interests: input.interests,
      behavior: input.behavior,
    }),
  );

  for (const term of affinityTerms) {
    if (term.length >= 3) {
      terms.add(normalizeInterestToken(term));
    }
  }

  return [...terms]
    .filter((term) => term.length >= 3)
    .slice(0, MAX_CANDIDATE_SEARCH_TERMS);
};

export const collectMaterialCandidateCategoryIds = (
  savedComponents: LearnerHomeSavedProjectComponent[],
) =>
  [
    ...new Set(
      savedComponents
        .map((component) => component.categoryId)
        .filter((categoryId): categoryId is string => Boolean(categoryId)),
    ),
  ].slice(0, MAX_CATEGORY_FILTER_IDS);

export const buildMaterialRelevanceWhere = (
  input: Pick<
    MaterialCandidateLoadInput,
    'interests' | 'savedComponents' | 'behavior' | 'savedLocation'
  >,
): Prisma.MaterialWhereInput | null => {
  const terms = collectMaterialCandidateSearchTerms(input);
  const categoryIds = collectMaterialCandidateCategoryIds(input.savedComponents);
  const orFilters: Prisma.MaterialWhereInput[] = [];

  if (categoryIds.length > 0) {
    orFilters.push({
      categoryId: {
        in: categoryIds,
      },
    });
  }

  const scalarTermFilters = terms.flatMap((term) => [
    {
      title: {
        contains: term,
        mode: 'insensitive' as const,
      },
    },
    {
      materialType: {
        contains: term,
        mode: 'insensitive' as const,
      },
    },
  ] satisfies Prisma.MaterialWhereInput[]);

  if (scalarTermFilters.length > 0) {
    orFilters.push({
      OR: scalarTermFilters,
    });
  }

  const tagTermFilters = terms.map((term) => ({
    tag: {
      contains: term,
      mode: 'insensitive' as const,
    },
  }));

  if (tagTermFilters.length > 0) {
    orFilters.push({
      tags: {
        some: {
          OR: tagTermFilters,
        },
      },
    });
  }

  const categoryTermFilters = terms.flatMap((term) => [
    {
      nameEn: {
        contains: term,
        mode: 'insensitive' as const,
      },
    },
    {
      nameAr: {
        contains: term,
        mode: 'insensitive' as const,
      },
    },
  ]);

  if (categoryTermFilters.length > 0) {
    orFilters.push({
      category: {
        OR: categoryTermFilters,
      },
    });
  }

  const locationFilters: Prisma.LocationWhereInput[] = [];

  if (input.savedLocation.city?.trim()) {
    locationFilters.push({
      city: {
        equals: input.savedLocation.city.trim(),
        mode: 'insensitive',
      },
    });
  }

  if (input.savedLocation.area?.trim()) {
    locationFilters.push({
      area: {
        equals: input.savedLocation.area.trim(),
        mode: 'insensitive',
      },
    });
  }

  if (locationFilters.length > 0) {
    orFilters.push({
      location: {
        OR: locationFilters,
      },
    });
  }

  if (orFilters.length === 0) {
    return null;
  }

  return {
    AND: [availableMaterialWhere, { OR: orFilters }],
  };
};

export const mergeMaterialPoolRows = <T extends { id: string }>(
  pools: T[][],
  poolCap: number,
) => {
  const merged = new Map<string, T>();

  for (const pool of pools) {
    for (const row of pool) {
      if (!merged.has(row.id)) {
        merged.set(row.id, row);
      }

      if (merged.size >= poolCap) {
        return [...merged.values()];
      }
    }
  }

  return [...merged.values()];
};

type MaterialPoolRow = Awaited<ReturnType<typeof loadMaterialPoolRows>>[number];

const loadMaterialPoolIds = async (
  take = 160,
  where: Prisma.MaterialWhereInput = availableMaterialWhere,
  orderBy: Prisma.MaterialOrderByWithRelationInput[] = [
    { viewsCount: 'desc' },
    { createdAt: 'desc' },
    { id: 'asc' },
  ],
) =>
  prisma.material.findMany({
    where,
    orderBy,
    take,
    select: { id: true },
  });

const loadMaterialPoolRows = async (materialIds: string[]) => {
  if (materialIds.length === 0) {
    return [];
  }

  const rows = await prisma.material.findMany({
    where: {
      id: {
        in: materialIds,
      },
    },
    select: materialPoolSelect,
  });
  const rowsById = new Map(rows.map((row) => [row.id, row]));

  return materialIds.flatMap((materialId) => {
    const row = rowsById.get(materialId);
    return row ? [row] : [];
  });
};

const mapMaterialPoolRows = async (materials: MaterialPoolRow[]) => {
  const heldByMaterialId = await getHeldQuantitiesByMaterialIds(
    materials.map((material) => material.id),
  );

  return materials
    .map((material) => {
      const heldQuantity = heldByMaterialId.get(material.id) ?? toDecimal(0);
      const availableQuantity = decimalToNumber(
        computeAvailableQuantity(material.quantity, heldQuantity),
      );

      return mapMaterialCandidate(material, availableQuantity);
    })
    .filter((material) => material.availableQuantity > 0);
};

const countAvailableMaterials = async () =>
  prisma.material.count({
    where: availableMaterialWhere,
  });

export const loadMaterialCandidatesForLearner = async (
  input: MaterialCandidateLoadInput,
) => {
  const poolCap = Math.max(1, input.poolCap);
  const availableCount = await countAvailableMaterials();

  if (availableCount <= poolCap) {
    const materialIds = await loadMaterialPoolIds(poolCap);
    const rows = await loadMaterialPoolRows(
      materialIds.map((material) => material.id),
    );
    return mapMaterialPoolRows(rows);
  }

  const relevanceTake = Math.min(poolCap, Math.ceil(poolCap * 0.75));
  const popularTake = Math.min(poolCap, Math.ceil(poolCap * 0.6));
  const freeTake = Math.min(poolCap, Math.ceil(poolCap * 0.3));
  const relevanceWhere = buildMaterialRelevanceWhere(input);

  const [relevanceIds, popularIds, freeIds] = await Promise.all([
    relevanceWhere
      ? loadMaterialPoolIds(relevanceTake, relevanceWhere)
      : Promise.resolve([] as Array<{ id: string }>),
    loadMaterialPoolIds(popularTake, availableMaterialWhere),
    loadMaterialPoolIds(freeTake, {
      AND: [availableMaterialWhere, { isFree: true }],
    }),
  ]);

  let mergedIds = mergeMaterialPoolRows(
    [relevanceIds, popularIds, freeIds],
    poolCap,
  );

  if (mergedIds.length < poolCap) {
    const fallbackIds = await loadMaterialPoolIds(
      poolCap - mergedIds.length,
      availableMaterialWhere,
    );
    mergedIds = mergeMaterialPoolRows(
      [mergedIds, fallbackIds],
      poolCap,
    );
  }

  const rows = await loadMaterialPoolRows(
    mergedIds.map((material) => material.id),
  );

  return mapMaterialPoolRows(rows);
};

export const loadMaterialCandidates = async () =>
  loadMaterialCandidatesForLearner({
    interests: [],
    savedComponents: [],
    behavior: {
      likedMaterials: [],
      viewedMaterials: [],
      reservedMaterials: [],
      savedProjects: [],
      likedProjects: [],
      followedProjects: [],
      inProgressBuildProjects: [],
    },
    savedLocation: { city: null, area: null },
    poolCap: HOME_MATERIAL_POOL_CAP,
  });

export const loadProjectPool = async (take = 120) =>
  prisma.learningProject.findMany({
    where: publicProjectWhere,
    select: projectCandidateSelect,
    orderBy: [{ createdAt: 'desc' }],
    take,
  });

const mapProjectCandidates = (
  projects: Awaited<ReturnType<typeof loadProjectPool>>,
  reviewSummaries: Map<string, { average: number; count: number }>,
  likedProjectIds: Set<string>,
  savedProjectIds: Set<string>,
  followedProjectIds: Set<string>,
): LearnerHomeProjectCandidate[] =>
  projects.map((project) => {
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

  return mapProjectCandidates(
    projects,
    reviewSummaries,
    likedProjectIds,
    savedProjectIds,
    followedProjectIds,
  );
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
        select: savedProjectSelect,
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
    select: projectBuildSelect,
    orderBy: {
      updatedAt: 'desc',
    },
    take: limit,
  });

export const hasSavedProjects = async (userId: string) =>
  Boolean(await prisma.projectSave.findFirst({
    where: {
      userId,
      project: publicProjectWhere,
    },
    select: {
      id: true,
    },
  }));

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

const projectBehaviorSignalSelect = {
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

const savedProjectBehaviorSelect = {
  ...projectBehaviorSignalSelect,
  category: {
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
    },
  },
  difficulty: true,
  estimatedDurationMinutes: true,
  coverImageUrl: true,
  createdAt: true,
  requiredComponents: {
    select: {
      id: true,
      categoryId: true,
      componentName: true,
      materialType: true,
      searchKeywords: true,
      category: {
        select: {
          nameEn: true,
        },
      },
    },
  },
  _count: {
    select: {
      likes: true,
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

const loadLearnerBehaviorRows = async (
  userId: string,
) => {
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
        createdAt: true,
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
        createdAt: true,
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
        createdAt: true,
        status: true,
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
        createdAt: true,
        project: { select: savedProjectBehaviorSelect },
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
        createdAt: true,
        project: { select: projectBehaviorSignalSelect },
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
        createdAt: true,
        project: { select: projectBehaviorSignalSelect },
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
      select: projectBuildSelect,
    }),
  ]);

  return {
    likedMaterialRows,
    viewedMaterialRows,
    reservedMaterialRows,
    savedProjectRows,
    likedProjectRows,
    followedProjectRows,
    inProgressBuildRows,
  };
};

const mapLearnerBehaviorContext = (
  rows: Awaited<ReturnType<typeof loadLearnerBehaviorRows>>,
): LearnerBehaviorContext => {
  const viewedMaterials: LearnerBehaviorMaterialSignal[] = [];
  for (const row of rows.viewedMaterialRows) {
    viewedMaterials.push(mapMaterialBehaviorSignal(row.material));
  }

  return {
    likedMaterials: rows.likedMaterialRows.map((row) =>
      mapMaterialBehaviorSignal(row.material),
    ),
    viewedMaterials,
    savedProjectComponents: mapSavedProjectComponentsFromBehaviorRows(
      rows.savedProjectRows.slice(0, 12),
    ),
    reservedMaterials: dedupeMaterialSignals(
      rows.reservedMaterialRows.map((row) => mapMaterialBehaviorSignal(row.material)),
    ),
    savedProjects: rows.savedProjectRows.map((row) =>
      mapProjectBehaviorSignal(row.project),
    ),
    likedProjects: rows.likedProjectRows.map((row) =>
      mapProjectBehaviorSignal(row.project),
    ),
    followedProjects: rows.followedProjectRows.map((row) =>
      mapProjectBehaviorSignal(row.project),
    ),
    inProgressBuildProjects: rows.inProgressBuildRows.map((row) =>
      mapProjectBehaviorSignal(row.project),
    ),
    recentRecommendationEvents: [
      ...rows.likedMaterialRows.map((row) => ({ entityKey: row.material.id, actionType: 'like', timestampUtc: row.createdAt.toISOString() })),
      ...rows.viewedMaterialRows.map((row) => ({ entityKey: row.material.id, actionType: 'view', timestampUtc: row.createdAt.toISOString() })),
      ...rows.reservedMaterialRows.map((row) => ({ entityKey: row.material.id, actionType: row.status === 'COMPLETED' ? 'reservation' : 'reservation_pending', timestampUtc: row.createdAt.toISOString() })),
      ...rows.savedProjectRows.map((row) => ({ entityKey: row.project.id, actionType: 'project_save', timestampUtc: row.createdAt.toISOString() })),
      ...rows.likedProjectRows.map((row) => ({ entityKey: row.project.id, actionType: 'like', timestampUtc: row.createdAt.toISOString() })),
      ...rows.followedProjectRows.map((row) => ({ entityKey: row.project.id, actionType: 'project_follow', timestampUtc: row.createdAt.toISOString() })),
      ...rows.inProgressBuildRows.map((row) => ({ entityKey: row.project.id, actionType: 'build_started', timestampUtc: row.startedAt.toISOString() })),
    ].sort((left, right) => left.timestampUtc.localeCompare(right.timestampUtc)),
  };
};

export const loadLearnerBehaviorContext = async (
  userId: string,
): Promise<LearnerBehaviorContext> =>
  mapLearnerBehaviorContext(await loadLearnerBehaviorRows(userId));

export const loadMlShadowConcepts = async (
  materialIds: string[],
  projectIds: string[],
) => {
  if (materialIds.length > 200 || projectIds.length > 200) throw new Error('ml_concept_candidate_bound');
  const [materials, projects] = await Promise.all([
    prisma.materialConcept.findMany({
      where: { materialId: { in: materialIds }, concept: { status: 'ACTIVE' } },
      select: { materialId: true, concept: { select: { canonicalKey: true } } },
    }),
    prisma.learningProject.findMany({
      where: { id: { in: projectIds } },
      select: {
        id: true,
        taxonomyConcepts: { where: { concept: { status: 'ACTIVE' } }, select: { concept: { select: { canonicalKey: true } } } },
        requiredComponents: { select: { taxonomyConcepts: { where: { concept: { status: 'ACTIVE' } }, select: { concept: { select: { canonicalKey: true } } } } } },
      },
    }),
  ]);
  const materialConcepts = new Map<string, string[]>();
  for (const row of materials) materialConcepts.set(row.materialId, [...(materialConcepts.get(row.materialId) ?? []), row.concept.canonicalKey]);
  return {
    materialConcepts: new Map([...materialConcepts].map(([key, values]) => [key, [...new Set(values)].sort()])),
    projectConcepts: new Map(projects.map((project) => [project.id, project.taxonomyConcepts.map((entry) => entry.concept.canonicalKey).sort()])),
    projectComponentConcepts: new Map(projects.map((project) => [project.id, [...new Set(project.requiredComponents.flatMap((component) => component.taxonomyConcepts.map((entry) => entry.concept.canonicalKey)))].sort()])),
  };
};

type SavedProjectBehaviorRow = Awaited<
  ReturnType<typeof loadLearnerBehaviorRows>
>['savedProjectRows'][number];

const mapSavedProjectItemFromBehaviorRow = (
  row: SavedProjectBehaviorRow,
  reviewSummaries: Map<string, { average: number; count: number }>,
  likedProjectIds: Set<string>,
  followedProjectIds: Set<string>,
) => {
  const project = row.project;
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
};

export const loadLearnerHomeProjectContext = async (
  userId: string,
  savedProjectLimit = 8,
) => {
  const [behaviorRows, projectRows] = await Promise.all([
    loadLearnerBehaviorRows(userId),
    loadProjectPool(),
  ]);

  const candidateProjectIds = projectRows.map((project) => project.id);
  const savedProjectIds = behaviorRows.savedProjectRows.map(
    (row) => row.project.id,
  );
  const annotationProjectIds = [
    ...new Set([...candidateProjectIds, ...savedProjectIds]),
  ];

  const [reviewSummaries, likedProjectIds, followedProjectIds, candidateSavedIds] =
    await Promise.all([
      loadReviewSummaries(annotationProjectIds),
      findLikedProjectIds(userId, annotationProjectIds),
      findFollowedProjectIds(userId, annotationProjectIds),
      findSavedProjectIds(userId, candidateProjectIds),
    ]);

  return {
    behavior: mapLearnerBehaviorContext(behaviorRows),
    projects: mapProjectCandidates(
      projectRows,
      reviewSummaries,
      likedProjectIds,
      candidateSavedIds,
      followedProjectIds,
    ),
    savedProjects: behaviorRows.savedProjectRows
      .slice(0, savedProjectLimit)
      .map((row) =>
        mapSavedProjectItemFromBehaviorRow(
          row,
          reviewSummaries,
          likedProjectIds,
          followedProjectIds,
        ),
      ),
    inProgressBuilds: behaviorRows.inProgressBuildRows,
    hasSavedProjects: behaviorRows.savedProjectRows.length > 0,
  };
};
