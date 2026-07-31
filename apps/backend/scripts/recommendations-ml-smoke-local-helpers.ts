import { access, readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  env,
  type RecommendationMlRuntimeConfig,
  type RecommendationMlRuntimeMode,
} from '../src/config/env.js';
import { RECOMMENDATION_SCORER_VERSION } from '../src/config/recommendation-scoring-version.js';
import { prisma } from '../src/database/prisma.js';
import type { MaterialCondition, ProjectDifficulty } from '../src/generated/prisma/client.js';
import {
  buildBehaviorAffinityProfile,
  hasLearnerActivity,
} from '../src/modules/learner-home/learner-home.affinity.js';
import {
  withFrozenEvaluationTime,
  canonicalizeEvaluationTimeUtc,
} from '../src/modules/learner-home/learner-home.query-audit.js';
import * as learnerHomeRepository from '../src/modules/learner-home/learner-home.repository.js';
import { dedupeMaterialItems } from '../src/modules/learner-home/learner-home.deduplication.js';
import {
  assembleLearnerHomeCachedEnvelope,
  preScoreMaterials,
  rankPreScoredMaterialEntries,
  resolveMaterialCandidatePoolCap,
  resolveMaterialModeDecisionAndContext,
  type LearnerHomeLoadedContext,
  type LearnerHomeContext,
  type LearnerHomeCachedEnvelope,
} from '../src/modules/learner-home/learner-home.service.js';
import type {
  LearnerHomeMaterialItem,
  LearnerHomeProjectItem,
  LearnerHomeSectionItem,
} from '../src/modules/learner-home/learner-home.types.js';
import {
  rankLearnerHomeMlCandidatePool,
  type LearnerHomeMlOrderingDecision,
  type LearnerHomeMlOrderedPool,
} from '../src/modules/learner-home/learner-home.ml-ordering.js';
import {
  normalizeInterests,
} from '../src/modules/learner-home/learner-home.scoring.js';
import {
  getRecommendationMlRuntimeSnapshot,
  preloadRecommendationMlRuntime,
  rankMlLocalCandidates,
  resetRecommendationMlRuntimeForTests,
  setRecommendationMlRuntimeDependenciesForTests,
  type RecommendationMlRankingResult,
  type RecommendationMlRuntimeSnapshot,
} from '../src/modules/recommendations/ml-runtime-state.service.js';

export {
  SMOKE_SCHEMA_VERSION,
  DEFAULT_EVALUATION_TIME_UTC,
  ML_ELIGIBLE_SECTIONS,
  SECTION_LIMITS_SMOKE,
  mlDecisionToken,
  buildSectionAlgorithmStamp,
  assertContainment,
  assertUniqueness,
  assertFiniteScores,
  assertLimitPreserved,
  assertDomainSeparation,
  assertMappedUnmappedAppend,
  assertStampTruthful,
  assertMaterialCrossSectionDedup,
  assertUnknownKeysContained,
  assertDuplicateKeysContained,
  MATERIAL_SECTION_LIMITS_SMOKE,
  compareRepeatabilitySnapshots,
  extractSectionTokenFromActualStamp,
  classifyHardFailure,
  redactForOutput,
  aliasForIndex,
  formatHumanReport,
  toJsonReport,
  collectHardFailures,
  collectDiagnostics,
  parseSmokeArgs,
  type SmokeLearnerAlias,
  type SmokeCheckResult,
  type SmokeSectionEvaluation,
  type SmokeJsonReport,
  type SmokeOrderingDecision,
  type SmokeMlOrderingStatus,
  type SmokeRuntimeMode,
  type SmokeRepeatabilitySnapshot,
} from './recommendations-ml-smoke-local-checks.js';

import {
  DEFAULT_EVALUATION_TIME_UTC,
  ML_ELIGIBLE_SECTIONS,
  MATERIAL_SECTION_LIMITS_SMOKE,
  SECTION_LIMITS_SMOKE,
  SMOKE_SCHEMA_VERSION,
  aliasForIndex,
  assertContainment,
  assertDomainSeparation,
  assertDuplicateKeysContained,
  assertFiniteScores,
  assertLimitPreserved,
  assertMappedUnmappedAppend,
  assertMaterialCrossSectionDedup,
  assertStampTruthful,
  assertUnknownKeysContained,
  assertUniqueness,
  compareRepeatabilitySnapshots,
  collectDiagnostics,
  collectHardFailures,
  formatHumanReport,
  redactForOutput,
  type SmokeCheckResult,
  type SmokeJsonReport,
  type SmokeLearnerAlias,
  type SmokeMaterialDedupItem,
  type SmokeMaterialDedupSections,
  type SmokeRepeatabilitySnapshot,
  type SmokeSectionEvaluation,
} from './recommendations-ml-smoke-local-checks.js';

export type SmokeResolvedLearner = Readonly<{
  alias: SmokeLearnerAlias;
  userId: string;
}>;

export type SmokeRunOptions = Readonly<{
  evaluationTimeUtc?: string;
  materialArtifactPath?: string;
  projectArtifactPath?: string;
  repositoryRoot?: string;
  skipDisconnect?: boolean;
  assumeRuntimePreloaded?: boolean;
  /** Test-only: allow evaluating sections when only one domain is READY. */
  allowPartialDomainReadiness?: boolean;
}>;

export type SmokeEvaluationResult = Readonly<{
  report: SmokeJsonReport;
  humanText: string;
  exitCode: number;
}>;

export const KNOWN_SEED_LEARNER_EMAILS = [
  'majd@learner.com',
  'israa@learner.com',
  'learner@learner.com',
] as const;

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const defaultRepositoryRoot = resolve(scriptDirectory, '..', '..', '..');
const localLightFmRoot = (repositoryRoot: string) =>
  join(repositoryRoot, 'ml', 'recommendation', 'generated', 'local-lightfm');

export const resolveSmokeLearners = async (): Promise<
  | { ok: true; learners: readonly SmokeResolvedLearner[] }
  | { ok: false; code: string; detail: string }
> => {
  try {
    const known = await prisma.user.findMany({
      where: {
        email: { in: [...KNOWN_SEED_LEARNER_EMAILS] },
        accountStatus: 'ACTIVE',
        roles: { some: { role: 'LEARNER' } },
      },
      select: { id: true, email: true, createdAt: true },
    });
    const byEmail = new Map(known.map((row) => [row.email, row]));
    const orderedKnown = KNOWN_SEED_LEARNER_EMAILS.map((email) =>
      byEmail.get(email),
    ).filter((row): row is NonNullable<typeof row> => Boolean(row));

    if (orderedKnown.length >= 3) {
      return {
        ok: true,
        learners: orderedKnown.slice(0, 3).map((row, index) => ({
          alias: aliasForIndex(index),
          userId: row.id,
        })),
      };
    }

    const fallback = await prisma.user.findMany({
      where: {
        accountStatus: 'ACTIVE',
        roles: { some: { role: 'LEARNER' } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 40,
      select: {
        id: true,
        createdAt: true,
        recommendationEvidenceEligibility: true,
      },
    });
    const preferred = [
      ...fallback.filter(
        (row) => row.recommendationEvidenceEligibility === 'EXCLUDED_DEMO',
      ),
      ...fallback.filter(
        (row) => row.recommendationEvidenceEligibility !== 'EXCLUDED_DEMO',
      ),
    ];
    const unique: typeof preferred = [];
    const seen = new Set<string>();
    for (const row of preferred) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      unique.push(row);
      if (unique.length >= 3) break;
    }
    if (unique.length < 3) {
      return {
        ok: false,
        code: 'LEARNER_RESOLUTION_FAILED',
        detail: `resolved=${unique.length}`,
      };
    }
    return {
      ok: true,
      learners: unique.slice(0, 3).map((row, index) => ({
        alias: aliasForIndex(index),
        userId: row.id,
      })),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message.replaceAll(/\s+/g, ' ').slice(0, 160) : 'unknown';
    return {
      ok: false,
      code: 'DB_UNREADABLE',
      detail: message,
    };
  }
};

type CurrentPointer = {
  material?: { path?: string };
  project?: { path?: string };
};

export const resolveLocalArtifactPaths = async (
  repositoryRoot: string,
  overrides?: { material?: string; project?: string },
): Promise<
  | { ok: true; material: string; project: string }
  | { ok: false; code: string; detail: string }
> => {
  const fromEnvMaterial =
    overrides?.material?.trim() ||
    process.env.RECOMMENDATION_ML_MATERIAL_ARTIFACT_PATH?.trim() ||
    env.recommendationMlMaterialArtifactPath?.trim() ||
    '';
  const fromEnvProject =
    overrides?.project?.trim() ||
    process.env.RECOMMENDATION_ML_PROJECT_ARTIFACT_PATH?.trim() ||
    env.recommendationMlProjectArtifactPath?.trim() ||
    '';

  const absolutize = (value: string): string =>
    isAbsolute(value) ? value : resolve(repositoryRoot, value);

  if (fromEnvMaterial && fromEnvProject) {
    return {
      ok: true,
      material: absolutize(fromEnvMaterial),
      project: absolutize(fromEnvProject),
    };
  }

  const pointerPath = join(localLightFmRoot(repositoryRoot), 'current.json');
  try {
    await access(pointerPath);
    const pointer = JSON.parse(await readFile(pointerPath, 'utf8')) as CurrentPointer;
    const materialRel = pointer.material?.path;
    const projectRel = pointer.project?.path;
    if (!materialRel || !projectRel) {
      return {
        ok: false,
        code: 'ARTIFACTS_MISSING',
        detail: 'current.json missing material/project paths',
      };
    }
    const root = localLightFmRoot(repositoryRoot);
    return {
      ok: true,
      material: fromEnvMaterial
        ? absolutize(fromEnvMaterial)
        : resolve(root, materialRel),
      project: fromEnvProject
        ? absolutize(fromEnvProject)
        : resolve(root, projectRel),
    };
  } catch {
    return {
      ok: false,
      code: 'ARTIFACTS_MISSING',
      detail:
        'Set RECOMMENDATION_ML_*_ARTIFACT_PATH or publish ml/recommendation/generated/local-lightfm/current.json',
    };
  }
};

export const runtimeConfigForSmoke = (input: {
  mode?: RecommendationMlRuntimeMode;
  materialArtifactPath: string;
  projectArtifactPath: string;
}): RecommendationMlRuntimeConfig => ({
  mode: input.mode ?? 'ML_LOCAL',
  explicitMode: true,
  materialArtifactPath: input.materialArtifactPath,
  projectArtifactPath: input.projectArtifactPath,
});

export const applySmokeRuntimeEnv = (input: {
  materialArtifactPath: string;
  projectArtifactPath: string;
}): void => {
  process.env.RECOMMENDATION_ML_RUNTIME_MODE = 'ML_LOCAL';
  process.env.RECOMMENDATION_ML_MATERIAL_ARTIFACT_PATH = input.materialArtifactPath;
  process.env.RECOMMENDATION_ML_PROJECT_ARTIFACT_PATH = input.projectArtifactPath;
  env.recommendationMlRuntimeMode = 'ML_LOCAL';
  env.recommendationMlRuntimeModeExplicit = true;
  env.recommendationMlShadowEnabled = true;
  env.recommendationMlMaterialArtifactPath = input.materialArtifactPath;
  env.recommendationMlProjectArtifactPath = input.projectArtifactPath;
};

export const configureAndPreloadMlLocal = async (input: {
  materialArtifactPath: string;
  projectArtifactPath: string;
}): Promise<RecommendationMlRuntimeSnapshot> => {
  applySmokeRuntimeEnv(input);
  resetRecommendationMlRuntimeForTests();
  setRecommendationMlRuntimeDependenciesForTests({
    getConfig: () =>
      runtimeConfigForSmoke({
        materialArtifactPath: input.materialArtifactPath,
        projectArtifactPath: input.projectArtifactPath,
      }),
  });
  return preloadRecommendationMlRuntime();
};

const sectionItemIds = (
  items: readonly LearnerHomeSectionItem[],
  domain: 'material' | 'project',
): string[] =>
  items.flatMap((item) => {
    if (domain === 'material' && item.type === 'material') {
      const id = String(item.material.id ?? '');
      return id ? [id] : [];
    }
    if (domain === 'project' && item.type === 'project') {
      const id = String(item.project.id ?? '');
      return id ? [id] : [];
    }
    return [];
  });

const loadSmokeLearnerHomeContext = async (
  userId: string,
): Promise<LearnerHomeLoadedContext> => {
  const materialPoolCap = resolveMaterialCandidatePoolCap({ kind: 'FULL_HOME' });
  const [rawInterests, savedLocation, projectContext] = await Promise.all([
    learnerHomeRepository.loadLearnerInterests(userId),
    learnerHomeRepository.loadDefaultSavedLocation(userId),
    learnerHomeRepository.loadLearnerHomeProjectContext(userId, 4),
  ]);
  const behavior = projectContext.behavior;
  const projects = projectContext.projects;
  const savedComponents = behavior.savedProjectComponents ?? [];
  const interests = normalizeInterests(rawInterests);
  const behaviorAffinityProfile = buildBehaviorAffinityProfile(behavior);
  const materials =
    await learnerHomeRepository.loadMaterialCandidatesForLearner({
      interests,
      savedComponents,
      behavior,
      savedLocation,
      poolCap: materialPoolCap,
    });
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

const materialIdsFromOrdered = (
  ordered: readonly { material: { id?: unknown } }[],
): string[] =>
  ordered
    .map((entry) => String(entry.material.id ?? ''))
    .filter(Boolean);

const projectIdsFromOrdered = (
  ordered: readonly LearnerHomeProjectItem[],
): string[] =>
  ordered
    .map((item) => String(item.project.id ?? ''))
    .filter(Boolean);

const rankMaterialPoolForSmoke = async (
  context: LearnerHomeContext,
  pool: readonly {
    material: { id?: unknown };
  }[],
  onRank: (result: RecommendationMlRankingResult) => void,
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
  const sourceById = new Map(
    context.materials.map((material) => [material.id, material]),
  );
  const candidates = pool.flatMap((entry) => {
    const candidateKey = String(entry.material.id ?? '');
    const source = sourceById.get(candidateKey);
    if (!source || candidateKey.length === 0) return [];
    return [
      {
        candidateKey,
        item: entry,
        conceptKeys: materialConcepts.get(candidateKey) ?? [],
        condition: source.mapped.condition as MaterialCondition,
        isFree: source.isFree,
        pickupAllowed: source.pickupAllowed,
        deliveryAllowed: source.deliveryAllowed,
      },
    ];
  });
  return rankLearnerHomeMlCandidatePool(
    {
      domain: 'material',
      interests: context.interests,
      candidates,
    },
    {
      getSnapshot: () => snapshot,
      rank: (input) => {
        const result = rankMlLocalCandidates(input);
        onRank(result);
        return result;
      },
      ...(conceptLoadFailed
        ? {
            loadUserFeatures: async () => {
              throw new Error('material_concept_load_failed');
            },
          }
        : {}),
    },
  );
};

const rankProjectPoolForSmoke = async (
  context: LearnerHomeContext,
  pool: readonly LearnerHomeProjectItem[],
  onRank: (result: RecommendationMlRankingResult) => void,
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
  const sourceById = new Map(
    context.projects.map((project) => [project.id, project]),
  );
  const candidates = pool.flatMap((item) => {
    const candidateKey = String(item.project.id ?? '');
    const source = sourceById.get(candidateKey);
    if (!source || candidateKey.length === 0) return [];
    return [
      {
        candidateKey,
        item,
        conceptKeys: projectConcepts.get(candidateKey) ?? [],
        componentConceptKeys: projectComponentConcepts.get(candidateKey) ?? [],
        difficulty: source.difficulty as ProjectDifficulty,
      },
    ];
  });
  return rankLearnerHomeMlCandidatePool(
    {
      domain: 'project',
      interests: context.interests,
      candidates,
    },
    {
      getSnapshot: () => snapshot,
      rank: (input) => {
        const result = rankMlLocalCandidates(input);
        onRank(result);
        return result;
      },
      ...(conceptLoadFailed
        ? {
            loadUserFeatures: async () => {
              throw new Error('project_concept_load_failed');
            },
          }
        : {}),
    },
  );
};

const validateDomainReady = (
  snapshot: RecommendationMlRuntimeSnapshot,
  domain: 'material' | 'project',
): SmokeCheckResult => {
  const diagnostics = snapshot[domain];
  if (diagnostics.state === 'READY') {
    if (!diagnostics.semanticContentHash || !diagnostics.modelVersion) {
      return { ok: false, code: 'READY_WITHOUT_ARTIFACT', detail: domain };
    }
    return { ok: true, code: 'DOMAIN_READY' };
  }
  return {
    ok: false,
    code: 'DOMAIN_NOT_READY',
    detail: `${domain}:${diagnostics.state}:${diagnostics.failureCode ?? 'none'}`,
  };
};

type DomainCapture = Readonly<{
  poolIds: readonly string[];
  orderedPoolIds: readonly string[];
  rankedMappedIds: readonly string[];
  scores: readonly number[];
  decision: LearnerHomeMlOrderingDecision | undefined;
  orderedMaterialItems: readonly LearnerHomeMaterialItem[];
}>;

const emptyDomainCapture = (): {
  poolIds: string[];
  orderedPoolIds: string[];
  rankedMappedIds: string[];
  scores: number[];
  decision: LearnerHomeMlOrderingDecision | undefined;
  orderedMaterialItems: LearnerHomeMaterialItem[];
} => ({
  poolIds: [],
  orderedPoolIds: [],
  rankedMappedIds: [],
  scores: [],
  decision: undefined,
  orderedMaterialItems: [],
});

const RANK_POOL_SIZE_SMOKE = 48;

const toMaterialItemFromRanked = (entry: {
  score: number;
  reasons: string[];
  material: Record<string, unknown>;
}): LearnerHomeMaterialItem => ({
  type: 'material',
  score: entry.score,
  reasons: entry.reasons,
  material: entry.material,
});

const rankDeterministicMaterialPool = (
  preScored: ReturnType<typeof preScoreMaterials>,
  scoreKey: 'savedProjects' | 'suggested' | 'free',
  useTieredSuggestedRanking: boolean,
  browseAllTierSort: boolean,
): LearnerHomeMaterialItem[] =>
  dedupeMaterialItems(
    rankPreScoredMaterialEntries(
      preScored,
      scoreKey,
      useTieredSuggestedRanking,
      browseAllTierSort,
    )
      .slice(0, RANK_POOL_SIZE_SMOKE)
      .map(toMaterialItemFromRanked),
    RANK_POOL_SIZE_SMOKE,
  );

const toSmokeDedupItem = (
  item: LearnerHomeMaterialItem,
): SmokeMaterialDedupItem => ({
  id: String(item.material.id ?? ''),
  title: String(item.material.title ?? item.material.id ?? ''),
  score: item.score,
  reasons: item.reasons,
});

const reconstructMaterialPreDedup = async (input: {
  loaded: LearnerHomeLoadedContext;
  materialCapture: DomainCapture;
}): Promise<SmokeMaterialDedupSections> => {
  const { modeDecision, canonicalContext } =
    await resolveMaterialModeDecisionAndContext({
      requestedMaterialScoringMode: RECOMMENDATION_SCORER_VERSION,
      needsCanonicalMaterialScoring: true,
      materials: input.loaded.materials,
      behavior: input.loaded.behavior,
    });
  const context: LearnerHomeContext = {
    ...input.loaded,
    modeDecision,
    canonicalContext,
  };
  const preScored = preScoreMaterials(context);
  const materialsForSavedProjects =
    context.savedComponents.length === 0
      ? []
      : rankDeterministicMaterialPool(preScored, 'savedProjects', true, true);
  const freeMaterialsNearYou = rankDeterministicMaterialPool(
    preScored,
    'free',
    true,
    true,
  );
  const suggestedMaterials =
    input.materialCapture.decision?.status === 'ML_RANKED' &&
    input.materialCapture.orderedMaterialItems.length > 0
      ? dedupeMaterialItems(
          [...input.materialCapture.orderedMaterialItems].slice(
            0,
            RANK_POOL_SIZE_SMOKE,
          ),
          RANK_POOL_SIZE_SMOKE,
        )
      : rankDeterministicMaterialPool(preScored, 'suggested', true, false);

  return {
    materialsForSavedProjects: materialsForSavedProjects.map(toSmokeDedupItem),
    suggestedMaterials: suggestedMaterials.map(toSmokeDedupItem),
    freeMaterialsNearYou: freeMaterialsNearYou.map(toSmokeDedupItem),
  };
};

const materialSectionsFromEnvelope = (
  envelope: LearnerHomeCachedEnvelope,
): SmokeMaterialDedupSections => {
  const byKey = (key: string): SmokeMaterialDedupItem[] =>
    sectionItemsByKey(envelope, key).flatMap((item) => {
      if (item.type !== 'material') return [];
      const id = String(item.material.id ?? '');
      if (!id) return [];
      return [
        {
          id,
          title: String(item.material.title ?? id),
          score: item.score,
          reasons: item.reasons,
        },
      ];
    });
  return {
    materialsForSavedProjects: byKey('materials_for_saved_projects'),
    suggestedMaterials: byKey('suggested_materials'),
    freeMaterialsNearYou: byKey('free_materials_near_you'),
  };
};

const toSmokeOrderingDecision = (
  decision: LearnerHomeMlOrderingDecision,
): SmokeSectionEvaluation['decision'] => ({
  status: decision.status,
  runtimeMode: decision.runtimeMode,
  diagnostics: {
    candidateCount: decision.diagnostics.candidateCount,
    scoredCount: decision.diagnostics.scoredCount,
    retryCount: decision.diagnostics.retryCount,
    unmappedCandidateCount: decision.diagnostics.unmappedCandidateCount,
    omittedMappedCandidateCount:
      decision.diagnostics.omittedMappedCandidateCount,
    unknownRankedKeyCount: decision.diagnostics.unknownRankedKeyCount,
    duplicateRankedKeyCount: decision.diagnostics.duplicateRankedKeyCount,
  },
});

const buildRepeatabilitySnapshot = (input: {
  capture: DomainCapture;
  visibleIds: readonly string[];
  actualStamp: string;
}): SmokeRepeatabilitySnapshot => {
  const decision = input.capture.decision!;
  const rankedIds =
    decision.status === 'ML_RANKED' ? [...input.capture.rankedMappedIds] : [];
  const scores =
    decision.status === 'ML_RANKED' ? [...input.capture.scores] : [];
  const mappedCount =
    decision.diagnostics.candidateCount -
    decision.diagnostics.unmappedCandidateCount;
  const diagnosticsDigest = [
    `candidateCount=${decision.diagnostics.candidateCount}`,
    `scoredCount=${decision.diagnostics.scoredCount}`,
    `retryCount=${decision.diagnostics.retryCount}`,
    `unmappedCandidateCount=${decision.diagnostics.unmappedCandidateCount}`,
    `omittedMappedCandidateCount=${decision.diagnostics.omittedMappedCandidateCount}`,
    `unknownRankedKeyCount=${decision.diagnostics.unknownRankedKeyCount}`,
    `duplicateRankedKeyCount=${decision.diagnostics.duplicateRankedKeyCount}`,
    `reasonCode=${decision.reasonCode ?? ''}`,
  ].join(';');

  return {
    rankedIds,
    orderedPoolIds: [...input.capture.orderedPoolIds],
    visibleIds: [...input.visibleIds],
    actualStamp: input.actualStamp,
    status: decision.status,
    mappedCount,
    unmappedCount: decision.diagnostics.unmappedCandidateCount,
    omittedMappedCount: decision.diagnostics.omittedMappedCandidateCount,
    unknownKeyCount: decision.diagnostics.unknownRankedKeyCount,
    duplicateKeyCount: decision.diagnostics.duplicateRankedKeyCount,
    fallback: decision.status !== 'ML_RANKED',
    scores,
    diagnosticsDigest,
  };
};

const evaluateDomainSection = (input: {
  learner: SmokeResolvedLearner;
  sectionKey: (typeof ML_ELIGIBLE_SECTIONS)[number];
  domain: 'material' | 'project';
  capture: DomainCapture;
  returnedIds: readonly string[];
  foreignPoolIds: readonly string[];
  actualStamp: string;
  crossSectionDedupOk: boolean;
}): SmokeSectionEvaluation => {
  const decision = input.capture.decision!;
  const smokeDecision = toSmokeOrderingDecision(decision);
  const poolIds = input.capture.poolIds;
  const orderedPoolIds = input.capture.orderedPoolIds;
  const rankedMappedIds =
    decision.status === 'ML_RANKED' ? [...input.capture.rankedMappedIds] : [];
  const scores =
    decision.status === 'ML_RANKED' ? [...input.capture.scores] : [];

  const append = assertMappedUnmappedAppend({
    originalIds: poolIds,
    rankedMappedIds,
    combinedIds: orderedPoolIds,
  });
  const containment = assertContainment(input.returnedIds, poolIds);
  const uniqueness = assertUniqueness(input.returnedIds);
  const finite = assertFiniteScores(scores);
  const limit = assertLimitPreserved(
    input.returnedIds.length,
    SECTION_LIMITS_SMOKE[input.sectionKey],
  );
  const separation = assertDomainSeparation({
    domain: input.domain,
    returnedIds: input.returnedIds,
    foreignPoolIds: input.foreignPoolIds,
  });
  const stampCheck = assertStampTruthful({
    actualStamp: input.actualStamp,
    decision: smokeDecision,
    sectionKey: input.sectionKey,
  });
  const eligibility = assertContainment(input.returnedIds, poolIds);
  const unknownKeys = assertUnknownKeysContained({
    decision: smokeDecision,
    poolIds,
    orderedPoolIds,
    returnedIds: input.returnedIds,
  });
  const duplicateKeys = assertDuplicateKeysContained({
    decision: smokeDecision,
    returnedIds: input.returnedIds,
    actualStamp: input.actualStamp,
    sectionKey: input.sectionKey,
  });

  const mappedCount =
    decision.diagnostics.candidateCount -
    decision.diagnostics.unmappedCandidateCount;
  const mlRankedMapped =
    decision.status === 'ML_RANKED'
      ? Math.max(
          0,
          mappedCount - decision.diagnostics.omittedMappedCandidateCount,
        )
      : 0;

  return {
    learnerAlias: input.learner.alias,
    sectionKey: input.sectionKey,
    domain: input.domain,
    poolIds,
    rankedIds: rankedMappedIds,
    orderedPoolIds,
    returnedIds: input.returnedIds,
    decision: smokeDecision,
    algorithmStamp: input.actualStamp,
    scores,
    checks: {
      containment: containment.ok,
      uniqueness: uniqueness.ok,
      finiteScores: finite.ok,
      limit: limit.ok,
      domainSeparation: separation.ok,
      stampTruthful: stampCheck.ok,
      mappedUnmappedAppend: append.ok,
      eligibility: eligibility.ok,
      crossSectionDedup: input.crossSectionDedupOk,
      unknownKeysContained: unknownKeys.ok,
      duplicateKeysContained: duplicateKeys.ok,
    },
    coverage: {
      eligibleCandidateCount: decision.diagnostics.candidateCount,
      mappedCandidateCount: mappedCount,
      mlRankedMappedCount: mlRankedMapped,
      omittedMappedCount: decision.diagnostics.omittedMappedCandidateCount,
      unmappedCount: decision.diagnostics.unmappedCandidateCount,
      scorerFallback: decision.status !== 'ML_RANKED',
    },
  };
};

const runAuthoritativeHomeEvaluation = async (input: {
  userId: string;
  loaded: LearnerHomeLoadedContext;
}): Promise<{
  envelope: LearnerHomeCachedEnvelope;
  material: DomainCapture;
  project: DomainCapture;
}> => {
  const materialCapture = emptyDomainCapture();
  const projectCapture = emptyDomainCapture();

  const envelope = await assembleLearnerHomeCachedEnvelope({
    userId: input.userId,
    loaded: input.loaded,
    requestedMaterialScoringMode: RECOMMENDATION_SCORER_VERSION,
    rankMaterialPool: async (ctx, pool) => {
      materialCapture.poolIds = materialIdsFromOrdered(pool);
      const result = await rankMaterialPoolForSmoke(ctx, pool, (ranking) => {
        if (ranking.outcome === 'ML_RANKED') {
          materialCapture.rankedMappedIds = [...ranking.rankedCandidateKeys];
          materialCapture.scores = ranking.scored.map((row) => row.score);
        }
      });
      materialCapture.orderedPoolIds = materialIdsFromOrdered(result.ordered);
      materialCapture.orderedMaterialItems = result.ordered.map((entry) =>
        toMaterialItemFromRanked(entry as {
          score: number;
          reasons: string[];
          material: Record<string, unknown>;
        }),
      );
      materialCapture.decision = result.decision;
      return result as never;
    },
    rankProjectPool: async (ctx, pool) => {
      projectCapture.poolIds = projectIdsFromOrdered(pool);
      const result = await rankProjectPoolForSmoke(ctx, pool, (ranking) => {
        if (ranking.outcome === 'ML_RANKED') {
          projectCapture.rankedMappedIds = [...ranking.rankedCandidateKeys];
          projectCapture.scores = ranking.scored.map((row) => row.score);
        }
      });
      projectCapture.orderedPoolIds = projectIdsFromOrdered(result.ordered);
      projectCapture.decision = result.decision;
      return result;
    },
  });

  return {
    envelope,
    material: {
      poolIds: materialCapture.poolIds,
      orderedPoolIds: materialCapture.orderedPoolIds,
      rankedMappedIds: materialCapture.rankedMappedIds,
      scores: materialCapture.scores,
      decision: materialCapture.decision ?? envelope.mlOrdering.material,
      orderedMaterialItems: materialCapture.orderedMaterialItems,
    },
    project: {
      poolIds: projectCapture.poolIds,
      orderedPoolIds: projectCapture.orderedPoolIds,
      rankedMappedIds: projectCapture.rankedMappedIds,
      scores: projectCapture.scores,
      decision: projectCapture.decision ?? envelope.mlOrdering.project,
      orderedMaterialItems: [],
    },
  };
};

const WRITE_METHODS = [
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
] as const;

export type PrismaMutationGuard = {
  mutations: string[];
  restore: () => void;
};

export const installPrismaMutationGuard = (): PrismaMutationGuard => {
  const mutations: string[] = [];
  const client = prisma as unknown as Record<string, unknown>;
  const patched: Array<{
    target: Record<string, unknown>;
    key: string;
    original: unknown;
  }> = [];

  const wrapWriteMethods = (
    modelName: string,
    model: Record<string, unknown>,
  ): void => {
    for (const method of WRITE_METHODS) {
      const original = model[method];
      if (typeof original !== 'function') continue;
      patched.push({ target: model, key: method, original });
      model[method] = (..._args: unknown[]) => {
        mutations.push(`${modelName}.${method}`);
        throw new Error(`SMOKE_MUTATION_GUARD:${modelName}.${method}`);
      };
    }
  };

  const wrapRawMethods = (
    target: Record<string, unknown>,
    prefix: string,
  ): void => {
    for (const rawMethod of ['$executeRaw', '$executeRawUnsafe'] as const) {
      const original = target[rawMethod];
      if (typeof original !== 'function') continue;
      patched.push({ target, key: rawMethod, original });
      target[rawMethod] = (..._args: unknown[]) => {
        const label = prefix ? `${prefix}.${rawMethod}` : rawMethod;
        mutations.push(label);
        throw new Error(`SMOKE_MUTATION_GUARD:${label}`);
      };
    }
  };

  const guardModelDelegates = (
    target: Record<string, unknown>,
    prefix: string,
  ): void => {
    for (const [key, value] of Object.entries(target)) {
      if (!value || typeof value !== 'object') continue;
      if (key.startsWith('$') || key.startsWith('_')) continue;
      const modelName = prefix ? `${prefix}.${key}` : key;
      wrapWriteMethods(modelName, value as Record<string, unknown>);
    }
  };

  guardModelDelegates(client, '');
  wrapRawMethods(client, '');

  const originalTransaction = client.$transaction;
  if (typeof originalTransaction === 'function') {
    patched.push({
      target: client,
      key: '$transaction',
      original: originalTransaction,
    });
    client.$transaction = (arg: unknown, ...rest: unknown[]) => {
      if (typeof arg === 'function') {
        const wrappedCallback = async (
          tx: Record<string, unknown>,
          ...cbRest: unknown[]
        ) => {
          guardModelDelegates(tx, 'tx');
          wrapRawMethods(tx, 'tx');
          return await (arg as (...cbArgs: unknown[]) => unknown)(
            tx,
            ...cbRest,
          );
        };
        return (originalTransaction as (...args: unknown[]) => unknown).call(
          client,
          wrappedCallback,
          ...rest,
        );
      }
      return (originalTransaction as (...args: unknown[]) => unknown).call(
        client,
        arg,
        ...rest,
      );
    };
  }

  return {
    mutations,
    restore: () => {
      for (const entry of patched) {
        entry.target[entry.key] = entry.original;
      }
    },
  };
};

const sectionItemsByKey = (
  envelope: LearnerHomeCachedEnvelope,
  key: string,
): readonly LearnerHomeSectionItem[] =>
  envelope.response.sections.find((section) => section.key === key)?.items ??
  [];

export const runLocalMlSmokeEvaluation = async (
  options: SmokeRunOptions = {},
): Promise<SmokeEvaluationResult> => {
  const evaluationTimeUtc = canonicalizeEvaluationTimeUtc(
    options.evaluationTimeUtc ?? DEFAULT_EVALUATION_TIME_UTC,
  );
  const repositoryRoot = options.repositoryRoot ?? defaultRepositoryRoot;
  const hardSetup: string[] = [];
  const diagnostics: string[] = [];
  let snapshot: RecommendationMlRuntimeSnapshot | undefined;
  let learners: readonly SmokeResolvedLearner[] = [];
  const sectionEvals: SmokeSectionEvaluation[] = [];
  const stabilityFailures: string[] = [];

  try {
    if (!options.assumeRuntimePreloaded) {
      const artifacts = await resolveLocalArtifactPaths(repositoryRoot, {
        material: options.materialArtifactPath,
        project: options.projectArtifactPath,
      });
      if (!artifacts.ok) {
        hardSetup.push(`${artifacts.code}:${artifacts.detail}`);
      } else {
        snapshot = await configureAndPreloadMlLocal({
          materialArtifactPath: artifacts.material,
          projectArtifactPath: artifacts.project,
        });
      }
    } else {
      snapshot = getRecommendationMlRuntimeSnapshot();
    }

    if (snapshot) {
      if (snapshot.mode !== 'ML_LOCAL') {
        hardSetup.push(`RUNTIME_MODE_NOT_ML_LOCAL:${snapshot.mode}`);
      }
      const materialReady = validateDomainReady(snapshot, 'material');
      const projectReady = validateDomainReady(snapshot, 'project');
      if (materialReady.code === 'READY_WITHOUT_ARTIFACT') {
        hardSetup.push(`${materialReady.code}:${materialReady.detail}`);
      }
      if (projectReady.code === 'READY_WITHOUT_ARTIFACT') {
        hardSetup.push(`${projectReady.code}:${projectReady.detail}`);
      }
      if (!options.allowPartialDomainReadiness) {
        if (!materialReady.ok) {
          hardSetup.push(`${materialReady.code}:${materialReady.detail}`);
        }
        if (!projectReady.ok) {
          hardSetup.push(`${projectReady.code}:${projectReady.detail}`);
        }
      } else if (!materialReady.ok && !projectReady.ok) {
        hardSetup.push('DOMAIN_NOT_READY:both');
      }
    }

    const resolved = await resolveSmokeLearners();
    if (!resolved.ok) {
      hardSetup.push(`${resolved.code}:${resolved.detail}`);
    } else {
      learners = resolved.learners;
    }

    if (hardSetup.length === 0 && snapshot && learners.length === 3) {
      await withFrozenEvaluationTime(evaluationTimeUtc, async () => {
        for (const learner of learners) {
          const loaded = await loadSmokeLearnerHomeContext(learner.userId);

          const first = await runAuthoritativeHomeEvaluation({
            userId: learner.userId,
            loaded,
          });
          const second = await runAuthoritativeHomeEvaluation({
            userId: learner.userId,
            loaded,
          });

          const actualStamp = first.envelope.generation.algorithmVersion;
          const materialVisible = sectionItemIds(
            sectionItemsByKey(first.envelope, 'suggested_materials'),
            'material',
          );
          const projectVisible = sectionItemIds(
            sectionItemsByKey(first.envelope, 'suggested_projects'),
            'project',
          );
          const materialVisible2 = sectionItemIds(
            sectionItemsByKey(second.envelope, 'suggested_materials'),
            'material',
          );
          const projectVisible2 = sectionItemIds(
            sectionItemsByKey(second.envelope, 'suggested_projects'),
            'project',
          );

          const preDedup = await reconstructMaterialPreDedup({
            loaded,
            materialCapture: first.material,
          });
          const materialDedup = assertMaterialCrossSectionDedup({
            preDedup,
            actual: materialSectionsFromEnvelope(first.envelope),
            limits: MATERIAL_SECTION_LIMITS_SMOKE,
          });

          const materialRepeatability = compareRepeatabilitySnapshots(
            buildRepeatabilitySnapshot({
              capture: first.material,
              visibleIds: materialVisible,
              actualStamp,
            }),
            buildRepeatabilitySnapshot({
              capture: second.material,
              visibleIds: materialVisible2,
              actualStamp: second.envelope.generation.algorithmVersion,
            }),
          );
          const projectRepeatability = compareRepeatabilitySnapshots(
            buildRepeatabilitySnapshot({
              capture: first.project,
              visibleIds: projectVisible,
              actualStamp,
            }),
            buildRepeatabilitySnapshot({
              capture: second.project,
              visibleIds: projectVisible2,
              actualStamp: second.envelope.generation.algorithmVersion,
            }),
          );
          if (!materialRepeatability.ok) {
            stabilityFailures.push(
              `${learner.alias}/suggested_materials:${materialRepeatability.code}`,
            );
          }
          if (!projectRepeatability.ok) {
            stabilityFailures.push(
              `${learner.alias}/suggested_projects:${projectRepeatability.code}`,
            );
          }

          sectionEvals.push(
            evaluateDomainSection({
              learner,
              sectionKey: 'suggested_materials',
              domain: 'material',
              capture: first.material,
              returnedIds: materialVisible,
              foreignPoolIds: first.project.poolIds,
              actualStamp,
              crossSectionDedupOk: materialDedup.ok,
            }),
            evaluateDomainSection({
              learner,
              sectionKey: 'suggested_projects',
              domain: 'project',
              capture: first.project,
              returnedIds: projectVisible,
              foreignPoolIds: first.material.poolIds,
              actualStamp,
              crossSectionDedupOk: true,
            }),
          );

          const interestCount = loaded.interests.length;
          const savedComponentCount = loaded.savedComponents.length;
          diagnostics.push(
            `${learner.alias}:interest_signal_count=${interestCount}`,
          );
          diagnostics.push(
            `${learner.alias}:saved_component_signal_count=${savedComponentCount}`,
          );
          if (interestCount === 0) {
            diagnostics.push(`${learner.alias}:sparse_learner_features`);
          }
        }
      });

      const materialReady = snapshot.material.state === 'READY';
      const projectReady = snapshot.project.state === 'READY';
      const materialMlApplied = sectionEvals.some(
        (section) =>
          section.domain === 'material' &&
          section.decision.status === 'ML_RANKED',
      );
      const projectMlApplied = sectionEvals.some(
        (section) =>
          section.domain === 'project' &&
          section.decision.status === 'ML_RANKED',
      );

      if (!options.allowPartialDomainReadiness && materialReady && projectReady) {
        if (!materialMlApplied) {
          hardSetup.push('MATERIAL_ML_NOT_APPLIED');
        }
        if (!projectMlApplied) {
          hardSetup.push('PROJECT_ML_NOT_APPLIED');
        }
      } else if (options.allowPartialDomainReadiness) {
        if (materialReady && projectReady) {
          if (!materialMlApplied && !projectMlApplied) {
            hardSetup.push('MATERIAL_ML_NOT_APPLIED');
            hardSetup.push('PROJECT_ML_NOT_APPLIED');
          }
        } else {
          if (materialReady && !materialMlApplied) {
            hardSetup.push('MATERIAL_ML_NOT_APPLIED');
          }
          if (projectReady && !projectMlApplied) {
            hardSetup.push('PROJECT_ML_NOT_APPLIED');
          }
        }
      }
    }
  } catch (error) {
    hardSetup.push(
      `CRASH:${error instanceof Error ? error.message.slice(0, 240) : 'unknown'}`,
    );
  }

  const allHard = collectHardFailures(
    sectionEvals,
    hardSetup,
    stabilityFailures,
  );
  const allDiagnostics = [...diagnostics, ...collectDiagnostics(sectionEvals)];
  const success = allHard.length === 0;
  const report: SmokeJsonReport = redactForOutput({
    schemaVersion: SMOKE_SCHEMA_VERSION,
    evaluationTimeUtc,
    runtimeMode: snapshot?.mode ?? env.recommendationMlRuntimeMode,
    artifacts: {
      material: {
        semanticContentHash: snapshot?.material.semanticContentHash,
        modelVersion: snapshot?.material.modelVersion,
        schemaVersion: snapshot?.material.schemaVersion,
        state: snapshot?.material.state ?? 'UNKNOWN',
      },
      project: {
        semanticContentHash: snapshot?.project.semanticContentHash,
        modelVersion: snapshot?.project.modelVersion,
        schemaVersion: snapshot?.project.schemaVersion,
        state: snapshot?.project.state ?? 'UNKNOWN',
      },
    },
    domains: {
      material: {
        readiness: snapshot?.material.state ?? 'UNKNOWN',
        failureCode: snapshot?.material.failureCode,
      },
      project: {
        readiness: snapshot?.project.state ?? 'UNKNOWN',
        failureCode: snapshot?.project.failureCode,
      },
    },
    learners: learners.map((learner) => ({ alias: learner.alias })),
    sections: sectionEvals.map((section) => ({
      learnerAlias: section.learnerAlias,
      sectionKey: section.sectionKey,
      domain: section.domain,
      counts: section.coverage,
      checks: section.checks,
      stamp: section.algorithmStamp,
      fallback: section.coverage.scorerFallback,
      status: section.decision.status,
      boundedRankedIds: section.returnedIds.slice(
        0,
        SECTION_LIMITS_SMOKE[section.sectionKey],
      ),
    })),
    hardFailures: allHard,
    diagnostics: allDiagnostics,
    success,
  });

  return {
    report,
    humanText: formatHumanReport(report),
    exitCode: success ? 0 : 1,
  };
};
