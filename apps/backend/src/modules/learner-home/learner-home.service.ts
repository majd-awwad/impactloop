import * as learnerHomeRepository from './learner-home.repository.js';
import {
  BROWSE_MATERIAL_POOL_CAP,
  HOME_MATERIAL_POOL_CAP,
} from './learner-home.repository.js';
import {
  dedupeMaterialSections,
  dedupeMaterialItems,
  dedupeSectionItemsById,
  getProjectItemId,
} from './learner-home.deduplication.js';
import {
  preScoreMaterialPool,
  type PreScoredMaterialEntry,
} from './learner-home.material-features.js';
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
import { createLearnerHomeProfiler } from './learner-home.scoring-debug.js';
import {
  applyDiversityCap,
  normalizeInterests,
  resolveSuggestedMaterialsSubtitle,
  resolveSuggestedProjectsSubtitle,
  scorePopularProject,
  scoreSuggestedProject,
} from './learner-home.scoring.js';
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

const LEARNER_HOME_CACHE_TTL_MS = 45_000;
const learnerHomeCache = new Map<
  string,
  { expiresAt: number; payload: LearnerHomeResponse }
>();

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

type LearnerHomeLoadOptions = {
  materialPoolCap?: number;
  profiler?: ReturnType<typeof createLearnerHomeProfiler>;
};

const loadLearnerHomeContext = async (
  userId: string,
  options: LearnerHomeLoadOptions = {},
): Promise<LearnerHomeContext> => {
  const profiler = options.profiler;
  const materialPoolCap = options.materialPoolCap ?? HOME_MATERIAL_POOL_CAP;

  const [
    rawInterests,
    savedLocation,
    savedComponents,
    savedProjectsCount,
    behavior,
    projects,
  ] = await Promise.all([
    profiler
      ? profiler.time('loadLearnerInterests', () =>
          learnerHomeRepository.loadLearnerInterests(userId),
        )
      : learnerHomeRepository.loadLearnerInterests(userId),
    profiler
      ? profiler.time('loadDefaultSavedLocation', () =>
          learnerHomeRepository.loadDefaultSavedLocation(userId),
        )
      : learnerHomeRepository.loadDefaultSavedLocation(userId),
    profiler
      ? profiler.time('loadSavedProjectComponents', () =>
          learnerHomeRepository.loadSavedProjectComponents(userId),
        )
      : learnerHomeRepository.loadSavedProjectComponents(userId),
    profiler
      ? profiler.time('countSavedProjects', () =>
          learnerHomeRepository.countSavedProjects(userId),
        )
      : learnerHomeRepository.countSavedProjects(userId),
    profiler
      ? profiler.time('loadLearnerBehaviorContext', () =>
          learnerHomeRepository.loadLearnerBehaviorContext(userId),
        )
      : learnerHomeRepository.loadLearnerBehaviorContext(userId),
    profiler
      ? profiler.time('loadProjectCandidates', () =>
          learnerHomeRepository.loadProjectCandidates(userId),
        )
      : learnerHomeRepository.loadProjectCandidates(userId),
  ]);

  const interests = normalizeInterests(rawInterests);
  let behaviorAffinityProfile!: LearnerAffinityProfile;
  const assignBehaviorAffinityProfile = () => {
    behaviorAffinityProfile = buildBehaviorAffinityProfile(behavior);
  };

  if (profiler) {
    profiler.mark('buildBehaviorAffinityProfile', assignBehaviorAffinityProfile);
  } else {
    assignBehaviorAffinityProfile();
  }

  const materials = await (profiler
    ? profiler.time('loadMaterialCandidates', () =>
        learnerHomeRepository.loadMaterialCandidatesForLearner({
          interests,
          savedComponents,
          behavior,
          savedLocation,
          poolCap: materialPoolCap,
        }),
      )
    : learnerHomeRepository.loadMaterialCandidatesForLearner({
        interests,
        savedComponents,
        behavior,
        savedLocation,
        poolCap: materialPoolCap,
      }));

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

const preScoreMaterials = (context: LearnerHomeContext): PreScoredMaterialEntry[] =>
  preScoreMaterialPool({
    materials: context.materials,
    interests: context.interests,
    savedComponents: context.savedComponents,
    savedLocation: context.savedLocation,
    behavior: context.behavior,
    behaviorAffinityProfile: context.behaviorAffinityProfile,
  });

const rankPreScoredMaterialEntries = (
  entries: PreScoredMaterialEntry[],
  scoreKey: keyof PreScoredMaterialEntry['scores'],
  useTieredSuggestedRanking: boolean,
  browseAllTierSort: boolean,
): RankedMaterialEntry[] => {
  const ranked = entries
    .map((entry) => {
      const scored = entry.scores[scoreKey];
      return {
        type: 'material' as const,
        score: scored.score,
        reasons: scored.reasons,
        tier: scored.tier ?? 5,
        hasPrimaryRelevance: scored.hasPrimaryRelevance ?? false,
        fallbackOnly: scored.fallbackOnly ?? false,
        material: entry.material.mapped,
        ownerId: entry.ownerId,
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

const rankMaterialsFromPreScored = (
  entries: PreScoredMaterialEntry[],
  scoreKey: keyof PreScoredMaterialEntry['scores'],
  limit: number,
  useDiversityCap: boolean,
  useTieredSuggestedRanking = false,
  browseAllTierSort = false,
): LearnerHomeMaterialItem[] => {
  const selected = rankPreScoredMaterialEntries(
    entries,
    scoreKey,
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

const rankMaterialsPageFromPreScored = (
  entries: PreScoredMaterialEntry[],
  scoreKey: keyof PreScoredMaterialEntry['scores'],
  limit: number,
  offset: number,
): { items: LearnerHomeMaterialItem[]; hasMore: boolean; nextOffset: number | null } => {
  const sorted = rankPreScoredMaterialEntries(
    entries,
    scoreKey,
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

const buildRankedHomeMaterialSections = (
  context: LearnerHomeContext,
  preScoredMaterials: PreScoredMaterialEntry[],
  profiler?: ReturnType<typeof createLearnerHomeProfiler>,
) => {
  let rankedMaterialsForSavedProjects: LearnerHomeMaterialItem[] = [];
  const rankSaved = () => {
    rankedMaterialsForSavedProjects =
      context.savedComponents.length === 0
        ? []
        : rankMaterialsFromPreScored(
            preScoredMaterials,
            'savedProjects',
            RANK_POOL_SIZE,
            false,
            true,
            true,
          );
  };

  if (profiler) {
    profiler.mark('rankSavedProjectMaterials', rankSaved);
  } else {
    rankSaved();
  }

  let rankedSuggestedMaterials: LearnerHomeMaterialItem[] = [];
  const rankSuggested = () => {
    rankedSuggestedMaterials = rankMaterialsFromPreScored(
      preScoredMaterials,
      'suggested',
      RANK_POOL_SIZE,
      false,
      true,
    );
  };

  if (profiler) {
    profiler.mark('rankSuggestedMaterials', rankSuggested);
  } else {
    rankSuggested();
  }

  let rankedFreeMaterials: LearnerHomeMaterialItem[] = [];
  const rankFree = () => {
    rankedFreeMaterials = rankMaterialsFromPreScored(
      preScoredMaterials,
      'free',
      RANK_POOL_SIZE,
      false,
      true,
      true,
    );
  };

  if (profiler) {
    profiler.mark('rankFreeMaterials', rankFree);
  } else {
    rankFree();
  }

  let deduped = {
    materialsForSavedProjects: rankedMaterialsForSavedProjects,
    suggestedMaterials: rankedSuggestedMaterials,
    freeMaterialsNearYou: rankedFreeMaterials,
  };

  const dedupe = () => {
    deduped = dedupeMaterialSections({
      materialsForSavedProjects: rankedMaterialsForSavedProjects,
      suggestedMaterials: rankedSuggestedMaterials,
      freeMaterialsNearYou: rankedFreeMaterials,
      limits: {
        materialsForSavedProjects: SECTION_LIMITS.materials_for_saved_projects,
        suggestedMaterials: SECTION_LIMITS.suggested_materials,
        freeMaterialsNearYou: SECTION_LIMITS.free_materials_near_you,
      },
    });
  };

  if (profiler) {
    profiler.mark('dedupeMaterialSections', dedupe);
  } else {
    dedupe();
  }

  return deduped;
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
  preScoredMaterials?: PreScoredMaterialEntry[],
): Promise<{
  title: string;
  subtitle: string;
  items: LearnerHomeSectionItem[];
  hasMore: boolean;
  nextOffset: number | null;
}> => {
  switch (sectionKey) {
    case 'suggested_materials': {
      const scoredMaterials =
        preScoredMaterials ?? preScoreMaterials(context);
      const paged = rankMaterialsPageFromPreScored(
        scoredMaterials,
        'suggested',
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
    case 'materials_for_saved_projects': {
      const scoredMaterials =
        preScoredMaterials ?? preScoreMaterials(context);

      return {
        title: SECTION_META.materials_for_saved_projects.title,
        subtitle: SECTION_SUBTITLES.materials_for_saved_projects,
        items:
          context.savedComponents.length === 0
            ? []
            : rankMaterialsFromPreScored(
                scoredMaterials,
                'savedProjects',
                limit,
                false,
                true,
                true,
              ),
        hasMore: false,
        nextOffset: null,
      };
    }
    case 'free_materials_near_you': {
      const scoredMaterials =
        preScoredMaterials ?? preScoreMaterials(context);
      const items = rankMaterialsFromPreScored(
        scoredMaterials,
        'free',
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
  const profiler = createLearnerHomeProfiler('getLearnerHomeSection');
  const startedAt = performance.now();
  const materialPoolCap =
    sectionKey === 'suggested_materials'
      ? BROWSE_MATERIAL_POOL_CAP
      : HOME_MATERIAL_POOL_CAP;
  const context = await profiler.time('loadLearnerHomeContext', () =>
    loadLearnerHomeContext(userId, { profiler, materialPoolCap }),
  );
  let preScoredMaterials: PreScoredMaterialEntry[] | undefined;

  if (
    sectionKey === 'suggested_materials' ||
    sectionKey === 'materials_for_saved_projects' ||
    sectionKey === 'free_materials_near_you'
  ) {
    preScoredMaterials = await profiler.time('preScoreMaterials', async () =>
      preScoreMaterials(context),
    );
  }

  const built = await profiler.time(`buildSection:${sectionKey}`, () =>
    buildSectionItems(
      context,
      userId,
      sectionKey,
      limit,
      offset,
      preScoredMaterials,
    ),
  );

  profiler.record('totalGetLearnerHomeSection', performance.now() - startedAt);
  profiler.report({ userId, scope: 'getLearnerHomeSection' });

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
  const cached = learnerHomeCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  const profiler = createLearnerHomeProfiler('getLearnerHome');
  const startedAt = performance.now();
  const context = await profiler.time('loadLearnerHomeContext', () =>
    loadLearnerHomeContext(userId, {
      profiler,
      materialPoolCap: HOME_MATERIAL_POOL_CAP,
    }),
  );

  const [dedupedMaterials, continueProjectsSection, savedProjectsSection] =
    await Promise.all([
      profiler.time('rankMaterialSections', async () => {
        const preScoredMaterials = await profiler.time(
          'preScoreMaterials',
          async () => preScoreMaterials(context),
        );

        return buildRankedHomeMaterialSections(
          context,
          preScoredMaterials,
          profiler,
        );
      }),
      profiler.time('buildContinueProjectsItems', async () => ({
        key: 'continue_projects' as const,
        ...SECTION_META.continue_projects,
        items: await buildContinueProjectsItems(
          userId,
          SECTION_LIMITS.continue_projects,
        ),
      })),
      profiler.time('buildSavedProjectsItems', async () => ({
        key: 'saved_projects' as const,
        ...SECTION_META.saved_projects,
        items: await buildSavedProjectsItems(
          userId,
          SECTION_LIMITS.saved_projects,
        ),
      })),
    ]);

  profiler.record('totalGetLearnerHome', performance.now() - startedAt);
  profiler.report({ userId, scope: 'getLearnerHome' });

  const profileCompletion = {
    hasInterests: context.interests.length > 0,
    hasSavedLocation:
      (context.savedLocation.city?.trim().length ?? 0) > 0 ||
      (context.savedLocation.area?.trim().length ?? 0) > 0,
    hasSavedProjects: context.savedProjectsCount > 0,
    hasActivity: context.hasActivity,
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

  const response = {
    profileCompletion,
    sections,
  };

  learnerHomeCache.set(userId, {
    expiresAt: Date.now() + LEARNER_HOME_CACHE_TTL_MS,
    payload: response,
  });

  return response;
};
