import { createHash } from "node:crypto";

import { env } from "../../config/env.js";
import { logger } from "../../observability/logger.js";
import { redactErrorMessage } from "../../observability/redact.js";
import type { LogContext } from "../../observability/log-types.js";
import type {
  MaterialCondition,
  ProjectDifficulty,
} from "../../generated/prisma/client.js";
import type {
  LearnerInterestRegistryConcept,
  LearnerInterestResolutionStatus,
  LearnerInterestUnmappedReason,
} from "../taxonomy/learner-interest-resolver.js";
import { TaxonomyFoundationRepository } from "../taxonomy/taxonomy-foundation.repository.js";
import {
  buildCanonicalMaterialRuntimeFeatures,
  buildCanonicalProjectRuntimeFeatures,
  canonicalConceptAssociationFromActiveKey,
  getCanonicalRuntimeFeatureAuthority,
  type CanonicalRuntimeFeatureAuthority,
} from "./canonical-runtime-item-features.js";
import {
  resolveCanonicalShadowUserFeatures,
  type ArtifactUserFeatureOverlapStatus,
} from "./canonical-shadow-user-features.js";
import {
  setCompiledRecommendationFeatureReadinessContractForTests,
  type RecommendationFeatureReadiness,
} from "./recommendation-feature-readiness.js";
import {
  combineNormalizedScores,
  type LightFmScorerDiagnostics,
  type LightFmScorerReasonCode,
  type LightFmScorerResult,
  type LocalMlContainedScoringResult,
  type WeightedFeature,
} from "./ml-lightfm-scorer.js";
import {
  getRecommendationMlRuntimeSnapshot,
  rankMlLocalCandidates,
  scoreRecommendationMlRuntimeForShadow,
  type RecommendationMlDomainDiagnostics,
} from "./ml-runtime-state.service.js";
import {
  buildShortTermIntent,
  recentItemScore,
  SHORT_TERM_CONFIG,
  type RecentIntentEvent,
} from "./short-term-intent.js";
import {
  classifyRecentIntent,
  type RecentIntentConfidence,
} from "./recent-intent-confidence.js";
import {
  fuseMaterialRankings,
  type MaterialFusionStageObserver,
} from "./material-rank-fusion.js";
import {
  buildProjectRecentIntent,
  classifyProjectRecentIntent,
  isProjectRecentIntentEvent,
  projectRecentItemScore,
  type ProjectRecentIntentConfidence,
} from "./project-recent-intent.js";
import { fuseProjectRankings } from "./project-rank-fusion.js";

const CANONICAL_USER_FEATURES_SHADOW_ONLY =
  "CANONICAL_USER_FEATURES_SHADOW_ONLY" as const;

type InterestRegistryLoader = () => Promise<
  readonly LearnerInterestRegistryConcept[]
>;

const defaultInterestRegistryLoader: InterestRegistryLoader = () =>
  new TaxonomyFoundationRepository().loadLearnerInterestResolutionRegistry();

let interestRegistryLoaderForTests: InterestRegistryLoader | undefined;

export const setMlShadowInterestRegistryLoaderForTests = (
  loader?: InterestRegistryLoader,
): void => {
  interestRegistryLoaderForTests = loader;
};

const loadInterestRegistry = (): Promise<
  readonly LearnerInterestRegistryConcept[]
> =>
  (interestRegistryLoaderForTests ?? defaultInterestRegistryLoader)();

export type ShadowCandidate = {
  candidateKey: string;
  categoryId: string;
  categoryLabel: string;
  conceptKeys?: string[];
  componentConceptKeys?: string[];
  condition?: string;
  isFree?: boolean;
  pickupAllowed?: boolean;
  deliveryAllowed?: boolean;
  difficulty?: string;
};
export type ShadowComparisonInput<T> = {
  response: T;
  domain: "material" | "project";
  interests: string[];
  candidates: ShadowCandidate[];
  recentEntityMetadata?: Array<ShadowCandidate & { entityKey: string }>;
  currentSections?: Array<{ sectionKey: string; candidateKeys: string[] }>;
  activeCandidateKeys: string[];
  currentTopKeys: string[];
  recentEvents: RecentIntentEvent[];
  evaluationTimestamp: string;
};
export type ShadowFeatureCoverage = {
  activeUserFeatures: number;
  zeroFeatureUser: boolean;
  itemFeatureTotal: number;
  itemsOnlyCategory: number;
  itemsWithoutApprovedFeatures: number;
  categoryCovered: number;
  conceptCovered: number;
  conditionCovered: number;
  freeCovered: number;
  pickupCovered: number;
  deliveryCovered: number;
  difficultyCovered: number;
  componentCovered: number;
};
export type ProjectReadinessStatus = "READY" | "NOT_READY" | "FALLBACK";
export type ShadowDiagnostics = {
  status: "DISABLED" | "SCORED" | "FALLBACK";
  fallbackReason?: string;
  candidateCount: number;
  top5Overlap?: number;
  top10Overlap?: number;
  top5OverlapCount?: number;
  top10OverlapCount?: number;
  top5OverlapRatio?: number;
  top10OverlapRatio?: number;
  averageTop10RankMovement?: number;
  maximumTop10RankMovement?: number;
  rankCorrelation?: number;
  duplicateCurrentCount?: number;
  deduplicatedCurrentCount?: number;
  sectionDiagnostics?: Array<{
    sectionKey: string;
    candidatePoolSize: number;
    top5Overlap: number;
    top10Overlap: number;
    fusedTop5Keys?: string[];
  }>;
  recentEventInputCount?: number;
  recentEvidenceCount?: number;
  recentChannelApplied?: boolean;
  recentConfidence?: RecentIntentConfidence | ProjectRecentIntentConfidence;
  confidenceSource?: string;
  recentUniqueMaterialCount?: number;
  recentUniqueViewCount?: number;
  recentActiveLikeCount?: number;
  recentStrongActionCount?: number;
  burstWindowHours?: number;
  burstUniqueMaterialCount?: number;
  burstUniqueViewCount?: number;
  burstActiveLikeCount?: number;
  burstStrongActionCount?: number;
  recentCoherence?: number;
  dominantCategoryShare?: number;
  dominantConceptShare?: number;
  fullHistoryDominantCategoryShare?: number;
  fullHistoryDominantConceptShare?: number;
  newestEvidenceAgeHours?: number;
  qualifiedRecentCandidateCount?: number;
  recentSlotsAllowedTop5?: number;
  recentSlotsUsedTop5?: number;
  recentSlotsAllowedTop10?: number;
  recentSlotsUsedTop10?: number;
  longTermTop5RecentDomainCount?: number;
  recentChannelTop5RecentDomainCount?: number;
  fusedTop5RecentDomainCount?: number;
  recentHistoryDistinctProjectCount?: number;
  burstDistinctProjectCount?: number;
  burstActiveSaveCount?: number;
  burstActiveFollowCount?: number;
  burstDominantConceptShare?: number;
  longTermRecentTop5OverlapCount?: number;
  longTermFusedTop5OverlapCount?: number;
  recentFusionDurationMs?: number;
  totalProjectRecommendationDurationMs?: number;
  recentEvidenceRejectedCounts?: {
    unmappedCategory: number;
    unmappedConcept: number;
    stale: number;
    reversed: number;
    duplicateOrCapped: number;
    outsideCandidateUniverse: number;
    belowCandidateQualityThreshold: number;
    invalidAction?: number;
  };
  rankMovement?: Array<{
    candidateKeyHash: string;
    longTermRank: number;
    recentRank: number;
    fusedRank: number;
    recentScore: number;
    qualificationStatus: "QUALIFIED";
    mappedCategoryMatch: boolean;
    mappedConceptMatch: boolean;
  }>;
  fusionDurationMs?: number;
  scoringDurationMs?: number;
  scorerDurationMs?: number;
  comparisonDurationMs?: number;
  totalProjectShadowDurationMs?: number;
  artifactVersion?: string;
  featureSchemaVersion?: string;
  missingFeatureCount?: number;
  scorerOutcome?: LightFmScorerResult["outcome"];
  scorerReadiness?: LightFmScorerResult["scoringReadiness"];
  scorerReasonCodes?: LightFmScorerReasonCode[];
  scorerDiagnostics?: LightFmScorerDiagnostics;
  resolutionStatus?: LearnerInterestResolutionStatus;
  canonicalFeatureCount?: number;
  mappedInputCount?: number;
  unmappedInputCount?: number;
  unmappedReasonCounts?: Partial<
    Record<LearnerInterestUnmappedReason, number>
  >;
  candidateIndependent?: true;
  canonicalUserFeatureCount?: number;
  artifactMatchedUserFeatureCount?: number;
  artifactMissingUserFeatureCount?: number;
  artifactUserFeatureOverlapStatus?: ArtifactUserFeatureOverlapStatus;
  servingSuppressedReason?: typeof CANONICAL_USER_FEATURES_SHADOW_ONLY;
  featureReadiness?: RecommendationFeatureReadiness;
  featureCoverage?: ShadowFeatureCoverage;
  currentTop5Keys?: string[];
  shadowTop5Keys?: string[];
  linearBlendTop5Keys?: string[];
  longTermTop5Keys?: string[];
  recentChannelTop5Keys?: string[];
  fusedTop5Keys?: string[];
  projectReadinessStatus?: ProjectReadinessStatus;
  runtimeCandidateCount?: number;
  artifactCatalogCount?: number;
  artifactMappedCandidateCount?: number;
  runtimeCandidatesMissingFromArtifact?: number;
  artifactEntriesOutsideRuntimeUniverse?: number;
  scoredCandidateCount?: number;
  deterministicCandidateCount?: number;
  mlCandidateCount?: number;
  nonFiniteScoreCount?: number;
  finiteScoreCount?: number;
  zeroScoreCount?: number;
  duplicateRuntimeCandidateCount?: number;
  duplicateScoredCandidateCount?: number;
  hydratedMappingFailureCount?: number;
};
export type MlShadowComparisonResult<T> = {
  response: T;
  diagnostics: ShadowDiagnostics;
  rankedCandidateKeys?: string[];
};

type ShadowObserver = (
  diagnostics: ShadowDiagnostics & { domain: "material" | "project" },
) => void;
let observer: ShadowObserver | undefined;
export const setMlShadowObserverForTests = (value?: ShadowObserver) => {
  observer = value;
};
export type MlShadowFailurePhase =
  | "confidence"
  | "dominance"
  | "fusion"
  | "diagnostics"
  | "logger"
  | "redaction";
let failurePhaseForTests: MlShadowFailurePhase | undefined;
export const setMlShadowFailureForTests = (value?: MlShadowFailurePhase) => {
  failurePhaseForTests = value;
};
let neverSettleResponseForTests: unknown | undefined;
export const setMlShadowNeverSettleForTests = (response?: unknown): void => {
  neverSettleResponseForTests = response;
};
const injectFailure = (phase: MlShadowFailurePhase) => {
  if (failurePhaseForTests === phase)
    throw new Error(`injected_${phase}_failure`);
};
export const getMlArtifactCacheStatsForTests = () => ({
  entries: 0,
  artifactLoadCount: 0,
});

const ML_SHADOW_TIMEOUT_MS = 1_000;
const safeMaterialFusion = (
  ...args: Parameters<typeof fuseMaterialRankings>
) => {
  try {
    return {
      ...fuseMaterialRankings(...args),
      fallbackReason: undefined as string | undefined,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "material_shadow_iteration_bound"
    )
      throw error;
    return {
      ranking: [...args[0]],
      qualifiedRecentCount: 0,
      insertedTop5Count: 0,
      insertedTop10Count: 0,
      recentSlotsAllowedTop5: 0,
      recentSlotsUsedTop5: 0,
      recentSlotsAllowedTop10: 0,
      recentSlotsUsedTop10: 0,
      qualifiedRecent: [],
      belowCandidateQualityThresholdCount: 0,
      outsideCandidateUniverseCount: 0,
      fallbackReason: error instanceof Error ? error.message : "fusion_error",
    };
  }
};
const safeProjectFusion = (...args: Parameters<typeof fuseProjectRankings>) => {
  try {
    return {
      ...fuseProjectRankings(...args),
      fallbackReason: undefined as string | undefined,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "project_shadow_iteration_bound"
    )
      throw error;
    return {
      ranking: [...args[0]],
      qualifiedRecentCount: 0,
      insertedTop5Count: 0,
      insertedTop10Count: 0,
      recentSlotsAllowedTop5: 0,
      recentSlotsUsedTop5: 0,
      recentSlotsAllowedTop10: 0,
      recentSlotsUsedTop10: 0,
      qualifiedRecent: [],
      belowCandidateQualityThresholdCount: 0,
      outsideCandidateUniverseCount: 0,
      fallbackReason: error instanceof Error ? error.message : "fusion_error",
    };
  }
};
const requireMaterialFusion = (
  ...args: Parameters<typeof fuseMaterialRankings>
) => {
  const result = safeMaterialFusion(...args);
  if (result.fallbackReason) throw new Error("material_fusion_failure");
  return result;
};
const requireProjectFusion = (
  ...args: Parameters<typeof fuseProjectRankings>
) => {
  const result = safeProjectFusion(...args);
  if (result.fallbackReason) throw new Error("project_fusion_failure");
  return result;
};
export const clearMlArtifactCacheForTests = (): void => undefined;

export { rankMlLocalCandidates };

export const resetMlShadowTestStateForTests = (): void => {
  clearMlArtifactCacheForTests();
  setMlShadowObserverForTests(undefined);
  setMlShadowFailureForTests(undefined);
  setMlShadowNeverSettleForTests(undefined);
  setMlShadowInterestRegistryLoaderForTests(undefined);
  setCompiledRecommendationFeatureReadinessContractForTests(undefined);
};

const overlap = (left: string[], right: string[], k: number) => {
  const a = new Set(left.slice(0, k));
  return (
    right.slice(0, k).filter((value) => a.has(value)).length /
    Math.max(1, Math.min(k, left.length, right.length))
  );
};
const overlapCount = (left: string[], right: string[], k: number) => {
  const a = new Set(left.slice(0, k));
  return right.slice(0, k).filter((value) => a.has(value)).length;
};
const duplicateCount = (values: string[]) =>
  values.length - new Set(values).size;
const sharedTop10RankMovement = (deterministic: string[], ml: string[]) => {
  const deterministicRanks = new Map(
    deterministic.slice(0, 10).map((key, index) => [key, index + 1]),
  );
  const movements = ml
    .slice(0, 10)
    .map((key, index) => {
      const deterministicRank = deterministicRanks.get(key);
      return deterministicRank === undefined
        ? undefined
        : Math.abs(deterministicRank - (index + 1));
    })
    .filter((value): value is number => value !== undefined);
  return {
    average:
      movements.length > 0
        ? movements.reduce((sum, value) => sum + value, 0) / movements.length
        : 0,
    maximum: movements.length > 0 ? Math.max(...movements) : 0,
  };
};
export const calculateProjectTopKOverlap = (
  deterministic: string[],
  ml: string[],
  k: 5 | 10,
) => ({
  count: overlapCount(deterministic, ml, k),
  ratio: overlap(deterministic, ml, k),
});
export const calculateProjectTop10RankMovement = sharedTop10RankMovement;
const privacyKey = (value: string) =>
  createHash("sha256")
    .update(`impactloop-shadow-diagnostic:${value}`)
    .digest("hex")
    .slice(0, 16);
const rankCorrelation = (left: string[], right: string[]) => {
  const rightRanks = new Map(right.map((key, index) => [key, index]));
  const common = left.filter((key) => rightRanks.has(key));
  if (common.length < 2) return undefined;
  const squared = common.reduce(
    (sum, key, index) => sum + (index - rightRanks.get(key)!) ** 2,
    0,
  );
  return 1 - (6 * squared) / (common.length * (common.length ** 2 - 1));
};

const canonicalItemFeatures = (
  candidate: ShadowCandidate,
  domain: "material" | "project",
  authority: CanonicalRuntimeFeatureAuthority,
): WeightedFeature[] => {
  if (domain === "material") {
    if (
      candidate.condition === undefined ||
      candidate.isFree === undefined ||
      candidate.pickupAllowed === undefined ||
      candidate.deliveryAllowed === undefined
    ) {
      throw new Error("material_runtime_feature_fields_missing");
    }
    return buildCanonicalMaterialRuntimeFeatures({
      authority,
      concepts: (candidate.conceptKeys ?? []).map((canonicalKey) =>
        canonicalConceptAssociationFromActiveKey(authority, canonicalKey),
      ),
      condition: candidate.condition as MaterialCondition,
      isFree: candidate.isFree,
      pickupAllowed: candidate.pickupAllowed,
      deliveryAllowed: candidate.deliveryAllowed,
    }).features;
  }
  if (candidate.difficulty === undefined) {
    throw new Error("project_runtime_feature_fields_missing");
  }
  return buildCanonicalProjectRuntimeFeatures({
    authority,
    topicConcepts: (candidate.conceptKeys ?? []).map((canonicalKey) =>
      canonicalConceptAssociationFromActiveKey(authority, canonicalKey),
    ),
    componentConcepts: (candidate.componentConceptKeys ?? []).map(
      (canonicalKey) => ({
        ...canonicalConceptAssociationFromActiveKey(authority, canonicalKey),
        isRequired: true,
      }),
    ),
    difficulty: candidate.difficulty as ProjectDifficulty,
  }).features;
};

export const buildCanonicalShadowItemFeaturesForTests = async (
  candidate: ShadowCandidate,
  domain: "material" | "project",
): Promise<WeightedFeature[]> =>
  canonicalItemFeatures(
    candidate,
    domain,
    await getCanonicalRuntimeFeatureAuthority(),
  );

// Deterministic recent-intent vocabulary only. Portable runtime item rows use
// the canonical v3 builders below and never receive category hashes.
const categoryKey = (id: string) =>
  createHash("sha256").update(`impactloop-category:${id}`).digest("hex");

const safeLogWarning = (context: LogContext, message: string): void => {
  try {
    logger.warn(context, message);
  } catch (loggingError) {
    try {
      process.stderr.write(
        `${JSON.stringify({ operation: "recommendation.ml-shadow.log-failure", fallbackReason: redactErrorMessage(loggingError) })}\n`,
      );
    } catch {
      // Logging is best effort and must never affect the learner-home response.
    }
  }
};

type MaterialDecisionMode = "DETERMINISTIC" | "SHADOW" | "SERVED" | "FALLBACK";
type ProjectDecisionMode = "DETERMINISTIC" | "SHADOW" | "SERVED" | "FALLBACK";

const writeMaterialDecisionLog = (
  input: ShadowComparisonInput<unknown>,
  diagnostics: ShadowDiagnostics,
  started: number,
  mode: MaterialDecisionMode,
): void => {
  if (env.nodeEnv !== "development" || input.domain !== "material") return;
  const servedItemCount =
    input.currentSections?.find(
      (section) => section.sectionKey === "suggested_materials",
    )?.candidateKeys.length ?? input.currentTopKeys.length;
  logger.info(
    {
      operation: "recommendation.ml.material-decision",
      domain: "material",
      mode,
      status: diagnostics.status,
      confidenceLevel: diagnostics.recentConfidence ?? "NONE",
      confidenceSource: diagnostics.confidenceSource ?? "NONE",
      candidateCount: diagnostics.candidateCount,
      servedItemCount,
      recentSlotsUsedTop5: diagnostics.recentSlotsUsedTop5 ?? 0,
      recentSlotsUsedTop10: diagnostics.recentSlotsUsedTop10 ?? 0,
      fallbackReason: diagnostics.fallbackReason ?? null,
      scorerDurationMs: diagnostics.scoringDurationMs ?? 0,
      fusionDurationMs: diagnostics.fusionDurationMs ?? 0,
      totalRecommendationDurationMs: Math.max(0, performance.now() - started),
    },
    "material recommendation decision",
  );
};

const safeWriteMaterialDecisionLog = (
  input: ShadowComparisonInput<unknown>,
  diagnostics: ShadowDiagnostics,
  started: number,
  mode: MaterialDecisionMode,
): void => {
  try {
    writeMaterialDecisionLog(input, diagnostics, started, mode);
  } catch (loggingError) {
    safeLogWarning(
      {
        operation: "recommendation.ml-shadow.decision-log-failure",
        fallbackReason: redactErrorMessage(loggingError),
      },
      "material recommendation decision log failure",
    );
  }
};

const safeObserve = (
  diagnostics: ShadowDiagnostics & { domain: "material" | "project" },
): void => {
  try {
    observer?.(diagnostics);
  } catch (observerError) {
    safeLogWarning(
      {
        operation: "recommendation.ml-shadow.observer-failure",
        fallbackReason: redactErrorMessage(observerError),
        domain: diagnostics.domain,
      },
      "recommendation ML shadow observer failure",
    );
  }
};

const observeMaterialStage = (
  input: ShadowComparisonInput<unknown>,
  started: number,
  stage: string,
  phase: "start" | "complete",
  iterationCount = 0,
): void => {
  // Detailed stage tracing is intentionally disabled by default after the
  // material shadow CPU-loop investigation.
};

export const reportMlShadowFallback = (
  domain: "material" | "project",
  candidateCount: number,
  error: unknown,
): ShadowDiagnostics => {
  const fallbackReason = redactErrorMessage(error);
  const diagnostics: ShadowDiagnostics = {
    status: "FALLBACK",
    fallbackReason,
    candidateCount,
    scoringDurationMs: 0,
    ...(domain === "project"
      ? {
          projectReadinessStatus: "FALLBACK" as const,
          runtimeCandidateCount: candidateCount,
          totalProjectShadowDurationMs: 0,
        }
      : {}),
  };
  safeLogWarning(
    {
      userId: "[redacted]",
      recommendationMlShadow: diagnostics,
      domain,
      ...(env.nodeEnv === "development" ? { error: fallbackReason } : {}),
    },
    "recommendation ML shadow fallback",
  );
  return diagnostics;
};

const writeProjectDecisionLog = (
  input: ShadowComparisonInput<unknown>,
  diagnostics: ShadowDiagnostics,
  started: number,
  mode: ProjectDecisionMode,
): void => {
  if (env.nodeEnv !== "development" || input.domain !== "project") return;
  const servedItemCount =
    input.currentSections?.find(
      (section) => section.sectionKey === "suggested_projects",
    )?.candidateKeys.length ?? input.currentTopKeys.length;
  logger.info(
    {
      domain: "project",
      mode,
      status: diagnostics.status,
      projectReadinessStatus: diagnostics.projectReadinessStatus ?? "FALLBACK",
      confidenceLevel: diagnostics.recentConfidence ?? "NONE",
      confidenceSource: diagnostics.confidenceSource ?? "NONE",
      runtimeCandidateCount:
        diagnostics.runtimeCandidateCount ?? diagnostics.candidateCount,
      artifactMappedCandidateCount:
        diagnostics.artifactMappedCandidateCount ?? 0,
      servedItemCount,
      recentSlotsUsedTop5: diagnostics.recentSlotsUsedTop5 ?? 0,
      recentSlotsUsedTop10: diagnostics.recentSlotsUsedTop10 ?? 0,
      fallbackReason: diagnostics.fallbackReason ?? null,
      scorerDurationMs:
        diagnostics.scorerDurationMs ?? diagnostics.scoringDurationMs ?? 0,
      fusionDurationMs:
        diagnostics.fusionDurationMs ?? diagnostics.recentFusionDurationMs ?? 0,
      totalProjectRecommendationDurationMs:
        diagnostics.totalProjectRecommendationDurationMs ??
        diagnostics.totalProjectShadowDurationMs ??
        Math.max(0, performance.now() - started),
    },
    "project recommendation decision",
  );
};

const safeWriteProjectDecisionLog = (
  input: ShadowComparisonInput<unknown>,
  diagnostics: ShadowDiagnostics,
  started: number,
  mode: ProjectDecisionMode,
): void => {
  try {
    writeProjectDecisionLog(input, diagnostics, started, mode);
  } catch (loggingError) {
    safeLogWarning(
      {
        operation: "recommendation.ml-shadow.project-decision-log-failure",
        fallbackReason: redactErrorMessage(loggingError),
      },
      "project recommendation decision log failure",
    );
  }
};

const buildProjectShadowDiagnostics = (
  input: ShadowComparisonInput<unknown>,
  runtimeCandidates: ReadonlyArray<{
    candidateKey: string;
    features: readonly WeightedFeature[];
  }>,
  model: RecommendationMlDomainDiagnostics,
  longTerm: Extract<LocalMlContainedScoringResult, { outcome: "SCORED" }>,
  started: number,
  scorerDurationMs: number,
): { diagnostics: ShadowDiagnostics; fusedRankingKeys?: string[] } => {
  const comparisonStarted = performance.now();
  const runtimeKeys = input.candidates.map(
    (candidate) => candidate.candidateKey,
  );
  const runtimeKeySet = new Set(runtimeKeys);
  const scoredKeys = longTerm.scored.map((candidate) => candidate.candidateKey);
  const artifactMappedCandidateCount = runtimeCandidates.length;
  const runtimeCandidatesMissingFromArtifact = 0;
  const artifactEntriesOutsideRuntimeUniverse = Math.max(
    0,
    (model.artifactItemCount ?? 0) - runtimeCandidates.length,
  );
  const nonFiniteScoreCount = longTerm.scored.filter(
    (candidate) => !Number.isFinite(candidate.score),
  ).length;
  const finiteScoreCount = longTerm.scored.length - nonFiniteScoreCount;
  const deterministic = [
    ...new Set(
      input.currentSections?.find(
        (section) => section.sectionKey === "suggested_projects",
      )?.candidateKeys ?? input.currentTopKeys,
    ),
  ];
  const ml = [...new Set(scoredKeys)];
  const top5Overlap = calculateProjectTopKOverlap(deterministic, ml, 5);
  const top10Overlap = calculateProjectTopKOverlap(deterministic, ml, 10);
  const rankMovement = calculateProjectTop10RankMovement(deterministic, ml);
  const duplicateRuntimeCandidateCount = duplicateCount(runtimeKeys);
  const duplicateScoredCandidateCount = duplicateCount(scoredKeys);
  const unknownScoredCandidateCount = scoredKeys.filter(
    (key) => !runtimeKeySet.has(key),
  ).length;
  const hydratedMappingFailureCount =
    duplicateRuntimeCandidateCount + unknownScoredCandidateCount;
  const mappingIntegrityReady =
    nonFiniteScoreCount === 0 &&
    duplicateRuntimeCandidateCount === 0 &&
    duplicateScoredCandidateCount === 0 &&
    hydratedMappingFailureCount === 0 &&
    runtimeCandidatesMissingFromArtifact === 0;
  // RP-01.5: overall project readiness requires feature readiness; mapping integrity alone is not enough.
  const projectReadinessStatus: ProjectReadinessStatus = mappingIntegrityReady
    ? "READY"
    : "NOT_READY";
  const readinessBase: ShadowDiagnostics = {
    status: "SCORED",
    projectReadinessStatus,
    candidateCount: input.candidates.length,
    runtimeCandidateCount: input.candidates.length,
    artifactCatalogCount: model.artifactItemCount,
    artifactMappedCandidateCount,
    runtimeCandidatesMissingFromArtifact,
    artifactEntriesOutsideRuntimeUniverse,
    scoredCandidateCount: longTerm.scored.length,
    nonFiniteScoreCount,
    finiteScoreCount,
    zeroScoreCount: longTerm.scored.filter((candidate) => candidate.score === 0)
      .length,
    duplicateRuntimeCandidateCount,
    duplicateScoredCandidateCount,
    hydratedMappingFailureCount,
    deterministicCandidateCount: deterministic.length,
    mlCandidateCount: ml.length,
    top5Overlap: top5Overlap.ratio,
    top10Overlap: top10Overlap.ratio,
    top5OverlapCount: top5Overlap.count,
    top10OverlapCount: top10Overlap.count,
    top5OverlapRatio: top5Overlap.ratio,
    top10OverlapRatio: top10Overlap.ratio,
    averageTop10RankMovement: rankMovement.average,
    maximumTop10RankMovement: rankMovement.maximum,
    scorerDurationMs,
    comparisonDurationMs: Math.max(0, performance.now() - comparisonStarted),
    totalProjectShadowDurationMs: Math.max(0, performance.now() - started),
    totalProjectRecommendationDurationMs: Math.max(
      0,
      performance.now() - started,
    ),
    scoringDurationMs: scorerDurationMs,
    artifactVersion: model.modelVersion,
    featureSchemaVersion: model.schemaVersion,
    missingFeatureCount: 0,
    scorerOutcome: "SCORED",
    scorerReadiness: "READY",
    scorerReasonCodes: [],
    shadowTop5Keys: ml.slice(0, 5).map(privacyKey),
    currentTop5Keys: deterministic.slice(0, 5).map(privacyKey),
    longTermTop5Keys: ml.slice(0, 5).map(privacyKey),
    recentConfidence: "NONE",
    confidenceSource: "NONE",
    recentSlotsAllowedTop5: 0,
    recentSlotsUsedTop5: 0,
    recentSlotsAllowedTop10: 0,
    recentSlotsUsedTop10: 0,
    recentFusionDurationMs: 0,
  };
  // Early-return only when mapping/scoring integrity is unsafe. Feature NOT_READY
  // must not suppress recent-intent / fusion shadow evidence.
  if (!mappingIntegrityReady) {
    return { diagnostics: readinessBase };
  }

  const metadata = new Map(
    input.candidates.map((value) => [
      value.candidateKey,
      {
        categoryKey: categoryKey(value.categoryId),
        conceptKeys: value.conceptKeys ?? [],
        componentConceptKeys: value.componentConceptKeys ?? [],
      },
    ]),
  );
  for (const value of input.recentEntityMetadata ?? []) {
    metadata.set(value.entityKey, {
      categoryKey: categoryKey(value.categoryId),
      conceptKeys: value.conceptKeys ?? [],
      componentConceptKeys: value.componentConceptKeys ?? [],
    });
  }

  const projectEvents = input.recentEvents.filter((event) =>
    isProjectRecentIntentEvent(event.actionType),
  );
  const candidateUniverse = new Set(
    input.candidates.map((value) => value.candidateKey),
  );
  injectFailure("confidence");
  const confidence = classifyProjectRecentIntent(
    projectEvents,
    metadata,
    input.evaluationTimestamp,
    candidateUniverse,
  );
  injectFailure("dominance");
  const recentIntent = buildProjectRecentIntent(
    projectEvents,
    metadata,
    input.evaluationTimestamp,
  );
  const recentScores = new Map(
    input.candidates.map((value) => [
      value.candidateKey,
      projectRecentItemScore(
        value.candidateKey,
        metadata.get(value.candidateKey)!,
        recentIntent.intent,
        recentIntent.directScores,
      ),
    ]),
  );
  const fusionStarted = performance.now();
  injectFailure("fusion");
  const fusion = requireProjectFusion(
    longTerm.scored.map((candidate) => ({ ...candidate })),
    recentScores,
    confidence.confidence,
  );
  const recentFusionDurationMs = Math.max(0, performance.now() - fusionStarted);
  const longTermTop = ml;
  const recentTop = [...recentScores]
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )
    .map(([key]) => key);
  const fusedTop = fusion.ranking.map((value) => value.candidateKey);
  const dominantFeature = confidence.dominantFeature;
  const matchesRecentDomain = (key: string) => {
    const item = metadata.get(key);
    if (!item || !dominantFeature) return false;
    if (dominantFeature.startsWith("category:"))
      return `category:${item.categoryKey}` === dominantFeature;
    if (dominantFeature.startsWith("concept:"))
      return item.conceptKeys.some(
        (value) => `concept:${value}` === dominantFeature,
      );
    return item.componentConceptKeys.some(
      (value) => `component:${value}` === dominantFeature,
    );
  };
  const longTermRanks = new Map(
    longTerm.scored.map((value, index) => [value.candidateKey, index + 1]),
  );
  const fusedRanks = new Map(fusedTop.map((key, index) => [key, index + 1]));
  const rankMovementDiagnostics = fusion.qualifiedRecent
    .slice(0, 5)
    .flatMap((value) => {
      const longTermRank = longTermRanks.get(value.candidateKey);
      const fusedRank = fusedRanks.get(value.candidateKey);
      if (longTermRank === undefined || fusedRank === undefined) return [];
      const item = metadata.get(value.candidateKey)!;
      return [
        {
          candidateKeyHash: privacyKey(value.candidateKey),
          longTermRank,
          recentRank: value.recentRank,
          fusedRank,
          recentScore: value.recentScore,
          qualificationStatus: "QUALIFIED" as const,
          mappedCategoryMatch: dominantFeature?.startsWith("category:")
            ? `category:${item.categoryKey}` === dominantFeature
            : false,
          mappedConceptMatch:
            item.conceptKeys.some(
              (key) => `concept:${key}` === dominantFeature,
            ) ||
            item.componentConceptKeys.some(
              (key) => `component:${key}` === dominantFeature,
            ),
        },
      ];
    });
  const outsideCandidateUniverse = new Set(
    projectEvents
      .filter(
        (event) =>
          metadata.has(event.entityKey) &&
          !candidateUniverse.has(event.entityKey),
      )
      .map((event) => event.entityKey),
  ).size;
  const comparisonDurationMs = Math.max(
    0,
    performance.now() - comparisonStarted,
  );
  const totalProjectShadowDurationMs = Math.max(0, performance.now() - started);

  return {
    diagnostics: {
      status: "SCORED",
      projectReadinessStatus,
      candidateCount: input.candidates.length,
      runtimeCandidateCount: input.candidates.length,
      artifactCatalogCount: model.artifactItemCount,
      artifactMappedCandidateCount,
      runtimeCandidatesMissingFromArtifact,
      artifactEntriesOutsideRuntimeUniverse,
      scoredCandidateCount: longTerm.scored.length,
      nonFiniteScoreCount,
      finiteScoreCount,
      zeroScoreCount: longTerm.scored.filter(
        (candidate) => candidate.score === 0,
      ).length,
      duplicateRuntimeCandidateCount,
      duplicateScoredCandidateCount,
      hydratedMappingFailureCount,
      deterministicCandidateCount: deterministic.length,
      mlCandidateCount: ml.length,
      top5Overlap: top5Overlap.ratio,
      top10Overlap: top10Overlap.ratio,
      top5OverlapCount: top5Overlap.count,
      top10OverlapCount: top10Overlap.count,
      top5OverlapRatio: top5Overlap.ratio,
      top10OverlapRatio: top10Overlap.ratio,
      averageTop10RankMovement: rankMovement.average,
      maximumTop10RankMovement: rankMovement.maximum,
      scorerDurationMs,
      comparisonDurationMs,
      totalProjectShadowDurationMs,
      totalProjectRecommendationDurationMs: totalProjectShadowDurationMs,
      scoringDurationMs: scorerDurationMs,
      artifactVersion: model.modelVersion,
      featureSchemaVersion: model.schemaVersion,
      missingFeatureCount: 0,
      scorerOutcome: "SCORED",
      scorerReadiness: "READY",
      scorerReasonCodes: [],
      shadowTop5Keys: fusedTop.slice(0, 5).map(privacyKey),
      currentTop5Keys: deterministic.slice(0, 5).map(privacyKey),
      longTermTop5Keys: longTermTop.slice(0, 5).map(privacyKey),
      recentChannelTop5Keys: recentTop.slice(0, 5).map(privacyKey),
      fusedTop5Keys: fusedTop.slice(0, 5).map(privacyKey),
      recentEventInputCount: projectEvents.length,
      recentEvidenceCount: recentIntent.evidenceCount,
      recentChannelApplied: recentIntent.evidenceCount > 0,
      recentConfidence: confidence.confidence,
      confidenceSource: confidence.confidenceSource,
      burstWindowHours: confidence.burstWindowHours,
      recentHistoryDistinctProjectCount:
        confidence.recentHistoryDistinctProjectCount,
      burstDistinctProjectCount: confidence.burstDistinctProjectCount,
      burstActiveSaveCount: confidence.burstActiveSaveCount,
      burstActiveLikeCount: confidence.burstActiveLikeCount,
      burstActiveFollowCount: confidence.burstActiveFollowCount,
      burstStrongActionCount: confidence.burstStrongActionCount,
      burstDominantConceptShare: confidence.burstDominantConceptShare,
      fullHistoryDominantConceptShare:
        confidence.fullHistoryDominantConceptShare,
      newestEvidenceAgeHours:
        confidence.newestEvidenceAgeDays === undefined
          ? undefined
          : confidence.newestEvidenceAgeDays * 24,
      qualifiedRecentCandidateCount: fusion.qualifiedRecentCount,
      recentSlotsAllowedTop5: fusion.recentSlotsAllowedTop5,
      recentSlotsUsedTop5: fusion.recentSlotsUsedTop5,
      recentSlotsAllowedTop10: fusion.recentSlotsAllowedTop10,
      recentSlotsUsedTop10: fusion.recentSlotsUsedTop10,
      longTermRecentTop5OverlapCount: overlapCount(longTermTop, recentTop, 5),
      longTermFusedTop5OverlapCount: overlapCount(longTermTop, fusedTop, 5),
      longTermTop5RecentDomainCount: longTerm.scored
        .slice(0, 5)
        .filter((value) => matchesRecentDomain(value.candidateKey)).length,
      recentChannelTop5RecentDomainCount: recentTop
        .slice(0, 5)
        .filter(matchesRecentDomain).length,
      fusedTop5RecentDomainCount: fusedTop
        .slice(0, 5)
        .filter(matchesRecentDomain).length,
      recentEvidenceRejectedCounts: {
        ...confidence.rejectedCounts,
        outsideCandidateUniverse,
        belowCandidateQualityThreshold:
          fusion.belowCandidateQualityThresholdCount,
      },
      rankMovement: rankMovementDiagnostics,
      fusionDurationMs: recentFusionDurationMs,
      recentFusionDurationMs,
      rankCorrelation: rankCorrelation(
        deterministic.slice(0, 10),
        fusedTop.slice(0, 10),
      ),
    },
    fusedRankingKeys: fusedTop,
  };
};

const runMlShadowComparisonInternal = async <T>(
  input: ShadowComparisonInput<T>,
): Promise<MlShadowComparisonResult<T>> => {
  const timeoutTestEnabled = neverSettleResponseForTests === input.response;

  const runtimeEnabled =
    getRecommendationMlRuntimeSnapshot().mode !== "DETERMINISTIC";
  if (
    !env.recommendationMlShadowEnabled &&
    !runtimeEnabled &&
    !timeoutTestEnabled
  ) {
    const diagnostics: ShadowDiagnostics = {
      status: "DISABLED",
      candidateCount: input.candidates.length,
    };

    safeWriteMaterialDecisionLog(
      input,
      diagnostics,
      performance.now(),
      "DETERMINISTIC",
    );

    return { response: input.response, diagnostics };
  }

  const started = performance.now();

  try {
    observeMaterialStage(input, started, "material_shadow", "start");
    observeMaterialStage(input, started, "material_input_preparation", "start");

    if (
      neverSettleResponseForTests !== undefined &&
      neverSettleResponseForTests === input.response
    ) {
      await new Promise<never>(() => undefined);
    }

    if (input.candidates.length > 200) throw new Error("candidate_bound");

    const unique = new Set(input.candidates.map((value) => value.candidateKey));

    if (input.domain === "material" && unique.size !== input.candidates.length)
      throw new Error("candidate_mismatch");

    const shadowKeys = [...unique].sort();
    const activeKeys = [...new Set(input.activeCandidateKeys)].sort();

    if (
      shadowKeys.length !== activeKeys.length ||
      shadowKeys.some((value, index) => value !== activeKeys[index])
    )
      throw new Error("candidate_mismatch");

    observeMaterialStage(
      input,
      started,
      "material_input_preparation",
      "complete",
    );

    observeMaterialStage(input, started, "portable_artifact_scoring", "start");

    const [canonicalUser, runtimeFeatureAuthority] = await Promise.all([
      resolveCanonicalShadowUserFeatures({
        storedInterests: input.interests,
        loadRegistry: loadInterestRegistry,
      }),
      getCanonicalRuntimeFeatureAuthority(),
    ]);
    const userFeatures = canonicalUser.features;
    const canonicalUserDiagnosticsBase = {
      resolutionStatus: canonicalUser.resolutionStatus,
      canonicalFeatureCount: canonicalUser.canonicalFeatureCount,
      mappedInputCount: canonicalUser.mappedInputCount,
      unmappedInputCount: canonicalUser.unmappedInputCount,
      unmappedReasonCounts: canonicalUser.unmappedReasonCounts,
      candidateIndependent: canonicalUser.candidateIndependent,
      servingSuppressedReason: CANONICAL_USER_FEATURES_SHADOW_ONLY,
    };

    const candidates = input.candidates.map((value) => ({
      candidateKey: value.candidateKey,
      features: canonicalItemFeatures(
        value,
        input.domain,
        runtimeFeatureAuthority,
      ),
    }));

    const scorerStarted = performance.now();
    const longTerm = scoreRecommendationMlRuntimeForShadow({
      domain: input.domain,
      userFeatures,
      candidates,
    });
    const scorerDurationMs = Math.max(0, performance.now() - scorerStarted);

    observeMaterialStage(
      input,
      started,
      "portable_artifact_scoring",
      "complete",
    );

    if (longTerm.outcome !== "SCORED") {
      const diagnostics: ShadowDiagnostics = {
        ...reportMlShadowFallback(
          input.domain,
          input.candidates.length,
          new Error(longTerm.reasonCode),
        ),
        ...canonicalUserDiagnosticsBase,
        scoringDurationMs: scorerDurationMs,
        missingFeatureCount: longTerm.diagnostics.featureMappingMissingCount,
        scorerReadiness: "NOT_READY",
      };
      if (input.domain === "material") {
        safeWriteMaterialDecisionLog(input, diagnostics, started, "FALLBACK");
      } else {
        safeWriteProjectDecisionLog(input, diagnostics, started, "FALLBACK");
      }
      safeObserve({ ...diagnostics, domain: input.domain });
      return { response: input.response, diagnostics };
    }

    const runtimeSnapshot = getRecommendationMlRuntimeSnapshot();
    const model =
      input.domain === "material"
        ? runtimeSnapshot.material
        : runtimeSnapshot.project;
    const canonicalUserFeatureCount = userFeatures.length;
    const canonicalUserDiagnostics = {
      ...canonicalUserDiagnosticsBase,
      canonicalUserFeatureCount,
      artifactMatchedUserFeatureCount: canonicalUserFeatureCount,
      artifactMissingUserFeatureCount: 0,
      artifactUserFeatureOverlapStatus:
        canonicalUserFeatureCount === 0
          ? ("NO_RUNTIME_FEATURES" as const)
          : ("FULL_OVERLAP" as const),
    };

    if (input.domain === "project") {
      const projectDecision = buildProjectShadowDiagnostics(
        input,
        candidates,
        model,
        longTerm,
        started,
        scorerDurationMs,
      );

      const diagnostics: ShadowDiagnostics = {
        ...projectDecision.diagnostics,
        ...canonicalUserDiagnostics,
        projectReadinessStatus:
          projectDecision.diagnostics.projectReadinessStatus === "READY" &&
          canonicalUser.unmappedInputCount > 0
            ? "NOT_READY"
            : projectDecision.diagnostics.projectReadinessStatus,
      };

      injectFailure("diagnostics");
      injectFailure("redaction");
      injectFailure("logger");

      const projectMode: ProjectDecisionMode =
        diagnostics.status === "FALLBACK" ? "FALLBACK" : "SHADOW";

      safeWriteProjectDecisionLog(input, diagnostics, started, projectMode);
      safeObserve({ ...diagnostics, domain: input.domain });

      // RP-01.4: canonical user features are shadow-only; never attach serve keys.
      return {
        response: input.response,
        diagnostics,
      };
    }

    const metadata = new Map(
      input.candidates.map((value) => [
        value.candidateKey,
        {
          categoryKey: categoryKey(value.categoryId),
          conceptKeys: value.conceptKeys ?? [],
          componentConceptKeys: value.componentConceptKeys ?? [],
        },
      ]),
    );

    for (const value of input.recentEntityMetadata ?? [])
      metadata.set(value.entityKey, {
        categoryKey: categoryKey(value.categoryId),
        conceptKeys: value.conceptKeys ?? [],
        componentConceptKeys: value.componentConceptKeys ?? [],
      });

    observeMaterialStage(input, started, "recent_intent_scoring", "start");

    const recent = buildShortTermIntent(
      input.recentEvents,
      metadata,
      input.evaluationTimestamp,
    );

    const recentScores = new Map(
      input.candidates.map((value) => [
        value.candidateKey,
        recentItemScore(metadata.get(value.candidateKey)!, recent.intent),
      ]),
    );

    const combined = combineNormalizedScores(
      longTerm.scored.map((candidate) => ({ ...candidate })),
      recentScores,
      SHORT_TERM_CONFIG.recentBlend,
    );

    const linearBlendTop = combined.map((value) => value.candidateKey);

    observeMaterialStage(input, started, "recent_intent_scoring", "complete");

    const candidateUniverse = new Set(
      input.candidates.map((value) => value.candidateKey),
    );

    injectFailure("confidence");

    observeMaterialStage(
      input,
      started,
      "burst_evidence_construction",
      "start",
    );

    observeMaterialStage(input, started, "confidence_classification", "start");
    observeMaterialStage(
      input,
      started,
      "weighted_dominance_calculation",
      "start",
    );

    const confidence = classifyRecentIntent(
      input.recentEvents,
      metadata,
      input.evaluationTimestamp,
      candidateUniverse,
    );

    observeMaterialStage(
      input,
      started,
      "weighted_dominance_calculation",
      "complete",
    );

    observeMaterialStage(
      input,
      started,
      "confidence_classification",
      "complete",
    );

    observeMaterialStage(
      input,
      started,
      "burst_evidence_construction",
      "complete",
    );

    injectFailure("dominance");

    const scoringDurationMs = performance.now() - started;
    const fusionStarted = performance.now();

    injectFailure("fusion");

    const fusionStageObserver: MaterialFusionStageObserver | undefined =
      input.domain === "material"
        ? (stage, phase, iterationCount) =>
            observeMaterialStage(input, started, stage, phase, iterationCount)
        : undefined;

    const fusion =
      input.domain === "material"
          ? requireMaterialFusion(
            longTerm.scored.map((candidate) => ({ ...candidate })),
            recentScores,
            confidence.confidence,
            fusionStageObserver,
          )
        : undefined;

    const fusionDurationMs = performance.now() - fusionStarted;

    const shadowTop =
      fusion?.ranking.map((value) => value.candidateKey) ?? linearBlendTop;

    const deduplicatedCurrent = [...new Set(input.currentTopKeys)];

    const sectionDiagnostics = (input.currentSections ?? []).map((section) => {
      const current = [...new Set(section.candidateKeys)];
      const allowed = new Set(current);
      const sectionLongTerm = longTerm.scored.filter((value) =>
        allowed.has(value.candidateKey),
      );

      const within =
        input.domain === "material" &&
        section.sectionKey === "suggested_materials"
          ? requireMaterialFusion(
              sectionLongTerm,
              new Map([...recentScores].filter(([key]) => allowed.has(key))),
              confidence.confidence,
              fusionStageObserver,
            ).ranking.map((value) => value.candidateKey)
          : sectionLongTerm.map((value) => value.candidateKey);

      return {
        sectionKey: section.sectionKey,
        candidatePoolSize: current.length,
        top5Overlap: overlap(current, within, 5),
        top10Overlap: overlap(current, within, 10),
        fusedTop5Keys: within.slice(0, 5).map(privacyKey),
      };
    });

    const itemFeatureCounts = candidates.map((value) => value.features.length);

    const outsideCandidateUniverse = new Set(
      input.recentEvents
        .filter(
          (event) =>
            metadata.has(event.entityKey) &&
            !candidateUniverse.has(event.entityKey),
        )
        .map((event) => event.entityKey),
    ).size;

    const dominantFeature = confidence.dominantFeature;

    const matchesRecentDomain = (key: string) => {
      const item = metadata.get(key);
      if (!item || !dominantFeature) return false;
      return dominantFeature.startsWith("category:")
        ? `category:${item.categoryKey}` === dominantFeature
        : item.conceptKeys.some(
            (value) => `concept:${value}` === dominantFeature,
          );
    };

    const recentChannelTop = [...recentScores]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([key]) => key);

    const longTermRanks = new Map(
      longTerm.scored.map((value, index) => [value.candidateKey, index + 1]),
    );

    const fusedRanks = new Map(shadowTop.map((key, index) => [key, index + 1]));

    observeMaterialStage(input, started, "rank_movement_diagnostics", "start");

    const rankMovement = (fusion?.qualifiedRecent ?? [])
      .slice(0, 5)
      .map((value) => {
        const item = metadata.get(value.candidateKey)!;

        return {
          candidateKeyHash: privacyKey(value.candidateKey),
          longTermRank: longTermRanks.get(value.candidateKey)!,
          recentRank: value.recentRank,
          fusedRank: fusedRanks.get(value.candidateKey)!,
          recentScore: value.recentScore,
          qualificationStatus: "QUALIFIED" as const,
          mappedCategoryMatch:
            (recent.intent.get(`category:${item.categoryKey}`) ?? 0) > 0,
          mappedConceptMatch: item.conceptKeys.some(
            (key) => (recent.intent.get(`concept:${key}`) ?? 0) > 0,
          ),
        };
      });

    observeMaterialStage(
      input,
      started,
      "rank_movement_diagnostics",
      "complete",
      rankMovement.length,
    );

    observeMaterialStage(input, started, "diagnostics_construction", "start");
    const diagnostics: ShadowDiagnostics = {
      status: "SCORED",
      candidateCount: input.candidates.length,
      top5Overlap: overlap(deduplicatedCurrent, shadowTop, 5),
      top10Overlap: overlap(deduplicatedCurrent, shadowTop, 10),
      rankCorrelation: rankCorrelation(
        deduplicatedCurrent.slice(0, 10),
        shadowTop.slice(0, 10),
      ),
      duplicateCurrentCount:
        input.currentTopKeys.length - deduplicatedCurrent.length,
      deduplicatedCurrentCount: deduplicatedCurrent.length,
      sectionDiagnostics,
      recentEventInputCount: input.recentEvents.length,
      recentEvidenceCount: recent.evidenceCount,
      recentChannelApplied: recent.evidenceCount > 0,
      recentConfidence: confidence.confidence,
      confidenceSource: confidence.confidenceSource,
      recentUniqueMaterialCount: confidence.uniqueRecentMaterialCount,
      recentUniqueViewCount: confidence.uniqueRecentViewCount,
      recentActiveLikeCount: confidence.activeRecentLikeCount,
      recentStrongActionCount: confidence.strongActionCount,
      burstWindowHours: confidence.burstWindowHours,
      burstUniqueMaterialCount: confidence.burstUniqueMaterialCount,
      burstUniqueViewCount: confidence.burstUniqueViewCount,
      burstActiveLikeCount: confidence.burstActiveLikeCount,
      burstStrongActionCount: confidence.burstStrongActionCount,
      recentCoherence: confidence.dominantEvidenceShare,
      dominantCategoryShare: confidence.dominantCategoryShare,
      dominantConceptShare: confidence.dominantConceptShare,
      fullHistoryDominantCategoryShare:
        confidence.fullHistoryDominantCategoryShare,
      fullHistoryDominantConceptShare:
        confidence.fullHistoryDominantConceptShare,
      newestEvidenceAgeHours:
        confidence.newestEvidenceAgeDays === undefined
          ? undefined
          : confidence.newestEvidenceAgeDays * 24,
      qualifiedRecentCandidateCount: fusion?.qualifiedRecentCount,
      recentSlotsAllowedTop5: fusion?.recentSlotsAllowedTop5,
      recentSlotsUsedTop5: fusion?.recentSlotsUsedTop5,
      recentSlotsAllowedTop10: fusion?.recentSlotsAllowedTop10,
      recentSlotsUsedTop10: fusion?.recentSlotsUsedTop10,
      longTermTop5RecentDomainCount: longTerm.scored
        .slice(0, 5)
        .filter((value) => matchesRecentDomain(value.candidateKey)).length,
      recentChannelTop5RecentDomainCount: recentChannelTop
        .slice(0, 5)
        .filter(matchesRecentDomain).length,
      fusedTop5RecentDomainCount: shadowTop
        .slice(0, 5)
        .filter(matchesRecentDomain).length,
      recentEvidenceRejectedCounts: {
        ...confidence.rejectedCounts,
        outsideCandidateUniverse,
        belowCandidateQualityThreshold:
          fusion?.belowCandidateQualityThresholdCount ?? 0,
      },
      rankMovement,
      fusionDurationMs,
      scoringDurationMs,
      artifactVersion: model.modelVersion,
      featureSchemaVersion: model.schemaVersion,
      missingFeatureCount: 0,
      scorerOutcome: "SCORED",
      scorerReadiness: "READY",
      scorerReasonCodes: [],
      ...canonicalUserDiagnostics,
      currentTop5Keys: deduplicatedCurrent.slice(0, 5).map(privacyKey),
      shadowTop5Keys: shadowTop.slice(0, 5).map(privacyKey),
      linearBlendTop5Keys: linearBlendTop.slice(0, 5).map(privacyKey),
      featureCoverage: {
        // Runtime input length only — not artifact intersection (see overlap fields).
        activeUserFeatures: userFeatures.length,
        zeroFeatureUser: userFeatures.length === 0,
        itemFeatureTotal: itemFeatureCounts.reduce(
          (sum, value) => sum + value,
          0,
        ),
        itemsOnlyCategory: itemFeatureCounts.filter((value) => value === 1)
          .length,
        itemsWithoutApprovedFeatures: itemFeatureCounts.filter(
          (value) => value === 0,
        ).length,
        categoryCovered: input.candidates.filter((value) =>
          Boolean(value.categoryId),
        ).length,
        conceptCovered: input.candidates.filter(
          (value) => (value.conceptKeys?.length ?? 0) > 0,
        ).length,
        conditionCovered: input.candidates.filter((value) =>
          Boolean(value.condition),
        ).length,
        freeCovered: input.candidates.filter(
          (value) => value.isFree !== undefined,
        ).length,
        pickupCovered: input.candidates.filter(
          (value) => value.pickupAllowed !== undefined,
        ).length,
        deliveryCovered: input.candidates.filter(
          (value) => value.deliveryAllowed !== undefined,
        ).length,
        difficultyCovered: input.candidates.filter((value) =>
          Boolean(value.difficulty),
        ).length,
        componentCovered: input.candidates.filter(
          (value) => (value.componentConceptKeys?.length ?? 0) > 0,
        ).length,
      },
    };

    observeMaterialStage(
      input,
      started,
      "diagnostics_construction",
      "complete",
    );

    injectFailure("diagnostics");

    if (env.nodeEnv === "development" && input.domain === "material") {
      observeMaterialStage(
        input,
        started,
        "diagnostics_serialization_redaction",
        "start",
      );

      injectFailure("redaction");

      observeMaterialStage(
        input,
        started,
        "diagnostics_serialization_redaction",
        "complete",
      );

      observeMaterialStage(input, started, "diagnostics_logging", "start");

      injectFailure("logger");

      writeMaterialDecisionLog(
        input,
        diagnostics,
        started,
        "SHADOW",
      );

      observeMaterialStage(input, started, "diagnostics_logging", "complete");
    } else {
      logger.info(
        {
          userId: "[redacted]",
          recommendationMlShadow: {
            domain: input.domain,
            status: diagnostics.status,
            candidateCount: diagnostics.candidateCount,
            artifactVersion: diagnostics.artifactVersion ?? "unknown",
            featureSchemaVersion: diagnostics.featureSchemaVersion ?? "unknown",
            scorerDurationMs: diagnostics.scoringDurationMs ?? 0,
            fusionDurationMs: diagnostics.fusionDurationMs ?? 0,
          },
        },
        "recommendation ML shadow comparison",
      );
    }

    safeObserve({ ...diagnostics, domain: input.domain });

    observeMaterialStage(input, started, "material_shadow", "complete");

    // RP-01.4: canonical user features are shadow-only; never attach serve keys.
    return {
      response: input.response,
      diagnostics,
    };
  } catch (error) {
    const diagnostics = reportMlShadowFallback(
      input.domain,
      input.candidates.length,
      error,
    );

    if (input.domain === "material") {
      safeWriteMaterialDecisionLog(input, diagnostics, started, "FALLBACK");
    } else {
      safeWriteProjectDecisionLog(input, diagnostics, started, "FALLBACK");
    }

    safeObserve({ ...diagnostics, domain: input.domain });
    return { response: input.response, diagnostics };
  }
};

export const runMlShadowComparison = async <T>(
  input: ShadowComparisonInput<T>,
): Promise<MlShadowComparisonResult<T>> => {
  const timeoutTestEnabled = neverSettleResponseForTests === input.response;

  const runtimeEnabled =
    getRecommendationMlRuntimeSnapshot().mode !== "DETERMINISTIC";
  if (
    !env.recommendationMlShadowEnabled &&
    !runtimeEnabled &&
    !timeoutTestEnabled
  )
    return runMlShadowComparisonInternal(input);

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error(`${input.domain}_shadow_timeout`)),
      ML_SHADOW_TIMEOUT_MS,
    );
  });

  try {
    return await Promise.race([runMlShadowComparisonInternal(input), timeout]);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === `${input.domain}_shadow_timeout`
    ) {
      safeLogWarning(
        {
          operation: "recommendation.ml-shadow.timeout",
          domain: input.domain,
          fallbackReason: `${input.domain}_shadow_timeout`,
        },
        `${input.domain} shadow timeout`,
      );
    }

    const diagnostics = reportMlShadowFallback(
      input.domain,
      input.candidates.length,
      error,
    );

    if (input.domain === "material") {
      safeWriteMaterialDecisionLog(
        input,
        diagnostics,
        performance.now(),
        "FALLBACK",
      );
    } else {
      safeWriteProjectDecisionLog(
        input,
        diagnostics,
        performance.now(),
        "FALLBACK",
      );
    }

    safeObserve({ ...diagnostics, domain: input.domain });

    return { response: input.response, diagnostics };
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
  }
};
