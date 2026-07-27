import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  EvaluatorCliError,
  arraysEqual,
  buildDetailSampleIds,
  buildRankedEntries,
  canonicalJson,
  canonicalizeEvaluationTime,
  computeMaterialDetailEntry,
  computePairwiseDelta,
  computeProjectDetailEntry,
  computeScoringIdentity,
  computeTiedGroups,
  detectProjectRetrievalTies,
  digestIdentitySet,
  digestOrderedIds,
  extractMaterialRawScoreView,
  finalizeResult,
  hashIdentity,
  parseCliArgs,
  resolveMaterialRankingSurface,
  runRankingDeltaEvaluation,
  snapshotCoverage,
  stableHash,
  withFrozenClock,
  type EvaluatorDeps,
  type EvaluatorResult,
  type MaterialRawScoreView,
  type PairwiseSideMetadata,
  type RankedEntry,
  type RankMovement,
} from './evaluate-ranking-delta.js';
import type {
  LearnerBehaviorContext,
  LearnerHomeMaterialCandidate,
  LearnerHomeProjectCandidate,
} from '../src/modules/learner-home/learner-home.types.js';
import type { CanonicalMaterialSemanticProfile } from '../src/modules/learner-home/learner-home.canonical-scoring.js';
import type { PreScoredMaterialEntry } from '../src/modules/learner-home/learner-home.material-features.js';
import type { MaterialScoringTier } from '../src/modules/learner-home/learner-home.ranking.js';
import type { RecommendationScorerVersion } from '../src/config/recommendation-scoring-version.js';

const sideMeta = (
  requestedMode: RecommendationScorerVersion,
  overrides: Partial<PairwiseSideMetadata> = {},
): PairwiseSideMetadata => ({
  requestedMode,
  effectiveMode: overrides.effectiveMode ?? requestedMode,
  algorithmStamp: overrides.algorithmStamp ?? `learner-home-v1:${overrides.effectiveMode ?? requestedMode}`,
  fallbackCode: overrides.fallbackCode ?? null,
});

/* -------------------------------------------------------------------------
 * Fixture builders (no Prisma, no scoring formulas — pure test doubles).
 * ---------------------------------------------------------------------- */

const material = (
  overrides: Partial<LearnerHomeMaterialCandidate> = {},
): LearnerHomeMaterialCandidate => ({
  id: 'mat-1',
  ownerId: 'owner-1',
  title: 'Arduino Uno',
  description: 'Board',
  materialType: 'Arduino Board',
  categoryId: 'cat-electronics',
  categoryNameEn: 'Electronics',
  categoryNameAr: 'الكترونيات',
  status: 'AVAILABLE',
  isFree: false,
  deliveryAllowed: true,
  pickupAllowed: true,
  viewsCount: 10,
  likesCount: 2,
  city: 'Ramallah',
  area: null,
  tags: ['arduino'],
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  availableQuantity: 3,
  mapped: { id: overrides.id ?? 'mat-1' },
  ...overrides,
});

const project = (
  overrides: Partial<LearnerHomeProjectCandidate> = {},
): LearnerHomeProjectCandidate => ({
  id: 'proj-1',
  title: 'Robot Arm',
  shortDescription: 'Build a robot arm',
  difficulty: 'BEGINNER',
  estimatedDurationMinutes: 120,
  coverImageUrl: null,
  categoryId: 'cat-electronics',
  categoryNameEn: 'Electronics',
  categoryNameAr: 'الكترونيات',
  tags: ['robotics'],
  createdAt: new Date('2026-06-01T00:00:00.000Z'),
  likesCount: 1,
  savesCount: 0,
  reviewCount: 0,
  reviewAverage: 0,
  requiredComponents: [],
  mapped: { id: overrides.id ?? 'proj-1', isSaved: false },
  ...overrides,
});

const emptyBehavior = (): LearnerBehaviorContext => ({
  likedMaterials: [],
  viewedMaterials: [],
  reservedMaterials: [],
  savedProjectComponents: [],
  savedProjects: [],
  likedProjects: [],
  followedProjects: [],
  inProgressBuildProjects: [],
});

const scoredMaterialResult = (
  score: number,
  tier: MaterialScoringTier = 1,
  overrides: Partial<{ reasons: string[]; hasPrimaryRelevance: boolean; fallbackOnly: boolean }> = {},
) => ({
  score,
  reasons: overrides.reasons ?? ([] as string[]),
  tier,
  hasPrimaryRelevance: overrides.hasPrimaryRelevance ?? true,
  fallbackOnly: overrides.fallbackOnly ?? false,
});

/** A raw score result shaped like the runtime object `preScoreMaterials`
 * actually returns under canonical-taxonomy-v3 — i.e. the same
 * ScoredMaterialResult-typed field additionally carrying the canonical-only
 * `internalReasonCodes`/`semanticCoverage`/`components` fields. */
const canonicalScoredMaterialResult = (
  score: number,
  tier: MaterialScoringTier,
  components: Record<string, number>,
  overrides: Partial<{
    reasons: string[];
    internalReasonCodes: string[];
    semanticCoverage: string;
    hasPrimaryRelevance: boolean;
    fallbackOnly: boolean;
  }> = {},
) => ({
  score,
  reasons: overrides.reasons ?? ([] as string[]),
  tier,
  hasPrimaryRelevance: overrides.hasPrimaryRelevance ?? true,
  fallbackOnly: overrides.fallbackOnly ?? false,
  internalReasonCodes: overrides.internalReasonCodes ?? ([] as string[]),
  semanticCoverage: overrides.semanticCoverage ?? 'READY_FAMILY_ONLY',
  components,
});

type FixturePool = {
  materials: LearnerHomeMaterialCandidate[];
  projects: LearnerHomeProjectCandidate[];
};

const defaultFixture = (): FixturePool => ({
  materials: [material({ id: 'mat-1' }), material({ id: 'mat-2' }), material({ id: 'mat-3' })],
  projects: [
    project({ id: 'proj-1', createdAt: new Date('2026-06-01T00:00:00.000Z') }),
    project({ id: 'proj-2', createdAt: new Date('2026-06-02T00:00:00.000Z') }),
    project({ id: 'proj-3', createdAt: new Date('2026-06-03T00:00:00.000Z') }),
  ],
});

/** Fake rankProjects mirroring the real production combinator's exact
 * map-then-filter-then-sort-then-dedupe shape (see learner-home.service.ts
 * rankProjects, 1188:1223), so the recording-wrapper scoring-identity
 * technique under test behaves identically to production. */
const fakeRankProjects = (
  projects: LearnerHomeProjectCandidate[],
  scorer: (project: LearnerHomeProjectCandidate) => { score: number; reasons: string[]; tier?: number },
  limit: number,
) => {
  const ranked = projects
    .map((candidate) => {
      const scored = scorer(candidate);
      return { score: scored.score, reasons: scored.reasons, project: candidate.mapped, tier: scored.tier ?? 99 };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);
  const seen = new Set<string>();
  const deduped: Array<{ type: 'project'; score: number; reasons: string[]; project: Record<string, unknown> }> = [];
  for (const entry of ranked) {
    if (deduped.length >= limit) break;
    const id = String(entry.project.id ?? '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    deduped.push({ type: 'project', score: entry.score, reasons: entry.reasons, project: entry.project });
  }
  return deduped;
};

/** Test double mirroring the *shape* of production's real
 * `rankPreScoredMaterialEntries` (learner-home.service.ts, exported for
 * RP-03.3 reuse): filters `score <= 0` before ranking, then either fully
 * sorts by (tier, score) for `browseAllTierSort`, or — for the tiered-Home
 * surface — keeps only the best tier group actually present among the
 * survivors. The exact tier-grouping rule intentionally does not need to
 * match `selectTieredSuggestedMaterials`'s real grouping precisely (that is
 * covered by the real function in the orchestration test suite); this
 * double only needs to be internally consistent so the orchestration code's
 * *handling* of eliminated candidates (`TIER_NOT_SELECTED` vs
 * `NON_POSITIVE_SCORE` vs ranked) can be exercised deterministically. */
const fakeRankPreScoredMaterialEntries = (
  entries: PreScoredMaterialEntry[],
  scoreKey: keyof PreScoredMaterialEntry['scores'],
  useTieredSuggestedRanking: boolean,
  browseAllTierSort: boolean,
) => {
  const mapped = entries
    .map((entry) => {
      const scored = entry.scores[scoreKey] as unknown as MaterialRawScoreView;
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
    return [...mapped].sort((left, right) => right.score - left.score);
  }

  const sorted = [...mapped].sort((left, right) =>
    left.tier !== right.tier ? left.tier - right.tier : right.score - left.score,
  );

  if (browseAllTierSort || sorted.length === 0) {
    return sorted;
  }

  const bestTier = sorted[0]!.tier;
  return sorted.filter((entry) => entry.tier === bestTier);
};

const buildFakeDeps = (
  fixture: FixturePool,
  overrides: Partial<EvaluatorDeps> = {},
): EvaluatorDeps => ({
  prisma: {
    user: {
      findMany: async () => [
        {
          id: 'user-1',
          email: 'learner@test.com',
          accountStatus: 'ACTIVE',
          recommendationEvidenceEligibility: 'ELIGIBLE',
        },
      ],
    },
    $disconnect: async () => {},
  },
  loadLearnerInterests: async () => ['arduino'],
  loadDefaultSavedLocation: async () => ({ city: null, area: null }),
  loadLearnerHomeProjectContext: async () => ({
    behavior: emptyBehavior(),
    projects: fixture.projects,
    savedProjects: [],
    inProgressBuilds: [],
    hasSavedProjects: false,
  }),
  loadMaterialCandidatesForLearner: async () => fixture.materials,
  homeMaterialPoolCap: 120,
  browseMaterialPoolCap: 400,
  normalizeInterests: (interests) => interests,
  buildBehaviorAffinityProfile: () => new Map(),
  hasLearnerActivity: () => false,
  resolveMaterialModeDecisionAndContext: async ({ requestedMaterialScoringMode }) => ({
    modeDecision: {
      requestedMaterialScoringMode,
      effectiveMaterialScoringMode: requestedMaterialScoringMode,
      effectiveProjectScoringMode: 'legacy-v1',
      fallbackCode: null,
      cacheable: true,
    },
    canonicalContext: undefined,
  }),
  preScoreMaterials: (context) =>
    context.materials.map((candidate, index) => ({
      material: candidate,
      ownerId: candidate.ownerId,
      scores: {
        suggested: scoredMaterialResult(10 - index),
        savedProjects: scoredMaterialResult(5 - index),
        free: scoredMaterialResult(1 - index),
      },
    })),
  rankProjects: fakeRankProjects,
  scoreSuggestedProject: () => ({ score: 5, reasons: [], tier: 1 }),
  resolveProjectScorerVersion: (mode) => (mode === 'canonical-taxonomy-v3' ? 'legacy-v1' : mode ?? 'legacy-v1'),
  rankPreScoredMaterialEntries: fakeRankPreScoredMaterialEntries,
  algorithmVersionForEffectiveMode: (mode) => `learner-home-v1:${mode}`,
  getProjectItemId: (item) => String((item.project as Record<string, unknown>).id ?? ''),
  currentScorerVersionConstant: () => 'legacy-v1',
  ...overrides,
});

const baseOptions = () => ({
  userId: 'user-1',
  email: undefined,
  evaluationTimeUtc: '2026-07-20T00:00:00.000Z',
  topK: 2,
  poolScope: 'home' as const,
  scoreBucket: 'suggested' as const,
  reportPath: undefined,
});

/* -------------------------------------------------------------------------
 * 1. canonicalJson / stableHash
 * ---------------------------------------------------------------------- */

describe('canonicalJson / stableHash', () => {
  test('sorts object keys deterministically regardless of insertion order', () => {
    const a = canonicalJson({ b: 1, a: 2 });
    const b = canonicalJson({ a: 2, b: 1 });
    assert.equal(a, b);
  });

  test('stableHash changes when a value changes', () => {
    const h1 = stableHash({ score: 1 });
    const h2 = stableHash({ score: 2 });
    assert.notEqual(h1, h2);
  });

  test('stableHash is identical for structurally identical input', () => {
    assert.equal(stableHash({ a: [1, 2, 3] }), stableHash({ a: [1, 2, 3] }));
  });

  test('canonicalJson rejects non-finite numbers and undefined', () => {
    assert.throws(() => canonicalJson({ a: Number.NaN }));
    assert.throws(() => canonicalJson({ a: undefined }));
  });
});

/* -------------------------------------------------------------------------
 * 2. Digests: retrieval-order vs identity
 * ---------------------------------------------------------------------- */

describe('digestOrderedIds vs digestIdentitySet', () => {
  test('retrieval-order digest differs when order differs', () => {
    assert.notEqual(digestOrderedIds(['a', 'b']), digestOrderedIds(['b', 'a']));
  });

  test('identity digest is identical regardless of input order', () => {
    assert.equal(digestIdentitySet(['a', 'b']), digestIdentitySet(['b', 'a']));
  });

  test('identity digest de-duplicates', () => {
    assert.equal(digestIdentitySet(['a', 'a', 'b']), digestIdentitySet(['a', 'b']));
  });
});

/* -------------------------------------------------------------------------
 * 3. arraysEqual
 * ---------------------------------------------------------------------- */

describe('arraysEqual', () => {
  test('true for identical order and content', () => {
    assert.equal(arraysEqual(['a', 'b'], ['a', 'b']), true);
  });
  test('false when order differs', () => {
    assert.equal(arraysEqual(['a', 'b'], ['b', 'a']), false);
  });
  test('false when length differs', () => {
    assert.equal(arraysEqual(['a'], ['a', 'b']), false);
  });
});

/* -------------------------------------------------------------------------
 * 4. Scoring identity
 * ---------------------------------------------------------------------- */

describe('computeScoringIdentity', () => {
  test('valid when every frozen id has exactly one raw score', () => {
    const result = computeScoringIdentity(['a', 'b', 'c'], ['a', 'b', 'c']);
    assert.equal(result.identityMatch, true);
    assert.deepEqual(result.missingScoreIds, []);
    assert.deepEqual(result.extraScoreIds, []);
    assert.deepEqual(result.duplicateScoreIds, []);
  });

  test('missing candidate is invalid, never reinterpreted as filtering', () => {
    const result = computeScoringIdentity(['a', 'b', 'c'], ['a', 'c']);
    assert.equal(result.identityMatch, false);
    assert.deepEqual(result.missingScoreIds, ['b']);
  });

  test('extra id (not in frozen pool) is invalid', () => {
    const result = computeScoringIdentity(['a', 'b'], ['a', 'b', 'z']);
    assert.equal(result.identityMatch, false);
    assert.deepEqual(result.extraScoreIds, ['z']);
  });

  test('duplicate raw score for the same id is invalid', () => {
    const result = computeScoringIdentity(['a', 'b'], ['a', 'a', 'b']);
    assert.equal(result.identityMatch, false);
    assert.deepEqual(result.duplicateScoreIds, ['a']);
  });
});

/* -------------------------------------------------------------------------
 * 5. Project retrieval-order ambiguity detection
 * ---------------------------------------------------------------------- */

describe('detectProjectRetrievalTies', () => {
  test('no ties when every createdAt is distinct', () => {
    const projects = [
      { id: 'p1', createdAt: new Date('2026-06-01T00:00:00.000Z') },
      { id: 'p2', createdAt: new Date('2026-06-02T00:00:00.000Z') },
    ];
    assert.deepEqual(detectProjectRetrievalTies(projects), []);
  });

  test('detects a tie group for identical createdAt values', () => {
    const tied = new Date('2026-06-01T00:00:00.000Z');
    const projects = [
      { id: 'p2', createdAt: tied },
      { id: 'p1', createdAt: tied },
    ];
    const groups = detectProjectRetrievalTies(projects);
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0]!.projectIdsSortedAscending, ['p1', 'p2']);
  });

  test('tie-group output is byte-identical regardless of input array order', () => {
    const tied = new Date('2026-06-01T00:00:00.000Z');
    const orderA = [
      { id: 'p2', createdAt: tied },
      { id: 'p1', createdAt: tied },
      { id: 'p3', createdAt: new Date('2026-06-05T00:00:00.000Z') },
    ];
    const orderB = [
      { id: 'p3', createdAt: new Date('2026-06-05T00:00:00.000Z') },
      { id: 'p1', createdAt: tied },
      { id: 'p2', createdAt: tied },
    ];
    assert.equal(
      JSON.stringify(detectProjectRetrievalTies(orderA)),
      JSON.stringify(detectProjectRetrievalTies(orderB)),
    );
  });
});

/* -------------------------------------------------------------------------
 * 6. Delta calculations
 * ---------------------------------------------------------------------- */

describe('computePairwiseDelta', () => {
  const rankedA: RankedEntry[] = [
    { id: 'a', rank: 1, score: 10 },
    { id: 'b', rank: 2, score: 8 },
    { id: 'c', rank: 3, score: 6 },
    { id: 'd', rank: 4, score: 4 },
  ];
  const rankedB: RankedEntry[] = [
    { id: 'b', rank: 1, score: 12 },
    { id: 'a', rank: 2, score: 9 },
    { id: 'e', rank: 3, score: 7 },
    { id: 'd', rank: 4, score: 4 },
  ];

  test('top-K overlap count/ratio', () => {
    const delta = computePairwiseDelta(rankedA, rankedB, 2);
    // top-2 of A: {a,b}; top-2 of B: {b,a} -> overlap 2
    assert.equal(delta.overlapCount, 2);
    assert.equal(delta.overlapRatio, 1);
  });

  test('entering and leaving top-K', () => {
    const delta = computePairwiseDelta(rankedA, rankedB, 3);
    // top-3 A: a,b,c ; top-3 B: b,a,e -> entering: e; leaving: c
    assert.deepEqual(delta.entering, ['e']);
    assert.deepEqual(delta.leaving, ['c']);
  });

  test('rank movement is signed (positive = moved up)', () => {
    const delta = computePairwiseDelta(rankedA, rankedB, 4);
    const bMovement = delta.rankMovements.find((m) => m.id === 'b')!;
    assert.equal(bMovement.rankInA, 2);
    assert.equal(bMovement.rankInB, 1);
    assert.equal(bMovement.rankMovement, 1);
    assert.equal(bMovement.absoluteRankMovement, 1);
  });

  test('unchanged candidates have zero movement and zero score diff', () => {
    const delta = computePairwiseDelta(rankedA, rankedB, 4);
    assert.deepEqual(delta.unchangedCandidates, ['d']);
  });

  test('largest upward/downward movements are sorted correctly', () => {
    const delta = computePairwiseDelta(rankedA, rankedB, 4);
    assert.equal(delta.largestUpwardMovements[0]!.id, 'b');
    assert.equal(delta.largestDownwardMovements[0]!.id, 'a');
  });

  test('candidate count below K reports topKCount and truncation flags', () => {
    const small: RankedEntry[] = [{ id: 'x', rank: 1, score: 1 }];
    const delta = computePairwiseDelta(small, small, 10);
    assert.equal(delta.requestedK, 10);
    assert.equal(delta.topKCountA, 1);
    assert.equal(delta.topKCountB, 1);
    assert.equal(delta.effectiveK, 1);
    assert.equal(delta.truncatedInA, true);
    assert.equal(delta.truncatedInB, true);
    assert.equal(delta.truncatedByPoolSize, true);
  });

  test('unequal ranked lengths: A has 1, B has 3, K=3 — B extras enter; overlap ratio is 1/3 not 1', () => {
    const shortA: RankedEntry[] = [{ id: 'shared', rank: 1, score: 10 }];
    const longB: RankedEntry[] = [
      { id: 'shared', rank: 1, score: 12 },
      { id: 'enter-1', rank: 2, score: 8 },
      { id: 'enter-2', rank: 3, score: 6 },
    ];
    const delta = computePairwiseDelta(shortA, longB, 3);
    assert.equal(delta.requestedK, 3);
    assert.equal(delta.topKCountA, 1);
    assert.equal(delta.topKCountB, 3);
    assert.equal(delta.truncatedInA, true);
    assert.equal(delta.truncatedInB, false);
    assert.equal(delta.overlapCount, 1);
    assert.equal(delta.overlapRatio, 1 / 3);
    assert.deepEqual(delta.entering, ['enter-1', 'enter-2']);
    assert.deepEqual(delta.leaving, []);
  });

  test('unequal ranked lengths reverse: A has 3, B has 1, K=3 — A extras leave; overlap ratio is 1/3', () => {
    const longA: RankedEntry[] = [
      { id: 'shared', rank: 1, score: 10 },
      { id: 'leave-1', rank: 2, score: 8 },
      { id: 'leave-2', rank: 3, score: 6 },
    ];
    const shortB: RankedEntry[] = [{ id: 'shared', rank: 1, score: 12 }];
    const delta = computePairwiseDelta(longA, shortB, 3);
    assert.equal(delta.topKCountA, 3);
    assert.equal(delta.topKCountB, 1);
    assert.equal(delta.overlapCount, 1);
    assert.equal(delta.overlapRatio, 1 / 3);
    assert.deepEqual(delta.entering, []);
    assert.deepEqual(delta.leaving, ['leave-1', 'leave-2']);
  });

  test('both rankings shorter than K but with different lengths', () => {
    const rankedA: RankedEntry[] = [
      { id: 'a', rank: 1, score: 10 },
      { id: 'b', rank: 2, score: 8 },
    ];
    const rankedB: RankedEntry[] = [{ id: 'a', rank: 1, score: 9 }];
    const delta = computePairwiseDelta(rankedA, rankedB, 5);
    assert.equal(delta.topKCountA, 2);
    assert.equal(delta.topKCountB, 1);
    assert.equal(delta.truncatedInA, true);
    assert.equal(delta.truncatedInB, true);
    assert.equal(delta.overlapCount, 1);
    assert.equal(delta.overlapRatio, 1 / 2);
    assert.deepEqual(delta.entering, []);
    assert.deepEqual(delta.leaving, ['b']);
  });

  test('equal-length rankings preserve prior overlap / entering / leaving behavior', () => {
    const delta = computePairwiseDelta(rankedA, rankedB, 3);
    assert.equal(delta.topKCountA, 3);
    assert.equal(delta.topKCountB, 3);
    assert.equal(delta.overlapCount, 2);
    assert.equal(delta.overlapRatio, 2 / 3);
    assert.deepEqual(delta.entering, ['e']);
    assert.deepEqual(delta.leaving, ['c']);
  });

  test('largestUpwardMovements never includes an unchanged or downward candidate', () => {
    // Everyone moves down or stays the same; there is no true upward mover.
    const allDown: RankedEntry[] = [
      { id: 'a', rank: 1, score: 10 },
      { id: 'b', rank: 2, score: 8 },
    ];
    const allDownB: RankedEntry[] = [
      { id: 'a', rank: 2, score: 9 },
      { id: 'b', rank: 2, score: 8 },
    ];
    // 'b' is unchanged (rank 2 -> 2), 'a' moved down (rank 1 -> 2).
    const delta = computePairwiseDelta(allDown, allDownB, 2);
    assert.deepEqual(delta.largestUpwardMovements, []);
    assert.equal(delta.largestDownwardMovements.length, 1);
    assert.equal(delta.largestDownwardMovements[0]!.id, 'a');
  });

  test('largestDownwardMovements never includes an unchanged or upward candidate', () => {
    const before: RankedEntry[] = [
      { id: 'a', rank: 2, score: 8 },
      { id: 'b', rank: 1, score: 10 },
    ];
    const after: RankedEntry[] = [
      { id: 'a', rank: 1, score: 11 },
      { id: 'b', rank: 1, score: 10 },
    ];
    // 'a' moved up (rank 2 -> 1); 'b' unchanged (rank 1 -> 1).
    const delta = computePairwiseDelta(before, after, 2);
    assert.deepEqual(delta.largestDownwardMovements, []);
    assert.equal(delta.largestUpwardMovements.length, 1);
    assert.equal(delta.largestUpwardMovements[0]!.id, 'a');
  });

  test('fewer than five true movements in one direction never pads the list', () => {
    const before: RankedEntry[] = [
      { id: 'a', rank: 1, score: 10 },
      { id: 'b', rank: 2, score: 8 },
      { id: 'c', rank: 3, score: 6 },
    ];
    const after: RankedEntry[] = [
      { id: 'b', rank: 1, score: 12 },
      { id: 'a', rank: 2, score: 9 },
      { id: 'c', rank: 3, score: 6 },
    ];
    const delta = computePairwiseDelta(before, after, 3);
    // Only 'b' moved up; 'a' moved down; 'c' unchanged.
    assert.equal(delta.largestUpwardMovements.length, 1);
    assert.equal(delta.largestDownwardMovements.length, 1);
  });

  test('equal-magnitude movement ties break deterministically by rankInA then id, without altering production ranking', () => {
    const before: RankedEntry[] = [
      { id: 'z', rank: 1, score: 10 },
      { id: 'a', rank: 2, score: 8 },
      { id: 'b', rank: 3, score: 6 },
    ];
    const after: RankedEntry[] = [
      { id: 'a', rank: 1, score: 9 },
      { id: 'b', rank: 2, score: 7 },
      { id: 'z', rank: 3, score: 5 },
    ];
    // 'a' and 'b' both move up by 1; tie-break is rankInA (2 before 3), so 'a' first.
    const delta = computePairwiseDelta(before, after, 3);
    assert.equal(delta.largestUpwardMovements[0]!.id, 'a');
    assert.equal(delta.largestUpwardMovements[1]!.id, 'b');
  });
});

describe('computeTiedGroups', () => {
  test('groups candidates sharing identical (tier, score), preserving production order', () => {
    const ranked: RankedEntry[] = [
      { id: 'a', rank: 1, score: 5, tier: 1 },
      { id: 'b', rank: 2, score: 5, tier: 1 },
      { id: 'c', rank: 3, score: 3, tier: 2 },
    ];
    const groups = computeTiedGroups(ranked);
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0]!.candidateIdsInProductionOrder, ['a', 'b']);
  });

  test('no groups when every (tier, score) pair is unique', () => {
    const ranked: RankedEntry[] = [
      { id: 'a', rank: 1, score: 5, tier: 1 },
      { id: 'b', rank: 2, score: 4, tier: 1 },
    ];
    assert.deepEqual(computeTiedGroups(ranked), []);
  });
});

/* -------------------------------------------------------------------------
 * Material ranking-surface resolution (section 1).
 * ---------------------------------------------------------------------- */

describe('resolveMaterialRankingSurface', () => {
  test('suggested + home maps to tiered-Home selection (selectTieredSuggestedMaterials)', () => {
    const surface = resolveMaterialRankingSurface('suggested', 'home');
    assert.equal(surface.useTieredSuggestedRanking, true);
    assert.equal(surface.browseAllTierSort, false);
    assert.equal(surface.poolScopeAffectsRanking, true);
  });

  test('suggested + browse maps to browse-all tier sort (sortAllRankedMaterials)', () => {
    const surface = resolveMaterialRankingSurface('suggested', 'browse');
    assert.equal(surface.useTieredSuggestedRanking, true);
    assert.equal(surface.browseAllTierSort, true);
    assert.equal(surface.poolScopeAffectsRanking, true);
  });

  test('savedProjects bucket always uses browse-all tier sort regardless of --pool', () => {
    assert.deepEqual(
      resolveMaterialRankingSurface('savedProjects', 'home'),
      resolveMaterialRankingSurface('savedProjects', 'browse'),
    );
    assert.equal(resolveMaterialRankingSurface('savedProjects', 'home').poolScopeAffectsRanking, false);
  });

  test('free bucket always uses browse-all tier sort regardless of --pool', () => {
    assert.deepEqual(
      resolveMaterialRankingSurface('free', 'home'),
      resolveMaterialRankingSurface('free', 'browse'),
    );
    assert.equal(resolveMaterialRankingSurface('free', 'home').poolScopeAffectsRanking, false);
  });
});

/* -------------------------------------------------------------------------
 * Bounded reason/component delta evidence (section 2).
 * ---------------------------------------------------------------------- */

describe('extractMaterialRawScoreView', () => {
  test('legacy/normalized result has no canonical extras', () => {
    const view = extractMaterialRawScoreView(scoredMaterialResult(5, 2, { reasons: ['interest_match'] }));
    assert.equal(view.score, 5);
    assert.equal(view.tier, 2);
    assert.deepEqual(view.reasons, ['interest_match']);
    assert.equal(view.internalReasonCodes, null);
    assert.equal(view.semanticCoverage, null);
    assert.equal(view.components, null);
  });

  test('canonical result exposes internalReasonCodes/semanticCoverage/components without a second scoring call', () => {
    const view = extractMaterialRawScoreView(
      canonicalScoredMaterialResult(
        12,
        1,
        { likedSimilarity: 5, location: 7 },
        { internalReasonCodes: ['CANONICAL_FAMILY_OVERLAP'], semanticCoverage: 'READY_FAMILY_ONLY' },
      ),
    );
    assert.deepEqual(view.internalReasonCodes, ['CANONICAL_FAMILY_OVERLAP']);
    assert.equal(view.semanticCoverage, 'READY_FAMILY_ONLY');
    assert.deepEqual(view.components, { likedSimilarity: 5, location: 7 });
  });
});

describe('computeMaterialDetailEntry', () => {
  test('reports reasons added and removed plus explicit requested/effective mode snapshots', () => {
    const a = extractMaterialRawScoreView(scoredMaterialResult(5, 1, { reasons: ['near_you', 'interest_match'] }));
    const b = extractMaterialRawScoreView(scoredMaterialResult(6, 1, { reasons: ['interest_match', 'popular'] }));
    const entry = computeMaterialDetailEntry(
      'mat-1',
      sideMeta('legacy-v1'),
      sideMeta('normalized-interests-v2'),
      a,
      b,
    );
    assert.deepEqual(entry.reasonsAdded, ['popular']);
    assert.deepEqual(entry.reasonsRemoved, ['near_you']);
    assert.equal(entry.modeA.requestedMode, 'legacy-v1');
    assert.equal(entry.modeA.effectiveMode, 'legacy-v1');
    assert.equal(entry.modeA.score, 5);
    assert.deepEqual(entry.modeA.reasons, ['near_you', 'interest_match']);
    assert.equal(entry.modeB.requestedMode, 'normalized-interests-v2');
    assert.equal(entry.modeB.effectiveMode, 'normalized-interests-v2');
    assert.equal(entry.modeB.score, 6);
    assert.deepEqual(entry.modeB.reasons, ['interest_match', 'popular']);
  });

  test('computes a component-by-component delta when both sides are canonical', () => {
    const a = extractMaterialRawScoreView(
      canonicalScoredMaterialResult(10, 1, { likedSimilarity: 5, location: 0 }),
    );
    const b = extractMaterialRawScoreView(
      canonicalScoredMaterialResult(13, 1, { likedSimilarity: 5, location: 3 }),
    );
    const entry = computeMaterialDetailEntry(
      'mat-1',
      sideMeta('canonical-taxonomy-v3'),
      sideMeta('canonical-taxonomy-v3'),
      a,
      b,
    );
    assert.equal(entry.componentsUnavailable, false);
    assert.deepEqual(entry.componentDeltas, { likedSimilarity: 0, location: 3 });
    assert.deepEqual(entry.modeA.components, { likedSimilarity: 5, location: 0 });
    assert.deepEqual(entry.modeB.components, { likedSimilarity: 5, location: 3 });
  });

  test('internalReasonCodes added/removed when both sides are canonical', () => {
    const a = extractMaterialRawScoreView(
      canonicalScoredMaterialResult(10, 1, {}, { internalReasonCodes: ['CANONICAL_FAMILY_OVERLAP'] }),
    );
    const b = extractMaterialRawScoreView(
      canonicalScoredMaterialResult(10, 1, {}, { internalReasonCodes: ['CANONICAL_FORM_OVERLAP'] }),
    );
    const entry = computeMaterialDetailEntry(
      'mat-1',
      sideMeta('canonical-taxonomy-v3'),
      sideMeta('canonical-taxonomy-v3'),
      a,
      b,
    );
    assert.deepEqual(entry.internalReasonCodesAdded, ['CANONICAL_FORM_OVERLAP']);
    assert.deepEqual(entry.internalReasonCodesRemoved, ['CANONICAL_FAMILY_OVERLAP']);
  });

  test('legacy-vs-canonical surfaces absolute canonical evidence without fabricating legacy components', () => {
    const legacy = extractMaterialRawScoreView(
      scoredMaterialResult(5, 1, { reasons: ['near_you'] }),
    );
    const canonical = extractMaterialRawScoreView(
      canonicalScoredMaterialResult(
        8,
        1,
        { likedSimilarity: 4, location: 2 },
        {
          reasons: ['canonical-liked-overlap'],
          internalReasonCodes: ['CANONICAL_FAMILY_OVERLAP'],
          semanticCoverage: 'READY_FAMILY_ONLY',
        },
      ),
    );
    const entry = computeMaterialDetailEntry(
      'mat-1',
      sideMeta('legacy-v1'),
      sideMeta('canonical-taxonomy-v3'),
      legacy,
      canonical,
    );
    assert.equal(entry.modeA.requestedMode, 'legacy-v1');
    assert.equal(entry.modeA.effectiveMode, 'legacy-v1');
    assert.equal(entry.modeA.components, null);
    assert.equal(entry.modeA.internalReasonCodes, null);
    assert.equal(entry.modeA.semanticCoverage, null);
    assert.equal(entry.modeB.requestedMode, 'canonical-taxonomy-v3');
    assert.equal(entry.modeB.effectiveMode, 'canonical-taxonomy-v3');
    assert.deepEqual(entry.modeB.components, { likedSimilarity: 4, location: 2 });
    assert.deepEqual(entry.modeB.internalReasonCodes, ['CANONICAL_FAMILY_OVERLAP']);
    assert.equal(entry.modeB.semanticCoverage, 'READY_FAMILY_ONLY');
    assert.equal(entry.componentsUnavailable, true);
    assert.equal(entry.componentDeltas, null);
    assert.deepEqual(entry.reasonsAdded, ['canonical-liked-overlap']);
    assert.deepEqual(entry.reasonsRemoved, ['near_you']);
    // One-sided codes are still exposed absolutely and via derived add/remove
    // (missing side treated as empty) — never discarded merely because legacy has none.
    assert.deepEqual(entry.internalReasonCodesAdded, ['CANONICAL_FAMILY_OVERLAP']);
    assert.deepEqual(entry.internalReasonCodesRemoved, []);

    const legacyVsLegacy = computeMaterialDetailEntry(
      'mat-1',
      sideMeta('legacy-v1'),
      sideMeta('normalized-interests-v2'),
      extractMaterialRawScoreView(scoredMaterialResult(5, 1)),
      extractMaterialRawScoreView(scoredMaterialResult(6, 1)),
    );
    assert.equal(legacyVsLegacy.componentsUnavailable, true);
    assert.equal(legacyVsLegacy.componentDeltas, null);
    assert.equal(legacyVsLegacy.modeA.components, null);
    assert.equal(legacyVsLegacy.modeB.components, null);
  });

  test('fallback effective legacy is never labeled as canonical output', () => {
    const legacy = extractMaterialRawScoreView(scoredMaterialResult(5, 1, { reasons: ['near_you'] }));
    const fallbackLegacy = extractMaterialRawScoreView(
      scoredMaterialResult(8, 1, { reasons: ['legacy-after-fallback'] }),
    );
    const entry = computeMaterialDetailEntry(
      'mat-1',
      sideMeta('legacy-v1'),
      sideMeta('canonical-taxonomy-v3', {
        effectiveMode: 'legacy-v1',
        algorithmStamp: 'learner-home-v1:legacy-v1',
        fallbackCode: 'CANONICAL_CONTEXT_INVARIANT_FALLBACK',
      }),
      legacy,
      fallbackLegacy,
    );
    assert.equal(entry.modeB.requestedMode, 'canonical-taxonomy-v3');
    assert.equal(entry.modeB.effectiveMode, 'legacy-v1');
    assert.equal(entry.modeB.algorithmStamp, 'learner-home-v1:legacy-v1');
    assert.equal(entry.modeB.fallbackCode, 'CANONICAL_CONTEXT_INVARIANT_FALLBACK');
    assert.equal(entry.modeB.components, null);
    assert.equal(entry.modeB.internalReasonCodes, null);
    assert.equal(entry.modeB.semanticCoverage, null);
  });

  test('missing raw view on one side is treated as empty reasons/components, not a crash', () => {
    const b = extractMaterialRawScoreView(scoredMaterialResult(5, 1, { reasons: ['interest_match'] }));
    const entry = computeMaterialDetailEntry(
      'mat-1',
      sideMeta('legacy-v1'),
      sideMeta('normalized-interests-v2'),
      undefined,
      b,
    );
    assert.deepEqual(entry.reasonsAdded, ['interest_match']);
    assert.deepEqual(entry.reasonsRemoved, []);
    assert.equal(entry.modeA.score, null);
    assert.equal(entry.modeB.score, 5);
  });
});

describe('computeProjectDetailEntry', () => {
  test('reports reasons added/removed with requested/effective project mode metadata', () => {
    const entry = computeProjectDetailEntry(
      'proj-1',
      sideMeta('legacy-v1'),
      sideMeta('canonical-taxonomy-v3', {
        effectiveMode: 'legacy-v1',
        algorithmStamp: 'learner-home-v1:legacy-v1',
      }),
      { score: 5, reasons: ['interest_match'] },
      { score: 7, reasons: ['interest_match', 'behavior_strong'] },
    );
    assert.deepEqual(entry.reasonsAdded, ['behavior_strong']);
    assert.deepEqual(entry.reasonsRemoved, []);
    assert.equal(entry.modeA.requestedMode, 'legacy-v1');
    assert.equal(entry.modeA.effectiveMode, 'legacy-v1');
    assert.equal(entry.modeA.score, 5);
    assert.equal(entry.modeB.requestedMode, 'canonical-taxonomy-v3');
    assert.equal(entry.modeB.effectiveMode, 'legacy-v1');
    assert.equal(entry.modeB.algorithmStamp, 'learner-home-v1:legacy-v1');
    assert.equal(entry.modeB.score, 7);
    assert.ok(!('componentDeltas' in entry));
  });
});

describe('buildDetailSampleIds', () => {
  const rankedA: RankedEntry[] = [
    { id: 'a', rank: 1, score: 10 },
    { id: 'b', rank: 2, score: 8 },
    { id: 'c', rank: 3, score: 6 },
  ];
  const rankedB: RankedEntry[] = [
    { id: 'b', rank: 1, score: 12 },
    { id: 'a', rank: 2, score: 9 },
    { id: 'c', rank: 3, score: 6 },
  ];
  const noMovements: RankMovement[] = [];

  test('is the deterministic union of both Top-K sets plus movement highlights', () => {
    const ids = buildDetailSampleIds(rankedA, rankedB, 2, noMovements, noMovements);
    assert.deepEqual(ids, ['a', 'b']);
  });

  test('is capped at the documented deterministic limit', () => {
    const many: RankedEntry[] = Array.from({ length: 50 }, (_, index) => ({
      id: `m-${index}`,
      rank: index + 1,
      score: 50 - index,
    }));
    const ids = buildDetailSampleIds(many, many, 50, noMovements, noMovements);
    assert.equal(ids.length, 20);
  });

  test('includes largest movement ids even outside the Top-K window', () => {
    const movement: RankMovement = {
      id: 'far-mover',
      rankInA: 40,
      rankInB: 2,
      rankMovement: 38,
      absoluteRankMovement: 38,
      scoreDiff: 5,
    };
    const ids = buildDetailSampleIds(rankedA, rankedB, 1, [movement], noMovements);
    assert.ok(ids.includes('far-mover'));
  });

  test('does not truncate the longer mode to the shorter mode before the final cap', () => {
    const shortA: RankedEntry[] = [{ id: 'shared', rank: 1, score: 10 }];
    const longB: RankedEntry[] = [
      { id: 'shared', rank: 1, score: 12 },
      { id: 'enter-1', rank: 2, score: 8 },
      { id: 'enter-2', rank: 3, score: 6 },
    ];
    const ids = buildDetailSampleIds(shortA, longB, 3, noMovements, noMovements);
    // All three B Top-K IDs are considered (shared, enter-1, enter-2) before the final cap.
    assert.deepEqual(ids, ['shared', 'enter-1', 'enter-2']);
  });

  test('reverse unequal lengths also keep the longer mode Top-K intact before the final cap', () => {
    const longA: RankedEntry[] = [
      { id: 'shared', rank: 1, score: 10 },
      { id: 'leave-1', rank: 2, score: 8 },
      { id: 'leave-2', rank: 3, score: 6 },
    ];
    const shortB: RankedEntry[] = [{ id: 'shared', rank: 1, score: 12 }];
    const ids = buildDetailSampleIds(longA, shortB, 3, noMovements, noMovements);
    assert.deepEqual(ids, ['shared', 'leave-1', 'leave-2']);
  });
});

/* -------------------------------------------------------------------------
 * 7. Coverage state machine
 * ---------------------------------------------------------------------- */

describe('snapshotCoverage', () => {
  const profile = (
    overrides: Partial<CanonicalMaterialSemanticProfile>,
  ): CanonicalMaterialSemanticProfile => ({
    materialId: 'mat-1',
    familyKeys: [],
    formKeys: [],
    coverage: 'MISSING_CANONICAL_ASSIGNMENT',
    similarityEligible: false,
    diagnostics: [],
    ...overrides,
  });

  test('successful context aggregates coverage counts from the exact scoring context', () => {
    const map = new Map<string, CanonicalMaterialSemanticProfile>([
      ['mat-1', profile({ materialId: 'mat-1', coverage: 'READY_FAMILY_AND_FORM' })],
      ['mat-2', profile({ materialId: 'mat-2', coverage: 'READY_FAMILY_ONLY' })],
      ['mat-3', profile({ materialId: 'mat-3', coverage: 'MISSING_CANONICAL_ASSIGNMENT' })],
      ['mat-4', profile({ materialId: 'mat-4', coverage: 'INVALID_FAMILY_CARDINALITY' })],
    ]);
    const context = {
      requestedScoringMode: 'canonical-taxonomy-v3' as const,
      effectiveScoringMode: 'canonical-taxonomy-v3' as const,
      fallbackCode: null,
      cacheable: true,
      candidateMaterialProfiles: map,
      likedMaterialProfiles: new Map(),
      reservedMaterialProfiles: new Map(),
      viewedMaterialProfiles: new Map(),
    };
    const snapshot = snapshotCoverage(context, null);
    assert.equal(snapshot.coverageStatus, 'AVAILABLE');
    assert.equal(snapshot.coverageSource, 'successfulContext');
    assert.equal(snapshot.counts!.READY_FAMILY_AND_FORM, 1);
    assert.equal(snapshot.counts!.READY_FAMILY_ONLY, 1);
    assert.equal(snapshot.counts!.MISSING_CANONICAL_ASSIGNMENT, 1);
    assert.equal(snapshot.counts!.INVALID_FAMILY_CARDINALITY, 1);
  });

  test('context invariant fallback: no second loader call, coverage marked unavailable', () => {
    const snapshot = snapshotCoverage(undefined, 'CANONICAL_CONTEXT_INVARIANT_FALLBACK');
    assert.equal(snapshot.coverageStatus, 'UNAVAILABLE');
    assert.equal(snapshot.counts, null);
    assert.equal(snapshot.coverageUnavailableReason, 'CANONICAL_CONTEXT_INVARIANT_FALLBACK');
  });

  test('loader failure: coverage marked unavailable with that exact reason', () => {
    const snapshot = snapshotCoverage(undefined, 'CANONICAL_LOADER_FALLBACK_LEGACY_V1');
    assert.equal(snapshot.coverageStatus, 'UNAVAILABLE');
    assert.equal(snapshot.coverageUnavailableReason, 'CANONICAL_LOADER_FALLBACK_LEGACY_V1');
  });
});

/* -------------------------------------------------------------------------
 * 8. Frozen clock
 * ---------------------------------------------------------------------- */

describe('withFrozenClock', () => {
  test('freezes both Date.now() and no-argument new Date() during the callback', () => {
    const fixedMs = Date.parse('2026-07-20T00:00:00.000Z');
    const observed = withFrozenClock(fixedMs, () => ({
      now: Date.now(),
      constructed: new Date().getTime(),
    }));
    assert.equal(observed.now, fixedMs);
    assert.equal(observed.constructed, fixedMs);
  });

  test('restores the real Date after the callback completes', () => {
    const RealDate = Date;
    withFrozenClock(0, () => undefined);
    assert.equal(Date, RealDate);
  });

  test('restores the real Date even if the callback throws', () => {
    const RealDate = Date;
    assert.throws(() => withFrozenClock(0, () => { throw new Error('boom'); }));
    assert.equal(Date, RealDate);
  });
});

/* -------------------------------------------------------------------------
 * 9. CLI argument validation
 * ---------------------------------------------------------------------- */

describe('parseCliArgs', () => {
  test('requires exactly one of --user-id or --email', () => {
    assert.throws(
      () => parseCliArgs(['--evaluation-time', '2026-07-20T00:00:00.000Z']),
      EvaluatorCliError,
    );
    assert.throws(
      () =>
        parseCliArgs([
          '--user-id',
          'u1',
          '--email',
          'a@b.com',
          '--evaluation-time',
          '2026-07-20T00:00:00.000Z',
        ]),
      EvaluatorCliError,
    );
  });

  test('requires --evaluation-time', () => {
    assert.throws(() => parseCliArgs(['--user-id', 'u1']), EvaluatorCliError);
  });

  test('rejects a non-UTC evaluation time', () => {
    assert.throws(
      () => parseCliArgs(['--user-id', 'u1', '--evaluation-time', '2026-07-20T00:00:00.000']),
      EvaluatorCliError,
    );
  });

  test('rejects an out-of-range --top-k', () => {
    assert.throws(
      () =>
        parseCliArgs([
          '--user-id',
          'u1',
          '--evaluation-time',
          '2026-07-20T00:00:00.000Z',
          '--top-k',
          '0',
        ]),
      EvaluatorCliError,
    );
  });

  test('rejects an unknown argument', () => {
    assert.throws(
      () =>
        parseCliArgs([
          '--user-id',
          'u1',
          '--evaluation-time',
          '2026-07-20T00:00:00.000Z',
          '--bogus',
        ]),
      EvaluatorCliError,
    );
  });

  test('rejects duplicate arguments', () => {
    assert.throws(
      () =>
        parseCliArgs([
          '--user-id',
          'u1',
          '--user-id',
          'u2',
          '--evaluation-time',
          '2026-07-20T00:00:00.000Z',
        ]),
      EvaluatorCliError,
    );
  });

  test('parses a fully valid argument set', () => {
    const options = parseCliArgs([
      '--user-id',
      'u1',
      '--evaluation-time',
      '2026-07-20T00:00:00.000Z',
      '--top-k',
      '5',
      '--pool',
      'browse',
      '--score-bucket',
      'free',
    ]);
    assert.equal(options.userId, 'u1');
    assert.equal(options.topK, 5);
    assert.equal(options.poolScope, 'browse');
    assert.equal(options.scoreBucket, 'free');
  });

  test('canonicalizeEvaluationTime normalizes to a canonical ISO string', () => {
    assert.equal(
      canonicalizeEvaluationTime('2026-07-20T00:00:00.000Z'),
      '2026-07-20T00:00:00.000Z',
    );
  });
});

/* -------------------------------------------------------------------------
 * 10. End-to-end orchestration against fully synthetic (non-Prisma) deps.
 * ---------------------------------------------------------------------- */

describe('runRankingDeltaEvaluation (synthetic deps, no Prisma)', () => {
  test('valid run: identical candidate ids across all three modes', async () => {
    const deps = buildFakeDeps(defaultFixture());
    const result = await runRankingDeltaEvaluation(baseOptions(), deps);
    assert.equal(result.status, 'VALID');
    assert.equal(result.materialEvaluation.status, 'VALID');
    assert.equal(result.projectEvaluation.status, 'VALID');
    for (const mode of result.requestedModes) {
      assert.equal(result.materialEvaluation.perMode[mode]!.scoringIdentity.identityMatch, true);
      assert.equal(result.projectEvaluation.perMode[mode]!.scoringIdentity.identityMatch, true);
    }
    assert.equal(result.candidatePool.materialCount, 3);
    assert.equal(result.candidatePool.projectCount, 3);
    assert.equal(result.inputPoolMutationDetected, false);
    assert.equal(result.canonicalFallbacks.total, 0);
  });

  test('ineligible learner accounts fail closed before ranking', async () => {
    const deps = buildFakeDeps(defaultFixture());
    deps.prisma.user.findMany = async () => [
      {
        id: 'user-1',
        email: 'learner@test.com',
        accountStatus: 'ACTIVE',
        recommendationEvidenceEligibility: 'EXCLUDED_DEMO',
      },
    ];
    const result = await runRankingDeltaEvaluation(baseOptions(), deps);
    assert.equal(result.status, 'INVALID');
    assert.ok(result.invalidResultReasons.includes('LEARNER_NOT_EVIDENCE_ELIGIBLE'));
  });

  test('material scoring-identity failure (silent drop) invalidates the run, never reinterpreted as filtering', async () => {
    const fixture = defaultFixture();
    const deps = buildFakeDeps(fixture, {
      preScoreMaterials: (context) =>
        context.materials
          .filter((candidate) => candidate.id !== 'mat-2')
          .map((candidate) => ({
            material: candidate,
            ownerId: candidate.ownerId,
            scores: {
              suggested: scoredMaterialResult(1),
              savedProjects: scoredMaterialResult(1),
              free: scoredMaterialResult(1),
            },
          })),
    });
    const result = await runRankingDeltaEvaluation(baseOptions(), deps);
    assert.equal(result.status, 'INVALID');
    assert.equal(result.materialEvaluation.status, 'INVALID');
    assert.ok(result.invalidResultReasons.some((reason) => reason.startsWith('MATERIAL_SCORING_IDENTITY_INVALID')));
    for (const mode of result.requestedModes) {
      assert.deepEqual(result.materialEvaluation.perMode[mode]!.scoringIdentity.missingScoreIds, ['mat-2']);
    }
  });

  test('project score <= 0 is expected filtering, not a missing-score failure', async () => {
    const fixture = defaultFixture();
    const deps = buildFakeDeps(fixture, {
      scoreSuggestedProject: ({ project }) => ({
        score: project.id === 'proj-2' ? 0 : 5,
        reasons: [],
        tier: 1,
      }),
    });
    const result = await runRankingDeltaEvaluation(baseOptions(), deps);
    assert.equal(result.projectEvaluation.status, 'VALID');
    for (const mode of result.requestedModes) {
      const perMode = result.projectEvaluation.perMode[mode]!;
      assert.equal(perMode.scoringIdentity.identityMatch, true);
      assert.deepEqual(perMode.scoringIdentity.missingScoreIds, []);
      assert.ok(perMode.rankingEligibility.filteredOutCandidateIds.includes('proj-2'));
      assert.equal(
        perMode.rankingEligibility.filteredOutReasonsWhenExistingProductionDataExposesThem[0]!.reason,
        'NON_POSITIVE_SCORE',
      );
    }
  });

  test('project retrieval-order ambiguity fails project evidence closed but keeps material evidence valid', async () => {
    const tied = new Date('2026-06-01T00:00:00.000Z');
    const fixture: FixturePool = {
      materials: defaultFixture().materials,
      projects: [project({ id: 'proj-1', createdAt: tied }), project({ id: 'proj-2', createdAt: tied })],
    };
    const deps = buildFakeDeps(fixture);
    const result = await runRankingDeltaEvaluation(baseOptions(), deps);
    assert.equal(result.status, 'INVALID');
    assert.equal(result.projectEvaluation.status, 'INVALID_NONDETERMINISTIC_RETRIEVAL_ORDER');
    assert.equal(result.projectEvaluation.pairwise, null);
    assert.equal(result.projectEvaluation.nondeterministicRetrievalDiagnostics!.tieGroups.length, 1);
    assert.equal(result.candidatePool.projectRetrievalOrderDigest, null);
    assert.equal(result.materialEvaluation.status, 'VALID');
    assert.ok(result.invalidResultReasons.includes('PROJECT_RETRIEVAL_ORDER_NONDETERMINISTIC'));
  });

  test('no project retrieval ties: normal pairwise deltas are computed', async () => {
    const deps = buildFakeDeps(defaultFixture());
    const result = await runRankingDeltaEvaluation(baseOptions(), deps);
    assert.equal(result.projectEvaluation.status, 'VALID');
    assert.ok(result.projectEvaluation.pairwise);
    assert.ok('legacy-v1_vs_normalized-interests-v2' in result.projectEvaluation.pairwise!);
  });

  test('input-pool mutation is detected and invalidates the run', async () => {
    const fixture = defaultFixture();
    const deps = buildFakeDeps(fixture, {
      preScoreMaterials: (context) => {
        context.materials.reverse(); // mutates the shared frozen array in place
        return context.materials.map((candidate) => ({
          material: candidate,
          ownerId: candidate.ownerId,
          scores: {
            suggested: scoredMaterialResult(1),
            savedProjects: scoredMaterialResult(1),
            free: scoredMaterialResult(1),
          },
        }));
      },
    });
    const result = await runRankingDeltaEvaluation(baseOptions(), deps);
    assert.equal(result.inputPoolMutationDetected, true);
    assert.equal(result.status, 'INVALID');
    assert.ok(result.invalidResultReasons.includes('INPUT_POOL_MUTATION_DETECTED'));
  });

  test('no mutation reports inputPoolMutationDetected: false', async () => {
    const deps = buildFakeDeps(defaultFixture());
    const result = await runRankingDeltaEvaluation(baseOptions(), deps);
    assert.equal(result.inputPoolMutationDetected, false);
  });

  test('canonical material fallback: pairwise and detail metadata keep requested canonical / effective legacy', async () => {
    const deps = buildFakeDeps(defaultFixture(), {
      resolveMaterialModeDecisionAndContext: async ({ requestedMaterialScoringMode }) => {
        if (requestedMaterialScoringMode === 'canonical-taxonomy-v3') {
          return {
            modeDecision: {
              requestedMaterialScoringMode,
              effectiveMaterialScoringMode: 'legacy-v1',
              effectiveProjectScoringMode: 'legacy-v1',
              fallbackCode: 'CANONICAL_CONTEXT_INVARIANT_FALLBACK',
              cacheable: false,
            },
            canonicalContext: undefined,
          };
        }
        return {
          modeDecision: {
            requestedMaterialScoringMode,
            effectiveMaterialScoringMode: requestedMaterialScoringMode,
            effectiveProjectScoringMode: 'legacy-v1',
            fallbackCode: null,
            cacheable: true,
          },
          canonicalContext: undefined,
        };
      },
      preScoreMaterials: (context) =>
        // Effective legacy after fallback: legacy-shaped scores only (no canonical components).
        context.materials.map((candidate, index) => ({
          material: candidate,
          ownerId: candidate.ownerId,
          scores: {
            suggested: scoredMaterialResult(10 - index, 1, { reasons: [`fallback-legacy-${index}`] }),
            savedProjects: scoredMaterialResult(5 - index, 1),
            free: scoredMaterialResult(1 - index, 1),
          },
        })),
    });
    const result = await runRankingDeltaEvaluation(baseOptions(), deps);
    const canonicalEntry = result.modeResults['canonical-taxonomy-v3']!;
    assert.equal(canonicalEntry.requestedMode, 'canonical-taxonomy-v3');
    assert.equal(canonicalEntry.effectiveMode, 'legacy-v1');
    assert.equal(canonicalEntry.fallbackCode, 'CANONICAL_CONTEXT_INVARIANT_FALLBACK');
    assert.equal(canonicalEntry.algorithmStamp, 'learner-home-v1:legacy-v1');
    assert.equal(result.materialEvaluation.coverage.coverageStatus, 'UNAVAILABLE');
    assert.equal(
      result.materialEvaluation.coverage.coverageUnavailableReason,
      'CANONICAL_CONTEXT_INVARIANT_FALLBACK',
    );
    assert.equal(result.canonicalFallbacks.total, 1);
    assert.equal(result.canonicalFallbacks.byCode.CANONICAL_CONTEXT_INVARIANT_FALLBACK, 1);

    const pair = result.materialEvaluation.pairwise['legacy-v1_vs_canonical-taxonomy-v3-requested']!;
    assert.equal(pair.sideB.requestedMode, 'canonical-taxonomy-v3');
    assert.equal(pair.sideB.effectiveMode, 'legacy-v1');
    assert.equal(pair.sideB.algorithmStamp, 'learner-home-v1:legacy-v1');
    assert.equal(pair.sideB.fallbackCode, 'CANONICAL_CONTEXT_INVARIANT_FALLBACK');
    const detail = pair.detailSample[0]!;
    assert.equal(detail.modeB.requestedMode, 'canonical-taxonomy-v3');
    assert.equal(detail.modeB.effectiveMode, 'legacy-v1');
    assert.equal(detail.modeB.components, null);
    assert.equal(detail.modeB.internalReasonCodes, null);
    assert.equal(detail.modeB.semanticCoverage, null);
  });

  test('successful canonical material scoring: requested and effective are both canonical with components', async () => {
    const deps = buildFakeDeps(defaultFixture(), {
      preScoreMaterials: (context) => {
        const isCanonicalEffective = context.modeDecision.effectiveMaterialScoringMode === 'canonical-taxonomy-v3';
        return context.materials.map((candidate, index) => ({
          material: candidate,
          ownerId: candidate.ownerId,
          scores: {
            suggested: isCanonicalEffective
              ? canonicalScoredMaterialResult(10 - index, 1, { likedSimilarity: 10 - index }, {
                  reasons: ['canonical-liked-overlap'],
                  internalReasonCodes: ['CANONICAL_FAMILY_OVERLAP'],
                  semanticCoverage: 'READY_FAMILY_ONLY',
                })
              : scoredMaterialResult(10 - index, 1, { reasons: [`legacy-reason-${index}`] }),
            savedProjects: scoredMaterialResult(5 - index, 1),
            free: scoredMaterialResult(1 - index, 1),
          },
        }));
      },
    });
    const result = await runRankingDeltaEvaluation(baseOptions(), deps);
    const canonicalEntry = result.modeResults['canonical-taxonomy-v3']!;
    assert.equal(canonicalEntry.requestedMode, 'canonical-taxonomy-v3');
    assert.equal(canonicalEntry.effectiveMode, 'canonical-taxonomy-v3');
    assert.equal(canonicalEntry.fallbackCode, null);
    const pair = result.materialEvaluation.pairwise['legacy-v1_vs_canonical-taxonomy-v3-requested']!;
    assert.equal(pair.sideB.requestedMode, 'canonical-taxonomy-v3');
    assert.equal(pair.sideB.effectiveMode, 'canonical-taxonomy-v3');
    const mat1 = pair.detailSample.find((entry) => entry.id === 'mat-1')!;
    assert.equal(mat1.modeB.requestedMode, 'canonical-taxonomy-v3');
    assert.equal(mat1.modeB.effectiveMode, 'canonical-taxonomy-v3');
    assert.deepEqual(mat1.modeB.components, { likedSimilarity: 10 });
    assert.deepEqual(mat1.modeB.internalReasonCodes, ['CANONICAL_FAMILY_OVERLAP']);
    assert.equal(mat1.modeB.semanticCoverage, 'READY_FAMILY_ONLY');
  });

  test('canonical project request is reported as delegated to legacy-v1 in pairwise and detail evidence', async () => {
    const deps = buildFakeDeps(defaultFixture());
    const result = await runRankingDeltaEvaluation(baseOptions(), deps);
    assert.equal(result.projectEvaluation.delegatedFromCanonicalRequest, true);
    assert.equal(result.projectEvaluation.algorithmStamp, 'learner-home-v1:legacy-v1');
    assert.equal(
      result.projectEvaluation.perMode['canonical-taxonomy-v3']!.effectiveProjectScoringMode,
      'legacy-v1',
    );
    const pair = result.projectEvaluation.pairwise!['legacy-v1_vs_canonical-taxonomy-v3-requested']!;
    assert.equal(pair.sideB.requestedMode, 'canonical-taxonomy-v3');
    assert.equal(pair.sideB.effectiveMode, 'legacy-v1');
    assert.equal(pair.sideB.algorithmStamp, 'learner-home-v1:legacy-v1');
    assert.equal(pair.sideB.fallbackCode, null);
    for (const entry of pair.detailSample) {
      assert.equal(entry.modeB.requestedMode, 'canonical-taxonomy-v3');
      assert.equal(entry.modeB.effectiveMode, 'legacy-v1');
      assert.equal(entry.modeB.algorithmStamp, 'learner-home-v1:legacy-v1');
    }
  });

  test('material and project evidence remain separated', async () => {
    const deps = buildFakeDeps(defaultFixture());
    const result = await runRankingDeltaEvaluation(baseOptions(), deps);
    assert.notEqual(result.materialEvaluation, result.projectEvaluation as unknown);
    assert.ok(Object.keys(result.materialEvaluation.perMode).length > 0);
    assert.ok(Object.keys(result.projectEvaluation.perMode).length > 0);
  });

  test('byte-for-byte repeatability: identical input produces identical resultStableHash', async () => {
    const first = await runRankingDeltaEvaluation(baseOptions(), buildFakeDeps(defaultFixture()));
    const second = await runRankingDeltaEvaluation(baseOptions(), buildFakeDeps(defaultFixture()));
    assert.equal(first.resultStableHash, second.resultStableHash);
  });

  test('a single changed score changes the hash', async () => {
    const base = await runRankingDeltaEvaluation(baseOptions(), buildFakeDeps(defaultFixture()));
    const mutated = await runRankingDeltaEvaluation(
      baseOptions(),
      buildFakeDeps(defaultFixture(), {
        // Reverses the per-candidate score gradient (was `10 - index`), which
        // changes rankedCandidateIds order and every pairwise rank movement
        // — an observable change, unlike a uniform constant shared by every
        // candidate in every mode (which would leave all relative deltas at
        // zero and the hash unchanged).
        preScoreMaterials: (context) =>
          context.materials.map((candidate, index) => ({
            material: candidate,
            ownerId: candidate.ownerId,
            scores: {
              suggested: scoredMaterialResult(index),
              savedProjects: scoredMaterialResult(index),
              free: scoredMaterialResult(index),
            },
          })),
      }),
    );
    assert.notEqual(base.resultStableHash, mutated.resultStableHash);
  });

  test('hash excludes the unstable project retrieval order when ties exist', async () => {
    const tied = new Date('2026-06-01T00:00:00.000Z');
    const orderA: FixturePool = {
      materials: defaultFixture().materials,
      projects: [project({ id: 'proj-1', createdAt: tied }), project({ id: 'proj-2', createdAt: tied })],
    };
    const orderB: FixturePool = {
      materials: defaultFixture().materials,
      projects: [project({ id: 'proj-2', createdAt: tied }), project({ id: 'proj-1', createdAt: tied })],
    };
    const resultA = await runRankingDeltaEvaluation(baseOptions(), buildFakeDeps(orderA));
    const resultB = await runRankingDeltaEvaluation(baseOptions(), buildFakeDeps(orderB));
    assert.equal(resultA.resultStableHash, resultB.resultStableHash);
  });

  test('a high-tier material with score <= 0 is filtered, never enters ranked Top-K or eligible/pairwise evidence', async () => {
    const fixture = defaultFixture();
    const deps = buildFakeDeps(fixture, {
      preScoreMaterials: (context) =>
        context.materials.map((candidate) => {
          // mat-1 has the best possible tier (1) but a non-positive score:
          // the production filter must exclude it regardless of tier.
          const [score, tier]: [number, MaterialScoringTier] =
            candidate.id === 'mat-1' ? [-5, 1] : [3, 3];
          return {
            material: candidate,
            ownerId: candidate.ownerId,
            scores: {
              suggested: scoredMaterialResult(score, tier),
              savedProjects: scoredMaterialResult(score, tier),
              free: scoredMaterialResult(score, tier),
            },
          };
        }),
    });
    const result = await runRankingDeltaEvaluation({ ...baseOptions(), topK: 5 }, deps);
    assert.equal(result.materialEvaluation.status, 'VALID');
    for (const mode of result.requestedModes) {
      const perMode = result.materialEvaluation.perMode[mode]!;
      assert.ok(!perMode.rankingEligibility.rankedCandidateIds.includes('mat-1'));
      assert.ok(!perMode.rankingEligibility.eligibleCandidateIds.includes('mat-1'));
      assert.ok(perMode.rankingEligibility.filteredOutCandidateIds.includes('mat-1'));
      const reasonEntry = perMode.rankingEligibility.filteredOutReasonsWhenExistingProductionDataExposesThem.find(
        (entry) => entry.candidateId === 'mat-1',
      );
      assert.equal(reasonEntry?.reason, 'NON_POSITIVE_SCORE');
    }
    const pairwise = result.materialEvaluation.pairwise['legacy-v1_vs_normalized-interests-v2']!;
    const idsInMovements = new Set(pairwise.rankMovements.map((movement) => movement.id));
    assert.ok(!idsInMovements.has('mat-1'));
    assert.ok(!pairwise.entering.includes('mat-1'));
    assert.ok(!pairwise.leaving.includes('mat-1'));
  });

  test('a positive-score material eliminated by tiered-Home selection is TIER_NOT_SELECTED, not missing or ranked', async () => {
    const fixture = defaultFixture(); // mat-1, mat-2, mat-3
    const deps = buildFakeDeps(fixture, {
      preScoreMaterials: (context) =>
        context.materials.map((candidate) => {
          const [score, tier]: [number, MaterialScoringTier] =
            candidate.id === 'mat-1' ? [10, 1] : [5, 3];
          return {
            material: candidate,
            ownerId: candidate.ownerId,
            scores: {
              suggested: scoredMaterialResult(score, tier),
              savedProjects: scoredMaterialResult(score, tier),
              free: scoredMaterialResult(score, tier),
            },
          };
        }),
    });
    // Default options: --pool home, --score-bucket suggested -> tiered-Home surface.
    const result = await runRankingDeltaEvaluation(baseOptions(), deps);
    for (const mode of result.requestedModes) {
      const perMode = result.materialEvaluation.perMode[mode]!;
      assert.deepEqual(perMode.rankingEligibility.rankedCandidateIds, ['mat-1']);
      assert.ok(perMode.rankingEligibility.filteredOutCandidateIds.includes('mat-2'));
      const reasonEntry = perMode.rankingEligibility.filteredOutReasonsWhenExistingProductionDataExposesThem.find(
        (entry) => entry.candidateId === 'mat-2',
      );
      assert.equal(reasonEntry?.reason, 'TIER_NOT_SELECTED');
      // scoringIdentity must still show every frozen candidate received a raw score.
      assert.equal(perMode.scoringIdentity.identityMatch, true);
    }
  });

  test('--pool browse for the suggested bucket uses browse-all tier sort and reports it in rankingSurface', async () => {
    const fixture = defaultFixture();
    const deps = buildFakeDeps(fixture, {
      preScoreMaterials: (context) =>
        context.materials.map((candidate) => {
          const [score, tier]: [number, MaterialScoringTier] =
            candidate.id === 'mat-1' ? [10, 1] : [5, 3];
          return {
            material: candidate,
            ownerId: candidate.ownerId,
            scores: {
              suggested: scoredMaterialResult(score, tier),
              savedProjects: scoredMaterialResult(score, tier),
              free: scoredMaterialResult(score, tier),
            },
          };
        }),
    });
    const result = await runRankingDeltaEvaluation({ ...baseOptions(), poolScope: 'browse' }, deps);
    assert.equal(result.materialEvaluation.rankingSurface.browseAllTierSort, true);
    assert.equal(result.materialEvaluation.rankingSurface.poolScopeAffectsRanking, true);
    // Under browse-all ordering there is no tier-group elimination: both
    // positive-score candidates are ranked (never claim Home ranking while
    // applying Browse-all ordering, or vice versa).
    for (const mode of result.requestedModes) {
      const rankedSet = new Set(result.materialEvaluation.perMode[mode]!.rankingEligibility.rankedCandidateIds);
      assert.ok(rankedSet.has('mat-1'));
      assert.ok(rankedSet.has('mat-2') || rankedSet.has('mat-3'));
    }
  });

  test('pairwise detail sample surfaces absolute canonical evidence and truthfully marks components unavailable across modes', async () => {
    // Canonical components are unique to canonical-taxonomy-v3, so every
    // *pairwise* (cross-mode) comparison always has exactly one non-canonical
    // side — componentsUnavailable must therefore be true (never fabricated)
    // for every pairwise entry. Absolute canonical components / codes /
    // semanticCoverage must still appear on the canonical mode snapshot.
    const fixture = defaultFixture();
    const deps = buildFakeDeps(fixture, {
      preScoreMaterials: (context) => {
        const isCanonicalEffective = context.modeDecision.effectiveMaterialScoringMode === 'canonical-taxonomy-v3';
        return context.materials.map((candidate, index) => ({
          material: candidate,
          ownerId: candidate.ownerId,
          scores: {
            suggested: isCanonicalEffective
              ? canonicalScoredMaterialResult(10 - index, 1, { likedSimilarity: 10 - index, location: 1 }, {
                  reasons: ['canonical-liked-overlap'],
                  internalReasonCodes: ['CANONICAL_FAMILY_OVERLAP'],
                  semanticCoverage: 'READY_FAMILY_ONLY',
                })
              : scoredMaterialResult(10 - index, 1, { reasons: [`legacy-reason-${index}`] }),
            savedProjects: scoredMaterialResult(5 - index, 1),
            free: scoredMaterialResult(1 - index, 1),
          },
        }));
      },
    });
    const result = await runRankingDeltaEvaluation(baseOptions(), deps);
    assert.equal(result.materialEvaluation.status, 'VALID');

    for (const pairKey of [
      'legacy-v1_vs_normalized-interests-v2',
      'legacy-v1_vs_canonical-taxonomy-v3-requested',
      'normalized-interests-v2_vs_canonical-taxonomy-v3-requested',
    ] as const) {
      const pair = result.materialEvaluation.pairwise[pairKey]!;
      assert.ok(pair.detailSample.length > 0);
      assert.ok(pair.detailSample.length <= 20);
      assert.ok(pair.sideA.requestedMode);
      assert.ok(pair.sideB.requestedMode);
      for (const entry of pair.detailSample) {
        assert.equal(entry.componentsUnavailable, true);
        assert.equal(entry.componentDeltas, null);
        assert.ok(entry.modeA.requestedMode);
        assert.ok(entry.modeB.requestedMode);
      }
    }

    const canonicalPair = result.materialEvaluation.pairwise['legacy-v1_vs_canonical-taxonomy-v3-requested']!;
    assert.equal(canonicalPair.sideB.requestedMode, 'canonical-taxonomy-v3');
    assert.equal(canonicalPair.sideB.effectiveMode, 'canonical-taxonomy-v3');
    const mat1Entry = canonicalPair.detailSample.find((entry) => entry.id === 'mat-1');
    assert.ok(mat1Entry);
    assert.equal(mat1Entry!.modeA.requestedMode, 'legacy-v1');
    assert.equal(mat1Entry!.modeA.effectiveMode, 'legacy-v1');
    assert.equal(mat1Entry!.modeA.components, null);
    assert.equal(mat1Entry!.modeA.internalReasonCodes, null);
    assert.equal(mat1Entry!.modeA.semanticCoverage, null);
    assert.equal(mat1Entry!.modeB.requestedMode, 'canonical-taxonomy-v3');
    assert.equal(mat1Entry!.modeB.effectiveMode, 'canonical-taxonomy-v3');
    assert.deepEqual(mat1Entry!.modeB.components, { likedSimilarity: 10, location: 1 });
    assert.deepEqual(mat1Entry!.modeB.internalReasonCodes, ['CANONICAL_FAMILY_OVERLAP']);
    assert.equal(mat1Entry!.modeB.semanticCoverage, 'READY_FAMILY_ONLY');
    assert.equal(mat1Entry!.componentsUnavailable, true);
    assert.deepEqual(mat1Entry!.reasonsAdded, ['canonical-liked-overlap']);
    assert.deepEqual(mat1Entry!.reasonsRemoved, ['legacy-reason-0']);
  });

  test('empty material candidate pool: exact invalid reasons without false identity failure', async () => {
    const fixture: FixturePool = { materials: [], projects: defaultFixture().projects };
    const deps = buildFakeDeps(fixture);
    const result = await runRankingDeltaEvaluation(baseOptions(), deps);
    assert.equal(result.status, 'INVALID');
    assert.equal(result.materialEvaluation.status, 'INVALID');
    assert.deepEqual(result.invalidResultReasons, ['EMPTY_MATERIAL_CANDIDATE_POOL']);
    assert.ok(!result.invalidResultReasons.some((reason) => reason.includes('SCORING_IDENTITY_INVALID')));
    assert.deepEqual(result.materialEvaluation.pairwise, {});
  });

  test('empty project candidate pool: exact invalid reasons without false identity failure', async () => {
    const fixture: FixturePool = { materials: defaultFixture().materials, projects: [] };
    const deps = buildFakeDeps(fixture);
    const result = await runRankingDeltaEvaluation(baseOptions(), deps);
    assert.equal(result.status, 'INVALID');
    assert.equal(result.projectEvaluation.status, 'INVALID');
    assert.deepEqual(result.invalidResultReasons, ['EMPTY_PROJECT_CANDIDATE_POOL']);
    assert.ok(!result.invalidResultReasons.some((reason) => reason.includes('SCORING_IDENTITY_INVALID')));
    assert.equal(result.projectEvaluation.pairwise, null);
  });

  test('both candidate pools empty: exact invalid reasons without false identity failure', async () => {
    const fixture: FixturePool = { materials: [], projects: [] };
    const deps = buildFakeDeps(fixture);
    const result = await runRankingDeltaEvaluation(baseOptions(), deps);
    assert.equal(result.status, 'INVALID');
    assert.deepEqual(result.invalidResultReasons, [
      'EMPTY_MATERIAL_CANDIDATE_POOL',
      'EMPTY_PROJECT_CANDIDATE_POOL',
    ]);
    assert.ok(!result.invalidResultReasons.some((reason) => reason.includes('SCORING_IDENTITY_INVALID')));
    assert.equal(result.materialEvaluation.status, 'INVALID');
    assert.equal(result.projectEvaluation.status, 'INVALID');
  });

  test('scorer-configuration mutation with valid scoring identity: exact reason set without identity failure', async () => {
    let calls = 0;
    const deps = buildFakeDeps(defaultFixture(), {
      currentScorerVersionConstant: () => {
        calls += 1;
        return calls === 1 ? 'legacy-v1' : 'normalized-interests-v2';
      },
    });
    const result = await runRankingDeltaEvaluation(baseOptions(), deps);
    assert.equal(result.status, 'INVALID');
    assert.deepEqual(result.invalidResultReasons, ['SCORER_CONFIGURATION_MUTATION_DETECTED']);
    assert.ok(!result.invalidResultReasons.some((reason) => reason.includes('SCORING_IDENTITY_INVALID')));
    for (const mode of result.requestedModes) {
      assert.equal(result.materialEvaluation.perMode[mode]!.scoringIdentity.identityMatch, true);
      assert.equal(result.projectEvaluation.perMode[mode]!.scoringIdentity.identityMatch, true);
    }
  });

  test('genuine material identity mismatch: exact per-mode identity invalid reasons', async () => {
    const fixture = defaultFixture();
    const deps = buildFakeDeps(fixture, {
      preScoreMaterials: (context) =>
        context.materials
          .filter((candidate) => candidate.id !== 'mat-2')
          .map((candidate) => ({
            material: candidate,
            ownerId: candidate.ownerId,
            scores: {
              suggested: scoredMaterialResult(1),
              savedProjects: scoredMaterialResult(1),
              free: scoredMaterialResult(1),
            },
          })),
    });
    const result = await runRankingDeltaEvaluation(baseOptions(), deps);
    assert.equal(result.status, 'INVALID');
    assert.equal(result.materialEvaluation.status, 'INVALID');
    assert.deepEqual(result.invalidResultReasons, [
      'MATERIAL_SCORING_IDENTITY_INVALID:canonical-taxonomy-v3',
      'MATERIAL_SCORING_IDENTITY_INVALID:legacy-v1',
      'MATERIAL_SCORING_IDENTITY_INVALID:normalized-interests-v2',
    ]);
  });

  test('genuine project identity mismatch: exact per-mode identity invalid reasons', async () => {
    const fixture = defaultFixture();
    const deps = buildFakeDeps(fixture, {
      // Skip scoring one project on every mode so the recording wrapper sees a missing ID.
      scoreSuggestedProject: ({ project }) => {
        if (project.id === 'proj-2') {
          throw new Error('simulated project scoring drop');
        }
        return { score: 5, reasons: [], tier: 1 };
      },
      rankProjects: (projects, scorer, limit) => {
        // Mirror production: call scorer for every project; swallow throws so
        // the recording wrapper only captures successful calls (identity incomplete).
        const scored: Array<{ score: number; reasons: string[]; project: Record<string, unknown> }> = [];
        for (const candidate of projects) {
          try {
            const result = scorer(candidate);
            if (result.score > 0) {
              scored.push({ score: result.score, reasons: result.reasons, project: candidate.mapped });
            }
          } catch {
            // dropped
          }
        }
        return scored
          .sort((left, right) => right.score - left.score)
          .slice(0, limit)
          .map((entry) => ({ type: 'project' as const, ...entry }));
      },
    });
    const result = await runRankingDeltaEvaluation(baseOptions(), deps);
    assert.equal(result.status, 'INVALID');
    assert.equal(result.projectEvaluation.status, 'INVALID');
    assert.deepEqual(result.invalidResultReasons, [
      'PROJECT_SCORING_IDENTITY_INVALID:canonical-taxonomy-v3',
      'PROJECT_SCORING_IDENTITY_INVALID:legacy-v1',
      'PROJECT_SCORING_IDENTITY_INVALID:normalized-interests-v2',
    ]);
  });

  test('a legacy-v1 resolver exception preserves frozen-pool digests and does not claim canonical project delegation', async () => {
    const fixture = defaultFixture();
    const deps = buildFakeDeps(fixture, {
      resolveMaterialModeDecisionAndContext: async ({ requestedMaterialScoringMode }) => {
        if (requestedMaterialScoringMode === 'legacy-v1') {
          throw new Error('unexpected legacy resolver failure');
        }
        return {
          modeDecision: {
            requestedMaterialScoringMode,
            effectiveMaterialScoringMode: requestedMaterialScoringMode,
            effectiveProjectScoringMode: 'legacy-v1',
            fallbackCode: null,
            cacheable: true,
          },
          canonicalContext: undefined,
        };
      },
    });
    const result = await runRankingDeltaEvaluation(baseOptions(), deps);
    assert.equal(result.status, 'INVALID');
    assert.ok(result.invalidResultReasons.includes('MODE_RESOLUTION_ERROR:legacy-v1'));
    assert.equal(result.canonicalFallbacks.total, 0);
    assert.equal(result.canonicalFallbacks.byCode.CANONICAL_LOADER_FALLBACK_LEGACY_V1, 0);
    assert.equal(Object.keys(result.modeResults).length, 0);
    assert.equal(result.learner.userIdHash, hashIdentity('user-1'));
    assert.equal(result.candidatePool.materialCount, 3);
    assert.equal(result.candidatePool.projectCount, 3);
    assert.equal(
      result.candidatePool.materialRetrievalOrderDigest,
      digestOrderedIds(['mat-1', 'mat-2', 'mat-3']),
    );
    assert.equal(
      result.candidatePool.materialIdentityDigest,
      digestIdentitySet(['mat-1', 'mat-2', 'mat-3']),
    );
    assert.equal(
      result.candidatePool.projectIdentityDigest,
      digestIdentitySet(['proj-1', 'proj-2', 'proj-3']),
    );
    assert.equal(
      result.candidatePool.projectRetrievalOrderDigest,
      digestOrderedIds(['proj-1', 'proj-2', 'proj-3']),
    );
    assert.equal(result.candidatePool.projectRetrievalOrderAmbiguous, false);
    assert.equal(result.projectEvaluation.delegatedFromCanonicalRequest, null);
    assert.equal(result.projectEvaluation.algorithmStamp, null);
    assert.equal(result.materialEvaluation.coverage.canonicalRequested, true);
    assert.equal(result.materialEvaluation.coverage.coverageStatus, 'UNAVAILABLE');
    assert.equal(result.materialEvaluation.coverage.coverageSource, 'none');
    assert.equal(
      result.materialEvaluation.coverage.coverageUnavailableReason,
      'NOT_EVALUATED_DUE_TO_MODE_RESOLUTION_ERROR',
    );
  });

  test('a normalized-interests-v2 resolver exception does not claim canonical project delegation', async () => {
    const deps = buildFakeDeps(defaultFixture(), {
      resolveMaterialModeDecisionAndContext: async ({ requestedMaterialScoringMode }) => {
        if (requestedMaterialScoringMode === 'normalized-interests-v2') {
          throw new Error('unexpected normalized resolver failure');
        }
        return {
          modeDecision: {
            requestedMaterialScoringMode,
            effectiveMaterialScoringMode: requestedMaterialScoringMode,
            effectiveProjectScoringMode: 'legacy-v1',
            fallbackCode: null,
            cacheable: true,
          },
          canonicalContext: undefined,
        };
      },
    });
    const result = await runRankingDeltaEvaluation(baseOptions(), deps);
    assert.equal(result.status, 'INVALID');
    assert.ok(result.invalidResultReasons.includes('MODE_RESOLUTION_ERROR:normalized-interests-v2'));
    assert.equal(result.canonicalFallbacks.total, 0);
    assert.equal(result.canonicalFallbacks.byCode.CANONICAL_LOADER_FALLBACK_LEGACY_V1, 0);
    // Legacy completed before the failure; later modes were not fabricated.
    assert.deepEqual(Object.keys(result.modeResults).sort(), ['legacy-v1']);
    assert.equal(result.candidatePool.materialCount, 3);
    assert.equal(
      result.candidatePool.materialRetrievalOrderDigest,
      digestOrderedIds(['mat-1', 'mat-2', 'mat-3']),
    );
    assert.equal(result.projectEvaluation.delegatedFromCanonicalRequest, null);
    assert.equal(result.projectEvaluation.algorithmStamp, null);
    assert.equal(
      result.materialEvaluation.coverage.coverageUnavailableReason,
      'NOT_EVALUATED_DUE_TO_MODE_RESOLUTION_ERROR',
    );
  });

  test('a canonical resolver exception before project scoring claims no delegation and uses a truthful coverage reason', async () => {
    const deps = buildFakeDeps(defaultFixture(), {
      resolveMaterialModeDecisionAndContext: async ({ requestedMaterialScoringMode }) => {
        if (requestedMaterialScoringMode === 'canonical-taxonomy-v3') {
          throw new Error('unexpected canonical resolver failure');
        }
        return {
          modeDecision: {
            requestedMaterialScoringMode,
            effectiveMaterialScoringMode: requestedMaterialScoringMode,
            effectiveProjectScoringMode: 'legacy-v1',
            fallbackCode: null,
            cacheable: true,
          },
          canonicalContext: undefined,
        };
      },
    });
    const result = await runRankingDeltaEvaluation(baseOptions(), deps);
    assert.equal(result.status, 'INVALID');
    assert.ok(result.invalidResultReasons.includes('MODE_RESOLUTION_ERROR:canonical-taxonomy-v3'));
    assert.equal(result.canonicalFallbacks.total, 0);
    assert.deepEqual(Object.keys(result.modeResults).sort(), ['legacy-v1', 'normalized-interests-v2']);
    assert.equal(result.projectEvaluation.delegatedFromCanonicalRequest, null);
    assert.equal(result.projectEvaluation.algorithmStamp, null);
    assert.ok(result.projectEvaluation.perMode['legacy-v1']);
    assert.ok(result.projectEvaluation.perMode['normalized-interests-v2']);
    assert.equal(result.materialEvaluation.coverage.canonicalRequested, true);
    assert.equal(
      result.materialEvaluation.coverage.coverageUnavailableReason,
      'MODE_RESOLUTION_ERROR:canonical-taxonomy-v3',
    );
  });

  test('resolver that mutates the input pool then throws still reports INPUT_POOL_MUTATION_DETECTED', async () => {
    const deps = buildFakeDeps(defaultFixture(), {
      resolveMaterialModeDecisionAndContext: async ({ requestedMaterialScoringMode, materials }) => {
        if (requestedMaterialScoringMode === 'legacy-v1') {
          materials.reverse();
          throw new Error('resolver mutates then throws');
        }
        return {
          modeDecision: {
            requestedMaterialScoringMode,
            effectiveMaterialScoringMode: requestedMaterialScoringMode,
            effectiveProjectScoringMode: 'legacy-v1',
            fallbackCode: null,
            cacheable: true,
          },
          canonicalContext: undefined,
        };
      },
    });
    const result = await runRankingDeltaEvaluation(baseOptions(), deps);
    assert.equal(result.status, 'INVALID');
    assert.ok(result.invalidResultReasons.includes('MODE_RESOLUTION_ERROR:legacy-v1'));
    assert.ok(result.invalidResultReasons.includes('INPUT_POOL_MUTATION_DETECTED'));
    assert.equal(result.inputPoolMutationDetected, true);
    assert.equal(result.candidatePool.materialCount, 3);
    assert.equal(
      result.candidatePool.materialRetrievalOrderDigest,
      digestOrderedIds(['mat-1', 'mat-2', 'mat-3']),
    );
  });

  test('resolver that mutates scorer configuration then throws still reports SCORER_CONFIGURATION_MUTATION_DETECTED', async () => {
    let version: 'legacy-v1' | 'normalized-interests-v2' = 'legacy-v1';
    const deps = buildFakeDeps(defaultFixture(), {
      currentScorerVersionConstant: () => version,
      resolveMaterialModeDecisionAndContext: async ({ requestedMaterialScoringMode }) => {
        if (requestedMaterialScoringMode === 'legacy-v1') {
          version = 'normalized-interests-v2';
          throw new Error('resolver mutates scorer config then throws');
        }
        return {
          modeDecision: {
            requestedMaterialScoringMode,
            effectiveMaterialScoringMode: requestedMaterialScoringMode,
            effectiveProjectScoringMode: 'legacy-v1',
            fallbackCode: null,
            cacheable: true,
          },
          canonicalContext: undefined,
        };
      },
    });
    const result = await runRankingDeltaEvaluation(baseOptions(), deps);
    assert.equal(result.status, 'INVALID');
    assert.ok(result.invalidResultReasons.includes('MODE_RESOLUTION_ERROR:legacy-v1'));
    assert.ok(result.invalidResultReasons.includes('SCORER_CONFIGURATION_MUTATION_DETECTED'));
    assert.ok(!result.invalidResultReasons.some((reason) => reason.includes('SCORING_IDENTITY_INVALID')));
  });

  test('mode-resolution invalid output remains byte-reproducible', async () => {
    const build = () =>
      buildFakeDeps(defaultFixture(), {
        resolveMaterialModeDecisionAndContext: async ({ requestedMaterialScoringMode }) => {
          if (requestedMaterialScoringMode === 'legacy-v1') {
            throw new Error('unexpected legacy resolver failure');
          }
          return {
            modeDecision: {
              requestedMaterialScoringMode,
              effectiveMaterialScoringMode: requestedMaterialScoringMode,
              effectiveProjectScoringMode: 'legacy-v1',
              fallbackCode: null,
              cacheable: true,
            },
            canonicalContext: undefined,
          };
        },
      });
    const first = await runRankingDeltaEvaluation(baseOptions(), build());
    const second = await runRankingDeltaEvaluation(baseOptions(), build());
    assert.equal(first.resultStableHash, second.resultStableHash);
    assert.equal(canonicalJson(first), canonicalJson(second));
  });

  test('no field in the finalized output is derived from an unfrozen wall clock', () => {
    const OriginalDate = Date;
    // eslint-disable-next-line @typescript-eslint/no-extraneous-class
    class ThrowingDate extends OriginalDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) {
          throw new Error('Unexpected bare new Date() during output assembly.');
        }
        // @ts-expect-error variadic passthrough
        super(...args);
      }
    }
    // @ts-expect-error scoped structural test double for global Date
    globalThis.Date = ThrowingDate;
    try {
      const draft: EvaluatorResult = {
        evaluatorVersion: 'ranking-delta-evaluator-v1',
        status: 'VALID',
        evaluationTimestampUtc: '2026-07-20T00:00:00.000Z',
        learner: { userIdHash: hashIdentity('user-1'), emailProvided: false },
        pool: { scope: 'home', poolCap: 120 },
        requestedModes: ['legacy-v1', 'normalized-interests-v2', 'canonical-taxonomy-v3'],
        topK: 10,
        inputPoolMutationDetected: false,
        candidatePool: {
          materialCount: 0,
          materialRetrievalOrderDigest: digestOrderedIds([]),
          materialIdentityDigest: digestIdentitySet([]),
          projectCount: 0,
          projectRetrievalOrderDigest: digestOrderedIds([]),
          projectIdentityDigest: digestIdentitySet([]),
          projectRetrievalOrderAmbiguous: false,
          projectRetrievalTieGroups: [],
        },
        modeResults: {} as EvaluatorResult['modeResults'],
        canonicalFallbacks: {
          total: 0,
          byCode: {
            CANONICAL_LOADER_FALLBACK_LEGACY_V1: 0,
            CANONICAL_CONTEXT_INVARIANT_FALLBACK: 0,
            CANONICAL_SCORER_INVARIANT_FALLBACK: 0,
          },
        },
        materialEvaluation: {
          status: 'VALID',
          scoreBucket: 'suggested',
          rankingSurface: resolveMaterialRankingSurface('suggested', 'home'),
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
          status: 'VALID',
          rankingFunctionUsed: 'test',
          algorithmStamp: 'learner-home-v1:legacy-v1',
          delegatedFromCanonicalRequest: true,
          perMode: {} as EvaluatorResult['projectEvaluation']['perMode'],
          pairwise: {},
          nondeterministicRetrievalDiagnostics: null,
        },
        warnings: [],
        invalidResultReasons: [],
        knownUnrelatedIssues: [],
      };
      const output = finalizeResult(draft);
      assert.ok(output.resultStableHash.startsWith('sha256:'));
    } finally {
      globalThis.Date = OriginalDate;
    }
  });
});
