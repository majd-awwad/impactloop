import * as learnerHomeRepository from './learner-home.repository.js';
import {
  dedupeMaterialSections,
  dedupeMaterialItems,
  dedupeSectionItemsById,
  getProjectItemId,
} from './learner-home.deduplication.js';
import {
  applyDiversityCap,
  normalizeInterests,
  resolveSuggestedMaterialsSubtitle,
  resolveSuggestedProjectsSubtitle,
  scoreFreeNearbyMaterial,
  scoreMaterialForSavedProjects,
  scorePopularProject,
  scoreSuggestedMaterial,
  scoreSuggestedProject,
} from './learner-home.scoring.js';
import {
  selectTieredSuggestedMaterials,
  sortAllRankedMaterials,
  type RankedMaterialItem,
} from './learner-home.ranking.js';
import {
  buildBehaviorAffinityProfile,
  hasLearnerActivity,
} from './learner-home.affinity.js';
import {
  resolveFreeMaterialsSectionTitle,
  selectSuggestedProjectItems,
} from './learner-home.section-builders.js';
import type {
  LearnerHomeContinueProjectItem,
  LearnerHomeMaterialItem,
  LearnerHomeProjectItem,
  LearnerHomeResponse,
  LearnerHomeSection,
  LearnerHomeSectionDetails,
  LearnerHomeSectionItem,
  LearnerHomeSectionKey,
  LearnerAffinityProfile,
  LearnerBehaviorContext,
} from './learner-home.types.js';

const SECTION_LIMITS = {
  suggested_materials: 4,
  materials_for_saved_projects: 4,
  suggested_projects: 4,
  continue_projects: 3,
  saved_projects: 4,
  free_materials_near_you: 4,
  popular_projects: 4,
} as const;

const RANK_POOL_SIZE = 48;

const SECTION_META: Record<
  LearnerHomeSectionKey,
  { title: string; emptyState: string }
> = {
  suggested_materials: {
    title: 'Suggested materials for you',
    emptyState: 'Choose interests to improve your suggestions.',
  },
  materials_for_saved_projects: {
    title: 'Materials for your saved projects',
    emptyState: 'Save a learning project to see matching materials.',
  },
  suggested_projects: {
    title: 'Projects you may like',
    emptyState: 'Choose interests to see project recommendations.',
  },
  continue_projects: {
    title: 'Continue your projects',
    emptyState: 'Start a project build to continue here.',
  },
  saved_projects: {
    title: 'Saved projects',
    emptyState: 'Saved projects will appear here.',
  },
  free_materials_near_you: {
    title: 'Free materials near you',
    emptyState: 'No free nearby materials found yet.',
  },
  popular_projects: {
    title: 'Popular projects',
    emptyState: 'No popular projects found yet.',
  },
};

const SECTION_SUBTITLES: Record<LearnerHomeSectionKey, string> = {
  suggested_materials:
    'Ranked by your interests, saved projects, and location.',
  materials_for_saved_projects:
    'Materials matched to components in your saved learning projects.',
  suggested_projects: 'Ranked by your interests and available matching materials.',
  continue_projects: 'Pick up where you left off on in-progress project builds.',
  saved_projects: 'Projects you saved for later.',
  free_materials_near_you: 'Free materials available on ImpactLoop.',
  popular_projects: 'Popular learning projects across ImpactLoop.',
};

const BUILD_ITEM_READY_STATUSES = new Set([
  'ALREADY_OWNED',
  'AVAILABLE',
  'ALTERNATIVE',
]);

const isBuildItemReady = (item: {
  status: string;
  linkedReservation: { status: string } | null;
  linkedMaterial: unknown | null;
}) => {
  if (item.linkedReservation?.status === 'COMPLETED') {
    return true;
  }

  return BUILD_ITEM_READY_STATUSES.has(item.status);
};

const mapBuildItem = (
  item: Awaited<
    ReturnType<typeof learnerHomeRepository.loadInProgressBuilds>
  >[number]['items'][number],
) => {
  const isReadyForBuild = isBuildItemReady(item);

  return {
    id: item.id,
    requiredComponentId: item.requiredComponentId,
    status: item.status,
    isReadyForBuild,
    readinessLabel: isReadyForBuild
      ? 'Ready for build'
      : 'Still in progress',
    component: {
      id: item.requiredComponent.id,
      componentName: item.requiredComponent.componentName,
      materialType: item.requiredComponent.materialType,
      quantity: item.requiredComponent.quantity.toNumber(),
      unit: item.requiredComponent.unit,
    },
  };
};

const mapContinueBuild = (
  build: Awaited<
    ReturnType<typeof learnerHomeRepository.loadInProgressBuilds>
  >[number],
): LearnerHomeContinueProjectItem => {
  const mappedItems = build.items.map((item) => mapBuildItem(item));
  const readyItems = mappedItems.filter((item) => item.isReadyForBuild);
  const totalItems = mappedItems.length;

  return {
    type: 'continue_project',
    score: readyItems.length,
    reasons:
      totalItems > 0
        ? [`${readyItems.length} of ${totalItems} components ready`]
        : [],
    build: {
      id: build.id,
      projectId: build.projectId,
      status: build.status,
      startedAt: build.startedAt.toISOString(),
      completedAt: build.completedAt?.toISOString() ?? null,
      updatedAt: build.updatedAt.toISOString(),
      project: {
        id: build.project.id,
        title: build.project.title,
        shortDescription: build.project.shortDescription,
        coverImageUrl: build.project.coverImageUrl,
      },
      progress: {
        total: totalItems,
        ready: readyItems.length,
        percent:
          totalItems === 0
            ? 0
            : Math.round((readyItems.length / totalItems) * 100),
      },
      items: mappedItems,
    },
  };
};

type LearnerHomeContext = {
  interests: string[];
  savedLocation: Awaited<
    ReturnType<typeof learnerHomeRepository.loadDefaultSavedLocation>
  >;
  savedComponents: Awaited<
    ReturnType<typeof learnerHomeRepository.loadSavedProjectComponents>
  >;
  materials: Awaited<ReturnType<typeof learnerHomeRepository.loadMaterialCandidates>>;
  projects: Awaited<ReturnType<typeof learnerHomeRepository.loadProjectCandidates>>;
  savedProjectIds: Set<string>;
  savedProjectsCount: number;
  behavior: LearnerBehaviorContext;
  behaviorAffinityProfile: LearnerAffinityProfile;
  hasActivity: boolean;
};

const loadLearnerHomeContext = async (userId: string): Promise<LearnerHomeContext> => {
  const [
    rawInterests,
    savedLocation,
    savedComponents,
    materials,
    projects,
    savedProjectsCount,
    behavior,
  ] = await Promise.all([
    learnerHomeRepository.loadLearnerInterests(userId),
    learnerHomeRepository.loadDefaultSavedLocation(userId),
    learnerHomeRepository.loadSavedProjectComponents(userId),
    learnerHomeRepository.loadMaterialCandidates(),
    learnerHomeRepository.loadProjectCandidates(userId),
    learnerHomeRepository.countSavedProjects(userId),
    learnerHomeRepository.loadLearnerBehaviorContext(userId),
  ]);

  const interests = normalizeInterests(rawInterests);
  const behaviorAffinityProfile = buildBehaviorAffinityProfile(behavior);
  const savedProjectIds = new Set(
    projects.filter((project) => project.mapped.isSaved).map((project) => project.id),
  );

  return {
    interests,
    savedLocation,
    savedComponents,
    materials,
    projects,
    savedProjectIds,
    savedProjectsCount,
    behavior,
    behaviorAffinityProfile,
    hasActivity: hasLearnerActivity(behavior),
  };
};

type RankedMaterialEntry = {
  type: 'material';
  score: number;
  reasons: string[];
  tier: number;
  hasPrimaryRelevance: boolean;
  fallbackOnly: boolean;
  material: Record<string, unknown>;
  ownerId: string;
};

const toMaterialItem = ({
  ownerId: _ownerId,
  tier: _tier,
  hasPrimaryRelevance: _hasPrimaryRelevance,
  fallbackOnly: _fallbackOnly,
  ...item
}: RankedMaterialEntry): LearnerHomeMaterialItem => item;

const rankMaterialEntries = (
  materials: LearnerHomeContext['materials'],
  scorer: (material: (typeof materials)[number]) => {
    score: number;
    reasons: string[];
    tier?: number;
    hasPrimaryRelevance?: boolean;
    fallbackOnly?: boolean;
  },
  useTieredSuggestedRanking: boolean,
  browseAllTierSort: boolean,
): RankedMaterialEntry[] => {
  const ranked = materials
    .map((material) => {
      const scored = scorer(material);
      return {
        type: 'material' as const,
        score: scored.score,
        reasons: scored.reasons,
        tier: scored.tier ?? 5,
        hasPrimaryRelevance: scored.hasPrimaryRelevance ?? false,
        fallbackOnly: scored.fallbackOnly ?? false,
        material: material.mapped,
        ownerId: material.ownerId,
      };
    })
    .filter((entry) => entry.score > 0);

  if (!useTieredSuggestedRanking) {
    return [...ranked].sort((left, right) => right.score - left.score);
  }

  const rankedItems = ranked.map((entry) => ({
    item: entry,
    score: entry.score,
    tier: entry.tier as RankedMaterialItem<RankedMaterialEntry>['tier'],
    reasons: entry.reasons,
    hasPrimaryRelevance: entry.hasPrimaryRelevance,
    fallbackOnly: entry.fallbackOnly,
  }));

  if (browseAllTierSort) {
    return sortAllRankedMaterials(rankedItems).map((entry) => entry.item);
  }

  return selectTieredSuggestedMaterials(rankedItems, ranked.length).map(
    (entry) => entry.item,
  );
};

const rankMaterials = (
  materials: LearnerHomeContext['materials'],
  scorer: (material: (typeof materials)[number]) => {
    score: number;
    reasons: string[];
    tier?: number;
    hasPrimaryRelevance?: boolean;
    fallbackOnly?: boolean;
  },
  limit: number,
  useDiversityCap: boolean,
  useTieredSuggestedRanking = false,
  browseAllTierSort = false,
): LearnerHomeMaterialItem[] => {
  const selected = rankMaterialEntries(
    materials,
    scorer,
    useTieredSuggestedRanking,
    browseAllTierSort,
  ).slice(0, limit);

  if (useDiversityCap) {
    return applyDiversityCap(selected, limit, (item) => item.ownerId).map(
      toMaterialItem,
    );
  }

  return dedupeMaterialItems(selected.map(toMaterialItem), limit);
};

const rankMaterialsPage = (
  materials: LearnerHomeContext['materials'],
  scorer: (material: (typeof materials)[number]) => {
    score: number;
    reasons: string[];
    tier?: number;
    hasPrimaryRelevance?: boolean;
    fallbackOnly?: boolean;
  },
  limit: number,
  offset: number,
): { items: LearnerHomeMaterialItem[]; hasMore: boolean; nextOffset: number | null } => {
  const sorted = rankMaterialEntries(
    materials,
    scorer,
    true,
    true,
  );
  const pageEntries = sorted.slice(offset, offset + limit);
  const items = dedupeMaterialItems(pageEntries.map(toMaterialItem), limit);
  const nextOffset = offset + items.length;
  const hasMore = nextOffset < sorted.length;

  return {
    items,
    hasMore,
    nextOffset: hasMore ? nextOffset : null,
  };
};

const rankProjects = (
  projects: LearnerHomeContext['projects'],
  scorer: (project: (typeof projects)[number]) => {
    score: number;
    reasons: string[];
    tier?: number;
  },
  limit: number,
  useTieredRanking = false,
): LearnerHomeProjectItem[] => {
  const ranked = projects
    .map((project) => {
      const scored = scorer(project);
      return {
        type: 'project' as const,
        score: scored.score,
        reasons: scored.reasons,
        project: project.mapped,
        tier: scored.tier ?? 99,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (useTieredRanking && left.tier !== right.tier) {
        return left.tier - right.tier;
      }

      return right.score - left.score;
    });

  return dedupeSectionItemsById(
    ranked.map(({ tier: _tier, ...item }) => item),
    limit,
    getProjectItemId,
  );
};

const buildSuggestedProjectsItems = (
  context: LearnerHomeContext,
  limit: number,
): LearnerHomeProjectItem[] => {
  const availableMaterials = context.materials.filter(
    (material) =>
      material.status === 'AVAILABLE' && material.availableQuantity > 0,
  );

  const scoreProject = (project: (typeof context.projects)[number]) =>
    scoreSuggestedProject({
      project,
      interests: context.interests,
      availableMaterials,
      behaviorAffinityProfile: context.behaviorAffinityProfile,
      behavior: context.behavior,
    });

  const unsavedProjects = context.projects.filter(
    (project) => !context.savedProjectIds.has(project.id),
  );
  const savedProjects = context.projects.filter((project) =>
    context.savedProjectIds.has(project.id),
  );

  return selectSuggestedProjectItems(
    rankProjects(unsavedProjects, scoreProject, limit, true),
    rankProjects(savedProjects, scoreProject, limit, true),
    limit,
  );
};

const buildContinueProjectsItems = async (
  userId: string,
  limit: number,
): Promise<LearnerHomeContinueProjectItem[]> => {
  const builds = await learnerHomeRepository.loadInProgressBuilds(userId, limit);

  return dedupeSectionItemsById(
    builds
      .map((build) => mapContinueBuild(build))
      .filter((entry) => {
        const progress = entry.build.progress as {
          total: number;
          percent: number;
        };
        return progress.total === 0 || progress.percent < 100;
      }),
    limit,
    (item) => String(item.build.projectId ?? item.build.id ?? ''),
  );
};

const buildSavedProjectsItems = async (
  userId: string,
  limit: number,
): Promise<LearnerHomeProjectItem[]> => {
  const items = await learnerHomeRepository.loadSavedProjectsForLearner(
    userId,
    limit,
  );

  return dedupeSectionItemsById(items, limit, getProjectItemId);
};

const resolveFreeMaterialsTitle = (
  items: LearnerHomeMaterialItem[],
  savedLocation: LearnerHomeContext['savedLocation'],
) => {
  const hasSavedLocation =
    (savedLocation.city?.trim().length ?? 0) > 0 ||
    (savedLocation.area?.trim().length ?? 0) > 0;
  const hasNearItems = items.some((item) =>
    item.reasons.some((reason) =>
      reason.toLowerCase().includes('near your saved location'),
    ),
  );

  return resolveFreeMaterialsSectionTitle({
    hasSavedLocation,
    hasNearItems,
    defaultTitle: SECTION_META.free_materials_near_you.title,
  });
};

const resolveFreeMaterialsSubtitle = (
  items: LearnerHomeMaterialItem[],
  savedLocation: LearnerHomeContext['savedLocation'],
) => {
  const hasSavedLocation =
    (savedLocation.city?.trim().length ?? 0) > 0 ||
    (savedLocation.area?.trim().length ?? 0) > 0;
  const hasNearItems = items.some((item) =>
    item.reasons.some((reason) =>
      reason.toLowerCase().includes('near your saved location'),
    ),
  );

  if (hasSavedLocation && hasNearItems) {
    return 'Free materials available near your saved location.';
  }

  return SECTION_SUBTITLES.free_materials_near_you;
};

const buildSectionItems = async (
  context: LearnerHomeContext,
  userId: string,
  sectionKey: LearnerHomeSectionKey,
  limit: number,
  offset = 0,
): Promise<{
  title: string;
  subtitle: string;
  items: LearnerHomeSectionItem[];
  hasMore: boolean;
  nextOffset: number | null;
}> => {
  switch (sectionKey) {
    case 'suggested_materials': {
      const scoreMaterial = (material: (typeof context.materials)[number]) =>
        scoreSuggestedMaterial({
          material,
          interests: context.interests,
          savedComponents: context.savedComponents,
          savedLocation: context.savedLocation,
          behaviorAffinityProfile: context.behaviorAffinityProfile,
          behavior: context.behavior,
        });

      const paged = rankMaterialsPage(
        context.materials,
        scoreMaterial,
        limit,
        offset,
      );

      return {
        title: SECTION_META.suggested_materials.title,
        subtitle: resolveSuggestedMaterialsSubtitle({
          hasInterests: context.interests.length > 0,
          hasBehavior: context.hasActivity,
          items: paged.items,
        }),
        items: paged.items,
        hasMore: paged.hasMore,
        nextOffset: paged.nextOffset,
      };
    }
    case 'materials_for_saved_projects':
      return {
        title: SECTION_META.materials_for_saved_projects.title,
        subtitle: SECTION_SUBTITLES.materials_for_saved_projects,
        items:
          context.savedComponents.length === 0
            ? []
            : rankMaterials(
                context.materials,
                (material) =>
                  scoreMaterialForSavedProjects({
                    material,
                    interests: context.interests,
                    savedComponents: context.savedComponents,
                    savedLocation: context.savedLocation,
                    behaviorAffinityProfile: context.behaviorAffinityProfile,
                    behavior: context.behavior,
                  }),
                limit,
                false,
                true,
                true,
              ),
        hasMore: false,
        nextOffset: null,
      };
    case 'free_materials_near_you': {
      const items = rankMaterials(
        context.materials,
        (material) =>
          scoreFreeNearbyMaterial({
            material,
            savedLocation: context.savedLocation,
            interests: context.interests,
            behaviorAffinityProfile: context.behaviorAffinityProfile,
            behavior: context.behavior,
          }),
        limit,
        false,
        true,
        true,
      );

      return {
        title: resolveFreeMaterialsTitle(items, context.savedLocation),
        subtitle: resolveFreeMaterialsSubtitle(items, context.savedLocation),
        items,
        hasMore: false,
        nextOffset: null,
      };
    }
    case 'suggested_projects': {
      const items = buildSuggestedProjectsItems(context, limit);
      return {
        title: SECTION_META.suggested_projects.title,
        subtitle: resolveSuggestedProjectsSubtitle({
          hasInterests: context.interests.length > 0,
          hasBehavior: context.hasActivity,
          items,
        }),
        items,
        hasMore: false,
        nextOffset: null,
      };
    }
    case 'continue_projects':
      return {
        title: SECTION_META.continue_projects.title,
        subtitle: SECTION_SUBTITLES.continue_projects,
        items: await buildContinueProjectsItems(userId, limit),
        hasMore: false,
        nextOffset: null,
      };
    case 'saved_projects':
      return {
        title: SECTION_META.saved_projects.title,
        subtitle: SECTION_SUBTITLES.saved_projects,
        items: await buildSavedProjectsItems(userId, limit),
        hasMore: false,
        nextOffset: null,
      };
    case 'popular_projects':
      return {
        title: SECTION_META.popular_projects.title,
        subtitle: SECTION_SUBTITLES.popular_projects,
        items: rankProjects(
          context.projects,
          (project) => scorePopularProject(project),
          limit,
        ),
        hasMore: false,
        nextOffset: null,
      };
    default: {
      const exhaustive: never = sectionKey;
      throw new Error(`Unsupported section key: ${exhaustive}`);
    }
  }
};

export const getLearnerHomeSection = async (
  userId: string,
  sectionKey: LearnerHomeSectionKey,
  limit: number,
  offset = 0,
): Promise<LearnerHomeSectionDetails> => {
  const context = await loadLearnerHomeContext(userId);
  const built = await buildSectionItems(context, userId, sectionKey, limit, offset);

  return {
    key: sectionKey,
    title: built.title,
    subtitle: built.subtitle,
    items: built.items,
    emptyState: SECTION_META[sectionKey].emptyState,
    nextCursor: null,
    nextOffset: built.nextOffset,
    hasMore: built.hasMore,
  };
};

export const getLearnerHome = async (userId: string): Promise<LearnerHomeResponse> => {
  const context = await loadLearnerHomeContext(userId);

  const rankedMaterialsForSavedProjects =
    context.savedComponents.length === 0
      ? []
      : rankMaterials(
          context.materials,
          (material) =>
            scoreMaterialForSavedProjects({
              material,
              interests: context.interests,
              savedComponents: context.savedComponents,
              savedLocation: context.savedLocation,
              behaviorAffinityProfile: context.behaviorAffinityProfile,
              behavior: context.behavior,
            }),
          RANK_POOL_SIZE,
          false,
          true,
          true,
        );

  const rankedSuggestedMaterials = rankMaterials(
    context.materials,
    (material) =>
          scoreSuggestedMaterial({
            material,
            interests: context.interests,
            savedComponents: context.savedComponents,
            savedLocation: context.savedLocation,
            behaviorAffinityProfile: context.behaviorAffinityProfile,
            behavior: context.behavior,
          }),
    RANK_POOL_SIZE,
    false,
    true,
  );

  const rankedFreeMaterials = rankMaterials(
    context.materials,
    (material) =>
      scoreFreeNearbyMaterial({
        material,
        savedLocation: context.savedLocation,
        interests: context.interests,
        behaviorAffinityProfile: context.behaviorAffinityProfile,
        behavior: context.behavior,
      }),
    RANK_POOL_SIZE,
    false,
    true,
    true,
  );

  const dedupedMaterials = dedupeMaterialSections({
    materialsForSavedProjects: rankedMaterialsForSavedProjects,
    suggestedMaterials: rankedSuggestedMaterials,
    freeMaterialsNearYou: rankedFreeMaterials,
    limits: {
      materialsForSavedProjects: SECTION_LIMITS.materials_for_saved_projects,
      suggestedMaterials: SECTION_LIMITS.suggested_materials,
      freeMaterialsNearYou: SECTION_LIMITS.free_materials_near_you,
    },
  });

  const profileCompletion = {
    hasInterests: context.interests.length > 0,
    hasSavedLocation:
      (context.savedLocation.city?.trim().length ?? 0) > 0 ||
      (context.savedLocation.area?.trim().length ?? 0) > 0,
    hasSavedProjects: context.savedProjectsCount > 0,
    hasActivity: context.hasActivity,
  };

  const continueProjectsSection: LearnerHomeSection = {
    key: 'continue_projects',
    ...SECTION_META.continue_projects,
    items: await buildContinueProjectsItems(userId, SECTION_LIMITS.continue_projects),
  };

  const savedProjectsSection: LearnerHomeSection = {
    key: 'saved_projects',
    ...SECTION_META.saved_projects,
    items: await buildSavedProjectsItems(userId, SECTION_LIMITS.saved_projects),
  };

  const freeItems = dedupedMaterials.freeMaterialsNearYou;

  const sections: LearnerHomeSection[] = [
    {
      key: 'suggested_materials',
      ...SECTION_META.suggested_materials,
      items: dedupedMaterials.suggestedMaterials,
    },
    {
      key: 'materials_for_saved_projects',
      ...SECTION_META.materials_for_saved_projects,
      items: dedupedMaterials.materialsForSavedProjects,
    },
    {
      key: 'suggested_projects',
      ...SECTION_META.suggested_projects,
      items: buildSuggestedProjectsItems(
        context,
        SECTION_LIMITS.suggested_projects,
      ),
    },
    continueProjectsSection,
    savedProjectsSection,
    {
      key: 'free_materials_near_you',
      title: resolveFreeMaterialsTitle(freeItems, context.savedLocation),
      emptyState: SECTION_META.free_materials_near_you.emptyState,
      items: freeItems,
    },
    {
      key: 'popular_projects',
      ...SECTION_META.popular_projects,
      items: rankProjects(
        context.projects,
        (project) => scorePopularProject(project),
        SECTION_LIMITS.popular_projects,
      ),
    },
  ];

  return {
    profileCompletion,
    sections,
  };
};
