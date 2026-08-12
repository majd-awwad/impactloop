import type { RecommendationMlRuntimeMode } from '../../config/env.js';
import type {
  LearnerHomeMlOrderingDecision,
  LearnerHomeMlOrderingStatus,
} from '../learner-home/learner-home.ml-ordering.js';
import type {
  RecommendationMlRuntimeDomainState,
  RecommendationMlRuntimeSnapshot,
} from './ml-runtime-state.service.js';
import type { LocalMlDomain } from './ml-lightfm-scorer.js';

/**
 * Per-domain recommendation serving health.
 * Orthogonal to application process readiness (/health/ready).
 */
export type RecommendationServingHealthKind =
  | 'ML_SERVED'
  | 'FALLBACK_EXPECTED'
  | 'FALLBACK_UNEXPECTED'
  | 'EXPLICIT_DETERMINISTIC'
  | 'SHADOW'
  | 'NOT_APPLICABLE'
  | 'EMPTY';

export type RecommendationDomainServingTruth = Readonly<{
  domain: LocalMlDomain;
  runtimeMode: RecommendationMlRuntimeMode;
  domainState: RecommendationMlRuntimeDomainState;
  domainFailureCode?: string;
  outcome: LearnerHomeMlOrderingStatus | 'EMPTY' | 'NOT_APPLICABLE';
  reasonCode?: string;
  health: RecommendationServingHealthKind;
  expectedToMlRank: boolean;
  mlOwnedFinalOrder: boolean;
  candidateCount: number;
  scoredCount: number;
  mappedCandidateCount: number;
  unmappedCandidateCount: number;
  omittedMappedCandidateCount: number;
  finalSectionItemCount: number;
  modelVersion?: string;
  schemaVersion?: string;
  semanticContentHash?: string;
  aggregationMode?: string;
  featureContractId?: string;
  featureContractVersion?: string;
}>;

export type RecommendationRequestServingTruth = Readonly<{
  runtimeMode: RecommendationMlRuntimeMode;
  material: RecommendationDomainServingTruth;
  project: RecommendationDomainServingTruth;
  overallHealth: RecommendationServingHealthKind;
  hasUnexpectedFallback: boolean;
}>;

export type EvaluateDomainServingInput = Readonly<{
  decision: LearnerHomeMlOrderingDecision;
  domainState: RecommendationMlRuntimeSnapshot['material'];
  finalSectionItemCount: number;
}>;

const mappedCount = (decision: LearnerHomeMlOrderingDecision): number =>
  Math.max(
    0,
    decision.diagnostics.candidateCount -
      decision.diagnostics.unmappedCandidateCount,
  );

/**
 * Under ML_PRIMARY, ML is expected to rank when the domain is READY and the
 * candidate pool is non-empty. Empty pools are NOT_APPLICABLE, not unexpected.
 */
export const isExpectedToMlRank = (input: {
  runtimeMode: RecommendationMlRuntimeMode;
  domainState: RecommendationMlRuntimeDomainState;
  candidateCount: number;
}): boolean =>
  input.runtimeMode === 'ML_PRIMARY' &&
  input.domainState === 'READY' &&
  input.candidateCount > 0;

export const evaluateDomainServingHealth = (
  input: EvaluateDomainServingInput,
): RecommendationDomainServingTruth => {
  const { decision, domainState, finalSectionItemCount } = input;
  const runtimeMode = decision.runtimeMode;
  const candidateCount = decision.diagnostics.candidateCount;
  const expectedToMlRank = isExpectedToMlRank({
    runtimeMode,
    domainState: domainState.state,
    candidateCount,
  });

  let outcome: RecommendationDomainServingTruth['outcome'] = decision.status;
  let health: RecommendationServingHealthKind;
  let mlOwnedFinalOrder = false;

  if (runtimeMode === 'DETERMINISTIC') {
    health = 'EXPLICIT_DETERMINISTIC';
    outcome = decision.status === 'DETERMINISTIC' ? 'DETERMINISTIC' : decision.status;
  } else if (runtimeMode === 'SHADOW') {
    health = 'SHADOW';
  } else if (candidateCount === 0 || decision.reasonCode === 'EMPTY_CANDIDATE_POOL') {
    health = 'EMPTY';
    outcome = 'EMPTY';
  } else if (decision.status === 'ML_RANKED') {
    health = 'ML_SERVED';
    mlOwnedFinalOrder = true;
  } else if (expectedToMlRank) {
    // Domain READY + non-empty pool but not ML_RANKED → degradation.
    health = 'FALLBACK_UNEXPECTED';
  } else if (
    decision.status === 'FALLBACK_NOT_READY' ||
    decision.status === 'FALLBACK_FAILED' ||
    decision.status === 'DETERMINISTIC'
  ) {
    health = 'FALLBACK_EXPECTED';
  } else {
    health = 'NOT_APPLICABLE';
    outcome = 'NOT_APPLICABLE';
  }

  return Object.freeze({
    domain: decision.domain,
    runtimeMode,
    domainState: domainState.state,
    ...(domainState.failureCode
      ? { domainFailureCode: domainState.failureCode }
      : {}),
    outcome,
    ...(decision.reasonCode ? { reasonCode: decision.reasonCode } : {}),
    health,
    expectedToMlRank,
    mlOwnedFinalOrder,
    candidateCount,
    scoredCount: decision.diagnostics.scoredCount,
    mappedCandidateCount: mappedCount(decision),
    unmappedCandidateCount: decision.diagnostics.unmappedCandidateCount,
    omittedMappedCandidateCount: decision.diagnostics.omittedMappedCandidateCount,
    finalSectionItemCount,
    ...(domainState.modelVersion
      ? { modelVersion: domainState.modelVersion }
      : {}),
    ...(domainState.schemaVersion
      ? { schemaVersion: domainState.schemaVersion }
      : {}),
    ...(domainState.semanticContentHash
      ? { semanticContentHash: domainState.semanticContentHash }
      : {}),
    ...(domainState.aggregationMode
      ? { aggregationMode: domainState.aggregationMode }
      : {}),
    ...(domainState.featureContractId
      ? { featureContractId: domainState.featureContractId }
      : {}),
    ...(domainState.featureContractVersion
      ? { featureContractVersion: domainState.featureContractVersion }
      : {}),
  });
};

export const evaluateRequestServingHealth = (input: {
  snapshot: RecommendationMlRuntimeSnapshot;
  materialDecision: LearnerHomeMlOrderingDecision;
  projectDecision: LearnerHomeMlOrderingDecision;
  materialFinalSectionItemCount: number;
  projectFinalSectionItemCount: number;
}): RecommendationRequestServingTruth => {
  const material = evaluateDomainServingHealth({
    decision: input.materialDecision,
    domainState: input.snapshot.material,
    finalSectionItemCount: input.materialFinalSectionItemCount,
  });
  const project = evaluateDomainServingHealth({
    decision: input.projectDecision,
    domainState: input.snapshot.project,
    finalSectionItemCount: input.projectFinalSectionItemCount,
  });

  const hasUnexpectedFallback =
    material.health === 'FALLBACK_UNEXPECTED' ||
    project.health === 'FALLBACK_UNEXPECTED';

  let overallHealth: RecommendationServingHealthKind;
  if (hasUnexpectedFallback) {
    overallHealth = 'FALLBACK_UNEXPECTED';
  } else if (
    material.health === 'ML_SERVED' ||
    project.health === 'ML_SERVED'
  ) {
    overallHealth = 'ML_SERVED';
  } else if (
    material.health === 'EXPLICIT_DETERMINISTIC' &&
    project.health === 'EXPLICIT_DETERMINISTIC'
  ) {
    overallHealth = 'EXPLICIT_DETERMINISTIC';
  } else if (material.health === 'SHADOW' && project.health === 'SHADOW') {
    overallHealth = 'SHADOW';
  } else if (
    material.health === 'FALLBACK_EXPECTED' ||
    project.health === 'FALLBACK_EXPECTED'
  ) {
    overallHealth = 'FALLBACK_EXPECTED';
  } else if (material.health === 'EMPTY' && project.health === 'EMPTY') {
    overallHealth = 'EMPTY';
  } else {
    overallHealth = 'NOT_APPLICABLE';
  }

  return Object.freeze({
    runtimeMode: input.snapshot.mode,
    material,
    project,
    overallHealth,
    hasUnexpectedFallback,
  });
};

/** Outcome counters for coverage reporting (exposure/outbox/smoke). */
export type RecommendationServingOutcomeBucket =
  | 'ML_RANKED'
  | 'FALLBACK_NOT_READY'
  | 'FALLBACK_FAILED'
  | 'DETERMINISTIC'
  | 'SHADOW'
  | 'EMPTY'
  | 'NOT_APPLICABLE';

export const bucketServingOutcome = (
  truth: RecommendationDomainServingTruth,
): RecommendationServingOutcomeBucket => {
  if (truth.outcome === 'ML_RANKED') return 'ML_RANKED';
  if (truth.outcome === 'FALLBACK_NOT_READY') return 'FALLBACK_NOT_READY';
  if (truth.outcome === 'FALLBACK_FAILED') return 'FALLBACK_FAILED';
  if (truth.outcome === 'SHADOW') return 'SHADOW';
  if (truth.outcome === 'EMPTY') return 'EMPTY';
  if (truth.outcome === 'DETERMINISTIC') return 'DETERMINISTIC';
  return 'NOT_APPLICABLE';
};

export type ServingCoverageCounts = Readonly<
  Record<RecommendationServingOutcomeBucket, number>
>;

export const emptyServingCoverageCounts = (): ServingCoverageCounts =>
  Object.freeze({
    ML_RANKED: 0,
    FALLBACK_NOT_READY: 0,
    FALLBACK_FAILED: 0,
    DETERMINISTIC: 0,
    SHADOW: 0,
    EMPTY: 0,
    NOT_APPLICABLE: 0,
  });

export const accumulateServingCoverage = (
  counts: ServingCoverageCounts,
  truth: RecommendationDomainServingTruth,
): ServingCoverageCounts => {
  const bucket = bucketServingOutcome(truth);
  return Object.freeze({
    ...counts,
    [bucket]: counts[bucket] + 1,
  });
};

export const summarizeServingCoverage = (
  counts: ServingCoverageCounts,
): Readonly<{
  total: number;
  mlRankedRate: number;
  unexpectedFallbackHint: boolean;
  counts: ServingCoverageCounts;
}> => {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  return Object.freeze({
    total,
    mlRankedRate: total === 0 ? 0 : counts.ML_RANKED / total,
    unexpectedFallbackHint: false,
    counts,
  });
};

/**
 * Parse durable algorithmVersion stamps (`sm=` / `sp=`) into outcome buckets.
 * Compatible with exposure/outbox rows that only persist algorithmVersion.
 */
export const parseServingTokenToOutcome = (
  token: string | undefined,
): RecommendationServingOutcomeBucket => {
  switch (token) {
    case 'ml-primary':
      return 'ML_RANKED';
    case 'fb-not-ready':
      return 'FALLBACK_NOT_READY';
    case 'fb-failed':
      return 'FALLBACK_FAILED';
    case 'shadow':
      return 'SHADOW';
    case 'deterministic':
      return 'DETERMINISTIC';
    default:
      return 'NOT_APPLICABLE';
  }
};

export const parseDomainServingTokensFromAlgorithmVersion = (
  algorithmVersion: string,
): Readonly<{
  material: RecommendationServingOutcomeBucket;
  project: RecommendationServingOutcomeBucket;
}> => {
  const material = algorithmVersion.match(/(?:^|;)sm=([^;]+)/)?.[1];
  const project = algorithmVersion.match(/(?:^|;)sp=([^;]+)/)?.[1];
  return Object.freeze({
    material: parseServingTokenToOutcome(material),
    project: parseServingTokenToOutcome(project),
  });
};

export const accumulateCoverageFromAlgorithmVersions = (
  versions: readonly string[],
): Readonly<{
  material: ServingCoverageCounts;
  project: ServingCoverageCounts;
  materialSummary: ReturnType<typeof summarizeServingCoverage>;
  projectSummary: ReturnType<typeof summarizeServingCoverage>;
}> => {
  let material = emptyServingCoverageCounts();
  let project = emptyServingCoverageCounts();
  for (const version of versions) {
    const tokens = parseDomainServingTokensFromAlgorithmVersion(version);
    material = Object.freeze({
      ...material,
      [tokens.material]: material[tokens.material] + 1,
    });
    project = Object.freeze({
      ...project,
      [tokens.project]: project[tokens.project] + 1,
    });
  }
  return Object.freeze({
    material,
    project,
    materialSummary: summarizeServingCoverage(material),
    projectSummary: summarizeServingCoverage(project),
  });
};

/**
 * Candidate-pool soft-gate instrumentation (score > 0).
 * Classifies zero-score removals without changing ranking.
 */
export type SoftScoreGateClass =
  | 'VALID_SURFACE_EXCLUSION'
  | 'LOW_DETERMINISTIC_PREFERENCE'
  | 'HARD_ELIGIBILITY_AS_SCORE'
  | 'UNKNOWN';

export type SoftScoreGateAudit = Readonly<{
  hardEligibleCount: number;
  softEligibleCount: number;
  excludedByScoreZeroCount: number;
  exclusionRate: number;
  classification: SoftScoreGateClass;
  note: string;
}>;

export const auditSoftScoreGate = (input: {
  hardEligibleCount: number;
  softEligibleCount: number;
}): SoftScoreGateAudit => {
  const excluded = Math.max(
    0,
    input.hardEligibleCount - input.softEligibleCount,
  );
  const exclusionRate =
    input.hardEligibleCount === 0 ? 0 : excluded / input.hardEligibleCount;

  // Heuristic only: high exclusion rates warrant investigation as hidden preference.
  let classification: SoftScoreGateClass = 'UNKNOWN';
  let note =
    'score>0 retained as suggestion-surface gate; measure before changing.';
  if (excluded === 0) {
    classification = 'VALID_SURFACE_EXCLUSION';
    note = 'No candidates removed by score>0 under this sample.';
  } else if (exclusionRate >= 0.35) {
    classification = 'LOW_DETERMINISTIC_PREFERENCE';
    note =
      'Substantial share of hard-eligible candidates never reach ML; investigate whether score>0 hides ML-rankable items.';
  } else {
    classification = 'VALID_SURFACE_EXCLUSION';
    note =
      'Moderate score>0 exclusion; treat as surface filter unless quality eval shows harm.';
  }

  return Object.freeze({
    hardEligibleCount: input.hardEligibleCount,
    softEligibleCount: input.softEligibleCount,
    excludedByScoreZeroCount: excluded,
    exclusionRate,
    classification,
    note,
  });
};

export type RankPoolCapAudit = Readonly<{
  softEligibleCount: number;
  poolCap: number;
  truncated: boolean;
  truncatedCount: number;
  truncationRate: number;
  note: string;
}>;

export const auditRankPoolCap = (input: {
  softEligibleCount: number;
  poolCap: number;
}): RankPoolCapAudit => {
  const truncatedCount = Math.max(0, input.softEligibleCount - input.poolCap);
  const truncated = truncatedCount > 0;
  return Object.freeze({
    softEligibleCount: input.softEligibleCount,
    poolCap: input.poolCap,
    truncated,
    truncatedCount,
    truncationRate:
      input.softEligibleCount === 0
        ? 0
        : truncatedCount / input.softEligibleCount,
    note: truncated
      ? 'Cap truncates soft-eligible pool before ML; after Slice A pool is score-sorted not tier-gated, so truncation still biases recall toward higher deterministic scores.'
      : 'Cap does not truncate this sample.',
  });
};
