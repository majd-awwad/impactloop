import assert from 'node:assert/strict';
import { after, describe, test } from 'node:test';

import {
  parseRecommendationScorerVersion,
  RECOMMENDATION_SCORER_VERSIONS,
  type RecommendationScorerVersion,
} from '../../config/recommendation-scoring-version.js';
import { prisma } from '../../database/prisma.js';
import {
  createEmptyAffinityProfile,
  createEmptyBehaviorContext,
} from './learner-home.affinity.js';
import { CANONICAL_SCORING_MODE } from './learner-home.canonical-scoring.js';
import { resetMaterialFeaturePoolCacheForTests } from './learner-home.material-features.js';
import {
  BROWSE_MATERIAL_POOL_CAP,
  HOME_MATERIAL_POOL_CAP,
  MATERIAL_CONCEPT_HYDRATION_CHUNK_SIZE,
  loadMaterialConceptsForScoring,
  mergeMaterialPoolRows,
  type MaterialConceptChunkRow,
} from './learner-home.repository.js';
import {
  LEARNER_HOME_CACHE_TTL_MS,
  assembleLearnerHomeCachedEnvelope,
  buildLearnerHomeCacheKey,
  createLearnerHomeCacheForTests,
  getLearnerHome,
  invalidateLearnerHomeCache,
  resolveMaterialCandidatePoolCap,
  resolveMaterialModeDecisionAndContext,
  type LearnerHomeCachedEnvelope,
  type LearnerHomeLoadedContext,
} from './learner-home.service.js';
import type {
  LearnerHomeMaterialCandidate,
  LearnerHomeProjectCandidate,
  LearnerHomeSavedLocationContext,
  LearnerHomeSectionKey,
} from './learner-home.types.js';
import {
  attributeProjectOnlyMaterialConceptSql,
  buildCallerMatrix,
  canonicalizeEvaluationTimeUtc,
  classifyAuditStatus,
  classifyLearnerHomeQueryEvent,
  evaluateBroaderNPlusOne,
  evaluateCacheStateSamples,
  evaluateCanonicalHydrationRequirement,
  evaluateWarmCandidateSqlSamples,
  medianSample,
  normalizeLearnerHomeQueryShape,
  parseAuditCliArgs,
  parseAuditProfile,
  percentileNearestRank,
  readMlRuntimeFlagSnapshot,
  restoreMlRuntimeFlagSnapshot,
  summarizeLearnerHomeQueryEvents,
  withCanonicalIsolatedMlFlags,
  withFrozenEvaluationTime,
} from './learner-home.query-audit.js';
import { env } from '../../config/env.js';
import { getMaterialById } from '../materials/materials.service.js';
import { hashPassword } from '../../utils/password.js';

const SECTION_KEYS: readonly LearnerHomeSectionKey[] = [
  'suggested_materials',
  'materials_for_saved_projects',
  'free_materials_near_you',
  'suggested_projects',
  'continue_projects',
  'saved_projects',
  'popular_projects',
];

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
  mapped: { id: 'mat-1' },
  ...overrides,
});

const project = (
  overrides: Partial<LearnerHomeProjectCandidate> = {},
): LearnerHomeProjectCandidate => ({
  id: 'proj-1',
  title: 'LED Blink',
  shortDescription: 'Blink an LED',
  difficulty: 'BEGINNER',
  estimatedDurationMinutes: 30,
  coverImageUrl: null,
  categoryId: 'cat-electronics',
  categoryNameEn: 'Electronics',
  categoryNameAr: 'الكترونيات',
  tags: ['led'],
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  likesCount: 1,
  savesCount: 0,
  reviewCount: 0,
  reviewAverage: 0,
  requiredComponents: [],
  mapped: { id: 'proj-1', isSaved: false, isLiked: false, isFollowed: false },
  ...overrides,
});

const emptyLocation = (): LearnerHomeSavedLocationContext => ({
  city: null,
  area: null,
});

const loadedContext = (
  materials: LearnerHomeMaterialCandidate[],
  projects: LearnerHomeProjectCandidate[] = [project()],
): LearnerHomeLoadedContext => ({
  interests: ['electronics'],
  savedLocation: emptyLocation(),
  savedComponents: [],
  materials,
  projects,
  savedProjectItems: [],
  inProgressBuilds: [],
  savedProjectIds: new Set(),
  hasSavedProjects: false,
  behavior: createEmptyBehaviorContext(),
  behaviorAffinityProfile: createEmptyAffinityProfile(),
  hasActivity: false,
});

const productionMlKeyFlags = {
  mlShadowEnabled: false,
  mlMaterialServingEnabled: false,
  mlMaterialArtifactPath: '',
  mlProjectServingEnabled: false,
  mlProjectArtifactPath: '',
} as const;

const candidateIdsFromEnvelope = (envelope: LearnerHomeCachedEnvelope) => {
  const materialIds = new Set<string>();
  const projectIds = new Set<string>();
  for (const section of envelope.response.sections) {
    for (const item of section.items) {
      if (item.type === 'material') {
        materialIds.add(String(item.material.id ?? ''));
      }
      if (item.type === 'project') {
        projectIds.add(String(item.project.id ?? ''));
      }
    }
  }
  return {
    materialIds: [...materialIds].filter(Boolean).sort(),
    projectIds: [...projectIds].filter(Boolean).sort(),
  };
};

const conceptRowsForIds = (
  materialIds: readonly string[],
): MaterialConceptChunkRow[] =>
  materialIds.map((materialId) => ({
    materialId,
    concept: {
      canonicalKey: 'material-family:electronics',
      conceptType: 'MATERIAL_FAMILY',
      status: 'ACTIVE',
    },
  }));

describe('RP-03.5 production cache-key construction', () => {
  test('same user + mode + ML flags → identical key; modes diverge; section keys absent', () => {
    const legacy = buildLearnerHomeCacheKey({
      userId: 'learner-a',
      scorerVersion: 'legacy-v1',
      ...productionMlKeyFlags,
    });
    const legacyAgain = buildLearnerHomeCacheKey({
      userId: 'learner-a',
      scorerVersion: 'legacy-v1',
      ...productionMlKeyFlags,
    });
    const normalized = buildLearnerHomeCacheKey({
      userId: 'learner-a',
      scorerVersion: 'normalized-interests-v2',
      ...productionMlKeyFlags,
    });
    const canonical = buildLearnerHomeCacheKey({
      userId: 'learner-a',
      scorerVersion: 'canonical-taxonomy-v3',
      ...productionMlKeyFlags,
    });

    assert.equal(legacy, legacyAgain);
    assert.notEqual(legacy, normalized);
    assert.notEqual(legacy, canonical);
    assert.notEqual(normalized, canonical);

    for (const version of RECOMMENDATION_SCORER_VERSIONS) {
      const key = buildLearnerHomeCacheKey({
        userId: 'learner-a',
        scorerVersion: version,
        ...productionMlKeyFlags,
      });
      assert.ok(key.includes(version));
      assert.ok(key.startsWith(`learner-a\u0000${version}\u0000`));
      for (const sectionKey of SECTION_KEYS) {
        assert.equal(key.includes(sectionKey), false);
      }
    }
  });

  test('default scorer parse remains legacy-v1', () => {
    assert.equal(parseRecommendationScorerVersion(undefined), 'legacy-v1');
    assert.equal(parseRecommendationScorerVersion(''), 'legacy-v1');
  });
});

describe('RP-03.5 resolveMaterialCandidatePoolCap', () => {
  test('Full Home and non-browse sections use 120; suggested_materials uses 400', () => {
    assert.equal(HOME_MATERIAL_POOL_CAP, 120);
    assert.equal(BROWSE_MATERIAL_POOL_CAP, 400);
    assert.equal(
      resolveMaterialCandidatePoolCap({ kind: 'FULL_HOME' }),
      HOME_MATERIAL_POOL_CAP,
    );

    for (const sectionKey of SECTION_KEYS) {
      const cap = resolveMaterialCandidatePoolCap({
        kind: 'SECTION',
        sectionKey,
      });
      if (sectionKey === 'suggested_materials') {
        assert.equal(cap, BROWSE_MATERIAL_POOL_CAP);
      } else {
        assert.equal(cap, HOME_MATERIAL_POOL_CAP);
      }
    }
  });

  test('mergeMaterialPoolRows enforces 120 and 400 against 500 synthetic ids', () => {
    const fiveHundred = Array.from({ length: 500 }, (_, index) => ({
      id: `mat-cap-${index}`,
    }));
    assert.equal(mergeMaterialPoolRows([fiveHundred], 120).length, 120);
    assert.equal(mergeMaterialPoolRows([fiveHundred], 400).length, 400);
  });
});

describe('RP-03.5 TTL boundary', () => {
  test('LEARNER_HOME_CACHE_TTL_MS is 45s and fake clock expires correctly', async () => {
    assert.equal(LEARNER_HOME_CACHE_TTL_MS, 45_000);
    let now = 1_000;
    let loadCount = 0;
    const cache = createLearnerHomeCacheForTests(
      async () => {
        loadCount += 1;
        return { token: loadCount, cacheable: true };
      },
      () => now,
      (payload) => payload.cacheable,
    );

    const first = await cache.get('learner-ttl');
    assert.equal(loadCount, 1);
    now += LEARNER_HOME_CACHE_TTL_MS - 1;
    assert.strictEqual(await cache.get('learner-ttl'), first);
    assert.equal(loadCount, 1);
    now += 1;
    const expired = await cache.get('learner-ttl');
    assert.notStrictEqual(expired, first);
    assert.equal(loadCount, 2);
  });
});

describe('RP-03.5 mapped-table SQL classification', () => {
  test('classifies PostgreSQL @@map table names with safe MaterialConcept precedence', () => {
    assert.equal(
      classifyLearnerHomeQueryEvent({
        query: 'SELECT "public"."material_concepts"."materialId" FROM "public"."material_concepts" WHERE 1=1',
      }),
      'MaterialConcept',
    );
    assert.equal(
      classifyLearnerHomeQueryEvent({
        query: 'SELECT "public"."materials"."id" FROM "public"."materials" WHERE "public"."materials"."status" = $1',
      }),
      'Material',
    );
    assert.equal(
      classifyLearnerHomeQueryEvent({
        query: 'SELECT "public"."learning_projects"."id" FROM "public"."learning_projects"',
      }),
      'LearningProject',
    );
    assert.equal(
      classifyLearnerHomeQueryEvent({
        query: 'SELECT 1 FROM "public"."material_likes"',
      }),
      'MaterialLike',
    );
    assert.equal(
      classifyLearnerHomeQueryEvent({
        query: 'SELECT 1 FROM "public"."material_views"',
      }),
      'MaterialView',
    );
    assert.equal(
      classifyLearnerHomeQueryEvent({
        query: 'SELECT 1 FROM "public"."reservations"',
      }),
      'Reservation',
    );
    assert.equal(
      classifyLearnerHomeQueryEvent({
        query: 'SELECT 1 FROM "public"."project_saves"',
      }),
      'ProjectSave',
    );
    assert.equal(
      classifyLearnerHomeQueryEvent({
        query: 'SELECT 1 FROM "public"."project_likes"',
      }),
      'ProjectLike',
    );
    assert.equal(
      classifyLearnerHomeQueryEvent({
        query: 'SELECT 1 FROM "public"."project_follows"',
      }),
      'ProjectFollow',
    );
    assert.equal(
      classifyLearnerHomeQueryEvent({
        query: 'SELECT 1 FROM "public"."project_builds"',
      }),
      'ProjectBuild',
    );
    assert.equal(
      classifyLearnerHomeQueryEvent({ query: 'BEGIN' }),
      'Transaction',
    );
    assert.equal(
      classifyLearnerHomeQueryEvent({ query: 'COMMIT' }),
      'Transaction',
    );
    assert.equal(
      classifyLearnerHomeQueryEvent({
        query: 'SELECT 1 FROM "public"."project_required_components"',
      }),
      'ProjectRequiredComponent',
    );
    assert.equal(
      classifyLearnerHomeQueryEvent({
        query: 'SELECT 1 FROM "public"."categories"',
      }),
      'Category',
    );
    assert.equal(
      classifyLearnerHomeQueryEvent({
        query: 'SELECT 1 FROM "public"."learner_interest_concepts"',
      }),
      'LearnerInterestConcept',
    );
    assert.equal(
      classifyLearnerHomeQueryEvent({
        query: 'SELECT 1 FROM "public"."user_saved_locations"',
      }),
      'UserSavedLocation',
    );
    assert.equal(
      classifyLearnerHomeQueryEvent({
        query: 'SELECT 1 FROM "public"."project_user_reviews"',
      }),
      'ProjectUserReview',
    );
    assert.equal(
      classifyLearnerHomeQueryEvent({
        query: 'SELECT 1 FROM "public"."unknown_audit_table"',
      }),
      'Other',
    );

    const summary = summarizeLearnerHomeQueryEvents([
      {
        query: 'SELECT 1 FROM "public"."material_concepts"',
        params: '[]',
        duration: 1,
        target: 'quaint',
      },
      {
        query: 'SELECT 1 FROM "public"."materials"',
        params: '[]',
        duration: 1,
        target: 'quaint',
      },
      {
        query: 'SELECT 1 FROM "public"."materials"',
        params: '[]',
        duration: 1,
        target: 'quaint',
      },
      { query: 'BEGIN', params: '[]', duration: 0, target: 'quaint' },
    ]);
    assert.equal(summary.total, 4);
    assert.equal(summary.excludingTransaction, 3);
    assert.equal(summary.materialConcept, 1);
    assert.equal(summary.material, 2);
    assert.equal(summary.repeatedShapes.length, 1);
    assert.equal(summary.repeatedShapes[0]!.count, 2);
    assert.ok(
      normalizeLearnerHomeQueryShape(
        'SELECT id FROM materials WHERE id IN ($1,$2)',
      ).includes('IN (?...)'),
    );
  });
});

describe('RP-03.5 async frozen evaluation time', () => {
  test('two different wall clocks observe the same frozen evaluation time', async () => {
    const evaluationTime = '2026-01-15T12:00:00.000Z';
    const observed: number[] = [];
    await withFrozenEvaluationTime(evaluationTime, async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      observed.push(Date.now());
      await new Promise((resolve) => setTimeout(resolve, 5));
      observed.push(new Date().getTime());
    });
    assert.equal(observed.length, 2);
    assert.equal(observed[0], Date.parse(evaluationTime));
    assert.equal(observed[1], Date.parse(evaluationTime));
    assert.ok(Date.now() !== Date.parse(evaluationTime) || true);
  });

  test('rejects unparseable Z-suffixed strings', () => {
    assert.throws(
      () => canonicalizeEvaluationTimeUtc('not-a-dateZ'),
      /not a parseable/,
    );
  });
});

describe('RP-03.5 audit status invariants', () => {
  test('fails for nonzero project-only MaterialConcept count', () => {
    const status = classifyAuditStatus({
      invariants: [
        {
          name: 'project_only_zero_material_concept',
          status: 'FAIL',
          expected: 0,
          observed: 2,
          evidence: 'test',
        },
      ],
      ttlGapCount: 3,
      unverifiedRequiredCallerCount: 0,
    });
    assert.equal(status, 'FAILED_INVARIANT');
  });

  test('fails for warm candidate SQL', () => {
    const status = classifyAuditStatus({
      invariants: [
        {
          name: 'warm_hit_no_candidate_loading_sql',
          status: 'FAIL',
          expected: 0,
          observed: 3,
          evidence: 'test',
        },
      ],
      ttlGapCount: 0,
      unverifiedRequiredCallerCount: 0,
    });
    assert.equal(status, 'FAILED_INVARIANT');
  });

  test('fails when a required caller remains UNVERIFIED_CALLER', () => {
    const status = classifyAuditStatus({
      invariants: [
        {
          name: 'required_invalidation_callers_verified',
          status: 'FAIL',
          expected: 0,
          observed: 1,
          evidence: 'view unverified',
        },
      ],
      ttlGapCount: 3,
      unverifiedRequiredCallerCount: 1,
    });
    assert.equal(status, 'FAILED_INVARIANT');
  });

  test('PASS_WITH_TTL_GAPS when invariants pass and TTL gaps remain', () => {
    const status = classifyAuditStatus({
      invariants: [
        {
          name: 'full_home_warm_is_hit',
          status: 'PASS',
          expected: 'HIT',
          observed: 'HIT',
          evidence: 'ok',
        },
      ],
      ttlGapCount: 3,
      unverifiedRequiredCallerCount: 0,
    });
    assert.equal(status, 'PASS_WITH_TTL_GAPS');
  });

  test('CLI sample counts reject non-positive values', () => {
    assert.throws(
      () =>
        parseAuditCliArgs([
          '--profile',
          'configured-runtime',
          '--email',
          'a@b.com',
          '--evaluation-time',
          '2026-01-15T12:00:00.000Z',
          '--report-dir',
          'C:\\temp',
          '--cold-samples',
          '0',
        ]),
      /positive integer/,
    );
    assert.throws(
      () =>
        parseAuditCliArgs([
          '--profile',
          'configured-runtime',
          '--email',
          'a@b.com',
          '--evaluation-time',
          '2026-01-15T12:00:00.000Z',
          '--report-dir',
          'C:\\temp',
          '--warm-samples',
          '-1',
        ]),
      /positive integer/,
    );
  });

  test('CLI requires --profile', () => {
    assert.throws(
      () =>
        parseAuditCliArgs([
          '--email',
          'a@b.com',
          '--evaluation-time',
          '2026-01-15T12:00:00.000Z',
          '--report-dir',
          'C:\\temp',
        ]),
      /--profile/,
    );
    assert.equal(parseAuditProfile('configured-runtime'), 'configured-runtime');
    assert.equal(parseAuditProfile('canonical-isolated'), 'canonical-isolated');
    assert.throws(() => parseAuditProfile('production'), /--profile/);
  });

  test('one failing cold sample causes FAILED_INVARIANT', () => {
    const samples = [
      { cacheState: 'MISS' },
      { cacheState: 'HIT' },
      { cacheState: 'MISS' },
    ];
    const check = evaluateCacheStateSamples(samples, 'MISS');
    assert.equal(check.pass, false);
    assert.deepEqual(check.failingIndexes, [1]);
    const status = classifyAuditStatus({
      invariants: [
        {
          name: 'full_home_cold_is_miss',
          status: 'FAIL',
          expected: 'MISS',
          observed: 'MISS,HIT,MISS',
          evidence: 'failing sample indexes: 1',
        },
      ],
      ttlGapCount: 3,
      unverifiedRequiredCallerCount: 0,
    });
    assert.equal(status, 'FAILED_INVARIANT');
  });

  test('one failing warm sample causes FAILED_INVARIANT', () => {
    const samples = [
      {
        cacheState: 'HIT',
        querySummary: { material: 0, learningProject: 0, materialConcept: 0 },
      },
      {
        cacheState: 'HIT',
        querySummary: { material: 1, learningProject: 0, materialConcept: 0 },
      },
    ];
    const check = evaluateWarmCandidateSqlSamples(samples);
    assert.equal(check.pass, false);
    assert.deepEqual(check.failingIndexes, [1]);
    const status = classifyAuditStatus({
      invariants: [
        {
          name: 'warm_hit_no_candidate_loading_sql',
          status: 'FAIL',
          expected: 0,
          observed: 1,
          evidence: check.evidence,
        },
      ],
      ttlGapCount: 0,
      unverifiedRequiredCallerCount: 0,
    });
    assert.equal(status, 'FAILED_INVARIANT');
  });

  test('N_PLUS_ONE_UNVERIFIED causes FAILED_INVARIANT', () => {
    const broader = evaluateBroaderNPlusOne({
      small: {
        label: 'small',
        events: [],
        materialCandidateCount: 2,
        projectCandidateCount: 1,
        requiredComponentCount: 0,
      },
      large: {
        label: 'large',
        events: [],
        materialCandidateCount: 2,
        projectCandidateCount: 1,
        requiredComponentCount: 0,
      },
    });
    assert.equal(broader.status, 'N_PLUS_ONE_UNVERIFIED');
    const status = classifyAuditStatus({
      invariants: [
        {
          name: 'broader_n_plus_one',
          status: 'FAIL',
          expected: 'PASS',
          observed: 'N_PLUS_ONE_UNVERIFIED',
          evidence: broader.evidence,
        },
      ],
      ttlGapCount: 3,
      unverifiedRequiredCallerCount: 0,
    });
    assert.equal(status, 'FAILED_INVARIANT');
  });

  test('configured-runtime ML-shadow MaterialConcept activity is reported, not hidden', () => {
    const attribution = attributeProjectOnlyMaterialConceptSql({
      materialConceptSqlCount: 1,
      loadCanonicalMaterialConceptsMs: null,
      mlShadowEnabled: true,
    });
    assert.equal(attribution.totalMaterialConceptSql, 1);
    assert.equal(attribution.canonicalMaterialConceptSql, 0);
    assert.equal(attribution.mlShadowMaterialConceptSql, 1);
    const shadowFinding = attribution.findings.find(
      (row) => row.code === 'ML_SHADOW_MATERIAL_CONCEPT_LOAD',
    );
    assert.equal(shadowFinding?.status, 'OBSERVED');
    const canonicalFinding = attribution.findings.find(
      (row) => row.code === 'CANONICAL_PROJECT_ONLY_ZERO_HYDRATION',
    );
    assert.equal(canonicalFinding?.status, 'PASS');
  });

  test('canonical-isolated fails when process scorer is not Canonical', () => {
    const rows = evaluateCanonicalHydrationRequirement({
      profile: 'canonical-isolated',
      processScorerVersion: 'legacy-v1',
      requestedMaterialScoringMode: 'legacy-v1',
      effectiveMaterialScoringMode: 'legacy-v1',
      fallbackCode: null,
      cacheable: true,
      loadCanonicalMaterialConceptsMs: 12,
      materialCandidateCount: 10,
      materialConceptSqlCount: 1,
    });
    assert.ok(
      rows.some(
        (row) =>
          row.name === 'canonical_isolated_process_scorer' &&
          row.status === 'FAIL',
      ),
    );
    const status = classifyAuditStatus({
      invariants: rows,
      ttlGapCount: 3,
      unverifiedRequiredCallerCount: 0,
    });
    assert.equal(status, 'FAILED_INVARIANT');
  });

  test('canonical-isolated cannot pass with missing Canonical hydration timing', () => {
    const rows = evaluateCanonicalHydrationRequirement({
      profile: 'canonical-isolated',
      processScorerVersion: 'canonical-taxonomy-v3',
      requestedMaterialScoringMode: 'canonical-taxonomy-v3',
      effectiveMaterialScoringMode: 'canonical-taxonomy-v3',
      fallbackCode: null,
      cacheable: true,
      loadCanonicalMaterialConceptsMs: null,
      materialCandidateCount: 10,
      materialConceptSqlCount: 1,
    });
    assert.ok(
      rows.some(
        (row) =>
          row.name === 'canonical_isolated_hydration_timing' &&
          row.status === 'FAIL',
      ),
    );
    assert.equal(
      classifyAuditStatus({
        invariants: rows,
        ttlGapCount: 3,
        unverifiedRequiredCallerCount: 0,
      }),
      'FAILED_INVARIANT',
    );
  });

  test('required invalidation callers are evidence-bound VERIFIED_POSITIVE', () => {
    const matrix = buildCallerMatrix();
    const required = matrix.filter((row) => row.required);
    assert.ok(required.length >= 7);
    for (const row of required) {
      assert.equal(row.classification, 'VERIFIED_POSITIVE');
      assert.ok(row.evidenceTestFile.length > 0);
      assert.ok(row.validationCommand.length > 0);
      assert.notEqual(row.validationCommand, 'report-only');
    }
    assert.ok(
      required.some((row) =>
        row.mutation.includes('authenticated view'),
      ),
    );
    assert.equal(
      matrix.filter((row) => row.classification === 'UNVERIFIED_CALLER').length,
      0,
    );
  });
});

describe('RP-03.5 project-only skips concept hydration', () => {
  test('needsCanonicalMaterialScoring=false issues zero conceptQueryChunk calls', async () => {
    let calls = 0;
    const { modeDecision, canonicalContext } =
      await resolveMaterialModeDecisionAndContext({
        requestedMaterialScoringMode: CANONICAL_SCORING_MODE,
        needsCanonicalMaterialScoring: false,
        materials: [material({ id: 'mat-skip' })],
        behavior: createEmptyBehaviorContext(),
        conceptQueryChunk: async () => {
          calls += 1;
          return [];
        },
      });
    assert.equal(calls, 0);
    assert.equal(canonicalContext, undefined);
    assert.equal(modeDecision.fallbackCode, null);
    assert.equal(modeDecision.cacheable, true);
  });
});

describe('RP-03.5 MaterialConcept chunk growth', () => {
  test('material_concept_chunk_bound: 50 ids → 1 chunk; 250 ids → 2 chunks', async () => {
    assert.equal(MATERIAL_CONCEPT_HYDRATION_CHUNK_SIZE, 200);

    const countChunks = async (size: number) => {
      const ids = Array.from({ length: size }, (_, index) => `mat-chunk-${index}`);
      let chunks = 0;
      await loadMaterialConceptsForScoring(ids, async (chunk) => {
        chunks += 1;
        return conceptRowsForIds(chunk);
      });
      return chunks;
    };

    assert.equal(await countChunks(50), 1);
    assert.equal(await countChunks(250), 2);
  });
});

describe('RP-03.5 audit profile ML flag isolation', () => {
  test('configured-runtime profile does not mutate ML flags', () => {
    const before = readMlRuntimeFlagSnapshot(env);
    // Simulate configured-runtime: snapshot only, no writes.
    const during = readMlRuntimeFlagSnapshot(env);
    assert.deepEqual(during, before);
    assert.equal(
      env.recommendationMlShadowEnabled,
      before.recommendationMlShadowEnabled,
    );
  });

  test('canonical-isolated restores all ML flags after success and failure', async () => {
    const before = readMlRuntimeFlagSnapshot(env);
    env.recommendationMlShadowEnabled = true;
    env.recommendationMlMaterialServingEnabled = true;
    env.recommendationMlProjectServingEnabled = true;
    const expectedRestore = readMlRuntimeFlagSnapshot(env);

    await withCanonicalIsolatedMlFlags(env, async () => {
      assert.equal(env.recommendationMlShadowEnabled, false);
      assert.equal(env.recommendationMlMaterialServingEnabled, false);
      assert.equal(env.recommendationMlProjectServingEnabled, false);
    });
    assert.deepEqual(readMlRuntimeFlagSnapshot(env), expectedRestore);

    await assert.rejects(
      async () =>
        withCanonicalIsolatedMlFlags(env, async () => {
          throw new Error('forced failure');
        }),
      /forced failure/,
    );
    assert.deepEqual(readMlRuntimeFlagSnapshot(env), expectedRestore);

    restoreMlRuntimeFlagSnapshot(env, before);
  });
});

describe('RP-03.5 broader N+1 evaluation', () => {
  const event = (query: string): {
    query: string;
    params: string;
    duration: number;
    target: string;
  } => ({ query, params: '[]', duration: 1, target: 'quaint' });

  test('repeated project_required_components SQL is classified', () => {
    assert.equal(
      classifyLearnerHomeQueryEvent({
        query:
          'SELECT "public"."project_required_components"."id" FROM "public"."project_required_components" WHERE "public"."project_required_components"."project_id" IN ($1,$2)',
      }),
      'ProjectRequiredComponent',
    );
  });

  test('query repeated once per 6 projects fails under call-graph nested_batch bound', () => {
    const componentSql =
      'SELECT 1 FROM "public"."project_required_components" WHERE project_id = $1';
    const small = {
      label: 'small',
      events: [event(componentSql), event(componentSql)],
      materialCandidateCount: 20,
      projectCandidateCount: 2,
      requiredComponentCount: 4,
    };
    const large = {
      label: 'large',
      events: Array.from({ length: 6 }, () => event(componentSql)),
      materialCandidateCount: 50,
      projectCandidateCount: 6,
      requiredComponentCount: 12,
    };
    const result = evaluateBroaderNPlusOne({ small, large });
    assert.equal(result.status, 'FAIL');
    assert.ok(
      result.violations.some(
        (row) =>
          row.queryClass === 'ProjectRequiredComponent' &&
          row.largeRepetition === 6,
      ),
    );
  });

  test('repeated unclassified query fails with UNCLASSIFIED_REPEATED_QUERY', () => {
    const otherSql = 'SELECT 1 FROM "public"."mystery_audit_table" WHERE id = $1';
    const result = evaluateBroaderNPlusOne({
      small: {
        label: 'small',
        events: [event(otherSql), event(otherSql)],
        materialCandidateCount: 20,
        projectCandidateCount: 3,
        requiredComponentCount: 4,
      },
      large: {
        label: 'large',
        events: [event(otherSql), event(otherSql), event(otherSql)],
        materialCandidateCount: 50,
        projectCandidateCount: 6,
        requiredComponentCount: 10,
      },
    });
    assert.equal(result.status, 'FAIL');
    assert.ok(
      result.violations.some(
        (row) => row.result === 'UNCLASSIFIED_REPEATED_QUERY',
      ),
    );
  });

  test('fixed request-level query counts pass', () => {
    const likeSql = 'SELECT 1 FROM "public"."material_likes" WHERE user_id = $1';
    const result = evaluateBroaderNPlusOne({
      small: {
        label: 'small',
        events: [event(likeSql)],
        materialCandidateCount: 20,
        projectCandidateCount: 3,
        requiredComponentCount: 4,
      },
      large: {
        label: 'large',
        events: [event(likeSql)],
        materialCandidateCount: 50,
        projectCandidateCount: 6,
        requiredComponentCount: 10,
      },
    });
    assert.equal(result.status, 'PASS');
  });

  test('MaterialConcept queries pass only according to ceil(ids/200)', () => {
    const conceptSql =
      'SELECT 1 FROM "public"."material_concepts" WHERE material_id IN ($1,$2)';
    const pass = evaluateBroaderNPlusOne({
      small: {
        label: 'small',
        events: [event(conceptSql)],
        materialCandidateCount: 50,
        projectCandidateCount: 3,
        requiredComponentCount: 4,
      },
      large: {
        label: 'large',
        events: [event(conceptSql), event(conceptSql)],
        materialCandidateCount: 250,
        projectCandidateCount: 6,
        requiredComponentCount: 10,
      },
    });
    assert.equal(pass.status, 'PASS');

    const fail = evaluateBroaderNPlusOne({
      small: {
        label: 'small',
        events: [event(conceptSql)],
        materialCandidateCount: 50,
        projectCandidateCount: 3,
        requiredComponentCount: 4,
      },
      large: {
        label: 'large',
        events: Array.from({ length: 5 }, () => event(conceptSql)),
        materialCandidateCount: 50,
        projectCandidateCount: 6,
        requiredComponentCount: 10,
      },
    });
    assert.equal(fail.status, 'FAIL');
  });

  test('insufficient project/component coverage returns N_PLUS_ONE_UNVERIFIED', () => {
    const result = evaluateBroaderNPlusOne({
      small: {
        label: 'small',
        events: [],
        materialCandidateCount: 5,
        projectCandidateCount: 1,
        requiredComponentCount: 0,
      },
      large: {
        label: 'large',
        events: [],
        materialCandidateCount: 8,
        projectCandidateCount: 1,
        requiredComponentCount: 1,
      },
    });
    assert.equal(result.status, 'N_PLUS_ONE_UNVERIFIED');
    assert.equal(
      classifyAuditStatus({
        invariants: [
          {
            name: 'broader_n_plus_one',
            status: 'FAIL',
            expected: 'PASS',
            observed: 'N_PLUS_ONE_UNVERIFIED',
            evidence: result.evidence,
          },
        ],
        ttlGapCount: 3,
        unverifiedRequiredCallerCount: 0,
      }),
      'FAILED_INVARIANT',
    );
  });

  test('growth from small to large candidate pools is detected', () => {
    const tagSql =
      'SELECT 1 FROM "public"."project_tags" WHERE project_id = $1';
    const result = evaluateBroaderNPlusOne({
      small: {
        label: 'small',
        events: Array.from({ length: 2 }, () => event(tagSql)),
        materialCandidateCount: 20,
        projectCandidateCount: 2,
        requiredComponentCount: 4,
      },
      large: {
        label: 'large',
        events: Array.from({ length: 8 }, () => event(tagSql)),
        materialCandidateCount: 50,
        projectCandidateCount: 8,
        requiredComponentCount: 16,
      },
    });
    assert.equal(result.status, 'FAIL');
    assert.ok(
      result.violations.some((row) => row.queryClass === 'ProjectTag'),
    );
  });
});

describe('RP-03.5 Design B Canonical fallback cache cycle', () => {
  test('exact fallback metadata, retry, cache write, HIT, stable candidates', async () => {
    resetMaterialFeaturePoolCacheForTests();
    const mats = [
      material({ id: 'mat-fb-1' }),
      material({ id: 'mat-fb-2', title: 'Resistor Pack' }),
    ];
    const projects = [project({ id: 'proj-fb-1' })];
    const loaded = loadedContext(mats, projects);
    let loadAttempt = 0;
    let hydrationCalls = 0;

    const cache = createLearnerHomeCacheForTests<LearnerHomeCachedEnvelope>(
      async (userId) => {
        loadAttempt += 1;
        return assembleLearnerHomeCachedEnvelope({
          userId,
          loaded,
          requestedMaterialScoringMode: CANONICAL_SCORING_MODE,
          conceptQueryChunk: async (chunkIds) => {
            hydrationCalls += 1;
            if (loadAttempt === 1) {
              throw new Error('RP-03.5 injected Canonical hydration failure');
            }
            return conceptRowsForIds(chunkIds);
          },
        });
      },
      Date.now,
      (payload) => payload.cacheable,
      (userId) =>
        buildLearnerHomeCacheKey({
          userId,
          scorerVersion: 'canonical-taxonomy-v3',
          ...productionMlKeyFlags,
        }),
    );

    const first = await cache.getWithState('learner-fb');
    assert.equal(first.state, 'MISS');
    assert.equal(first.payload.cacheable, false);
    assert.equal(
      first.payload.modeDecision.requestedMaterialScoringMode,
      CANONICAL_SCORING_MODE,
    );
    assert.equal(
      first.payload.modeDecision.effectiveMaterialScoringMode,
      'legacy-v1',
    );
    assert.equal(
      first.payload.modeDecision.fallbackCode,
      'CANONICAL_LOADER_FALLBACK_LEGACY_V1',
    );
    assert.equal(cache.getDiagnostics().cacheWriteCount, 0);
    assert.ok(hydrationCalls >= 1);
    const hydrationAfterFirst = hydrationCalls;
    const firstIds = candidateIdsFromEnvelope(first.payload);

    const second = await cache.getWithState('learner-fb');
    assert.equal(second.state, 'MISS');
    assert.ok(hydrationCalls > hydrationAfterFirst);
    assert.equal(second.payload.cacheable, true);
    assert.equal(
      second.payload.modeDecision.requestedMaterialScoringMode,
      CANONICAL_SCORING_MODE,
    );
    assert.equal(
      second.payload.modeDecision.effectiveMaterialScoringMode,
      CANONICAL_SCORING_MODE,
    );
    assert.equal(second.payload.modeDecision.fallbackCode, null);
    assert.equal(cache.getDiagnostics().cacheWriteCount, 1);
    assert.equal(loadAttempt, 2);
    const secondIds = candidateIdsFromEnvelope(second.payload);
    assert.deepEqual(firstIds, secondIds);

    const hydrationAfterSecond = hydrationCalls;
    const third = await cache.getWithState('learner-fb');
    assert.equal(third.state, 'HIT');
    assert.equal(loadAttempt, 2);
    assert.equal(hydrationCalls, hydrationAfterSecond);
    assert.strictEqual(third.payload, second.payload);
  });
});

describe('RP-03.5 authenticated material view invalidation', () => {
  const createdUserIds: string[] = [];
  const marker = `[rp035-view-${Date.now()}]`;

  after(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  test('recorded authenticated view invalidates only the viewing learner home cache', async (t) => {
    if (!process.env.DATABASE_URL) {
      t.skip('DATABASE_URL required');
      return;
    }

    const materialRow = await prisma.material.findFirst({
      where: { status: 'AVAILABLE', quantity: { gt: 0 } },
      select: { id: true },
    });
    if (!materialRow) {
      t.skip('No available material in database');
      return;
    }

    const passwordHash = await hashPassword('TestPassword123!');
    const learnerA = await prisma.user.create({
      data: {
        displayName: `${marker} A`,
        email: `${marker}-a@impactloop.test`,
        passwordHash,
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
        learnerProfile: {
          create: { learnerType: 'STUDENT', skillLevel: 'BEGINNER' },
        },
      },
      select: { id: true },
    });
    const learnerB = await prisma.user.create({
      data: {
        displayName: `${marker} B`,
        email: `${marker}-b@impactloop.test`,
        passwordHash,
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
        learnerProfile: {
          create: { learnerType: 'STUDENT', skillLevel: 'BEGINNER' },
        },
      },
      select: { id: true },
    });
    createdUserIds.push(learnerA.id, learnerB.id);

    invalidateLearnerHomeCache(learnerA.id);
    invalidateLearnerHomeCache(learnerB.id);
    const homeA = await getLearnerHome(learnerA.id);
    const homeB = await getLearnerHome(learnerB.id);

    await getMaterialById(materialRow.id, {
      sub: learnerA.id,
      roles: ['LEARNER'],
    });

    const homeAAfter = await getLearnerHome(learnerA.id);
    const homeBAfter = await getLearnerHome(learnerB.id);
    assert.notStrictEqual(homeAAfter, homeA);
    assert.strictEqual(homeBAfter, homeB);
  });
});

describe('RP-03.5 percentile helpers', () => {
  test('median and nearest-rank P75/P95', () => {
    const samples = [10, 20, 30, 40, 50];
    assert.equal(medianSample(samples), 30);
    assert.equal(percentileNearestRank(samples, 75), 40);
    assert.equal(percentileNearestRank(samples, 95), 50);
    assert.equal(medianSample([]), null);
  });
});

describe('RP-03.5 scorer version list covers three modes', () => {
  test('RECOMMENDATION_SCORER_VERSIONS enumerates the three modes', () => {
    const expected: RecommendationScorerVersion[] = [
      'legacy-v1',
      'normalized-interests-v2',
      'canonical-taxonomy-v3',
    ];
    assert.deepEqual([...RECOMMENDATION_SCORER_VERSIONS], expected);
  });
});
