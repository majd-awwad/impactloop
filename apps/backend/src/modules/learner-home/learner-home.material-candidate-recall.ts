import { HOME_MATERIAL_POOL_CAP } from './learner-home.repository.js';
import type { PreScoredMaterialEntry } from './learner-home.material-features.js';
import type { RecommendationMlRuntimeSnapshot } from '../recommendations/ml-runtime-state.service.js';

/** Bounded ML recall cap aligned with upstream DB retrieval (no hidden pre-ML truncation at 48). */
export const ML_MATERIAL_RECALL_CAP = HOME_MATERIAL_POOL_CAP;

/** Deterministic display/fallback pool cap (unchanged product semantics). */
export const DETERMINISTIC_MATERIAL_RANK_POOL_SIZE = 48;

export type MaterialPreMlExclusionReason =
  | 'HARD_INELIGIBLE'
  | 'SURFACE_INELIGIBLE'
  | 'RECALL_CAP';

export type RankedMaterialEntry = {
  type: 'material';
  score: number;
  reasons: string[];
  tier: number;
  hasPrimaryRelevance: boolean;
  fallbackOnly: boolean;
  material: Record<string, unknown>;
  ownerId: string;
};

export const mapPreScoredToRankedEntry = (
  entry: PreScoredMaterialEntry,
  scoreKey: keyof PreScoredMaterialEntry['scores'] = 'suggested',
): RankedMaterialEntry => {
  const scored = entry.scores[scoreKey];
  return {
    type: 'material',
    score: scored.score,
    reasons: scored.reasons,
    tier: scored.tier ?? 5,
    hasPrimaryRelevance: scored.hasPrimaryRelevance ?? false,
    fallbackOnly: scored.fallbackOnly ?? false,
    material: entry.material.mapped,
    ownerId: entry.ownerId,
  };
};

export type MaterialSurfaceEligibilityAssessment =
  | Readonly<{ eligible: true }>
  | Readonly<{
      eligible: false;
      reason: MaterialPreMlExclusionReason;
      detail: string;
    }>;

/**
 * Hard + suggestion-surface eligibility for ML-primary recall.
 * Deterministic preference (score <= 0) is intentionally NOT a surface gate.
 */
export const assessMaterialSuggestionSurfaceEligibility = (
  entry: PreScoredMaterialEntry,
): MaterialSurfaceEligibilityAssessment => {
  const material = entry.material;
  if (material.status !== 'AVAILABLE') {
    return {
      eligible: false,
      reason: 'HARD_INELIGIBLE',
      detail: 'material_status_not_available',
    };
  }
  if (material.availableQuantity <= 0) {
    return {
      eligible: false,
      reason: 'HARD_INELIGIBLE',
      detail: 'zero_available_quantity',
    };
  }
  return { eligible: true };
};

/** Stable, non-personalized recall ordering (catalog identity, not deterministic score). */
export const compareNeutralMaterialRecallOrder = (
  left: RankedMaterialEntry,
  right: RankedMaterialEntry,
): number => {
  const leftId = String(left.material.id ?? '');
  const rightId = String(right.material.id ?? '');
  const byId = leftId.localeCompare(rightId);
  if (byId !== 0) {
    return byId;
  }
  return left.ownerId.localeCompare(right.ownerId);
};

export type MaterialCandidateRecallAudit = Readonly<{
  hardEligibleCount: number;
  surfaceEligibleCount: number;
  excludedBySurfaceCount: number;
  mlRecallPoolCount: number;
  excludedByRecallCapCount: number;
  recallCap: number;
  surfaceExclusionDetails: Readonly<Record<string, number>>;
  note: string;
}>;

export type MaterialCandidateRecallComparisonAudit = Readonly<
  MaterialCandidateRecallAudit & {
    /** Legacy deterministic score>0 gate size (for before/after diagnostics). */
    deterministicSoftEligibleCount: number;
    excludedByDeterministicScoreGateCount: number;
    deterministicRankPoolCount: number;
    deterministicRankPoolCap: number;
    excludedByDeterministicRankPoolCapCount: number;
  }
>;

const buildSurfaceEligibleEntries = (
  entries: readonly PreScoredMaterialEntry[],
): {
  eligible: RankedMaterialEntry[];
  exclusionDetails: Record<string, number>;
} => {
  const eligible: RankedMaterialEntry[] = [];
  const exclusionDetails: Record<string, number> = {};

  for (const entry of entries) {
    const assessment = assessMaterialSuggestionSurfaceEligibility(entry);
    if (!assessment.eligible) {
      const key = `${assessment.reason}:${assessment.detail}`;
      exclusionDetails[key] = (exclusionDetails[key] ?? 0) + 1;
      continue;
    }
    eligible.push(mapPreScoredToRankedEntry(entry, 'suggested'));
  }

  return { eligible, exclusionDetails };
};

/**
 * ML-primary bounded recall: all surface-eligible materials in neutral stable order.
 * Does not filter score <= 0 or sort by deterministic preference.
 */
export const buildMlPrimaryMaterialRecallPool = (
  entries: readonly PreScoredMaterialEntry[],
  options: {
    cap?: number;
    browseAll?: boolean;
  } = {},
): Readonly<{ pool: RankedMaterialEntry[]; audit: MaterialCandidateRecallAudit }> => {
  const recallCap = options.browseAll
    ? entries.length
    : Math.max(1, options.cap ?? ML_MATERIAL_RECALL_CAP);
  const { eligible, exclusionDetails } = buildSurfaceEligibleEntries(entries);
  const sorted = [...eligible].sort(compareNeutralMaterialRecallOrder);
  const pool = sorted.slice(0, recallCap);
  const excludedByRecallCapCount = Math.max(0, sorted.length - pool.length);

  return Object.freeze({
    pool,
    audit: Object.freeze({
      hardEligibleCount: entries.length,
      surfaceEligibleCount: eligible.length,
      excludedBySurfaceCount: entries.length - eligible.length,
      mlRecallPoolCount: pool.length,
      excludedByRecallCapCount,
      recallCap,
      surfaceExclusionDetails: Object.freeze({ ...exclusionDetails }),
      note:
        excludedByRecallCapCount > 0
          ? 'Neutral-order recall cap applied; membership not determined by deterministic score.'
          : 'All surface-eligible materials reach ML recall without deterministic score gate.',
    }),
  });
};

/**
 * Deterministic suggestion pool: score > 0, tier-aware sort, legacy top-N cap.
 * Preserved for DETERMINISTIC mode, ML fallback display, and SHADOW comparisons.
 */
export const buildDeterministicSuggestedMaterialCandidatePool = (
  entries: readonly PreScoredMaterialEntry[],
  rankPreScoredMaterialEntries: (
    items: PreScoredMaterialEntry[],
    scoreKey: 'suggested',
    useTieredSuggestedRanking: boolean,
    browseAllTierSort: boolean,
  ) => RankedMaterialEntry[],
  browseAll: boolean,
): RankedMaterialEntry[] => {
  const ranked = rankPreScoredMaterialEntries(
    [...entries],
    'suggested',
    true,
    true,
  );
  const cap = browseAll ? ranked.length : DETERMINISTIC_MATERIAL_RANK_POOL_SIZE;
  return ranked.slice(0, cap);
};

export const resolveSuggestedMaterialCandidatePoolForServing = (input: {
  entries: readonly PreScoredMaterialEntry[];
  runtimeMode: RecommendationMlRuntimeSnapshot['mode'];
  browseAll: boolean;
  rankPreScoredMaterialEntries: (
    items: PreScoredMaterialEntry[],
    scoreKey: 'suggested',
    useTieredSuggestedRanking: boolean,
    browseAllTierSort: boolean,
  ) => RankedMaterialEntry[];
}): Readonly<{ pool: RankedMaterialEntry[]; audit: MaterialCandidateRecallComparisonAudit }> => {
  const mlRecall = buildMlPrimaryMaterialRecallPool(input.entries, {
    browseAll: input.browseAll,
  });
  const deterministicSoftEligible = input.rankPreScoredMaterialEntries(
    [...input.entries],
    'suggested',
    true,
    true,
  );
  const deterministicPool = buildDeterministicSuggestedMaterialCandidatePool(
    [...input.entries],
    input.rankPreScoredMaterialEntries,
    input.browseAll,
  );

  const comparison = Object.freeze({
    ...mlRecall.audit,
    deterministicSoftEligibleCount: deterministicSoftEligible.length,
    excludedByDeterministicScoreGateCount: Math.max(
      0,
      input.entries.length - deterministicSoftEligible.length,
    ),
    deterministicRankPoolCount: deterministicPool.length,
    deterministicRankPoolCap: input.browseAll
      ? deterministicSoftEligible.length
      : DETERMINISTIC_MATERIAL_RANK_POOL_SIZE,
    excludedByDeterministicRankPoolCapCount: Math.max(
      0,
      deterministicSoftEligible.length - deterministicPool.length,
    ),
  });

  if (input.runtimeMode === 'ML_PRIMARY') {
    return Object.freeze({ pool: mlRecall.pool, audit: comparison });
  }

  return Object.freeze({ pool: deterministicPool, audit: comparison });
};
