/**
 * Structural, test-double-based orchestration tests for RP-03.3.
 *
 * Unlike evaluate-ranking-delta.test.ts (fully synthetic, no real modules),
 * this file exercises the REAL production functions (resolveMaterialMode-
 * DecisionAndContext, preScoreMaterials, rankProjects, scoreSuggestedProject)
 * loaded via buildRealDeps(), while faking only the two retrieval calls
 * (loadMaterialCandidatesForLearner / loadLearnerHomeProjectContext) and the
 * user lookup, and monkeypatching the shared Prisma singleton's
 * materialConcept.findMany — the exact precedent already established in
 * learner-home.canonical-scoring.test.ts ("Never touch the real DB: return
 * an empty result synchronously").
 *
 * These tests intentionally do NOT rely on before/after table counts as
 * proof of no mutation (per RP-03.3 correction #4): instead they install a
 * write-method guard directly on the shared Prisma client that throws (and
 * records) any write-shaped call, so mutation is structurally impossible
 * during the run rather than merely unobserved afterward.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  buildRealDeps,
  runRankingDeltaEvaluation,
  type EvaluatorDeps,
} from './evaluate-ranking-delta.js';
import type {
  LearnerBehaviorContext,
  LearnerHomeMaterialCandidate,
  LearnerHomeProjectCandidate,
} from '../src/modules/learner-home/learner-home.types.js';

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

const WRITE_METHOD_NAMES = [
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
  'upsert',
] as const;

/** Installs a throwing guard over every write-shaped Prisma method reachable
 * on the real shared client, plus $executeRaw*. Restores originals on
 * request. Mirrors (and generalizes) the exact monkeypatch technique already
 * used in learner-home.canonical-scoring.test.ts. */
const installPrismaWriteGuard = (prismaClient: Record<string, any>) => {
  const violations: string[] = [];
  const restorers: Array<() => void> = [];

  const guard = (target: Record<string, any>, key: string) => {
    const original = target[key];
    if (typeof original !== 'function') return;
    target[key] = (...args: unknown[]) => {
      violations.push(key);
      throw new Error(`Blocked write-shaped Prisma call during evaluator run: ${key}`);
    };
    restorers.push(() => {
      target[key] = original;
    });
  };

  for (const key of ['$executeRaw', '$executeRawUnsafe']) {
    guard(prismaClient, key);
  }
  for (const modelKey of Object.keys(prismaClient)) {
    const delegate = prismaClient[modelKey];
    if (!delegate || typeof delegate !== 'object') continue;
    for (const methodName of WRITE_METHOD_NAMES) {
      guard(delegate, methodName);
    }
  }

  return {
    violations,
    restore: () => {
      for (const restore of restorers) restore();
    },
  };
};

describe('evaluate-ranking-delta orchestration (real production functions, faked retrieval)', () => {
  test(
    'retrieval invoked exactly once per domain; real rankProjects/preScoreMaterials/' +
      'resolveMaterialModeDecisionAndContext reused; no Prisma write method invoked; ' +
      'scorer configuration unaffected',
    async () => {
      const realDeps = await buildRealDeps();
      const beforeScorerVersion = realDeps.currentScorerVersionConstant();
      const beforeEnvScorerVersion = process.env.RECOMMENDATION_SCORER_VERSION;

      const originalMaterialConceptFindMany = (realDeps.prisma as any).materialConcept?.findMany;
      // Never touch the real DB for canonical concept hydration: return an
      // empty result synchronously (exact precedent from
      // learner-home.canonical-scoring.test.ts).
      (realDeps.prisma as any).materialConcept.findMany = async () => [];

      const writeGuard = installPrismaWriteGuard(realDeps.prisma as unknown as Record<string, any>);

      let materialRetrievalCallCount = 0;
      let projectRetrievalCallCount = 0;

      const fixtureMaterials = [material({ id: 'mat-1' }), material({ id: 'mat-2' }), material({ id: 'mat-3' })];
      const fixtureProjects = [
        project({ id: 'proj-1', createdAt: new Date('2026-06-01T00:00:00.000Z') }),
        project({ id: 'proj-2', createdAt: new Date('2026-06-02T00:00:00.000Z') }),
      ];

      const deps: EvaluatorDeps = {
        ...realDeps,
        prisma: {
          user: { findMany: async () => [{ id: 'user-1', email: 'learner@test.com', accountStatus: 'ACTIVE', recommendationEvidenceEligibility: 'ELIGIBLE' }] },
          $disconnect: async () => {},
        },
        loadLearnerInterests: async () => ['arduino'],
        loadDefaultSavedLocation: async () => ({ city: null, area: null }),
        loadLearnerHomeProjectContext: async () => {
          projectRetrievalCallCount += 1;
          return {
            behavior: emptyBehavior(),
            projects: fixtureProjects,
            savedProjects: [],
            inProgressBuilds: [],
            hasSavedProjects: false,
          };
        },
        loadMaterialCandidatesForLearner: async () => {
          materialRetrievalCallCount += 1;
          return fixtureMaterials;
        },
      };

      try {
        const result = await runRankingDeltaEvaluation(
          {
            userId: 'user-1',
            email: undefined,
            evaluationTimeUtc: '2026-07-20T00:00:00.000Z',
            topK: 2,
            poolScope: 'home',
            scoreBucket: 'suggested',
            reportPath: undefined,
          },
          deps,
        );

        assert.equal(materialRetrievalCallCount, 1, 'material retrieval must be invoked exactly once');
        assert.equal(projectRetrievalCallCount, 1, 'project retrieval must be invoked exactly once');
        assert.equal(
          writeGuard.violations.length,
          0,
          `no Prisma write method should be invoked; observed: ${writeGuard.violations.join(', ')}`,
        );

        // The real rankProjects/preScoreMaterials/resolveMaterialModeDecisionAndContext
        // were exercised (not faked); the frozen pool identity must still hold.
        for (const mode of result.requestedModes) {
          assert.equal(
            result.materialEvaluation.perMode[mode]!.scoringIdentity.inputCandidateCount,
            fixtureMaterials.length,
          );
          assert.equal(
            result.projectEvaluation.perMode[mode]!.scoringIdentity.inputCandidateCount,
            fixtureProjects.length,
          );
        }
        // rankingFunctionUsed names the real exported production combinator.
        assert.match(result.projectEvaluation.rankingFunctionUsed, /rankProjects/);

        const afterScorerVersion = realDeps.currentScorerVersionConstant();
        const afterEnvScorerVersion = process.env.RECOMMENDATION_SCORER_VERSION;
        assert.equal(afterScorerVersion, beforeScorerVersion);
        assert.equal(afterEnvScorerVersion, beforeEnvScorerVersion);
        assert.ok(!result.invalidResultReasons.includes('SCORER_CONFIGURATION_MUTATION_DETECTED'));
      } finally {
        writeGuard.restore();
        if (originalMaterialConceptFindMany) {
          (realDeps.prisma as any).materialConcept.findMany = originalMaterialConceptFindMany;
        }
        await realDeps.prisma.$disconnect();
      }
    },
  );

  test('the real rankProjects side-effect (recording scorer) yields a complete scoringIdentity with no extra scoring calls', async () => {
    const realDeps = await buildRealDeps();
    (realDeps.prisma as any).materialConcept.findMany = async () => [];
    const writeGuard = installPrismaWriteGuard(realDeps.prisma as unknown as Record<string, any>);

    const fixtureMaterials = [material({ id: 'mat-1' })];
    const fixtureProjects = [
      project({ id: 'proj-1', createdAt: new Date('2026-06-01T00:00:00.000Z') }),
      project({ id: 'proj-2', createdAt: new Date('2026-06-02T00:00:00.000Z') }),
      project({ id: 'proj-3', createdAt: new Date('2026-06-03T00:00:00.000Z') }),
    ];

    let scoreCallCount = 0;
    const deps: EvaluatorDeps = {
      ...realDeps,
      prisma: {
        user: { findMany: async () => [{ id: 'user-1', email: 'learner@test.com', accountStatus: 'ACTIVE', recommendationEvidenceEligibility: 'ELIGIBLE' }] },
        $disconnect: async () => {},
      },
      loadLearnerInterests: async () => [],
      loadDefaultSavedLocation: async () => ({ city: null, area: null }),
      loadLearnerHomeProjectContext: async () => ({
        behavior: emptyBehavior(),
        projects: fixtureProjects,
        savedProjects: [],
        inProgressBuilds: [],
        hasSavedProjects: false,
      }),
      loadMaterialCandidatesForLearner: async () => fixtureMaterials,
      scoreSuggestedProject: (input) => {
        scoreCallCount += 1;
        return realDeps.scoreSuggestedProject(input);
      },
    };

    try {
      const result = await runRankingDeltaEvaluation(
        {
          userId: 'user-1',
          email: undefined,
          evaluationTimeUtc: '2026-07-20T00:00:00.000Z',
          topK: 2,
          poolScope: 'home',
          scoreBucket: 'suggested',
          reportPath: undefined,
        },
        deps,
      );

      // Exactly one raw score per frozen project per mode (3 projects x 3 modes = 9),
      // observed as a side effect of the single real rankProjects call per mode —
      // no separate/duplicate scoring pass.
      assert.equal(scoreCallCount, fixtureProjects.length * result.requestedModes.length);
      for (const mode of result.requestedModes) {
        const identity = result.projectEvaluation.perMode[mode]!.scoringIdentity;
        assert.equal(identity.scoredCandidateCount, fixtureProjects.length);
        assert.equal(identity.identityMatch, true);
      }
      assert.equal(writeGuard.violations.length, 0);
    } finally {
      writeGuard.restore();
      await realDeps.prisma.$disconnect();
    }
  });

  test('the real rankPreScoredMaterialEntries filters non-positive scores before ranking (no local reimplementation)', async () => {
    const realDeps = await buildRealDeps();
    (realDeps.prisma as any).materialConcept.findMany = async () => [];
    const writeGuard = installPrismaWriteGuard(realDeps.prisma as unknown as Record<string, any>);

    const fixtureMaterials = [material({ id: 'mat-1' }), material({ id: 'mat-2' })];
    const fixtureProjects = [project({ id: 'proj-1' })];

    const scoredResult = (score: number) => ({
      score,
      reasons: [] as string[],
      tier: 1 as const,
      hasPrimaryRelevance: true,
      fallbackOnly: false,
    });

    const deps: EvaluatorDeps = {
      ...realDeps,
      prisma: {
        user: { findMany: async () => [{ id: 'user-1', email: 'learner@test.com', accountStatus: 'ACTIVE', recommendationEvidenceEligibility: 'ELIGIBLE' }] },
        $disconnect: async () => {},
      },
      loadLearnerInterests: async () => [],
      loadDefaultSavedLocation: async () => ({ city: null, area: null }),
      loadLearnerHomeProjectContext: async () => ({
        behavior: emptyBehavior(),
        projects: fixtureProjects,
        savedProjects: [],
        inProgressBuilds: [],
        hasSavedProjects: false,
      }),
      loadMaterialCandidatesForLearner: async () => fixtureMaterials,
      // Fakes only the raw score inputs; the ranking-eligibility decision
      // itself (score > 0 filter, tiered/browse dispatch) is made by the
      // real, exported `rankPreScoredMaterialEntries` via `realDeps`.
      preScoreMaterials: (context) =>
        context.materials.map((candidate) => ({
          material: candidate,
          ownerId: candidate.ownerId,
          scores: {
            suggested: scoredResult(candidate.id === 'mat-1' ? -10 : 5),
            savedProjects: scoredResult(1),
            free: scoredResult(1),
          },
        })),
    };

    try {
      const result = await runRankingDeltaEvaluation(
        {
          userId: 'user-1',
          email: undefined,
          evaluationTimeUtc: '2026-07-20T00:00:00.000Z',
          topK: 2,
          poolScope: 'home',
          scoreBucket: 'suggested',
          reportPath: undefined,
        },
        deps,
      );

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
      assert.equal(writeGuard.violations.length, 0);
    } finally {
      writeGuard.restore();
      await realDeps.prisma.$disconnect();
    }
  });

  test('gated real-query compatibility check (self-skips without RANKING_DELTA_TEST_USER_ID)', async (t) => {
    const testUserId = process.env.RANKING_DELTA_TEST_USER_ID;
    if (!testUserId) {
      t.skip('RANKING_DELTA_TEST_USER_ID not set; skipping real-database compatibility check.');
      return;
    }

    const realDeps = await buildRealDeps();
    try {
      const [interests, savedLocation, projectContext] = await Promise.all([
        realDeps.loadLearnerInterests(testUserId),
        realDeps.loadDefaultSavedLocation(testUserId),
        realDeps.loadLearnerHomeProjectContext(testUserId, 4),
      ]);
      assert.ok(Array.isArray(interests));
      assert.ok(savedLocation && typeof savedLocation === 'object');
      assert.ok(Array.isArray(projectContext.projects));

      const materials = await realDeps.loadMaterialCandidatesForLearner({
        interests,
        savedComponents: projectContext.behavior.savedProjectComponents ?? [],
        behavior: projectContext.behavior,
        savedLocation,
        poolCap: realDeps.homeMaterialPoolCap,
      });
      assert.ok(Array.isArray(materials));
      for (const candidate of materials) {
        assert.equal(typeof candidate.id, 'string');
      }
      // No determinism, ordering, or mutation assertions here by design —
      // this test only proves the real Prisma queries remain compatible.
    } finally {
      await realDeps.prisma.$disconnect();
    }
  });
});
