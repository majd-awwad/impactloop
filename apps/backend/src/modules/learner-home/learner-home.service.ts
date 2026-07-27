import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import {
  RECOMMENDATION_SCORER_VERSION,
  type RecommendationScorerVersion,
} from '../../config/recommendation-scoring-version.js';

import * as learnerHomeRepository from './learner-home.repository.js';
import {
  BROWSE_MATERIAL_POOL_CAP,
  HOME_MATERIAL_POOL_CAP,
  type MaterialConceptChunkQuery,
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
  algorithmVersionForEffectiveMode,
  algorithmVersionForModeDecision,
  buildCanonicalProfileMap,
  buildLearnerHomeModeDecision,
  CANONICAL_SCORING_MODE,
  createFallbackCanonicalContext,
  createSuccessfulCanonicalContext,
  type CanonicalFallbackCode,
  type CanonicalMaterialScoringContext,
  type LearnerHomeModeDecision,
} from './learner-home.canonical-scoring.js';
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
  LearnerHomeSavedProjectComponent,
  LearnerAffinityProfile,
  LearnerBehaviorContext,
} from './learner-home.types.js';
import type {
  MaterialCondition,
  ProjectDifficulty,
  ReservationStatus,
} from '../../generated/prisma/client.js';
import { isActiveReservationBehaviorStatus } from '../reservations/reservations.quantity.js';
import { getRequestId } from '../../observability/request-context.js';
import {
  RECOMMENDATION_ALGORITHM_NAME,
  RECOMMENDATION_POLICY_VERSION,
  attachRecommendationImpressionIds,
  enqueueRecommendationExposure,
  toRecommendationExposureItems,
  type RecommendationCandidateTraceInput,
  type RecommendationGenerationMetadata,
} from '../recommendation-events/recommendation-events.service.js';
import { reportMlShadowFallback, runMlShadowComparison } from '../recommendations/ml-shadow.service.js';
import {
  buildLearnerHomeMlRuntimeIdentity,
  rankLearnerHomeMlCandidatePool,
  type LearnerHomeMlOrderedPool,
  type LearnerHomeMlOrderingDecision,
} from './learner-home.ml-ordering.js';
import { getRecommendationMlRuntimeSnapshot } from '../recommendations/ml-runtime-state.service.js';

const MATERIAL_SECTION_KEYS: ReadonlySet<LearnerHomeSectionKey> = new Set([
  'suggested_materials',
  'materials_for_saved_projects',
  'free_materials_near_you',
]);

/**
 * Section stamps use the domain-appropriate effective mode: material
 * sections stamp effectiveMaterialScoringMode, project (and unscored
 * project-adjacent) sections stamp effectiveProjectScoringMode. A project
 * ranking must never be stamped canonical-taxonomy-v3.
 */
const algorithmVersionForSection = (
  context: LearnerHomeContext,
  sectionKey: LearnerHomeSectionKey,
): string =>
  algorithmVersionForEffectiveMode(
    MATERIAL_SECTION_KEYS.has(sectionKey)
      ? context.modeDecision.effectiveMaterialScoringMode
      : context.modeDecision.effectiveProjectScoringMode,
  );

const mlDecisionToken = (decision: LearnerHomeMlOrderingDecision): string => {
  switch (decision.status) {
    case 'ML_RANKED': return 'ml-local';
    case 'FALLBACK_NOT_READY': return 'fb-not-ready';
    case 'FALLBACK_FAILED': return 'fb-failed';
    default: return 'deterministic';
  }
};

const algorithmVersionForMlSection = (
  context: LearnerHomeContext,
  sectionKey: LearnerHomeSectionKey,
  decision?: LearnerHomeMlOrderingDecision,
): string => {
  if (!decision || decision.runtimeMode !== 'ML_LOCAL') {
    return algorithmVersionForSection(context, sectionKey);
  }
  const sectionToken = sectionKey === 'suggested_materials'
    ? 'sm'
    : sectionKey === 'suggested_projects'
      ? 'sp'
      : undefined;
  if (!sectionToken) return algorithmVersionForSection(context, sectionKey);
  const base = MATERIAL_SECTION_KEYS.has(sectionKey)
    ? context.modeDecision.effectiveMaterialScoringMode
    : context.modeDecision.effectiveProjectScoringMode;
  return `learner-home-v1:base=${base};${sectionToken}=${mlDecisionToken(decision)}`;
};

/**
 * Full-Home ML algorithm stamp. Must stay <=100 characters for every valid
 * supported scorer/decision combination (outbox `algorithmVersion` contract).
 * Equal domain bases are encoded once; mixed bases use compact `m=`/`p=` form.
 */
const algorithmVersionForMlHome = (
  context: Pick<LearnerHomeContext, 'modeDecision'>,
  material: LearnerHomeMlOrderingDecision,
  project: LearnerHomeMlOrderingDecision,
): string => {
  if (material.runtimeMode !== 'ML_LOCAL' && project.runtimeMode !== 'ML_LOCAL') {
    return algorithmVersionForModeDecision(context.modeDecision);
  }
  const materialBase = context.modeDecision.effectiveMaterialScoringMode;
  const projectBase = context.modeDecision.effectiveProjectScoringMode;
  const base = materialBase === projectBase
    ? `base=${materialBase}`
    : `m=${materialBase};p=${projectBase}`;
  return `learner-home-v1:${base};sm=${mlDecisionToken(material)};sp=${mlDecisionToken(project)}`;
};

/** @internal Focused pure-test seam for full-Home ML algorithm-version length. */
export const algorithmVersionForMlHomeForTests = algorithmVersionForMlHome;

const algorithmNameForMlDecisions = (
  ...decisions: Array<LearnerHomeMlOrderingDecision | undefined>
): string => decisions.some((value) => value?.status === 'ML_RANKED')
  ? 'local-ml-hybrid'
  : RECOMMENDATION_ALGORITHM_NAME;

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

/** @internal Exported for RP-03.5 TTL assertions (single source of truth). */
export const LEARNER_HOME_CACHE_TTL_MS = 45_000;

export type LearnerHomeRequestScope =
  | { kind: 'FULL_HOME' }
  | { kind: 'SECTION'; sectionKey: LearnerHomeSectionKey };

/**
 * Production material candidate-pool cap resolver.
 * Full Home and non-browse sections use 120; browse-all suggested_materials uses 400.
 */
export const resolveMaterialCandidatePoolCap = (
  scope: LearnerHomeRequestScope,
): number => {
  if (scope.kind === 'SECTION' && scope.sectionKey === 'suggested_materials') {
    return BROWSE_MATERIAL_POOL_CAP;
  }
  return HOME_MATERIAL_POOL_CAP;
};

const emptyMlShadowConcepts = {
  materialConcepts: new Map<string, string[]>(),
  projectConcepts: new Map<string, string[]>(),
  projectComponentConcepts: new Map<string, string[]>(),
};

const buildMaterialShadowCandidates = (
  context: LearnerHomeContext,
  materialConcepts: Map<string, string[]>,
) => context.materials
  .filter((material) => material.status === 'AVAILABLE' && material.availableQuantity > 0)
  .map((material) => ({
    candidateKey: material.id,
    categoryId: material.categoryId,
    categoryLabel: material.categoryNameEn,
    condition: typeof material.mapped.condition === 'string' ? material.mapped.condition : undefined,
    isFree: material.isFree,
    pickupAllowed: material.pickupAllowed,
    deliveryAllowed: material.deliveryAllowed,
    conceptKeys: materialConcepts.get(material.id) ?? [],
  }));

const buildProjectShadowCandidates = (
  context: LearnerHomeContext,
  shadowConcepts: typeof emptyMlShadowConcepts,
) => context.projects.map((project) => ({
  candidateKey: project.id,
  categoryId: project.categoryId,
  categoryLabel: project.categoryNameEn,
  difficulty: project.difficulty,
  conceptKeys: shadowConcepts.projectConcepts.get(project.id) ?? [],
  componentConceptKeys: shadowConcepts.projectComponentConcepts.get(project.id) ?? [],
}));

const buildProjectShadowSections = (
  sections: LearnerHomeSection[],
  domain: 'material' | 'project',
) => sections.map((section) => ({
  sectionKey: section.key,
  candidateKeys: section.items.flatMap((item) => {
    if (domain === 'material' && item.type === 'material') return [String(item.material.id ?? '')];
    if (domain === 'project' && item.type === 'project') return [String(item.project.id ?? '')];
    return [];
  }).filter(Boolean),
})).filter((section) => section.candidateKeys.length > 0);

const buildProjectShadowInput = (
  context: LearnerHomeContext,
  response: LearnerHomeResponse,
  shadowConcepts: typeof emptyMlShadowConcepts,
) => ({
  response,
  domain: 'project' as const,
  interests: context.interests,
  candidates: buildProjectShadowCandidates(context, shadowConcepts),
  currentTopKeys: response.sections.flatMap((section) => section.items)
    .flatMap((item) => (item.type === 'project' ? [String(item.project.id ?? '')] : []))
    .filter(Boolean),
  currentSections: buildProjectShadowSections(response.sections, 'project'),
  activeCandidateKeys: context.projects.map((project) => project.id),
  recentEvents: context.behavior.recentRecommendationEvents ?? [],
  recentEntityMetadata: context.projects.map((project) => ({
    entityKey: project.id,
    candidateKey: project.id,
    categoryId: project.categoryId,
    categoryLabel: project.categoryNameEn,
    conceptKeys: shadowConcepts.projectConcepts.get(project.id) ?? [],
    componentConceptKeys: shadowConcepts.projectComponentConcepts.get(project.id) ?? [],
  })),
  evaluationTimestamp: new Date().toISOString(),
});

type LearnerHomeCacheLoader<T> = (userId: string) => Promise<T>;

type LearnerHomeCacheEntry<T> = {
  expiresAt: number;
  payload: T;
};

type LearnerHomeInFlightEntry<T> = {
  promise: Promise<T>;
};

type LearnerHomeCacheRead<T> = {
  payload: T;
  state: 'MISS' | 'HIT' | 'SINGLE_FLIGHT';
};

type LearnerHomeCacheDiagnostics = {
  cacheSize: number;
  inFlightSize: number;
  generationSize: number;
  cacheWriteCount: number;
};

type LearnerHomeCacheController<T> = {
  get: (userId: string) => Promise<T>;
  getWithState: (userId: string) => Promise<LearnerHomeCacheRead<T>>;
  invalidate: (userId: string) => void;
  invalidateAll: () => void;
  getDiagnostics: () => LearnerHomeCacheDiagnostics;
};

const createLearnerHomeCache = <T>(
  load: LearnerHomeCacheLoader<T>,
  now: () => number = Date.now,
  resolveCacheKey: (userId: string) => string = (userId) => userId,
  shouldCache: (payload: T) => boolean = () => true,
): LearnerHomeCacheController<T> => {
  const cache = new Map<string, LearnerHomeCacheEntry<T>>();
  const inFlight = new Map<string, LearnerHomeInFlightEntry<T>>();

  // Generation metadata is retained only for keys with active work. This
  // keeps invalidation-race protection bounded by the in-flight map size.
  const generationByKey = new Map<string, number>();
  let cacheWriteCount = 0;

  const currentGeneration = (userId: string): number =>
    generationByKey.get(userId) ?? 0;

  const getWithState = async (userId: string): Promise<LearnerHomeCacheRead<T>> => {
    const cacheKey = resolveCacheKey(userId);
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > now()) {
      return { payload: cached.payload, state: 'HIT' };
    }

    if (cached) {
      cache.delete(cacheKey);
    }

    const existing = inFlight.get(cacheKey);
    if (existing) {
      return { payload: await existing.promise, state: 'SINGLE_FLIGHT' };
    }

    const generationAtStart = currentGeneration(cacheKey);
    let promise!: Promise<T>;

    // Queue the loader behind the map insertion so no asynchronous database
    // work can begin before concurrent callers can observe the flight.
    promise = Promise.resolve().then(async () => {
      const payload = await load(userId);
      const currentFlight = inFlight.get(cacheKey);

      if (
        currentFlight?.promise === promise &&
        currentGeneration(cacheKey) === generationAtStart &&
        shouldCache(payload)
      ) {
        cache.set(cacheKey, {
          expiresAt: now() + LEARNER_HOME_CACHE_TTL_MS,
          payload,
        });
        cacheWriteCount += 1;
      }

      return payload;
    });

    inFlight.set(cacheKey, { promise });

    try {
      return { payload: await promise, state: 'MISS' };
    } finally {
      if (inFlight.get(cacheKey)?.promise === promise) {
        inFlight.delete(cacheKey);
        generationByKey.delete(cacheKey);
      }
    }
  };

  const get = async (userId: string): Promise<T> =>
    (await getWithState(userId)).payload;

  const invalidate = (userId: string): void => {
    const keyPrefix = `${userId}\u0000`;
    const keys = new Set([
      ...cache.keys(),
      ...inFlight.keys(),
    ].filter((key) => key === userId || key.startsWith(keyPrefix)));

    for (const cacheKey of keys) {
      cache.delete(cacheKey);
      if (inFlight.has(cacheKey)) {
        generationByKey.set(cacheKey, currentGeneration(cacheKey) + 1);
      } else {
        generationByKey.delete(cacheKey);
      }
    }
  };

  const invalidateAll = (): void => {
    cache.clear();

    for (const userId of inFlight.keys()) {
      generationByKey.set(userId, currentGeneration(userId) + 1);
    }
  };

  return {
    get,
    getWithState,
    invalidate,
    invalidateAll,
    getDiagnostics: () => ({
      cacheSize: cache.size,
      inFlightSize: inFlight.size,
      generationSize: generationByKey.size,
      cacheWriteCount,
    }),
  };
};

/**
 * @internal Test-only factory for deterministic cache-coordination tests.
 * The optional shouldCache predicate mirrors the production wiring
 * (`payload => payload.cacheable`) so RP-03.1 cache-recovery tests can
 * exercise the real generic controller without a database.
 */
export const createLearnerHomeCacheForTests = <T = LearnerHomeResponse>(
  load: LearnerHomeCacheLoader<T>,
  now: () => number = Date.now,
  shouldCache?: (payload: T) => boolean,
  resolveCacheKey?: (userId: string) => string,
): LearnerHomeCacheController<T> =>
  createLearnerHomeCache(load, now, resolveCacheKey, shouldCache);

export const invalidateLearnerHomeCache = (userId: string): void => {
  learnerHomeCache.invalidate(userId);
};

/** Clears every cached learner-home response after a change to shared material availability. */
export const invalidateAllLearnerHomeResponseCaches = (): void => {
  learnerHomeCache.invalidateAll();
};

/**
 * An active-to-active reservation transition keeps the material hold in place.
 * Every other transition can change shared availability, so cached home responses
 * must be rebuilt for all learners.
 */
export const invalidateLearnerHomeForReservationTransition = (
  previousStatus: ReservationStatus | null,
  nextStatus: ReservationStatus,
): void => {
  if (
    previousStatus != null &&
    isActiveReservationBehaviorStatus(previousStatus) &&
    isActiveReservationBehaviorStatus(nextStatus)
  ) {
    return;
  }

  invalidateAllLearnerHomeResponseCaches();
};

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

/**
 * @internal Exported only so RP-03.1 tests can exercise preScoreMaterials's
 * real try/catch fallback branch directly (honest integration proof) instead
 * of duplicating its retry logic inside a test.
 */
export type LearnerHomeLoadedContext = {
  interests: string[];
  savedLocation: Awaited<
    ReturnType<typeof learnerHomeRepository.loadDefaultSavedLocation>
  >;
  savedComponents: LearnerHomeSavedProjectComponent[];
  materials: Awaited<ReturnType<typeof learnerHomeRepository.loadMaterialCandidates>>;
  projects: Awaited<ReturnType<typeof learnerHomeRepository.loadProjectCandidates>>;
  savedProjectItems: Awaited<
    ReturnType<typeof learnerHomeRepository.loadLearnerHomeProjectContext>
  >['savedProjects'];
  inProgressBuilds: Awaited<
    ReturnType<typeof learnerHomeRepository.loadLearnerHomeProjectContext>
  >['inProgressBuilds'];
  savedProjectIds: Set<string>;
  hasSavedProjects: boolean;
  behavior: LearnerBehaviorContext;
  behaviorAffinityProfile: LearnerAffinityProfile;
  hasActivity: boolean;
};

export type LearnerHomeContext = LearnerHomeLoadedContext & {
  /**
   * RP-03.1 correction: one material effectiveScoringMode cannot describe
   * project scoring (projects always force-delegate to legacy-v1 under a
   * canonical request). This bounded diagnostic tracks both domains plus
   * fallback state; fallbackCode is preserved here rather than dropped after
   * context construction, and is never exposed on the public response.
   */
  modeDecision: LearnerHomeModeDecision;
  canonicalContext: CanonicalMaterialScoringContext | undefined;
};

export type LearnerHomeCachedEnvelope = {
  response: LearnerHomeResponse;
  generation: RecommendationGenerationMetadata;
  cacheable: boolean;
  /** @internal Not exposed on the public HTTP response. */
  modeDecision: LearnerHomeModeDecision;
  /** @internal Bounded LM ordering decisions; never serialized to LearnerHomeResponse. */
  mlOrdering: {
    material: LearnerHomeMlOrderingDecision;
    project: LearnerHomeMlOrderingDecision;
  };
};

const buildCanonicalScoringContextForMaterials = async (input: {
  materials: LearnerHomeContext['materials'];
  behavior: LearnerBehaviorContext;
  conceptQueryChunk?: MaterialConceptChunkQuery;
}): Promise<CanonicalMaterialScoringContext> => {
  const candidateIds = input.materials.map((material) => material.id);
  const likedIds = input.behavior.likedMaterials.map((row) => row.materialId);
  const reservedIds = input.behavior.reservedMaterials.map((row) => row.materialId);
  const viewedIds = input.behavior.viewedMaterials.map((row) => row.materialId);
  const allIds = [...new Set([...candidateIds, ...likedIds, ...reservedIds, ...viewedIds])];

  const rowsByMaterialId = input.conceptQueryChunk
    ? await learnerHomeRepository.loadMaterialConceptsForScoring(
        allIds,
        input.conceptQueryChunk,
      )
    : await learnerHomeRepository.loadMaterialConceptsForScoring(allIds);

  // Incomplete coverage of requested IDs is a context invariant.
  for (const materialId of allIds) {
    if (!rowsByMaterialId.has(materialId)) {
      return createFallbackCanonicalContext('CANONICAL_CONTEXT_INVARIANT_FALLBACK');
    }
  }

  const allProfiles = buildCanonicalProfileMap(allIds, rowsByMaterialId);
  const pick = (ids: string[]) => {
    const map = new Map(
      [...new Set(ids)].map((id) => {
        const profile = allProfiles.get(id);
        if (!profile) {
          throw new Error('CANONICAL_CONTEXT_INVARIANT');
        }
        return [id, profile] as const;
      }),
    );
    return map;
  };

  try {
    return createSuccessfulCanonicalContext({
      candidateMaterialProfiles: pick(candidateIds),
      likedMaterialProfiles: pick(likedIds),
      reservedMaterialProfiles: pick(reservedIds),
      viewedMaterialProfiles: pick(viewedIds),
    });
  } catch {
    return createFallbackCanonicalContext('CANONICAL_CONTEXT_INVARIANT_FALLBACK');
  }
};

/**
 * @internal Exported for RP-03.1 tests: `requestedMaterialScoringMode` and
 * `needsCanonicalMaterialScoring` are explicit parameters (not read from the
 * frozen process-level RECOMMENDATION_SCORER_VERSION constant), so tests can
 * exercise the skip decision and hydration call count deterministically
 * regardless of the running process's actual configured mode.
 *
 * Project-only section requests (suggested_projects, popular_projects,
 * saved_projects, continue_projects) never need canonical material context:
 * project scoring always force-delegates to legacy-v1 already. Hydrating
 * MaterialConcept rows for those requests would be a wasted query with no
 * effect on the response, so needsCanonicalMaterialScoring=false skips the
 * whole hydration attempt (no query, no context, no fallback recorded).
 */
export const resolveMaterialModeDecisionAndContext = async (input: {
  requestedMaterialScoringMode: RecommendationScorerVersion;
  needsCanonicalMaterialScoring: boolean;
  materials: LearnerHomeContext['materials'];
  behavior: LearnerBehaviorContext;
  profiler?: ReturnType<typeof createLearnerHomeProfiler>;
  conceptQueryChunk?: MaterialConceptChunkQuery;
}): Promise<{
  modeDecision: LearnerHomeModeDecision;
  canonicalContext: CanonicalMaterialScoringContext | undefined;
}> => {
  let effectiveMaterialScoringMode: RecommendationScorerVersion =
    input.requestedMaterialScoringMode;
  let fallbackCode: CanonicalFallbackCode | null = null;
  let cacheable = true;
  let canonicalContext: CanonicalMaterialScoringContext | undefined;

  if (
    input.requestedMaterialScoringMode === CANONICAL_SCORING_MODE &&
    input.needsCanonicalMaterialScoring
  ) {
    try {
      const hydrate = () =>
        buildCanonicalScoringContextForMaterials({
          materials: input.materials,
          behavior: input.behavior,
          conceptQueryChunk: input.conceptQueryChunk,
        });
      canonicalContext = await (input.profiler
        ? input.profiler.time('loadCanonicalMaterialConcepts', hydrate)
        : hydrate());
    } catch {
      canonicalContext = createFallbackCanonicalContext(
        'CANONICAL_LOADER_FALLBACK_LEGACY_V1',
      );
    }

    if (canonicalContext.effectiveScoringMode !== CANONICAL_SCORING_MODE) {
      effectiveMaterialScoringMode = 'legacy-v1';
      fallbackCode =
        canonicalContext.fallbackCode ?? 'CANONICAL_LOADER_FALLBACK_LEGACY_V1';
      cacheable = false;
      canonicalContext = undefined;
    } else {
      effectiveMaterialScoringMode = CANONICAL_SCORING_MODE;
      cacheable = true;
    }
  }

  return {
    modeDecision: buildLearnerHomeModeDecision({
      requestedMaterialScoringMode: input.requestedMaterialScoringMode,
      effectiveMaterialScoringMode,
      fallbackCode,
      cacheable,
    }),
    canonicalContext,
  };
};

const buildCandidateTraces = (
  context: LearnerHomeContext,
  response: { sections: LearnerHomeSection[] },
  surface = 'LEARNER_HOME',
): RecommendationCandidateTraceInput[] => {
  const exposures = toRecommendationExposureItems(response);
  const selectedByEntity = new Map<string, (typeof exposures)[number]>();

  for (const exposure of exposures) {
    const key = `${exposure.entityType}:${exposure.entityId}`;
    if (!selectedByEntity.has(key)) {
      selectedByEntity.set(key, exposure);
    }
  }

  const traces: RecommendationCandidateTraceInput[] = [];
  const addTrace = (
    entityType: 'MATERIAL' | 'PROJECT',
    entityId: string,
    source: string,
    selected?: (typeof exposures)[number],
  ) => {
    const isEligible = entityType === 'MATERIAL'
      ? context.materials.some(
          (material) =>
            material.id === entityId &&
            material.status === 'AVAILABLE' &&
            material.availableQuantity > 0,
        )
      : context.projects.some((project) => project.id === entityId);

    traces.push({
      entityType,
      entityId,
      surface,
      sectionKey: selected?.sectionKey,
      candidateSource: source,
      eligibilityResult: isEligible ? 'ELIGIBLE' : 'EXCLUDED',
      rankBeforeSelection: selected?.position ?? null,
      finalScore: selected?.score ?? null,
      exclusionReason: isEligible ? null : 'not_eligible_at_generation',
      selected: Boolean(selected),
    });
  };

  for (const material of context.materials) {
    addTrace(
      'MATERIAL',
      material.id,
      'learner_home_material_pool',
      selectedByEntity.get(`MATERIAL:${material.id}`),
    );
  }

  for (const project of context.projects) {
    addTrace(
      'PROJECT',
      project.id,
      'learner_home_project_pool',
      selectedByEntity.get(`PROJECT:${project.id}`),
    );
  }

  for (const build of context.inProgressBuilds) {
    const selected = selectedByEntity.get(`PROJECT:${build.projectId}`);
    if (selected) {
      addTrace(
        'PROJECT',
        build.projectId,
        'learner_home_continue_project_pool',
        selected,
      );
    }
  }

  return traces;
};

type LearnerHomeLoadOptions = {
  materialPoolCap?: number;
  profiler?: ReturnType<typeof createLearnerHomeProfiler>;
  useConsolidatedProjectContext?: boolean;
};

const loadLearnerHomeContext = async (
  userId: string,
  options: LearnerHomeLoadOptions = {},
): Promise<LearnerHomeLoadedContext> => {
  const profiler = options.profiler;
  const materialPoolCap = options.materialPoolCap ?? HOME_MATERIAL_POOL_CAP;
  const useConsolidatedProjectContext =
    options.useConsolidatedProjectContext ?? false;

  const [
    rawInterests,
    savedLocation,
    projectContext,
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
    useConsolidatedProjectContext
      ? profiler
        ? profiler.time('loadLearnerHomeProjectContext', () =>
            learnerHomeRepository.loadLearnerHomeProjectContext(userId, 4),
          )
        : learnerHomeRepository.loadLearnerHomeProjectContext(userId, 4)
      : Promise.all([
          profiler
            ? profiler.time('hasSavedProjects', () =>
                learnerHomeRepository.hasSavedProjects(userId),
              )
            : learnerHomeRepository.hasSavedProjects(userId),
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
        ]).then(([hasSavedProjects, behavior, projects]) => ({
          hasSavedProjects,
          behavior,
          projects,
          savedProjects: [],
          inProgressBuilds: [],
        })),
  ]);

  const behavior = projectContext.behavior;
  const projects = projectContext.projects;

  const savedComponents = behavior.savedProjectComponents ?? [];

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
    savedProjectItems: projectContext.savedProjects,
    inProgressBuilds: projectContext.inProgressBuilds,
    savedProjectIds,
    hasSavedProjects: projectContext.hasSavedProjects,
    behavior,
    behaviorAffinityProfile,
    hasActivity: hasLearnerActivity(behavior),
  };
};

/**
 * @internal Exported only for RP-03.1's honest fallback-integration test,
 * which calls this exact function (not a re-implementation of it) to prove
 * that a canonical failure retries with the explicit 'legacy-v1' literal.
 */
export const preScoreMaterials = (context: LearnerHomeContext): PreScoredMaterialEntry[] => {
  try {
    return preScoreMaterialPool({
      materials: context.materials,
      interests: context.interests,
      savedComponents: context.savedComponents,
      savedLocation: context.savedLocation,
      behavior: context.behavior,
      behaviorAffinityProfile: context.behaviorAffinityProfile,
      // Explicit: the feature pool must never re-derive scorer version from
      // the process-global constant, or a canonical whole-request fallback
      // (effectiveMaterialScoringMode already downgraded to legacy-v1) would
      // silently regain normalized-alias interest semantics.
      scorerVersion: context.modeDecision.effectiveMaterialScoringMode,
      canonicalContext:
        context.modeDecision.effectiveMaterialScoringMode === CANONICAL_SCORING_MODE
          ? context.canonicalContext
          : undefined,
    });
  } catch (error) {
    // Only one canonical retry is ever attempted, and only when the request
    // was still effectively canonical at the moment of failure. If an
    // earlier loader-level fallback had already downgraded
    // effectiveMaterialScoringMode to legacy-v1, this catch is a genuine
    // legacy/normalized failure, not a canonical one, and must not retry
    // again.
    const canRetryAsCanonicalFallback =
      context.modeDecision.requestedMaterialScoringMode === CANONICAL_SCORING_MODE &&
      context.modeDecision.effectiveMaterialScoringMode === CANONICAL_SCORING_MODE;

    if (canRetryAsCanonicalFallback) {
      context.modeDecision.effectiveMaterialScoringMode = 'legacy-v1';
      context.modeDecision.fallbackCode = 'CANONICAL_SCORER_INVARIANT_FALLBACK';
      context.modeDecision.cacheable = false;
      context.canonicalContext = undefined;
      return preScoreMaterialPool({
        materials: context.materials,
        interests: context.interests,
        savedComponents: context.savedComponents,
        savedLocation: context.savedLocation,
        behavior: context.behavior,
        behaviorAffinityProfile: context.behaviorAffinityProfile,
        scorerVersion: 'legacy-v1',
      });
    }

    // Legacy-v1/normalized-interests-v2 failures — and a second failure
    // after the mode is already effectively legacy-v1 — propagate the
    // original error unchanged rather than masking it behind a generic
    // wrapper message.
    throw error;
  }
};

/**
 * @internal Exported only for RP-03.3's ranking-delta evaluator reuse, so the
 * evaluator calls the exact production `score > 0` filter plus tiered-Home
 * (`selectTieredSuggestedMaterials`) / browse-all (`sortAllRankedMaterials`)
 * dispatch instead of re-implementing material ranking-eligibility rules.
 * No behavior change.
 */
export const rankPreScoredMaterialEntries = (
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
  const rankedEntries = rankPreScoredMaterialEntries(
    entries,
    scoreKey,
    useTieredSuggestedRanking,
    browseAllTierSort,
  );

  const selected = rankedEntries.slice(0, limit);

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
  orderedEntries?: readonly RankedMaterialEntry[],
): { items: LearnerHomeMaterialItem[]; hasMore: boolean; nextOffset: number | null } => {
  const sorted = orderedEntries
    ? [...orderedEntries]
    : rankPreScoredMaterialEntries(entries, scoreKey, true, true);
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
  orderedSuggestedEntries?: readonly RankedMaterialEntry[],
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
    rankedSuggestedMaterials = orderedSuggestedEntries
      ? dedupeMaterialItems(
          orderedSuggestedEntries.slice(0, RANK_POOL_SIZE).map(toMaterialItem),
          RANK_POOL_SIZE,
        )
      : rankMaterialsFromPreScored(
          preScoredMaterials,
          'suggested',
          RANK_POOL_SIZE,
          false,
          true,
          false,
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

/**
 * @internal Exported only for RP-03.3's ranking-delta evaluator reuse, so the
 * evaluator calls the exact production filter/tier-sort/score-sort/dedupe
 * combinator instead of maintaining a separate mirror. No behavior change.
 */
export const rankProjects = (
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
  orderedPool?: readonly LearnerHomeProjectItem[],
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

  const deterministicPool = [
    ...rankProjects(unsavedProjects, scoreProject, context.projects.length, true),
    ...rankProjects(savedProjects, scoreProject, context.projects.length, true),
  ];
  const selectedPool = orderedPool ? [...orderedPool] : deterministicPool;
  return selectSuggestedProjectItems(
    selectedPool.filter(
      (item) => !context.savedProjectIds.has(String(item.project.id ?? '')),
    ),
    selectedPool.filter((item) =>
      context.savedProjectIds.has(String(item.project.id ?? '')),
    ),
    limit,
  );
};

const buildSuggestedProjectsCandidatePool = (
  context: LearnerHomeContext,
): LearnerHomeProjectItem[] => buildSuggestedProjectsItems(
  context,
  context.projects.length,
);

const buildSuggestedMaterialCandidatePool = (
  entries: PreScoredMaterialEntry[],
  browseAll: boolean,
): RankedMaterialEntry[] => rankPreScoredMaterialEntries(
  entries,
  'suggested',
  true,
  browseAll,
).slice(0, browseAll ? entries.length : RANK_POOL_SIZE);

const failedMlOrderingResult = <T>(
  domain: 'material' | 'project',
  pool: readonly T[],
  reasonCode: string,
): LearnerHomeMlOrderedPool<T> => ({
  ordered: Object.freeze([...pool]),
  decision: {
    domain,
    runtimeMode: getRecommendationMlRuntimeSnapshot().mode,
    status: 'FALLBACK_FAILED',
    reasonCode,
    diagnostics: {
      candidateCount: pool.length,
      scoredCount: 0,
      retryCount: 0,
      unmappedCandidateCount: 0,
      omittedMappedCandidateCount: 0,
      unknownRankedKeyCount: 0,
      duplicateRankedKeyCount: 0,
      opaqueKeySamples: [],
    },
  },
});

const rankSuggestedMaterialPoolWithMl = async (
  context: LearnerHomeContext,
  pool: readonly RankedMaterialEntry[],
) => {
  const snapshot = getRecommendationMlRuntimeSnapshot();
  let materialConcepts = new Map<string, string[]>();
  let conceptLoadFailed = false;
  if (snapshot.mode === 'ML_LOCAL') {
    try {
      materialConcepts = (
        await learnerHomeRepository.loadMlShadowConcepts(
          pool.map((entry) => String(entry.material.id ?? '')).filter(Boolean),
          [],
        )
      ).materialConcepts;
    } catch {
      conceptLoadFailed = true;
    }
  }
  const sourceById = new Map(context.materials.map((material) => [material.id, material]));
  const candidates = pool.flatMap((entry) => {
    const candidateKey = String(entry.material.id ?? '');
    const source = sourceById.get(candidateKey);
    if (!source || candidateKey.length === 0) return [];
    return [{
      candidateKey,
      item: entry,
      conceptKeys: materialConcepts.get(candidateKey) ?? [],
      condition: source.mapped.condition as MaterialCondition,
      isFree: source.isFree,
      pickupAllowed: source.pickupAllowed,
      deliveryAllowed: source.deliveryAllowed,
    }];
  });
  if (candidates.length !== pool.length) {
    return failedMlOrderingResult('material', pool, 'CANDIDATE_INPUT_MAPPING_FAILED');
  }
  return rankLearnerHomeMlCandidatePool({
    domain: 'material',
    interests: context.interests,
    candidates,
  }, {
    getSnapshot: () => snapshot,
    ...(conceptLoadFailed
      ? { loadUserFeatures: async () => { throw new Error('material_concept_load_failed'); } }
      : {}),
  });
};

const rankSuggestedProjectPoolWithMl = async (
  context: LearnerHomeContext,
  pool: readonly LearnerHomeProjectItem[],
) => {
  const snapshot = getRecommendationMlRuntimeSnapshot();
  let projectConcepts = new Map<string, string[]>();
  let projectComponentConcepts = new Map<string, string[]>();
  let conceptLoadFailed = false;
  if (snapshot.mode === 'ML_LOCAL') {
    try {
      const concepts = await learnerHomeRepository.loadMlShadowConcepts(
        [],
        pool.map((item) => String(item.project.id ?? '')).filter(Boolean),
      );
      projectConcepts = concepts.projectConcepts;
      projectComponentConcepts = concepts.projectComponentConcepts;
    } catch {
      conceptLoadFailed = true;
    }
  }
  const sourceById = new Map(context.projects.map((project) => [project.id, project]));
  const candidates = pool.flatMap((item) => {
    const candidateKey = String(item.project.id ?? '');
    const source = sourceById.get(candidateKey);
    if (!source || candidateKey.length === 0) return [];
    return [{
      candidateKey,
      item,
      conceptKeys: projectConcepts.get(candidateKey) ?? [],
      componentConceptKeys: projectComponentConcepts.get(candidateKey) ?? [],
      difficulty: source.difficulty as ProjectDifficulty,
    }];
  });
  if (candidates.length !== pool.length) {
    return failedMlOrderingResult('project', pool, 'CANDIDATE_INPUT_MAPPING_FAILED');
  }
  return rankLearnerHomeMlCandidatePool({
    domain: 'project',
    interests: context.interests,
    candidates,
  }, {
    getSnapshot: () => snapshot,
    ...(conceptLoadFailed
      ? { loadUserFeatures: async () => { throw new Error('project_concept_load_failed'); } }
      : {}),
  });
};

const buildContinueProjectsItems = async (
  userId: string,
  limit: number,
): Promise<LearnerHomeContinueProjectItem[]> => {
  const builds = await learnerHomeRepository.loadInProgressBuilds(userId, limit);

  return buildContinueProjectsItemsFromBuilds(builds, limit);
};

const buildContinueProjectsItemsFromBuilds = (
  builds: Awaited<ReturnType<typeof learnerHomeRepository.loadInProgressBuilds>>,
  limit: number,
): LearnerHomeContinueProjectItem[] => {
  const limitedBuilds = builds.slice(0, limit);

  return dedupeSectionItemsById(
    limitedBuilds
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

  return buildSavedProjectsItemsFromItems(items, limit);
};

const buildSavedProjectsItemsFromItems = (
  items: Awaited<
    ReturnType<typeof learnerHomeRepository.loadSavedProjectsForLearner>
  >,
  limit: number,
): LearnerHomeProjectItem[] =>
  dedupeSectionItemsById(items, limit, getProjectItemId);

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
  orderedSuggestedMaterialEntries?: readonly RankedMaterialEntry[],
  orderedSuggestedProjectItems?: readonly LearnerHomeProjectItem[],
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
        orderedSuggestedMaterialEntries,
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
      const items = buildSuggestedProjectsItems(
        context,
        limit,
        orderedSuggestedProjectItems,
      );
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

/**
 * @internal RP-03.5 audit seam: same production section path as
 * getLearnerHomeSection, plus candidate/mode/timing diagnostics.
 */
export const getLearnerHomeSectionForAudit = async (
  userId: string,
  sectionKey: LearnerHomeSectionKey,
  limit: number,
  offset = 0,
) => {
  const profiler = createLearnerHomeProfiler('getLearnerHomeSection');
  const startedAt = performance.now();
  const materialPoolCap = resolveMaterialCandidatePoolCap({
    kind: 'SECTION',
    sectionKey,
  });
  const loaded = await profiler.time('loadLearnerHomeContext', () =>
    loadLearnerHomeContext(userId, {
      profiler,
      materialPoolCap,
    }),
  );
  // Project-only sections never need canonical material context: project
  // scoring always force-delegates to legacy-v1 regardless.
  const { modeDecision, canonicalContext } =
    await resolveMaterialModeDecisionAndContext({
      requestedMaterialScoringMode: RECOMMENDATION_SCORER_VERSION,
      needsCanonicalMaterialScoring: MATERIAL_SECTION_KEYS.has(sectionKey),
      materials: loaded.materials,
      behavior: loaded.behavior,
      profiler,
    });
  const context: LearnerHomeContext = {
    ...loaded,
    modeDecision,
    canonicalContext,
  };
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

  let orderedSuggestedMaterialEntries: readonly RankedMaterialEntry[] | undefined;
  let orderedSuggestedProjectItems: readonly LearnerHomeProjectItem[] | undefined;
  let mlDecision: LearnerHomeMlOrderingDecision | undefined;
  if (sectionKey === 'suggested_materials' && preScoredMaterials) {
    const pool = buildSuggestedMaterialCandidatePool(preScoredMaterials, true);
    const mlResult = await rankSuggestedMaterialPoolWithMl(context, pool);
    orderedSuggestedMaterialEntries = mlResult.ordered;
    mlDecision = mlResult.decision;
  } else if (sectionKey === 'suggested_projects') {
    const pool = buildSuggestedProjectsCandidatePool(context);
    const mlResult = await rankSuggestedProjectPoolWithMl(context, pool);
    orderedSuggestedProjectItems = mlResult.ordered;
    mlDecision = mlResult.decision;
  }

  const built = await profiler.time(`buildSection:${sectionKey}`, () =>
    buildSectionItems(
      context,
      userId,
      sectionKey,
      limit,
      offset,
      preScoredMaterials,
      orderedSuggestedMaterialEntries,
      orderedSuggestedProjectItems,
    ),
  );

  profiler.record('totalGetLearnerHomeSection', performance.now() - startedAt);
  profiler.report({ userId, scope: 'getLearnerHomeSection' });

  const sectionResponse = {
    key: sectionKey,
    title: built.title,
    subtitle: built.subtitle,
    items: built.items,
    emptyState: SECTION_META[sectionKey].emptyState,
    nextCursor: null,
    nextOffset: built.nextOffset,
    hasMore: built.hasMore,
  };

  if (
    getRecommendationMlRuntimeSnapshot().mode === 'SHADOW' &&
    sectionKey === 'suggested_materials'
  ) {
    try {
      const shadowConcepts = env.recommendationMlShadowEnabled
        ? await learnerHomeRepository.loadMlShadowConcepts(
            context.materials.map((material) => material.id),
            context.projects.map((project) => project.id),
          )
        : emptyMlShadowConcepts;
      const shadowResponse = { sections: [sectionResponse] };
      const materialCandidates = buildMaterialShadowCandidates(
        context,
        shadowConcepts.materialConcepts,
      );
      const currentMaterialKeys = sectionResponse.items
        .filter((item): item is LearnerHomeMaterialItem => item.type === 'material')
        .map((item) => String(item.material.id ?? ''))
        .filter(Boolean);
      await runMlShadowComparison({
        response: shadowResponse,
        domain: 'material',
        interests: context.interests,
        candidates: materialCandidates,
        currentTopKeys: currentMaterialKeys,
        currentSections: [{
          sectionKey: sectionResponse.key,
          candidateKeys: currentMaterialKeys,
        }],
        activeCandidateKeys: materialCandidates.map((candidate) => candidate.candidateKey),
        recentEvents: context.behavior.recentRecommendationEvents ?? [],
        recentEntityMetadata: context.projects.map((project) => ({
          entityKey: project.id,
          candidateKey: project.id,
          categoryId: project.categoryId,
          categoryLabel: project.categoryNameEn,
          conceptKeys: shadowConcepts.projectConcepts.get(project.id) ?? [],
          componentConceptKeys: shadowConcepts.projectComponentConcepts.get(project.id) ?? [],
        })),
        evaluationTimestamp: new Date().toISOString(),
      });
    } catch (error) {
      reportMlShadowFallback('material', context.materials.length, error);
    }
  }

  if (
    getRecommendationMlRuntimeSnapshot().mode === 'SHADOW' &&
    sectionKey === 'suggested_projects'
  ) {
    try {
      const shadowConcepts = env.recommendationMlShadowEnabled
        ? await learnerHomeRepository.loadMlShadowConcepts(
            context.materials.map((material) => material.id),
            context.projects.map((project) => project.id),
          )
        : emptyMlShadowConcepts;
      const shadowResponse: LearnerHomeResponse = {
        profileCompletion: {
          hasInterests: context.interests.length > 0,
          hasSavedLocation:
            (context.savedLocation.city?.trim().length ?? 0) > 0 ||
            (context.savedLocation.area?.trim().length ?? 0) > 0,
          hasSavedProjects: context.hasSavedProjects,
          hasActivity: context.hasActivity,
        },
        sections: [{
          key: 'suggested_projects',
          ...SECTION_META.suggested_projects,
          items: sectionResponse.items,
        }],
      };
      await runMlShadowComparison(
        buildProjectShadowInput(context, shadowResponse, shadowConcepts),
      );
    } catch (error) {
      reportMlShadowFallback('project', context.projects.length, error);
    }
  }

  const correlationId = getRequestId();
  if (correlationId) {
    const generation: RecommendationGenerationMetadata = {
      generationKey: randomUUID(),
      learnerId: userId,
      surface: 'LEARNER_HOME_SECTION',
      algorithmName: algorithmNameForMlDecisions(mlDecision),
      algorithmVersion: algorithmVersionForMlSection(context, sectionKey, mlDecision),
      policyVersion: RECOMMENDATION_POLICY_VERSION,
      generatedAt: new Date(),
      candidateCount: context.materials.length + context.projects.length,
      shownItemCount: sectionResponse.items.length,
      generationDurationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      generationCacheState: 'UNCACHED',
      candidateTraces: buildCandidateTraces(
        context,
        { sections: [sectionResponse] },
        'LEARNER_HOME_SECTION',
      ),
    };
    const enqueue = await enqueueRecommendationExposure({
      generation,
      cacheState: 'UNCACHED',
      correlationId,
      items: toRecommendationExposureItems({ sections: [sectionResponse] }),
      includeGeneration: true,
    });
    if (enqueue.enqueued) {
      attachRecommendationImpressionIds(
        { sections: [sectionResponse] },
        enqueue.impressionIds,
      );
    }
  }

  return {
    section: sectionResponse,
    returnedItemCount: sectionResponse.items.length,
    candidateCounts: {
      materials: context.materials.length,
      projects: context.projects.length,
    },
    appliedPoolCap: materialPoolCap,
    requestedMaterialScoringMode: modeDecision.requestedMaterialScoringMode,
    effectiveMaterialScoringMode: modeDecision.effectiveMaterialScoringMode,
    fallbackCode: modeDecision.fallbackCode,
    cacheable: modeDecision.cacheable,
    mlOrdering: mlDecision,
    timingsMs: Object.fromEntries(
      [...profiler.getTimings().entries()].map(([step, durationMs]) => [
        step,
        durationMs,
      ]),
    ),
  };
};

export const getLearnerHomeSection = async (
  userId: string,
  sectionKey: LearnerHomeSectionKey,
  limit: number,
  offset = 0,
): Promise<LearnerHomeSectionDetails> => {
  const audited = await getLearnerHomeSectionForAudit(
    userId,
    sectionKey,
    limit,
    offset,
  );
  return audited.section;
};

/**
 * @internal Production Full-Home post-load orchestration; RP-03.5 Canonical
 * fallback / cacheability seam. Accepts an already-loaded context and optional
 * conceptQueryChunk (omitted in production → real Prisma chunk query).
 */
export const assembleLearnerHomeCachedEnvelope = async (input: {
  userId: string;
  loaded: LearnerHomeLoadedContext;
  requestedMaterialScoringMode: RecommendationScorerVersion;
  conceptQueryChunk?: MaterialConceptChunkQuery;
  profiler?: ReturnType<typeof createLearnerHomeProfiler>;
  /** Wall-clock start of the full uncached load (includes context load when provided). */
  startedAt?: number;
  /** @internal Focused service-test seams for domain-independent ML ordering. */
  rankMaterialPool?: typeof rankSuggestedMaterialPoolWithMl;
  rankProjectPool?: typeof rankSuggestedProjectPoolWithMl;
}): Promise<LearnerHomeCachedEnvelope> => {
  const profiler =
    input.profiler ?? createLearnerHomeProfiler('getLearnerHome');
  const startedAt = input.startedAt ?? performance.now();
  const { modeDecision, canonicalContext } =
    await resolveMaterialModeDecisionAndContext({
      requestedMaterialScoringMode: input.requestedMaterialScoringMode,
      needsCanonicalMaterialScoring: true,
      materials: input.loaded.materials,
      behavior: input.loaded.behavior,
      profiler,
      conceptQueryChunk: input.conceptQueryChunk,
    });
  const context: LearnerHomeContext = {
    ...input.loaded,
    modeDecision,
    canonicalContext,
  };

  let preScoredMaterials!: PreScoredMaterialEntry[];
  const [deterministicMaterials, continueProjectsSection, savedProjectsSection] =
    await Promise.all([
      profiler.time('rankMaterialSections', async () => {
        preScoredMaterials = await profiler.time(
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
        items: buildContinueProjectsItemsFromBuilds(
          context.inProgressBuilds,
          SECTION_LIMITS.continue_projects,
        ),
      })),
      profiler.time('buildSavedProjectsItems', async () => ({
        key: 'saved_projects' as const,
        ...SECTION_META.saved_projects,
        items: buildSavedProjectsItemsFromItems(
          context.savedProjectItems,
          SECTION_LIMITS.saved_projects,
        ),
      })),
    ]);

  const deterministicMaterialPool = buildSuggestedMaterialCandidatePool(
    preScoredMaterials,
    false,
  );
  const deterministicProjectPool = buildSuggestedProjectsCandidatePool(context);
  const [materialSettled, projectSettled] = await Promise.allSettled([
    Promise.resolve().then(() =>
      (input.rankMaterialPool ?? rankSuggestedMaterialPoolWithMl)(
        context,
        deterministicMaterialPool,
      ),
    ),
    Promise.resolve().then(() =>
      (input.rankProjectPool ?? rankSuggestedProjectPoolWithMl)(
        context,
        deterministicProjectPool,
      ),
    ),
  ]);
  const materialMl = materialSettled.status === 'fulfilled'
    ? materialSettled.value
    : failedMlOrderingResult('material', deterministicMaterialPool, 'SCORER_EXCEPTION');
  const projectMl = projectSettled.status === 'fulfilled'
    ? projectSettled.value
    : failedMlOrderingResult('project', deterministicProjectPool, 'SCORER_EXCEPTION');
  const dedupedMaterials = materialMl.decision.status === 'ML_RANKED'
    ? buildRankedHomeMaterialSections(
        context,
        preScoredMaterials,
        undefined,
        materialMl.ordered,
      )
    : deterministicMaterials;

  profiler.record('totalGetLearnerHome', performance.now() - startedAt);
  profiler.report({ userId: input.userId, scope: 'getLearnerHome' });

  const profileCompletion = {
    hasInterests: context.interests.length > 0,
    hasSavedLocation:
      (context.savedLocation.city?.trim().length ?? 0) > 0 ||
      (context.savedLocation.area?.trim().length ?? 0) > 0,
    hasSavedProjects: context.hasSavedProjects,
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
        projectMl.ordered,
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

  const response: LearnerHomeResponse = {
    profileCompletion,
    sections,
  };

  const currentTopKeys = (domain: 'material' | 'project') =>
    sections.flatMap((section) => section.items)
      .flatMap((item) => {
        if (domain === 'material' && item.type === 'material') {
          return [String(item.material.id ?? '')];
        }
        if (domain === 'project' && item.type === 'project') {
          return [String(item.project.id ?? '')];
        }
        return [];
      })
      .filter(Boolean);
  const currentSections = (domain: 'material' | 'project') => sections.map((section) => ({
    sectionKey: section.key,
    candidateKeys: section.items.flatMap((item) => domain === 'material' && item.type === 'material' ? [String(item.material.id ?? '')] : domain === 'project' && item.type === 'project' ? [String(item.project.id ?? '')] : []).filter(Boolean),
  })).filter((section) => section.candidateKeys.length > 0);

  // Shadow work is fail-safe and has no user-visible ordering effect.
  if (getRecommendationMlRuntimeSnapshot().mode === 'SHADOW') {
    try {
      const shadowConcepts = env.recommendationMlShadowEnabled
        ? await learnerHomeRepository.loadMlShadowConcepts(
            context.materials.map((material) => material.id),
            context.projects.map((project) => project.id),
          )
        : emptyMlShadowConcepts;
      await Promise.allSettled([
        runMlShadowComparison({
          response,
          domain: 'material',
          interests: context.interests,
          candidates: buildMaterialShadowCandidates(context, shadowConcepts.materialConcepts),
          currentTopKeys: currentTopKeys('material'),
          currentSections: currentSections('material'),
          activeCandidateKeys: context.materials.filter((material) => material.status === 'AVAILABLE' && material.availableQuantity > 0).map((material) => material.id),
          recentEvents: context.behavior.recentRecommendationEvents ?? [],
          recentEntityMetadata: context.projects.map((project) => ({
            entityKey: project.id,
            candidateKey: project.id,
            categoryId: project.categoryId,
            categoryLabel: project.categoryNameEn,
            conceptKeys: shadowConcepts.projectConcepts.get(project.id) ?? [],
            componentConceptKeys: shadowConcepts.projectComponentConcepts.get(project.id) ?? [],
          })),
          evaluationTimestamp: new Date().toISOString(),
        }),
        runMlShadowComparison(buildProjectShadowInput(context, response, shadowConcepts)),
      ]);
    } catch (error) {
      reportMlShadowFallback('material', context.materials.length, error);
      reportMlShadowFallback('project', context.projects.length, error);
    }
  }

  return {
    response,
    generation: {
      generationKey: randomUUID(),
      learnerId: input.userId,
      surface: 'LEARNER_HOME',
      algorithmName: algorithmNameForMlDecisions(
        materialMl.decision,
        projectMl.decision,
      ),
      algorithmVersion: algorithmVersionForMlHome(
        context,
        materialMl.decision,
        projectMl.decision,
      ),
      policyVersion: RECOMMENDATION_POLICY_VERSION,
      generatedAt: new Date(),
      candidateCount: context.materials.length + context.projects.length,
      shownItemCount: toRecommendationExposureItems(response).length,
      generationDurationMs: Math.max(
        0,
        Math.round(performance.now() - startedAt),
      ),
      generationCacheState: 'MISS',
      candidateTraces: buildCandidateTraces(context, response),
    },
    cacheable: context.modeDecision.cacheable,
    modeDecision: context.modeDecision,
    mlOrdering: {
      material: materialMl.decision,
      project: projectMl.decision,
    },
  };
};

async function loadLearnerHomeUncached(
  userId: string,
): Promise<LearnerHomeCachedEnvelope> {
  const profiler = createLearnerHomeProfiler('getLearnerHome');
  const startedAt = performance.now();
  const loaded = await profiler.time('loadLearnerHomeContext', () =>
    loadLearnerHomeContext(userId, {
      profiler,
      materialPoolCap: resolveMaterialCandidatePoolCap({ kind: 'FULL_HOME' }),
      useConsolidatedProjectContext: true,
    }),
  );
  return assembleLearnerHomeCachedEnvelope({
    userId,
    loaded,
    requestedMaterialScoringMode: RECOMMENDATION_SCORER_VERSION,
    profiler,
    startedAt,
  });
}

export type LearnerHomeCacheKeyInput = {
  userId: string;
  scorerVersion: RecommendationScorerVersion;
  runtimeMode?: 'DETERMINISTIC' | 'SHADOW' | 'ML_LOCAL';
  materialRuntimeIdentity?: string;
  projectRuntimeIdentity?: string;
  /** @deprecated Compatibility inputs for existing deterministic cache tests. */
  mlShadowEnabled?: boolean;
  mlMaterialServingEnabled?: boolean;
  mlMaterialArtifactPath?: string;
  mlProjectServingEnabled?: boolean;
  mlProjectArtifactPath?: string;
};

/**
 * @internal Pure production cache-key construction. Tests must use this helper
 * with explicit scorer versions — never a parallel test-only key formula.
 */
export const buildLearnerHomeCacheKey = (
  input: LearnerHomeCacheKeyInput,
): string =>
  [
    input.userId,
    input.scorerVersion,
    input.runtimeMode ?? (input.mlShadowEnabled ? 'SHADOW' : 'DETERMINISTIC'),
    input.materialRuntimeIdentity ?? [
      input.mlMaterialServingEnabled ? 'MATERIAL_SERVED' : 'MATERIAL_NOT_SERVED',
      input.mlMaterialArtifactPath || 'NO_MATERIAL_ARTIFACT',
    ].join(':'),
    input.projectRuntimeIdentity ?? [
      input.mlProjectServingEnabled ? 'PROJECT_SERVED' : 'PROJECT_NOT_SERVED',
      input.mlProjectArtifactPath || 'NO_PROJECT_ARTIFACT',
    ].join(':'),
  ].join('\u0000');

const learnerHomeCacheKey = (userId: string): string => {
  const runtimeIdentity = buildLearnerHomeMlRuntimeIdentity({
    snapshot: getRecommendationMlRuntimeSnapshot(),
    materialArtifactPath: env.recommendationMlMaterialArtifactPath,
    projectArtifactPath: env.recommendationMlProjectArtifactPath,
  });
  return buildLearnerHomeCacheKey({
    userId,
    scorerVersion: RECOMMENDATION_SCORER_VERSION,
    runtimeMode: runtimeIdentity.mode,
    materialRuntimeIdentity: runtimeIdentity.material,
    projectRuntimeIdentity: runtimeIdentity.project,
  });
};

const learnerHomeCache = createLearnerHomeCache(
  loadLearnerHomeUncached,
  Date.now,
  learnerHomeCacheKey,
  (payload) => payload.cacheable,
);

/**
 * @internal RP-03.5 audit seam: real uncached Full Home assembly with a
 * supplied profiler. Returns envelope + timing snapshot + pool diagnostics.
 */
export const runLearnerHomeUncachedAudit = async (userId: string) => {
  const profiler = createLearnerHomeProfiler('getLearnerHomeAudit');
  const startedAt = performance.now();
  const appliedPoolCap = resolveMaterialCandidatePoolCap({ kind: 'FULL_HOME' });
  const loaded = await profiler.time('loadLearnerHomeContext', () =>
    loadLearnerHomeContext(userId, {
      profiler,
      materialPoolCap: appliedPoolCap,
      useConsolidatedProjectContext: true,
    }),
  );
  const envelope = await assembleLearnerHomeCachedEnvelope({
    userId,
    loaded,
    requestedMaterialScoringMode: RECOMMENDATION_SCORER_VERSION,
    profiler,
    startedAt,
  });
  return {
    envelope,
    timingsMs: Object.fromEntries(
      [...profiler.getTimings().entries()].map(([step, durationMs]) => [
        step,
        durationMs,
      ]),
    ),
    candidateCounts: {
      materials: loaded.materials.length,
      projects: loaded.projects.length,
      requiredComponents: loaded.projects.reduce(
        (sum, project) => sum + project.requiredComponents.length,
        0,
      ),
    },
    appliedPoolCap,
    requestedMaterialScoringMode:
      envelope.modeDecision.requestedMaterialScoringMode,
    effectiveMaterialScoringMode:
      envelope.modeDecision.effectiveMaterialScoringMode,
    fallbackCode: envelope.modeDecision.fallbackCode,
    cacheable: envelope.cacheable,
    mlOrdering: envelope.mlOrdering,
  };
};

/**
 * @internal RP-03.5 audit seam: read production cache state without inferring
 * HIT/MISS from latency.
 */
export const getLearnerHomeWithCacheStateForAudit = async (userId: string) => {
  const cacheRead = await learnerHomeCache.getWithState(userId);
  return {
    cacheState: cacheRead.state,
    cacheable: cacheRead.payload.cacheable,
    response: cacheRead.payload.response,
    modeDecision: cacheRead.payload.modeDecision,
    mlOrdering: cacheRead.payload.mlOrdering,
    candidateCount: cacheRead.payload.generation.candidateCount,
  };
};

export const getLearnerHome = async (
  userId: string,
): Promise<LearnerHomeResponse> => {
  const cacheRead = await learnerHomeCache.getWithState(userId);
  const correlationId = getRequestId();
  if (!correlationId) {
    return cacheRead.payload.response;
  }

  const response = structuredClone(cacheRead.payload.response);
  const enqueue = await enqueueRecommendationExposure({
    generation: cacheRead.payload.generation,
    cacheState: cacheRead.state,
    correlationId,
    items: toRecommendationExposureItems(response),
    includeGeneration: cacheRead.state === 'MISS',
  });

  if (enqueue.enqueued) {
    attachRecommendationImpressionIds(response, enqueue.impressionIds);
  }

  return response;
};
