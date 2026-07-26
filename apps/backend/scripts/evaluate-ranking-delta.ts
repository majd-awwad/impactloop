/**
 * RP-03.3 — Controlled ranking delta evaluator.
 *
 * Read-only, evaluation-only CLI harness that compares legacy-v1,
 * normalized-interests-v2, and canonical-taxonomy-v3 material and project
 * scoring on one frozen candidate pool per learner. It never mutates the
 * database, never mutates process.env.RECOMMENDATION_SCORER_VERSION, and
 * never writes to the Learner Home cache or the frozen recommendation
 * baseline.
 *
 * Architectural notes (see docs/recommendation plan for full rationale):
 *  - Candidates are retrieved exactly once per domain and reused, in their
 *    original retrieval order, across all three scorer modes. Order is never
 *    re-sorted; only separate canonicalized copies are used for digests.
 *  - Scorer mode is selected via existing explicit-mode parameters
 *    (`resolveMaterialModeDecisionAndContext`, `preScoreMaterials`,
 *    `rankProjects` + `scoreSuggestedProject`) — process.env is never
 *    mutated.
 *  - Project ranking reuses the real, now-exported production combinator
 *    `rankProjects` (apps/backend/src/modules/learner-home/learner-home.service.ts)
 *    instead of a local mirror. Because `rankProjects` internally maps its
 *    `scorer` argument over *every* input project before filtering by
 *    `score > 0`, a small recording wrapper passed as that `scorer` yields
 *    the complete raw "scoringIdentity" snapshot as a side effect of the
 *    single production call — no second scoring pass.
 *  - Materials and projects are validated at a "scoringIdentity" stage
 *    (every frozen candidate must produce exactly one raw score) before any
 *    "rankingEligibility" filtering (e.g. a project's `score <= 0`) is
 *    interpreted as expected behavior rather than a missing result.
 *  - Project retrieval is ordered only by `createdAt DESC` with no id
 *    tiebreak (verified in learner-home.repository.ts). This evaluator does
 *    not modify that query; instead it detects `createdAt` ties in the
 *    frozen pool and fails the *project ranking* portion closed rather than
 *    publishing unreliable "reproducible" evidence.
 *  - The output JSON never contains a wall-clock-derived field: every
 *    timestamp is the explicit `--evaluation-time`. Legacy/normalized
 *    recency scoring reads bare `Date.now()`, and canonical scoring falls
 *    back to a bare `new Date()` when no `now` is threaded through (the
 *    reused `preScoreMaterials` wrapper does not expose a `now` parameter).
 *    Because `new Date()` with no arguments does not consult an overridden
 *    static `Date.now`, this evaluator temporarily replaces the global
 *    `Date` constructor itself (scoped to the synchronous scoring calls,
 *    restored in a `finally`) so both call styles observe the same frozen
 *    instant.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type {
  LearnerHomeContext,
} from '../src/modules/learner-home/learner-home.service.js';
import type {
  LearnerBehaviorContext,
  LearnerHomeMaterialCandidate,
  LearnerHomeProjectCandidate,
} from '../src/modules/learner-home/learner-home.types.js';
import type {
  CanonicalFallbackCode,
  CanonicalMaterialCoverage,
  CanonicalMaterialScoringContext,
} from '../src/modules/learner-home/learner-home.canonical-scoring.js';
import type { PreScoredMaterialEntry } from '../src/modules/learner-home/learner-home.material-features.js';
import type { ScoredMaterialResult, ScoredProjectResult } from '../src/modules/learner-home/learner-home.scoring.js';
import type { RecommendationScorerVersion } from '../src/config/recommendation-scoring-version.js';

export const EVALUATOR_VERSION = 'ranking-delta-evaluator-v1' as const;

export const REQUESTED_MODES = [
  'legacy-v1',
  'normalized-interests-v2',
  'canonical-taxonomy-v3',
] as const;

const CANONICAL_MODE = 'canonical-taxonomy-v3' as const;

/** Cap for `largestUpwardMovements`/`largestDownwardMovements`. */
const MAX_MOVEMENT_HIGHLIGHTS = 5;

/**
 * Cap for the bounded reason/component detail sample per pairwise
 * comparison (section 2): union of both modes' Top-K plus the largest true
 * upward/downward movements, deterministically truncated at this limit.
 */
const DETAIL_SAMPLE_LIMIT = 20;

const CANONICAL_FALLBACK_CODES = [
  'CANONICAL_LOADER_FALLBACK_LEGACY_V1',
  'CANONICAL_CONTEXT_INVARIANT_FALLBACK',
  'CANONICAL_SCORER_INVARIANT_FALLBACK',
] as const;

const CANONICAL_COVERAGE_KEYS: readonly CanonicalMaterialCoverage[] = [
  'READY_FAMILY_AND_FORM',
  'READY_FAMILY_ONLY',
  'MISSING_CANONICAL_ASSIGNMENT',
  'INVALID_FAMILY_CARDINALITY',
  'INVALID_OR_DEFECTIVE',
];

const SCORE_BUCKETS = ['suggested', 'savedProjects', 'free'] as const;
export type ScoreBucket = (typeof SCORE_BUCKETS)[number];

const POOL_SCOPES = ['home', 'browse'] as const;
export type PoolScope = (typeof POOL_SCOPES)[number];

/* -------------------------------------------------------------------------
 * Material ranking-surface resolution.
 *
 * `--pool` alone does not define ranking behavior for every score bucket:
 * production (`learner-home.service.ts`) dispatches `suggested` differently
 * for the full-Home section (`rankSuggested` -> `rankPreScoredMaterialEntries`
 * with `useTieredSuggestedRanking=true, browseAllTierSort=false`, i.e.
 * `selectTieredSuggestedMaterials`) versus the paged browse-all section
 * (`rankMaterialsPageFromPreScored` -> always `useTieredSuggestedRanking=true,
 * browseAllTierSort=true`, i.e. `sortAllRankedMaterials`). The `savedProjects`
 * and `free` buckets (`rankSaved`/`rankFree`) always use
 * `useTieredSuggestedRanking=true, browseAllTierSort=true` regardless of Home
 * vs Browse — for those two buckets `--pool` only ever selects the candidate
 * pool cap (`HOME_MATERIAL_POOL_CAP` vs `BROWSE_MATERIAL_POOL_CAP`), never
 * ranking behavior. This resolver makes that distinction explicit instead of
 * silently claiming Home ranking while applying Browse-all ordering (or vice
 * versa).
 * ---------------------------------------------------------------------- */

export type MaterialRankingSurface = {
  useTieredSuggestedRanking: boolean;
  browseAllTierSort: boolean;
  poolScopeAffectsRanking: boolean;
  productionEquivalent: string;
};

export const resolveMaterialRankingSurface = (
  scoreBucket: ScoreBucket,
  poolScope: PoolScope,
): MaterialRankingSurface => {
  if (scoreBucket === 'suggested') {
    return poolScope === 'browse'
      ? {
          useTieredSuggestedRanking: true,
          browseAllTierSort: true,
          poolScopeAffectsRanking: true,
          productionEquivalent:
            'suggested_materials browse-all page (rankMaterialsPageFromPreScored -> sortAllRankedMaterials)',
        }
      : {
          useTieredSuggestedRanking: true,
          browseAllTierSort: false,
          poolScopeAffectsRanking: true,
          productionEquivalent:
            'suggested_materials full-Home section (rankSuggested -> selectTieredSuggestedMaterials)',
        };
  }

  return {
    useTieredSuggestedRanking: true,
    browseAllTierSort: true,
    poolScopeAffectsRanking: false,
    productionEquivalent:
      scoreBucket === 'savedProjects'
        ? 'materials_for_saved_projects section (rankSaved -> sortAllRankedMaterials; --pool only selects the candidate pool cap for this bucket)'
        : 'free_materials_near_you section (rankFree -> sortAllRankedMaterials; --pool only selects the candidate pool cap for this bucket)',
  };
};

/* -------------------------------------------------------------------------
 * CLI error type + argument parsing (pure)
 * ---------------------------------------------------------------------- */

export class EvaluatorCliError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'EvaluatorCliError';
  }
}

const failCli = (code: string, message: string): never => {
  throw new EvaluatorCliError(code, message);
};

export const canonicalizeEvaluationTime = (value: string): string => {
  if (!value.endsWith('Z')) {
    failCli(
      'INVALID_EVALUATION_TIME',
      'Evaluation time must be an ISO-8601 UTC timestamp ending in Z.',
    );
  }
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    failCli('INVALID_EVALUATION_TIME', `Invalid evaluation time: ${value}`);
  }
  return new Date(ms).toISOString();
};

export type EvaluatorCliOptions = {
  userId?: string;
  email?: string;
  evaluationTimeUtc: string;
  topK: number;
  poolScope: PoolScope;
  scoreBucket: ScoreBucket;
  reportPath?: string;
};

const requireValue = (args: string[], index: number, flag: string): string => {
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) {
    failCli('CLI_USAGE', `${flag} requires a value.`);
  }
  return value;
};

export const parseCliArgs = (args: string[]): EvaluatorCliOptions => {
  let userId: string | undefined;
  let email: string | undefined;
  let evaluationTimeUtc: string | undefined;
  let topK = 10;
  let poolScope: PoolScope = 'home';
  let scoreBucket: ScoreBucket = 'suggested';
  let reportPath: string | undefined;
  const seen = new Set<string>();

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (!argument.startsWith('--')) {
      failCli('CLI_USAGE', `Unexpected positional argument: ${argument}`);
    }
    if (seen.has(argument)) {
      failCli('CLI_USAGE', `Duplicate argument: ${argument}`);
    }
    seen.add(argument);

    switch (argument) {
      case '--user-id':
        userId = requireValue(args, index, argument);
        index += 1;
        break;
      case '--email':
        email = requireValue(args, index, argument);
        index += 1;
        break;
      case '--evaluation-time':
        evaluationTimeUtc = canonicalizeEvaluationTime(
          requireValue(args, index, argument),
        );
        index += 1;
        break;
      case '--top-k': {
        const raw = requireValue(args, index, argument);
        const parsed = Number(raw);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
          failCli('CLI_USAGE', '--top-k must be an integer between 1 and 100.');
        }
        topK = parsed;
        index += 1;
        break;
      }
      case '--pool': {
        const raw = requireValue(args, index, argument);
        if (!(POOL_SCOPES as readonly string[]).includes(raw)) {
          failCli('CLI_USAGE', `--pool must be one of: ${POOL_SCOPES.join(', ')}`);
        }
        poolScope = raw as PoolScope;
        index += 1;
        break;
      }
      case '--score-bucket': {
        const raw = requireValue(args, index, argument);
        if (!(SCORE_BUCKETS as readonly string[]).includes(raw)) {
          failCli('CLI_USAGE', `--score-bucket must be one of: ${SCORE_BUCKETS.join(', ')}`);
        }
        scoreBucket = raw as ScoreBucket;
        index += 1;
        break;
      }
      case '--report':
        reportPath = resolve(requireValue(args, index, argument));
        index += 1;
        break;
      default:
        failCli('CLI_USAGE', `Unknown argument: ${argument}`);
    }
  }

  if (!userId && !email) {
    failCli('CLI_USAGE', 'Exactly one of --user-id or --email is required.');
  }
  if (userId && email) {
    failCli('CLI_USAGE', 'Provide only one of --user-id or --email, not both.');
  }
  if (!evaluationTimeUtc) {
    failCli('CLI_USAGE', '--evaluation-time is required.');
  }

  return {
    userId,
    email,
    evaluationTimeUtc: evaluationTimeUtc as string,
    topK,
    poolScope,
    scoreBucket,
    reportPath,
  };
};

/* -------------------------------------------------------------------------
 * Pure canonical-JSON serialization + stable hashing (owned locally; not
 * imported from benchmark-learner-home.ts to avoid inter-script coupling).
 * ---------------------------------------------------------------------- */

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const canonicalJson = (value: unknown): string => {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Canonical JSON cannot contain non-finite numbers.');
    }
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (isPlainRecord(value)) {
    const entries = Object.keys(value)
      .sort()
      .map((key) => {
        const entry = value[key];
        if (entry === undefined) {
          throw new Error(`Canonical JSON cannot contain undefined at key "${key}".`);
        }
        return `${JSON.stringify(key)}:${canonicalJson(entry)}`;
      });
    return `{${entries.join(',')}}`;
  }
  throw new Error(`Unsupported canonical JSON value: ${typeof value}`);
};

export const stableHash = (value: unknown): string =>
  `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;

export const hashIdentity = (value: string): string =>
  `sha256:${createHash('sha256').update(value).digest('hex')}`;

const writeJsonAtomically = (path: string, value: unknown): void => {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    renameSync(temporaryPath, path);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
};

/* -------------------------------------------------------------------------
 * Digests: retrieval-order (order-preserving) vs identity (sorted-unique).
 * Both operate on separate copies of id arrays; neither ever reorders the
 * scoring-input arrays themselves.
 * ---------------------------------------------------------------------- */

export const digestOrderedIds = (ids: readonly string[]): string =>
  stableHash({ orderedIds: [...ids] });

export const digestIdentitySet = (ids: readonly string[]): string =>
  stableHash({ sortedUniqueIds: [...new Set(ids)].sort() });

export const arraysEqual = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/**
 * Canonical (sorted, de-duplicated) representation of a *set-like* id list.
 * Used for every reported id list that represents membership (scoringIdentity
 * diagnostics, ranking-eligibility membership) rather than a meaningful
 * production order, so incidental retrieval/iteration order never leaks into
 * the reproducibility hash. Never applied to `rankedCandidateIds`, which is
 * order-significant by definition.
 */
export const sortedUniqueIds = (ids: readonly string[]): string[] => [...new Set(ids)].sort();

/* -------------------------------------------------------------------------
 * Scoring identity: raw-score presence per frozen candidate, independent of
 * any ranking-eligibility filter applied afterward.
 * ---------------------------------------------------------------------- */

export type ScoringIdentityResult = {
  inputCandidateCount: number;
  scoredCandidateCount: number;
  missingScoreIds: string[];
  extraScoreIds: string[];
  duplicateScoreIds: string[];
  identityMatch: boolean;
};

export const computeScoringIdentity = (
  frozenIds: readonly string[],
  scoredIds: readonly string[],
): ScoringIdentityResult => {
  const frozenSet = new Set(frozenIds);
  const seen = new Set<string>();
  const duplicateScoreIds = new Set<string>();
  for (const id of scoredIds) {
    if (seen.has(id)) {
      duplicateScoreIds.add(id);
    }
    seen.add(id);
  }
  const missingScoreIds = sortedUniqueIds(frozenIds.filter((id) => !seen.has(id)));
  const extraScoreIds = sortedUniqueIds([...seen].filter((id) => !frozenSet.has(id)));
  const identityMatch =
    missingScoreIds.length === 0 &&
    extraScoreIds.length === 0 &&
    duplicateScoreIds.size === 0 &&
    seen.size === frozenSet.size;

  return {
    inputCandidateCount: frozenIds.length,
    scoredCandidateCount: scoredIds.length,
    missingScoreIds,
    extraScoreIds,
    duplicateScoreIds: sortedUniqueIds([...duplicateScoreIds]),
    identityMatch,
  };
};

/* -------------------------------------------------------------------------
 * Project retrieval-order ambiguity detection (pure, order-independent).
 * ---------------------------------------------------------------------- */

export type ProjectRetrievalTieGroup = {
  createdAtIso: string;
  projectIdsSortedAscending: string[];
};

export const detectProjectRetrievalTies = (
  projects: ReadonlyArray<{ id: string; createdAt: Date }>,
): ProjectRetrievalTieGroup[] => {
  const groups = new Map<string, string[]>();
  for (const project of projects) {
    const key = project.createdAt.toISOString();
    const list = groups.get(key);
    if (list) {
      list.push(project.id);
    } else {
      groups.set(key, [project.id]);
    }
  }
  return [...groups.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([createdAtIso, ids]) => ({
      createdAtIso,
      projectIdsSortedAscending: [...ids].sort(),
    }))
    .sort((a, b) => a.createdAtIso.localeCompare(b.createdAtIso));
};

/* -------------------------------------------------------------------------
 * Ranking-delta math: rank indexing is one-based; ties are never
 * re-broken by the evaluator (see rankedIds construction in the
 * orchestration section, which reuses production comparators verbatim).
 * ---------------------------------------------------------------------- */

export type RankedEntry = { id: string; rank: number; score: number; tier?: number };

export const buildRankedEntries = (
  orderedIds: readonly string[],
  scoreById: ReadonlyMap<string, number>,
  tierById?: ReadonlyMap<string, number>,
): RankedEntry[] =>
  orderedIds.map((id, index) => ({
    id,
    rank: index + 1,
    score: scoreById.get(id) ?? NaN,
    tier: tierById?.get(id),
  }));

export type TiedCandidateGroup = {
  tier: number | null;
  score: number;
  candidateIdsInProductionOrder: string[];
};

export const computeTiedGroups = (ranked: readonly RankedEntry[]): TiedCandidateGroup[] => {
  const groups = new Map<string, { tier: number | null; score: number; ids: string[] }>();
  for (const entry of ranked) {
    const tierKey = entry.tier ?? null;
    const key = `${tierKey}:${entry.score}`;
    const existing = groups.get(key);
    if (existing) {
      existing.ids.push(entry.id);
    } else {
      groups.set(key, { tier: tierKey, score: entry.score, ids: [entry.id] });
    }
  }
  return [...groups.values()]
    .filter((group) => group.ids.length > 1)
    .map((group) => ({
      tier: group.tier,
      score: group.score,
      candidateIdsInProductionOrder: group.ids,
    }));
};

export type RankMovement = {
  id: string;
  rankInA: number;
  rankInB: number;
  rankMovement: number;
  absoluteRankMovement: number;
  scoreDiff: number;
};

export type PairwiseDelta = {
  /** Requested Top-K from CLI / configuration. */
  requestedK: number;
  /** @deprecated Prefer requestedK / topKCountA / topKCountB. Alias of requestedK for older readers. */
  topK: number;
  /** @deprecated Prefer topKCountA / topKCountB. Equals max(topKCountA, topKCountB). */
  effectiveK: number;
  topKCountA: number;
  topKCountB: number;
  truncatedInA: boolean;
  truncatedInB: boolean;
  /** @deprecated Prefer truncatedInA / truncatedInB. True when either side is truncated. */
  truncatedByPoolSize: boolean;
  overlapCount: number;
  /**
   * overlapCount / max(topKCountA, topKCountB), or 0 when both Top-K sets are
   * empty. Does not report 1.0 merely because the shorter ranking is a subset
   * of the longer ranking.
   */
  overlapRatio: number;
  entering: string[];
  leaving: string[];
  rankMovements: RankMovement[];
  largestUpwardMovements: RankMovement[];
  largestDownwardMovements: RankMovement[];
  unchangedCandidates: string[];
};

export const computePairwiseDelta = (
  rankedA: readonly RankedEntry[],
  rankedB: readonly RankedEntry[],
  k: number,
): PairwiseDelta => {
  // Each mode's Top-K is computed independently: a shorter ranked list must
  // never truncate the longer mode's Top-K window (that previously hid
  // valid candidates and falsely reported full overlap).
  const topKCountA = Math.min(k, rankedA.length);
  const topKCountB = Math.min(k, rankedB.length);
  const truncatedInA = rankedA.length < k;
  const truncatedInB = rankedB.length < k;

  const topA = new Set(rankedA.slice(0, topKCountA).map((entry) => entry.id));
  const topB = new Set(rankedB.slice(0, topKCountB).map((entry) => entry.id));
  const overlapCount = [...topA].filter((id) => topB.has(id)).length;
  const denominator = Math.max(topKCountA, topKCountB);
  const overlapRatio = denominator === 0 ? 0 : overlapCount / denominator;
  const entering = [...topB].filter((id) => !topA.has(id)).sort();
  const leaving = [...topA].filter((id) => !topB.has(id)).sort();

  const rankByIdB = new Map(rankedB.map((entry) => [entry.id, entry]));
  const rankMovements: RankMovement[] = [];
  for (const entryA of rankedA) {
    const entryB = rankByIdB.get(entryA.id);
    if (!entryB) continue;
    const rankMovement = entryA.rank - entryB.rank;
    rankMovements.push({
      id: entryA.id,
      rankInA: entryA.rank,
      rankInB: entryB.rank,
      rankMovement,
      absoluteRankMovement: Math.abs(rankMovement),
      scoreDiff: entryB.score - entryA.score,
    });
  }

  // Only true-direction movements ever populate these lists — an unchanged
  // or opposite-direction candidate must never be included merely to reach
  // the cap. Equal-magnitude ties break deterministically by rankInA then by
  // candidate ID, without altering the production ranking itself (this
  // ordering exists only inside this diagnostic list).
  const largestUpwardMovements = [...rankMovements]
    .filter((movement) => movement.rankMovement > 0)
    .sort(
      (left, right) =>
        right.rankMovement - left.rankMovement ||
        left.rankInA - right.rankInA ||
        left.id.localeCompare(right.id),
    )
    .slice(0, MAX_MOVEMENT_HIGHLIGHTS);
  const largestDownwardMovements = [...rankMovements]
    .filter((movement) => movement.rankMovement < 0)
    .sort(
      (left, right) =>
        left.rankMovement - right.rankMovement ||
        left.rankInA - right.rankInA ||
        left.id.localeCompare(right.id),
    )
    .slice(0, MAX_MOVEMENT_HIGHLIGHTS);
  const unchangedCandidates = rankMovements
    .filter((movement) => movement.rankMovement === 0 && movement.scoreDiff === 0)
    .map((movement) => movement.id);

  return {
    requestedK: k,
    topK: k,
    effectiveK: denominator,
    topKCountA,
    topKCountB,
    truncatedInA,
    truncatedInB,
    truncatedByPoolSize: truncatedInA || truncatedInB,
    overlapCount,
    overlapRatio,
    entering,
    leaving,
    rankMovements,
    largestUpwardMovements,
    largestDownwardMovements,
    unchangedCandidates,
  };
};

/* -------------------------------------------------------------------------
 * Bounded reason/component delta evidence (section 2).
 *
 * Retains the factual raw fields already present on a production score
 * result (never a re-derived or fabricated value) and reports pairwise
 * differences only for a small, deterministic sample of candidates: the
 * union of both modes' Top-K plus the largest true rank movements, capped
 * at DETAIL_SAMPLE_LIMIT. Canonical-only fields (`internalReasonCodes`,
 * `semanticCoverage`, `components`) are read from the same runtime object
 * `preScoreMaterials` already returned — never a second scoring call — via
 * a structural type guard, since `PreScoredMaterialEntry.scores.*` is
 * statically typed `ScoredMaterialResult` even when the pool was canonically
 * scored (the underlying object is still the full `CanonicalScoredMaterialResult`,
 * see learner-home.material-features.ts `preScoreMaterialPool`'s canonical
 * branch). Legacy/normalized results never carry these fields, so
 * `componentsUnavailable` is set truthfully rather than fabricating a
 * canonical-style breakdown for them.
 * ---------------------------------------------------------------------- */

export type MaterialRawScoreView = {
  score: number;
  tier: number;
  reasons: string[];
  hasPrimaryRelevance: boolean;
  fallbackOnly: boolean;
  internalReasonCodes: string[] | null;
  semanticCoverage: string | null;
  components: Record<string, number> | null;
};

const copySortedStringArray = (values: readonly string[] | null | undefined): string[] | null => {
  if (!values) return null;
  return [...values].sort((left, right) => left.localeCompare(right));
};

const copyComponents = (
  components: Record<string, number> | null | undefined,
): Record<string, number> | null => {
  if (!components) return null;
  const copy: Record<string, number> = {};
  for (const key of Object.keys(components).sort((left, right) => left.localeCompare(right))) {
    copy[key] = components[key]!;
  }
  return copy;
};

export const extractMaterialRawScoreView = (result: ScoredMaterialResult): MaterialRawScoreView => {
  const maybeCanonical = result as unknown as {
    internalReasonCodes?: unknown;
    semanticCoverage?: unknown;
    components?: unknown;
  };
  // Canonical extras are detected independently so a mode that exposes only
  // some of them still surfaces what it actually has (never fabricate the rest).
  const hasInternalReasonCodes = Array.isArray(maybeCanonical.internalReasonCodes);
  const hasSemanticCoverage = typeof maybeCanonical.semanticCoverage === 'string';
  const hasComponents = isPlainRecord(maybeCanonical.components);

  return {
    score: result.score,
    tier: result.tier,
    reasons: [...result.reasons],
    hasPrimaryRelevance: result.hasPrimaryRelevance,
    fallbackOnly: result.fallbackOnly,
    internalReasonCodes: hasInternalReasonCodes
      ? copySortedStringArray(maybeCanonical.internalReasonCodes as string[])
      : null,
    semanticCoverage: hasSemanticCoverage ? (maybeCanonical.semanticCoverage as string) : null,
    components: hasComponents ? copyComponents(maybeCanonical.components as Record<string, number>) : null,
  };
};

/** Deterministic, bounded candidate-id sample for detail evidence: the
 * union of both modes' independent Top-K (in rank order) plus the largest
 * true upward and downward movements, truncated at DETAIL_SAMPLE_LIMIT.
 * The longer mode is never truncated to the shorter mode's eligible count. */
export const buildDetailSampleIds = (
  rankedA: readonly RankedEntry[],
  rankedB: readonly RankedEntry[],
  k: number,
  largestUpwardMovements: readonly RankMovement[],
  largestDownwardMovements: readonly RankMovement[],
): string[] => {
  const topKCountA = Math.min(k, rankedA.length);
  const topKCountB = Math.min(k, rankedB.length);
  const ordered: string[] = [];
  const seen = new Set<string>();
  const add = (id: string) => {
    if (!seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  };
  for (const entry of rankedA.slice(0, topKCountA)) add(entry.id);
  for (const entry of rankedB.slice(0, topKCountB)) add(entry.id);
  for (const movement of largestUpwardMovements) add(movement.id);
  for (const movement of largestDownwardMovements) add(movement.id);
  return ordered.slice(0, DETAIL_SAMPLE_LIMIT);
};

/** Absolute per-mode score snapshot for a detail-sample candidate.
 * Always distinguishes the evaluator's requested mode from the actual
 * effective scoring mode (legacy fallback / project delegation must never
 * be labeled as canonical merely because canonical was requested). */
export type PairwiseSideMetadata = {
  requestedMode: RecommendationScorerVersion;
  effectiveMode: RecommendationScorerVersion;
  algorithmStamp: string;
  fallbackCode: CanonicalFallbackCode | null;
};

export type MaterialModeScoreSnapshot = PairwiseSideMetadata & {
  score: number | null;
  tier: number | null;
  reasons: string[] | null;
  hasPrimaryRelevance: boolean | null;
  fallbackOnly: boolean | null;
  internalReasonCodes: string[] | null;
  semanticCoverage: string | null;
  components: Record<string, number> | null;
};

export type MaterialDetailEntry = {
  id: string;
  modeA: MaterialModeScoreSnapshot;
  modeB: MaterialModeScoreSnapshot;
  reasonsAdded: string[];
  reasonsRemoved: string[];
  internalReasonCodesAdded: string[] | null;
  internalReasonCodesRemoved: string[] | null;
  componentDeltas: Record<string, number> | null;
  componentsUnavailable: boolean;
};

const snapshotMaterialMode = (
  side: PairwiseSideMetadata,
  view: MaterialRawScoreView | undefined,
): MaterialModeScoreSnapshot => {
  if (!view) {
    return {
      ...side,
      score: null,
      tier: null,
      reasons: null,
      hasPrimaryRelevance: null,
      fallbackOnly: null,
      internalReasonCodes: null,
      semanticCoverage: null,
      components: null,
    };
  }
  return {
    ...side,
    score: view.score,
    tier: view.tier,
    reasons: [...view.reasons],
    hasPrimaryRelevance: view.hasPrimaryRelevance,
    fallbackOnly: view.fallbackOnly,
    internalReasonCodes: copySortedStringArray(view.internalReasonCodes),
    semanticCoverage: view.semanticCoverage,
    components: copyComponents(view.components),
  };
};

export const computeMaterialDetailEntry = (
  id: string,
  sideA: PairwiseSideMetadata,
  sideB: PairwiseSideMetadata,
  a: MaterialRawScoreView | undefined,
  b: MaterialRawScoreView | undefined,
): MaterialDetailEntry => {
  const reasonsA = new Set(a?.reasons ?? []);
  const reasonsB = new Set(b?.reasons ?? []);
  const reasonsAdded = [...reasonsB].filter((reason) => !reasonsA.has(reason)).sort();
  const reasonsRemoved = [...reasonsA].filter((reason) => !reasonsB.has(reason)).sort();

  // Absolute codes are always exposed on each mode snapshot when present.
  // Derived add/remove is computed whenever at least one side exposes codes
  // (missing side treated as empty), so a one-sided canonical result is not
  // discarded merely because the other mode has none.
  const codesA = a?.internalReasonCodes ?? null;
  const codesB = b?.internalReasonCodes ?? null;
  let internalReasonCodesAdded: string[] | null = null;
  let internalReasonCodesRemoved: string[] | null = null;
  if (codesA !== null || codesB !== null) {
    const setA = new Set(codesA ?? []);
    const setB = new Set(codesB ?? []);
    internalReasonCodesAdded = [...setB].filter((code) => !setA.has(code)).sort();
    internalReasonCodesRemoved = [...setA].filter((code) => !setB.has(code)).sort();
  }

  const bothHaveComponents = Boolean(a?.components) && Boolean(b?.components);
  let componentDeltas: Record<string, number> | null = null;
  if (bothHaveComponents) {
    componentDeltas = {};
    const keys = sortedUniqueIds([...Object.keys(a!.components!), ...Object.keys(b!.components!)]);
    for (const key of keys) {
      componentDeltas[key] = (b!.components![key] ?? 0) - (a!.components![key] ?? 0);
    }
  }

  return {
    id,
    modeA: snapshotMaterialMode(sideA, a),
    modeB: snapshotMaterialMode(sideB, b),
    reasonsAdded,
    reasonsRemoved,
    internalReasonCodesAdded,
    internalReasonCodesRemoved,
    componentDeltas,
    componentsUnavailable: !bothHaveComponents,
  };
};

export type ProjectModeScoreSnapshot = PairwiseSideMetadata & {
  score: number | null;
  reasons: string[] | null;
};

export type ProjectDetailEntry = {
  id: string;
  modeA: ProjectModeScoreSnapshot;
  modeB: ProjectModeScoreSnapshot;
  reasonsAdded: string[];
  reasonsRemoved: string[];
};

export const computeProjectDetailEntry = (
  id: string,
  sideA: PairwiseSideMetadata,
  sideB: PairwiseSideMetadata,
  a: { score: number; reasons: string[] } | undefined,
  b: { score: number; reasons: string[] } | undefined,
): ProjectDetailEntry => {
  const reasonsA = new Set(a?.reasons ?? []);
  const reasonsB = new Set(b?.reasons ?? []);
  return {
    id,
    modeA: {
      ...sideA,
      score: a ? a.score : null,
      reasons: a ? [...a.reasons] : null,
    },
    modeB: {
      ...sideB,
      score: b ? b.score : null,
      reasons: b ? [...b.reasons] : null,
    },
    reasonsAdded: [...reasonsB].filter((reason) => !reasonsA.has(reason)).sort(),
    reasonsRemoved: [...reasonsA].filter((reason) => !reasonsB.has(reason)).sort(),
  };
};

export type PairwiseComparisonResult<TDetail> = PairwiseDelta & {
  sideA: PairwiseSideMetadata;
  sideB: PairwiseSideMetadata;
  detailSample: TDetail[];
};

/** Generic pairwise-comparison builder shared by materials and projects:
 * computes the base delta, then attaches a bounded, deterministic detail
 * sample built from each mode's raw (pre-elimination) score view. Pair keys
 * identify the *requested* mode pair; effective-mode truth lives in sideA/sideB
 * and each detail snapshot. */
const buildPairwiseWithDetail = <TRaw, TDetail>(
  ranked: Record<RecommendationScorerVersion, RankedEntry[]>,
  rawByMode: Record<RecommendationScorerVersion, ReadonlyMap<string, TRaw>>,
  topK: number,
  sideMetaByRequestedMode: Record<RecommendationScorerVersion, PairwiseSideMetadata>,
  computeDetailEntry: (
    id: string,
    sideA: PairwiseSideMetadata,
    sideB: PairwiseSideMetadata,
    a: TRaw | undefined,
    b: TRaw | undefined,
  ) => TDetail,
): Record<string, PairwiseComparisonResult<TDetail>> => {
  const build = (
    modeA: RecommendationScorerVersion,
    modeB: RecommendationScorerVersion,
  ): PairwiseComparisonResult<TDetail> => {
    const sideA = sideMetaByRequestedMode[modeA]!;
    const sideB = sideMetaByRequestedMode[modeB]!;
    const delta = computePairwiseDelta(ranked[modeA], ranked[modeB], topK);
    const detailIds = buildDetailSampleIds(
      ranked[modeA],
      ranked[modeB],
      topK,
      delta.largestUpwardMovements,
      delta.largestDownwardMovements,
    );
    const detailSample = detailIds.map((id) =>
      computeDetailEntry(id, sideA, sideB, rawByMode[modeA].get(id), rawByMode[modeB].get(id)),
    );
    return { ...delta, sideA, sideB, detailSample };
  };

  return {
    'legacy-v1_vs_normalized-interests-v2': build('legacy-v1', 'normalized-interests-v2'),
    'legacy-v1_vs_canonical-taxonomy-v3-requested': build('legacy-v1', CANONICAL_MODE),
    'normalized-interests-v2_vs_canonical-taxonomy-v3-requested': build(
      'normalized-interests-v2',
      CANONICAL_MODE,
    ),
  };
};

/* -------------------------------------------------------------------------
 * Coverage aggregation. Reuses only the CanonicalMaterialScoringContext
 * already computed for scoring; never issues a second loader call.
 * Evaluator-only unavailable reasons (mode-resolution abort) are distinct
 * from production CanonicalFallbackCode values and must never be relabeled
 * as fabricated fallback codes.
 * ---------------------------------------------------------------------- */

/** Production fallback codes plus evaluator-only "not evaluated" reasons. */
export type CoverageUnavailableReason =
  | CanonicalFallbackCode
  | 'NOT_EVALUATED_DUE_TO_MODE_RESOLUTION_ERROR'
  | 'MODE_RESOLUTION_ERROR:canonical-taxonomy-v3';

export type CoverageSnapshot = {
  canonicalRequested: boolean;
  coverageStatus: 'AVAILABLE' | 'UNAVAILABLE';
  coverageSource: 'successfulContext' | 'none';
  counts: Record<CanonicalMaterialCoverage, number> | null;
  coverageUnavailableReason: CoverageUnavailableReason | null;
};

export const snapshotCoverage = (
  canonicalContext: CanonicalMaterialScoringContext | undefined,
  loaderFallbackCode: CanonicalFallbackCode | null,
): CoverageSnapshot => {
  if (!canonicalContext || canonicalContext.effectiveScoringMode !== CANONICAL_MODE) {
    return {
      canonicalRequested: true,
      coverageStatus: 'UNAVAILABLE',
      coverageSource: 'none',
      counts: null,
      coverageUnavailableReason: loaderFallbackCode,
    };
  }

  const counts = Object.fromEntries(
    CANONICAL_COVERAGE_KEYS.map((key) => [key, 0]),
  ) as Record<CanonicalMaterialCoverage, number>;
  for (const profile of canonicalContext.candidateMaterialProfiles.values()) {
    counts[profile.coverage] = (counts[profile.coverage] ?? 0) + 1;
  }

  return {
    canonicalRequested: true,
    coverageStatus: 'AVAILABLE',
    coverageSource: 'successfulContext',
    counts,
    coverageUnavailableReason: null,
  };
};

/* -------------------------------------------------------------------------
 * Frozen-clock helper. `Date.now()` overrides do not affect no-argument
 * `new Date()` calls (they read system time independently), and canonical
 * scoring's `input.now ?? new Date()` branch is only ever reached via the
 * bare-constructor path here because `preScoreMaterials` does not expose a
 * `now` parameter. Overriding the global `Date` class itself (scoped,
 * restored in `finally`) is therefore required for full determinism across
 * both call styles.
 * ---------------------------------------------------------------------- */

export const withFrozenClock = <T>(fixedMs: number, run: () => T): T => {
  const RealDate = Date;

  class FrozenDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) {
        super(fixedMs);
      } else {
        // @ts-expect-error variadic passthrough to the real Date constructor
        super(...args);
      }
    }

    static now(): number {
      return fixedMs;
    }
  }

  // @ts-expect-error intentional scoped global override, restored below
  globalThis.Date = FrozenDate;
  try {
    return run();
  } finally {
    globalThis.Date = RealDate;
  }
};

/* -------------------------------------------------------------------------
 * Dependency-injection seam (evaluator-only; no production change). Real
 * implementations are loaded lazily via buildRealDeps() so this file stays
 * importable (for pure functions above) without ever touching Prisma.
 * ---------------------------------------------------------------------- */

export type EvaluatorPrismaLike = {
  user: {
    findMany: (
      args: unknown,
    ) => Promise<
      Array<{
        id: string;
        email: string;
        accountStatus: string;
        recommendationEvidenceEligibility: string;
      }>
    >;
  };
  $disconnect: () => Promise<void>;
};

export type EvaluatorDeps = {
  prisma: EvaluatorPrismaLike;
  loadLearnerInterests: (userId: string) => Promise<string[]>;
  loadDefaultSavedLocation: (userId: string) => Promise<{ city: string | null; area: string | null }>;
  loadLearnerHomeProjectContext: (
    userId: string,
    savedProjectLimit?: number,
  ) => Promise<{
    behavior: LearnerBehaviorContext;
    projects: LearnerHomeProjectCandidate[];
    savedProjects: LearnerHomeContext['savedProjectItems'];
    inProgressBuilds: LearnerHomeContext['inProgressBuilds'];
    hasSavedProjects: boolean;
  }>;
  loadMaterialCandidatesForLearner: (input: {
    interests: string[];
    savedComponents: LearnerHomeContext['savedComponents'];
    behavior: LearnerBehaviorContext;
    savedLocation: LearnerHomeContext['savedLocation'];
    poolCap: number;
  }) => Promise<LearnerHomeMaterialCandidate[]>;
  homeMaterialPoolCap: number;
  browseMaterialPoolCap: number;
  normalizeInterests: (interests: string[]) => string[];
  buildBehaviorAffinityProfile: (behavior: LearnerBehaviorContext) => LearnerHomeContext['behaviorAffinityProfile'];
  hasLearnerActivity: (behavior: LearnerBehaviorContext) => boolean;
  resolveMaterialModeDecisionAndContext: (input: {
    requestedMaterialScoringMode: RecommendationScorerVersion;
    needsCanonicalMaterialScoring: boolean;
    materials: LearnerHomeContext['materials'];
    behavior: LearnerBehaviorContext;
  }) => Promise<{
    modeDecision: LearnerHomeContext['modeDecision'];
    canonicalContext: CanonicalMaterialScoringContext | undefined;
  }>;
  preScoreMaterials: (context: LearnerHomeContext) => PreScoredMaterialEntry[];
  rankProjects: (
    projects: LearnerHomeContext['projects'],
    scorer: (project: LearnerHomeProjectCandidate) => { score: number; reasons: string[]; tier?: number },
    limit: number,
    useTieredRanking?: boolean,
  ) => Array<{ type: 'project'; score: number; reasons: string[]; project: Record<string, unknown> }>;
  scoreSuggestedProject: (input: {
    project: LearnerHomeProjectCandidate;
    interests: string[];
    availableMaterials: LearnerHomeMaterialCandidate[];
    behaviorAffinityProfile?: LearnerHomeContext['behaviorAffinityProfile'];
    behavior?: LearnerBehaviorContext;
    scorerVersion?: RecommendationScorerVersion;
  }) => ScoredProjectResult;
  resolveProjectScorerVersion: (scorerVersion?: RecommendationScorerVersion) => RecommendationScorerVersion;
  /**
   * The exact production filter (`score > 0`) + tiered-Home/browse-all
   * dispatch combinator (`learner-home.service.ts`, exported for RP-03.3
   * reuse). Never re-implemented locally.
   */
  rankPreScoredMaterialEntries: (
    entries: PreScoredMaterialEntry[],
    scoreKey: keyof PreScoredMaterialEntry['scores'],
    useTieredSuggestedRanking: boolean,
    browseAllTierSort: boolean,
  ) => Array<{
    type: 'material';
    score: number;
    reasons: string[];
    tier: number;
    hasPrimaryRelevance: boolean;
    fallbackOnly: boolean;
    material: Record<string, unknown>;
    ownerId: string;
  }>;
  algorithmVersionForEffectiveMode: (mode: RecommendationScorerVersion) => string;
  getProjectItemId: (item: { project: Record<string, unknown> }) => string;
  currentScorerVersionConstant: () => string;
};

export const buildRealDeps = async (): Promise<EvaluatorDeps> => {
  const [repository, service, scoring, deduplication, scoringVersion] = await Promise.all([
    import('../src/modules/learner-home/learner-home.repository.js'),
    import('../src/modules/learner-home/learner-home.service.js'),
    import('../src/modules/learner-home/learner-home.scoring.js'),
    import('../src/modules/learner-home/learner-home.deduplication.js'),
    import('../src/config/recommendation-scoring-version.js'),
  ]);
  const canonicalScoring = await import('../src/modules/learner-home/learner-home.canonical-scoring.js');
  const prismaModule = await import('../src/database/prisma.js');

  return {
    prisma: prismaModule.prisma as unknown as EvaluatorPrismaLike,
    loadLearnerInterests: repository.loadLearnerInterests,
    loadDefaultSavedLocation: repository.loadDefaultSavedLocation,
    loadLearnerHomeProjectContext: repository.loadLearnerHomeProjectContext,
    loadMaterialCandidatesForLearner: repository.loadMaterialCandidatesForLearner,
    homeMaterialPoolCap: repository.HOME_MATERIAL_POOL_CAP,
    browseMaterialPoolCap: repository.BROWSE_MATERIAL_POOL_CAP,
    normalizeInterests: scoring.normalizeInterests,
    buildBehaviorAffinityProfile: (await import('../src/modules/learner-home/learner-home.affinity.js'))
      .buildBehaviorAffinityProfile,
    hasLearnerActivity: (await import('../src/modules/learner-home/learner-home.affinity.js'))
      .hasLearnerActivity,
    resolveMaterialModeDecisionAndContext: service.resolveMaterialModeDecisionAndContext,
    preScoreMaterials: service.preScoreMaterials,
    rankProjects: service.rankProjects,
    scoreSuggestedProject: scoring.scoreSuggestedProject,
    resolveProjectScorerVersion: scoring.resolveProjectScorerVersion,
    rankPreScoredMaterialEntries: service.rankPreScoredMaterialEntries,
    algorithmVersionForEffectiveMode: canonicalScoring.algorithmVersionForEffectiveMode,
    getProjectItemId: deduplication.getProjectItemId,
    currentScorerVersionConstant: () => scoringVersion.RECOMMENDATION_SCORER_VERSION,
  };
};

/* -------------------------------------------------------------------------
 * Orchestration.
 * ---------------------------------------------------------------------- */

export type EvaluatorResult = {
  evaluatorVersion: typeof EVALUATOR_VERSION;
  status: 'VALID' | 'INVALID';
  evaluationTimestampUtc: string;
  learner: { userIdHash: string; emailProvided: boolean };
  pool: { scope: PoolScope; poolCap: number };
  requestedModes: readonly RecommendationScorerVersion[];
  topK: number;
  inputPoolMutationDetected: boolean;
  candidatePool: {
    materialCount: number;
    materialRetrievalOrderDigest: string;
    materialIdentityDigest: string;
    projectCount: number;
    projectRetrievalOrderDigest: string | null;
    projectIdentityDigest: string;
    projectRetrievalOrderAmbiguous: boolean;
    projectRetrievalTieGroups: ProjectRetrievalTieGroup[];
  };
  modeResults: Record<
    RecommendationScorerVersion,
    {
      requestedMode: RecommendationScorerVersion;
      effectiveMode: RecommendationScorerVersion;
      algorithmStamp: string;
      fallbackCode: CanonicalFallbackCode | null;
      cacheableIfProduction: boolean;
    }
  >;
  /** Deterministic aggregate evidence from actual effective mode decisions
   * only — never inferred from exceptions or a fabricated decision. */
  canonicalFallbacks: {
    total: number;
    byCode: Record<CanonicalFallbackCode, number>;
  };
  materialEvaluation: {
    status: 'VALID' | 'INVALID';
    scoreBucket: ScoreBucket;
    rankingSurface: MaterialRankingSurface;
    perMode: Record<
      RecommendationScorerVersion,
      {
        scoringIdentity: ScoringIdentityResult;
        rankingEligibility: {
          eligibleCandidateIds: string[];
          filteredOutCandidateIds: string[];
          filteredOutReasonsWhenExistingProductionDataExposesThem: Array<{
            candidateId: string;
            reason: string;
          }>;
          rankedCandidateIds: string[];
        };
        tiedCandidateGroups: TiedCandidateGroup[];
      }
    >;
    pairwise: Record<string, PairwiseComparisonResult<MaterialDetailEntry>>;
    coverage: CoverageSnapshot;
  };
  projectEvaluation: {
    status: 'VALID' | 'INVALID' | 'INVALID_NONDETERMINISTIC_RETRIEVAL_ORDER';
    rankingFunctionUsed: string;
    /** Effective project algorithm stamp for the completed canonical-requested
     * project evaluation, or null when that evaluation never ran. */
    algorithmStamp: string | null;
    /** Whether the completed canonical-requested project evaluation delegated
     * to a non-canonical effective scorer. null when canonical project scoring
     * was never reached (e.g. earlier mode-resolution abort). */
    delegatedFromCanonicalRequest: boolean | null;
    perMode: Record<
      RecommendationScorerVersion,
      {
        effectiveProjectScoringMode: RecommendationScorerVersion;
        algorithmStamp: string;
        scoringIdentity: ScoringIdentityResult;
        rankingEligibility: {
          eligibleCandidateIds: string[];
          filteredOutCandidateIds: string[];
          filteredOutReasonsWhenExistingProductionDataExposesThem: Array<{
            projectId: string;
            reason: string;
            score: number;
          }>;
          rankedCandidateIds: string[];
        };
      }
    >;
    pairwise: Record<string, PairwiseComparisonResult<ProjectDetailEntry>> | null;
    nondeterministicRetrievalDiagnostics: { tieGroups: ProjectRetrievalTieGroup[] } | null;
  };
  warnings: string[];
  invalidResultReasons: string[];
  knownUnrelatedIssues: Array<{ path: string; note: string }>;
};

export type EvaluatorOutput = EvaluatorResult & { resultStableHash: string };

const KNOWN_UNRELATED_ISSUES: EvaluatorResult['knownUnrelatedIssues'] = [
  {
    path: 'src/modules/admin-people/admin-people.service.ts:52',
    note: 'Pre-existing TS18049 possibly-null narrowing issue, out of RP-03.3 scope, not fixed.',
  },
];

export const finalizeResult = (draft: EvaluatorResult): EvaluatorOutput => ({
  ...draft,
  resultStableHash: stableHash(draft),
});

export const runRankingDeltaEvaluation = async (
  options: EvaluatorCliOptions,
  deps: EvaluatorDeps,
): Promise<EvaluatorOutput> => {
  const invalidResultReasons: string[] = [];
  const warnings: string[] = [];

  const beforeScorerVersion = deps.currentScorerVersionConstant();
  const beforeEnvScorerVersion = process.env.RECOMMENDATION_SCORER_VERSION;

  // ---- Resolve learner (bounded, explicit input only; no default list). ----
  const users = await deps.prisma.user.findMany({
    where: options.userId ? { id: options.userId } : { email: options.email },
    select: {
      id: true,
      email: true,
      accountStatus: true,
      recommendationEvidenceEligibility: true,
    },
  });
  if (users.length !== 1) {
    const draft = buildEmptyInvalidResult(
      options,
      users.length === 0 ? 'LEARNER_NOT_FOUND' : 'LEARNER_AMBIGUOUS',
    );
    return finalizeResult(draft);
  }
  const user = users[0]!;
  if (
    user.accountStatus !== 'ACTIVE' ||
    user.recommendationEvidenceEligibility !== 'ELIGIBLE'
  ) {
    const draft = buildEmptyInvalidResult(options, 'LEARNER_NOT_EVIDENCE_ELIGIBLE');
    return finalizeResult(draft);
  }

  // ---- Retrieval: exactly once per domain, order preserved verbatim. ----
  const [rawInterests, savedLocation, projectContext] = await Promise.all([
    deps.loadLearnerInterests(user.id),
    deps.loadDefaultSavedLocation(user.id),
    deps.loadLearnerHomeProjectContext(user.id, 4),
  ]);
  const behavior = projectContext.behavior;
  const projects = projectContext.projects; // frozen verbatim; never sorted
  const interests = deps.normalizeInterests(rawInterests);
  const savedComponents = behavior.savedProjectComponents ?? [];
  const behaviorAffinityProfile = deps.buildBehaviorAffinityProfile(behavior);
  const poolCap = options.poolScope === 'browse' ? deps.browseMaterialPoolCap : deps.homeMaterialPoolCap;
  const materials = await deps.loadMaterialCandidatesForLearner({
    interests,
    savedComponents,
    behavior,
    savedLocation,
    poolCap,
  }); // frozen verbatim; never sorted

  const originalMaterialIds = materials.map((material) => material.id);
  const originalProjectIds = projects.map((project) => project.id);
  const availableMaterials = materials.filter(
    (material) => material.status === 'AVAILABLE' && material.availableQuantity > 0,
  );

  // ---- Fail closed on empty evaluation domains (section 3). Zero
  // candidates must never be silently reported as a trivially "valid"
  // empty result — it is explicitly invalid, with a deterministic reason. ----
  const materialPoolEmpty = materials.length === 0;
  const projectPoolEmpty = projects.length === 0;
  if (materialPoolEmpty) {
    invalidResultReasons.push('EMPTY_MATERIAL_CANDIDATE_POOL');
  }
  if (projectPoolEmpty) {
    invalidResultReasons.push('EMPTY_PROJECT_CANDIDATE_POOL');
  }

  const evaluationTimeMs = Date.parse(options.evaluationTimeUtc);
  const rankingSurface = resolveMaterialRankingSurface(options.scoreBucket, options.poolScope);

  // ---- Project retrieval-order ambiguity gate (pool property, not per-mode). ----
  const tieGroups = detectProjectRetrievalTies(projects);
  const projectRetrievalOrderAmbiguous = tieGroups.length > 0;
  if (projectRetrievalOrderAmbiguous) {
    invalidResultReasons.push('PROJECT_RETRIEVAL_ORDER_NONDETERMINISTIC');
  }

  const modeResults = {} as EvaluatorResult['modeResults'];
  const materialPerMode = {} as EvaluatorResult['materialEvaluation']['perMode'];
  const projectPerMode = {} as EvaluatorResult['projectEvaluation']['perMode'];
  const materialRankedByMode = {} as Record<RecommendationScorerVersion, RankedEntry[]>;
  const projectRankedByMode = {} as Record<RecommendationScorerVersion, RankedEntry[]>;
  const materialRawViewByMode = {} as Record<RecommendationScorerVersion, ReadonlyMap<string, MaterialRawScoreView>>;
  const projectRawViewByMode = {} as Record<RecommendationScorerVersion, ReadonlyMap<string, ScoredProjectResult>>;
  let materialCoverage: CoverageSnapshot | null = null;
  let canonicalEffectiveProjectMode: RecommendationScorerVersion | null = null;
  let canonicalProjectEvaluationCompleted = false;
  // Explicit cause flags — never derived from aggregate validity alone.
  // Identity-invalid reasons are pushed only when identityMatch is actually
  // false; empty pools and scorer-config mutations never synthesize them.
  let modeResolutionError: string | null = null;
  let materialAllValid = !materialPoolEmpty;
  let projectAllValid = !projectPoolEmpty;
  const materialSideMetaByRequestedMode = {} as Record<RecommendationScorerVersion, PairwiseSideMetadata>;
  const projectSideMetaByRequestedMode = {} as Record<RecommendationScorerVersion, PairwiseSideMetadata>;

  for (const mode of REQUESTED_MODES) {
    // ---------------- Materials ----------------
    let modeDecision: LearnerHomeContext['modeDecision'];
    let canonicalContext: CanonicalMaterialScoringContext | undefined;
    try {
      ({ modeDecision, canonicalContext } = await deps.resolveMaterialModeDecisionAndContext({
        requestedMaterialScoringMode: mode,
        needsCanonicalMaterialScoring: true,
        materials,
        behavior,
      }));
    } catch {
      // The real resolver performs no I/O at all for legacy/normalized modes
      // and only ever RETURNS (never throws) its own canonical
      // loader/context fallback for canonical mode. An exception here is
      // therefore always an unexpected internal failure, never a
      // legitimate canonical fallback — fabricating a
      // `CANONICAL_LOADER_FALLBACK_LEGACY_V1` decision for it would
      // mislabel a legacy/normalized failure (or a genuinely unexpected
      // canonical failure) as a truthful fallback. Abort further mode
      // evaluation, keep the frozen-pool evidence already collected, and
      // finalize through the shared integrity path below.
      modeResolutionError = `MODE_RESOLUTION_ERROR:${mode}`;
      invalidResultReasons.push(modeResolutionError);
      materialAllValid = false;
      projectAllValid = false;
      break;
    }

    const loaderFallbackCode = modeDecision.fallbackCode;
    if (mode === CANONICAL_MODE) {
      // Snapshot coverage immediately, before preScoreMaterials can clear
      // canonicalContext on a scorer-level fallback retry.
      materialCoverage = snapshotCoverage(canonicalContext, loaderFallbackCode);
    }

    const context: LearnerHomeContext = {
      interests,
      savedLocation,
      savedComponents,
      materials,
      projects,
      savedProjectItems: projectContext.savedProjects,
      inProgressBuilds: projectContext.inProgressBuilds,
      savedProjectIds: new Set(
        projects.filter((project) => (project.mapped as Record<string, unknown>).isSaved).map((project) => project.id),
      ),
      hasSavedProjects: projectContext.hasSavedProjects,
      behavior,
      behaviorAffinityProfile,
      hasActivity: deps.hasLearnerActivity(behavior),
      modeDecision,
      canonicalContext,
    };

    let preScored: PreScoredMaterialEntry[] = [];
    let materialScoringFailed = false;
    try {
      preScored = withFrozenClock(evaluationTimeMs, () => deps.preScoreMaterials(context));
    } catch {
      materialScoringFailed = true;
      materialAllValid = false;
      invalidResultReasons.push(`MATERIAL_SCORING_FAILED:${mode}`);
    }

    const scoredMaterialIds = preScored.map((entry) => entry.material.id);
    const materialScoringIdentity = computeScoringIdentity(originalMaterialIds, scoredMaterialIds);
    // Identity invalid is only recorded when the identity check itself fails —
    // never because the pool is empty, scoring threw, or another invariant failed.
    if (!materialScoringIdentity.identityMatch) {
      materialAllValid = false;
      invalidResultReasons.push(`MATERIAL_SCORING_IDENTITY_INVALID:${mode}`);
    } else if (materialScoringFailed) {
      materialAllValid = false;
    }

    // Raw (pre-elimination) score view per candidate: used for
    // rankingEligibility classification below and for the bounded
    // reason/component detail-sample evidence (section 2). Retains the
    // canonical `internalReasonCodes`/`semanticCoverage`/`components` fields
    // when the runtime result actually carries them, without a second
    // scoring call.
    const materialRawViews = new Map(
      preScored.map((entry) => [
        entry.material.id,
        extractMaterialRawScoreView(entry.scores[options.scoreBucket]),
      ]),
    );
    materialRawViewByMode[mode] = materialRawViews;

    // The exact production filter/ranking combinator (score > 0, then
    // tiered-Home selection or browse-all tier sort per rankingSurface) —
    // never re-implemented locally. A candidate can be absent from this
    // output either because its score is <= 0, or (only under the
    // tiered-Home surface) because its tier group was not the one selected;
    // both are reported as filtered, never as ranked and never as missing.
    const rankedMaterialEntries = deps.rankPreScoredMaterialEntries(
      preScored,
      options.scoreBucket,
      rankingSurface.useTieredSuggestedRanking,
      rankingSurface.browseAllTierSort,
    );
    const rankedMaterialIds = rankedMaterialEntries.map((entry) => String(entry.material.id ?? ''));
    const rankedMaterialIdSet = new Set(rankedMaterialIds);
    const materialTierById = new Map(
      rankedMaterialEntries.map((entry) => [String(entry.material.id ?? ''), entry.tier]),
    );
    const materialRanked = buildRankedEntries(
      rankedMaterialIds,
      new Map([...materialRawViews.entries()].map(([id, view]) => [id, view.score])),
      materialTierById,
    );
    materialRankedByMode[mode] = materialRanked;

    const eligibleMaterialIds: string[] = [];
    const filteredOutMaterialEntries: Array<{ candidateId: string; reason: string }> = [];
    for (const [id, view] of materialRawViews) {
      if (rankedMaterialIdSet.has(id)) {
        eligibleMaterialIds.push(id);
      } else if (view.score <= 0) {
        filteredOutMaterialEntries.push({ candidateId: id, reason: 'NON_POSITIVE_SCORE' });
      } else {
        filteredOutMaterialEntries.push({ candidateId: id, reason: 'TIER_NOT_SELECTED' });
      }
    }

    materialPerMode[mode] = {
      scoringIdentity: materialScoringIdentity,
      rankingEligibility: {
        eligibleCandidateIds: sortedUniqueIds(eligibleMaterialIds),
        filteredOutCandidateIds: sortedUniqueIds(filteredOutMaterialEntries.map((entry) => entry.candidateId)),
        filteredOutReasonsWhenExistingProductionDataExposesThem: [...filteredOutMaterialEntries].sort((left, right) =>
          left.candidateId.localeCompare(right.candidateId),
        ),
        rankedCandidateIds: rankedMaterialIds,
      },
      tiedCandidateGroups: computeTiedGroups(materialRanked),
    };

    modeResults[mode] = {
      requestedMode: mode,
      effectiveMode: context.modeDecision.effectiveMaterialScoringMode,
      algorithmStamp: deps.algorithmVersionForEffectiveMode(context.modeDecision.effectiveMaterialScoringMode),
      fallbackCode: context.modeDecision.fallbackCode,
      cacheableIfProduction: context.modeDecision.cacheable,
    };
    // Material pairwise/detail side metadata must reflect the *final*
    // effective mode after preScoreMaterials (which may stamp a scorer-level
    // fallback), never the requested mode alone.
    materialSideMetaByRequestedMode[mode] = {
      requestedMode: mode,
      effectiveMode: context.modeDecision.effectiveMaterialScoringMode,
      algorithmStamp: deps.algorithmVersionForEffectiveMode(context.modeDecision.effectiveMaterialScoringMode),
      fallbackCode: context.modeDecision.fallbackCode,
    };

    // ---------------- Projects ----------------
    const rawScoreCalls: Array<{ id: string; result: ScoredProjectResult }> = [];
    const recordingScorer = (project: LearnerHomeProjectCandidate): ScoredProjectResult => {
      const result = deps.scoreSuggestedProject({
        project,
        interests,
        availableMaterials,
        behaviorAffinityProfile,
        behavior,
        scorerVersion: mode,
      });
      rawScoreCalls.push({ id: project.id, result });
      return result;
    };

    let rankedProjectItems: Array<{ score: number; reasons: string[]; project: Record<string, unknown> }> = [];
    let projectScoringFailed = false;
    try {
      rankedProjectItems = withFrozenClock(evaluationTimeMs, () =>
        deps.rankProjects(projects, recordingScorer, projects.length, true),
      );
    } catch {
      projectScoringFailed = true;
      projectAllValid = false;
      invalidResultReasons.push(`PROJECT_SCORING_FAILED:${mode}`);
    }

    const projectScoringIdentity = computeScoringIdentity(
      originalProjectIds,
      rawScoreCalls.map((call) => call.id),
    );
    if (!projectScoringIdentity.identityMatch) {
      projectAllValid = false;
      invalidResultReasons.push(`PROJECT_SCORING_IDENTITY_INVALID:${mode}`);
    } else if (projectScoringFailed) {
      projectAllValid = false;
    }

    const rawScoreById = new Map<string, ScoredProjectResult>();
    for (const call of rawScoreCalls) {
      rawScoreById.set(call.id, call.result);
    }
    projectRawViewByMode[mode] = rawScoreById;
    // Membership lists are set-like evidence, not meaningfully ordered, so
    // they are reported in a canonical (sorted) order. Raw Map iteration
    // order would otherwise leak the frozen array's incidental retrieval
    // order into fields that are not `rankedCandidateIds`, breaking
    // reproducibility whenever candidates happen to be retrieved in a
    // different (but identity-equivalent) order.
    const eligibleProjectIds = sortedUniqueIds(
      [...rawScoreById.entries()].filter(([, result]) => result.score > 0).map(([id]) => id),
    );
    const filteredOutProjectIds = sortedUniqueIds(
      [...rawScoreById.entries()].filter(([, result]) => result.score <= 0).map(([id]) => id),
    );
    const filteredOutReasons = filteredOutProjectIds.map((id) => ({
      projectId: id,
      reason: 'NON_POSITIVE_SCORE',
      score: rawScoreById.get(id)!.score,
    }));
    const rankedProjectIds = rankedProjectItems.map((item) => deps.getProjectItemId(item));

    if (!projectRetrievalOrderAmbiguous) {
      projectRankedByMode[mode] = buildRankedEntries(
        rankedProjectIds,
        new Map([...rawScoreById.entries()].map(([id, result]) => [id, result.score])),
      );
    }

    const effectiveProjectScoringMode = deps.resolveProjectScorerVersion(mode);
    const projectAlgorithmStamp = deps.algorithmVersionForEffectiveMode(effectiveProjectScoringMode);
    projectSideMetaByRequestedMode[mode] = {
      requestedMode: mode,
      effectiveMode: effectiveProjectScoringMode,
      algorithmStamp: projectAlgorithmStamp,
      // Project delegation is not a material CanonicalFallbackCode.
      fallbackCode: null,
    };
    if (mode === CANONICAL_MODE) {
      canonicalEffectiveProjectMode = effectiveProjectScoringMode;
      canonicalProjectEvaluationCompleted = true;
    }

    projectPerMode[mode] = {
      effectiveProjectScoringMode,
      algorithmStamp: projectAlgorithmStamp,
      scoringIdentity: projectScoringIdentity,
      rankingEligibility: {
        eligibleCandidateIds: eligibleProjectIds,
        filteredOutCandidateIds: filteredOutProjectIds,
        filteredOutReasonsWhenExistingProductionDataExposesThem: filteredOutReasons,
        rankedCandidateIds: projectRetrievalOrderAmbiguous ? [] : rankedProjectIds,
      },
    };
  }

  // ---- Input-pool mutation detection (always runs, including after
  // mode-resolution failure, so frozen-pool integrity is still reported). ----
  const finalMaterialIds = materials.map((material) => material.id);
  const finalProjectIds = projects.map((project) => project.id);
  const inputPoolMutationDetected =
    !arraysEqual(originalMaterialIds, finalMaterialIds) || !arraysEqual(originalProjectIds, finalProjectIds);
  if (inputPoolMutationDetected) {
    invalidResultReasons.push('INPUT_POOL_MUTATION_DETECTED');
  }

  const afterScorerVersion = deps.currentScorerVersionConstant();
  const afterEnvScorerVersion = process.env.RECOMMENDATION_SCORER_VERSION;
  const scorerConfigurationMutationDetected =
    beforeScorerVersion !== afterScorerVersion || beforeEnvScorerVersion !== afterEnvScorerVersion;
  if (scorerConfigurationMutationDetected) {
    invalidResultReasons.push('SCORER_CONFIGURATION_MUTATION_DETECTED');
  }

  // Do NOT derive bare MATERIAL_SCORING_IDENTITY_INVALID /
  // PROJECT_SCORING_IDENTITY_INVALID from aggregate validity flags. Per-mode
  // identity reasons were already pushed only when identityMatch was false.
  // Scoring failures keep MATERIAL_SCORING_FAILED:<mode> /
  // PROJECT_SCORING_FAILED:<mode> without being relabeled as identity failures.

  const materialEvaluationStatus: 'VALID' | 'INVALID' =
    materialAllValid && !modeResolutionError ? 'VALID' : 'INVALID';
  const projectEvaluationStatus: 'VALID' | 'INVALID' | 'INVALID_NONDETERMINISTIC_RETRIEVAL_ORDER' =
    projectRetrievalOrderAmbiguous
      ? 'INVALID_NONDETERMINISTIC_RETRIEVAL_ORDER'
      : projectAllValid && !modeResolutionError
        ? 'VALID'
        : 'INVALID';

  const materialPairwise =
    materialEvaluationStatus === 'VALID' && Object.keys(materialRankedByMode).length === REQUESTED_MODES.length
      ? buildPairwiseWithDetail(
          materialRankedByMode,
          materialRawViewByMode,
          options.topK,
          materialSideMetaByRequestedMode,
          computeMaterialDetailEntry,
        )
      : {};
  const projectPairwise =
    projectEvaluationStatus === 'VALID' && Object.keys(projectRankedByMode).length === REQUESTED_MODES.length
      ? buildPairwiseWithDetail(
          projectRankedByMode,
          projectRawViewByMode,
          options.topK,
          projectSideMetaByRequestedMode,
          computeProjectDetailEntry,
        )
      : null;

  // ---- Explicit canonical fallback aggregate (section 6): derived only
  // from actual effective mode decisions recorded in modeResults, never
  // inferred from exceptions or a fabricated decision. ----
  const canonicalFallbackByCode = Object.fromEntries(
    CANONICAL_FALLBACK_CODES.map((code) => [code, 0]),
  ) as Record<CanonicalFallbackCode, number>;
  let canonicalFallbackTotal = 0;
  for (const mode of REQUESTED_MODES) {
    const code = modeResults[mode]?.fallbackCode;
    if (code) {
      canonicalFallbackByCode[code] = (canonicalFallbackByCode[code] ?? 0) + 1;
      canonicalFallbackTotal += 1;
    }
  }

  if (projectRetrievalOrderAmbiguous) {
    warnings.push(
      'Project ranking-delta evidence withheld: retrieval order is ambiguous for one or more createdAt ties (see projectEvaluation.nondeterministicRetrievalDiagnostics).',
    );
  }

  const overallStatus: 'VALID' | 'INVALID' =
    materialEvaluationStatus === 'VALID' &&
    projectEvaluationStatus === 'VALID' &&
    !inputPoolMutationDetected &&
    !scorerConfigurationMutationDetected &&
    !modeResolutionError
      ? 'VALID'
      : 'INVALID';

  const resolvedCoverage: CoverageSnapshot =
    materialCoverage ??
    ({
      // Canonical is always part of REQUESTED_MODES; if we never reached its
      // context resolution, report requested-but-not-evaluated — never
      // "canonicalRequested: false" and never a fabricated fallback code.
      canonicalRequested: true,
      coverageStatus: 'UNAVAILABLE',
      coverageSource: 'none',
      counts: null,
      coverageUnavailableReason:
        modeResolutionError === `MODE_RESOLUTION_ERROR:${CANONICAL_MODE}`
          ? 'MODE_RESOLUTION_ERROR:canonical-taxonomy-v3'
          : modeResolutionError
            ? 'NOT_EVALUATED_DUE_TO_MODE_RESOLUTION_ERROR'
            : null,
    } satisfies CoverageSnapshot);

  const draft: EvaluatorResult = {
    evaluatorVersion: EVALUATOR_VERSION,
    status: overallStatus,
    evaluationTimestampUtc: options.evaluationTimeUtc,
    learner: { userIdHash: hashIdentity(user.id), emailProvided: Boolean(options.email) },
    pool: { scope: options.poolScope, poolCap },
    requestedModes: REQUESTED_MODES,
    topK: options.topK,
    inputPoolMutationDetected,
    candidatePool: {
      materialCount: originalMaterialIds.length,
      materialRetrievalOrderDigest: digestOrderedIds(originalMaterialIds),
      materialIdentityDigest: digestIdentitySet(originalMaterialIds),
      projectCount: originalProjectIds.length,
      projectRetrievalOrderDigest: projectRetrievalOrderAmbiguous ? null : digestOrderedIds(originalProjectIds),
      projectIdentityDigest: digestIdentitySet(originalProjectIds),
      projectRetrievalOrderAmbiguous,
      projectRetrievalTieGroups: tieGroups,
    },
    modeResults,
    canonicalFallbacks: { total: canonicalFallbackTotal, byCode: canonicalFallbackByCode },
    materialEvaluation: {
      status: materialEvaluationStatus,
      scoreBucket: options.scoreBucket,
      rankingSurface,
      perMode: materialPerMode,
      pairwise: materialPairwise,
      coverage: resolvedCoverage,
    },
    projectEvaluation: {
      status: projectEvaluationStatus,
      rankingFunctionUsed: 'learner-home.service.rankProjects (exported for RP-03.3 reuse)',
      algorithmStamp:
        canonicalProjectEvaluationCompleted && canonicalEffectiveProjectMode
          ? deps.algorithmVersionForEffectiveMode(canonicalEffectiveProjectMode)
          : null,
      delegatedFromCanonicalRequest: canonicalProjectEvaluationCompleted
        ? canonicalEffectiveProjectMode !== CANONICAL_MODE
        : null,
      perMode: projectPerMode,
      pairwise: projectPairwise,
      nondeterministicRetrievalDiagnostics: projectRetrievalOrderAmbiguous ? { tieGroups } : null,
    },
    warnings,
    invalidResultReasons: [...new Set(invalidResultReasons)].sort(),
    knownUnrelatedIssues: KNOWN_UNRELATED_ISSUES,
  };

  return finalizeResult(draft);
};

function buildEmptyInvalidResult(
  options: EvaluatorCliOptions,
  reason: string,
  counts?: { materialCount: number; projectCount: number },
): EvaluatorResult {
  const materialCount = counts?.materialCount ?? 0;
  const projectCount = counts?.projectCount ?? 0;
  const zeroFallbackByCode = Object.fromEntries(
    CANONICAL_FALLBACK_CODES.map((code) => [code, 0]),
  ) as Record<CanonicalFallbackCode, number>;

  return {
    evaluatorVersion: EVALUATOR_VERSION,
    status: 'INVALID',
    evaluationTimestampUtc: options.evaluationTimeUtc,
    learner: { userIdHash: hashIdentity(options.userId ?? options.email ?? 'unknown'), emailProvided: Boolean(options.email) },
    pool: { scope: options.poolScope, poolCap: 0 },
    requestedModes: REQUESTED_MODES,
    topK: options.topK,
    inputPoolMutationDetected: false,
    candidatePool: {
      materialCount,
      materialRetrievalOrderDigest: digestOrderedIds([]),
      materialIdentityDigest: digestIdentitySet([]),
      projectCount,
      projectRetrievalOrderDigest: digestOrderedIds([]),
      projectIdentityDigest: digestIdentitySet([]),
      projectRetrievalOrderAmbiguous: false,
      projectRetrievalTieGroups: [],
    },
    modeResults: {} as EvaluatorResult['modeResults'],
    canonicalFallbacks: { total: 0, byCode: zeroFallbackByCode },
    materialEvaluation: {
      status: 'INVALID',
      scoreBucket: options.scoreBucket,
      rankingSurface: resolveMaterialRankingSurface(options.scoreBucket, options.poolScope),
      perMode: {} as EvaluatorResult['materialEvaluation']['perMode'],
      pairwise: {},
      coverage: {
        canonicalRequested: false,
        coverageStatus: 'UNAVAILABLE',
        coverageSource: 'none',
        counts: null,
        coverageUnavailableReason: null,
      },
    },
    projectEvaluation: {
      status: 'INVALID',
      rankingFunctionUsed: 'learner-home.service.rankProjects (exported for RP-03.3 reuse)',
      algorithmStamp: null,
      delegatedFromCanonicalRequest: null,
      perMode: {} as EvaluatorResult['projectEvaluation']['perMode'],
      pairwise: null,
      nondeterministicRetrievalDiagnostics: null,
    },
    warnings: [],
    invalidResultReasons: [reason],
    knownUnrelatedIssues: KNOWN_UNRELATED_ISSUES,
  };
}

/* -------------------------------------------------------------------------
 * CLI entry point.
 * ---------------------------------------------------------------------- */

export const runCli = async (args: string[]): Promise<void> => {
  const options = parseCliArgs(args);
  const deps = await buildRealDeps();
  try {
    const result = await runRankingDeltaEvaluation(options, deps);
    if (options.reportPath) {
      writeJsonAtomically(options.reportPath, result);
    }
    console.log(JSON.stringify(result, null, 2));
    console.error(
      `[evaluate-ranking-delta] status=${result.status} materials=${result.candidatePool.materialCount} projects=${result.candidatePool.projectCount} projectStatus=${result.projectEvaluation.status} mutationDetected=${result.inputPoolMutationDetected} canonicalFallbacks=${result.canonicalFallbacks.total}`,
    );
    if (result.status !== 'VALID') {
      process.exitCode = 1;
    }
  } finally {
    await deps.prisma.$disconnect();
  }
};

const isDirectExecution = (): boolean => {
  const entry = process.argv[1];
  return Boolean(entry && pathToFileURL(resolve(entry)).href === import.meta.url);
};

if (isDirectExecution()) {
  void runCli(process.argv.slice(2)).catch((error: unknown) => {
    if (error instanceof EvaluatorCliError) {
      console.error(JSON.stringify({ status: 'FAILED', code: error.code, message: error.message }, null, 2));
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  });
}
