import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { scoreSuggestedMaterial } from '../src/modules/learner-home/learner-home.scoring.js';
import type { LearnerHomeMaterialCandidate } from '../src/modules/learner-home/learner-home.types.js';
import {
  BASELINE_SCHEMA_VERSION,
  BaselineError,
  buildFixture,
  buildReconstructedCandidateSnapshot,
  canonicalizeEvaluationTime,
  findDifferences,
  parseAndValidateFixture,
  parseCliArgs,
  projectAuthoritativeResponse,
  stableHash,
  validateSnapshotInvariants,
  withDeterministicProcessState,
  type ReconstructedCandidateSnapshot,
  type StablePersonaSnapshot,
  type StableSnapshot,
} from './benchmark-learner-home.js';

const evaluationTime = '2026-07-23T00:00:00.000Z';

const fakeLoaders = (mutableEnv: Record<string, unknown>) => ({
  loadScoringConfig: async () => ({
    RECOMMENDATION_SCORER_VERSION: 'legacy-v1',
  }),
  loadEnvironment: async () => ({ env: mutableEnv }),
});

const emptyCandidates = (): ReconstructedCandidateSnapshot => ({
  counts: { materials: 0, projects: 0, total: 0 },
  materials: [],
  projects: [],
  supportingPools: { savedProjects: [], continueProjects: [] },
  rankingInputFingerprint: stableHash({ empty: true }),
});

const stablePersona = (
  overrides: Partial<StablePersonaSnapshot> = {},
): StablePersonaSnapshot => ({
  email: 'majd@learner.com',
  databaseUserId: 'learner-id',
  profileCompletion: {
    hasInterests: true,
    hasSavedLocation: true,
    hasSavedProjects: false,
    hasActivity: false,
  },
  reconstructedCandidateSnapshot: emptyCandidates(),
  sections: [],
  ...overrides,
});

const stableSnapshot = (
  overrides: Partial<StableSnapshot> = {},
): StableSnapshot => ({
  evaluationTimeUtc: evaluationTime,
  champion: {
    scorerVersion: 'legacy-v1',
    algorithmName: 'deterministic-hybrid',
    algorithmVersion: 'learner-home-v1:legacy-v1',
    policyVersion: 'learner-home-policy-v1',
  },
  personas: [stablePersona()],
  ...overrides,
});

const assertBaselineError = (
  action: () => unknown,
  code: string,
): void => {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof BaselineError);
    assert.equal(error.code, code);
    return true;
  });
};

describe('deterministic baseline CLI contract', () => {
  test('accepts the documented verify and update forms', () => {
    assert.deepEqual(parseCliArgs(['verify']), {
      mode: 'verify',
      acceptCurrentDataset: false,
      evaluationTimeUtc: undefined,
      warm: false,
      reportPath: undefined,
    });

    const update = parseCliArgs([
      'update',
      '--accept-current-dataset',
      '--evaluation-time',
      '2026-07-23T00:00:00Z',
      '--warm',
    ]);
    assert.equal(update.mode, 'update');
    assert.equal(update.acceptCurrentDataset, true);
    assert.equal(update.evaluationTimeUtc, evaluationTime);
    assert.equal(update.warm, true);

    const npmForwarded = parseCliArgs(
      ['update', evaluationTime],
      undefined,
      {
        npm_config_accept_current_dataset: 'true',
        npm_config_evaluation_time: 'true',
      },
    );
    assert.equal(npmForwarded.acceptCurrentDataset, true);
    assert.equal(npmForwarded.evaluationTimeUtc, evaluationTime);
  });

  test('rejects unsafe or ambiguous argument combinations', () => {
    assertBaselineError(() => parseCliArgs([]), 'CLI_USAGE');
    assertBaselineError(
      () => parseCliArgs(['verify', '--evaluation-time', evaluationTime]),
      'CLI_USAGE',
    );
    assertBaselineError(
      () => parseCliArgs(['update', '--evaluation-time', evaluationTime]),
      'CLI_USAGE',
    );
    assertBaselineError(
      () => parseCliArgs(['update', '--accept-current-dataset']),
      'CLI_USAGE',
    );
    assertBaselineError(
      () => parseCliArgs(['verify', '--warm', '--warm']),
      'CLI_USAGE',
    );
    assertBaselineError(
      () => parseCliArgs(['verify', '--report', 'fixture.json'], 'fixture.json'),
      'CLI_USAGE',
    );
    assertBaselineError(
      () => canonicalizeEvaluationTime('2026-07-23T00:00:00+00:00'),
      'INVALID_EVALUATION_TIME',
    );
  });
});

describe('process-local deterministic bootstrap', () => {
  test('locks clock and recommendation flags before runtime and restores all state', async () => {
    const originalDateNow = Date.now;
    const trackedKeys = [
      'RECOMMENDATION_SCORER_VERSION',
      'RECOMMENDATION_ML_RUNTIME_MODE',
      'RECOMMENDATION_ML_SHADOW_ENABLED',
      'RECOMMENDATION_OUTBOX_WORKER_ENABLED',
    ] as const;
    const originalProcessValues = new Map(
      trackedKeys.map((key) => [key, process.env[key]]),
    );
    const mutableEnv: Record<string, unknown> = {
      recommendationScorerVersion: 'normalized-interests-v2',
      recommendationMlRuntimeMode: 'ML_PRIMARY',
      recommendationMlShadowEnabled: true,
      recommendationOutboxWorkerEnabled: true,
    };
    const originalMutableEnv = { ...mutableEnv };

    await withDeterministicProcessState(
      evaluationTime,
      {
        loadScoringConfig: async () => {
          assert.equal(Date.now(), Date.parse(evaluationTime));
          assert.equal(process.env.RECOMMENDATION_SCORER_VERSION, 'legacy-v1');
          return { RECOMMENDATION_SCORER_VERSION: 'legacy-v1' };
        },
        loadEnvironment: async () => {
          process.env.RECOMMENDATION_ML_SHADOW_ENABLED = 'true';
          return { env: mutableEnv };
        },
      },
      async ({ env }) => {
        assert.equal(Date.now(), Date.parse(evaluationTime));
        assert.equal(process.env.RECOMMENDATION_ML_SHADOW_ENABLED, 'false');
        assert.equal(process.env.RECOMMENDATION_ML_RUNTIME_MODE, 'DETERMINISTIC');
        assert.equal(env.recommendationScorerVersion, 'legacy-v1');
        assert.equal(env.recommendationMlRuntimeMode, 'DETERMINISTIC');
        assert.equal(env.recommendationMlShadowEnabled, false);
        assert.equal(env.recommendationOutboxWorkerEnabled, false);
      },
    );

    assert.equal(Date.now, originalDateNow);
    assert.deepEqual(mutableEnv, originalMutableEnv);
    for (const key of trackedKeys) {
      assert.equal(process.env[key], originalProcessValues.get(key));
    }
  });

  test('restores clock, process environment, and mutable env after failure', async () => {
    const originalDateNow = Date.now;
    const originalShadow = process.env.RECOMMENDATION_ML_SHADOW_ENABLED;
    const mutableEnv: Record<string, unknown> = {
      recommendationScorerVersion: 'legacy-v1',
      recommendationMlRuntimeMode: 'DETERMINISTIC',
      recommendationMlShadowEnabled: true,
      recommendationOutboxWorkerEnabled: false,
    };

    await assert.rejects(
      withDeterministicProcessState(
        evaluationTime,
        fakeLoaders(mutableEnv),
        async () => {
          throw new Error('intentional failure');
        },
      ),
      /intentional failure/,
    );

    assert.equal(Date.now, originalDateNow);
    assert.equal(
      process.env.RECOMMENDATION_ML_SHADOW_ENABLED,
      originalShadow,
    );
    assert.equal(mutableEnv.recommendationMlShadowEnabled, true);
  });

  test('ignores changing real clocks when evaluation time is unchanged', async () => {
    const actualDateNow = Date.now;
    const runAtRealClock = async (realClock: number) => {
      Date.now = () => realClock;
      return withDeterministicProcessState(
        evaluationTime,
        fakeLoaders({}),
        async ({ evaluationTimeUtc }) =>
          stableHash({ evaluationTimeUtc, observedNow: Date.now() }),
      );
    };

    try {
      const first = await runAtRealClock(1_000);
      const second = await runAtRealClock(9_000_000);
      assert.equal(first, second);
    } finally {
      Date.now = actualDateNow;
    }
  });

  test('changing evaluation time changes time-sensitive production scoring', async () => {
    const candidate: LearnerHomeMaterialCandidate = {
      id: 'material-1',
      ownerId: 'supplier-1',
      title: 'Time-sensitive material',
      description: 'A deterministic recency fixture',
      materialType: 'wood',
      categoryId: 'category-1',
      categoryNameEn: 'Wood',
      categoryNameAr: 'Wood',
      status: 'AVAILABLE',
      isFree: false,
      deliveryAllowed: true,
      pickupAllowed: true,
      viewsCount: 0,
      likesCount: 0,
      city: 'Hebron',
      area: null,
      tags: [],
      createdAt: new Date('2026-07-17T00:00:00.000Z'),
      availableQuantity: 1,
      mapped: {},
    };
    const scoreAt = (time: string) =>
      withDeterministicProcessState(time, fakeLoaders({}), async () =>
        scoreSuggestedMaterial({
          material: candidate,
          interests: [],
          savedComponents: [],
          savedLocation: { city: null, area: null },
        }).score,
      );

    const recentScore = await scoreAt(evaluationTime);
    const staleTime = '2026-08-23T00:00:00.000Z';
    const staleScore = await scoreAt(staleTime);
    assert.notEqual(recentScore, staleScore);
    assert.notEqual(
      stableHash({ evaluationTimeUtc: evaluationTime, score: recentScore }),
      stableHash({ evaluationTimeUtc: staleTime, score: staleScore }),
    );
  });
});

describe('stable fixture and snapshot contract', () => {
  test('canonical hashing sorts object keys and preserves array order', () => {
    assert.equal(stableHash({ b: 2, a: 1 }), stableHash({ a: 1, b: 2 }));
    assert.notEqual(stableHash([1, 2]), stableHash([2, 1]));
  });

  test('acceptance metadata and diagnostic timing do not enter stableHash', () => {
    const first = buildFixture({
      stableSnapshot: stableSnapshot(),
      databaseSnapshotFingerprint: stableHash({ database: 1 }),
      acceptedAtUtc: '2026-07-23T01:00:00.000Z',
    });
    const second = buildFixture({
      stableSnapshot: stableSnapshot(),
      databaseSnapshotFingerprint: stableHash({ database: 1 }),
      acceptedAtUtc: '2026-07-23T02:00:00.000Z',
    });
    assert.equal(first.stableHash, second.stableHash);
    assert.notEqual(
      first.stableHash,
      buildFixture({
        stableSnapshot: stableSnapshot({
          evaluationTimeUtc: '2026-07-24T00:00:00.000Z',
        }),
        databaseSnapshotFingerprint: stableHash({ database: 1 }),
        acceptedAtUtc: first.acceptanceMetadata.acceptedAtUtc,
      }).stableHash,
    );
  });

  test('validates fixture schema and self-hash', () => {
    const fixture = buildFixture({
      stableSnapshot: stableSnapshot(),
      databaseSnapshotFingerprint: stableHash({ database: 1 }),
      acceptedAtUtc: '2026-07-23T01:00:00.000Z',
    });
    assert.deepEqual(parseAndValidateFixture(JSON.stringify(fixture)), fixture);

    assertBaselineError(
      () =>
        parseAndValidateFixture(
          JSON.stringify({ ...fixture, schemaVersion: 'unsupported-v99' }),
        ),
      'FIXTURE_SCHEMA_UNSUPPORTED',
    );
    assertBaselineError(
      () =>
        parseAndValidateFixture(
          JSON.stringify({ ...fixture, stableHash: 'sha256:wrong' }),
        ),
      'FIXTURE_HASH_INVALID',
    );
  });

  test('projects all recommendation item types with authoritative identities', () => {
    const candidates: ReconstructedCandidateSnapshot = {
      counts: { materials: 1, projects: 1, total: 2 },
      materials: [
        {
          entityType: 'MATERIAL',
          entityId: 'material-1',
          diagnosticDescriptor: ['material', 'wood', 'wood', 'hebron'],
        },
      ],
      projects: [
        {
          entityType: 'PROJECT',
          entityId: 'project-1',
          diagnosticDescriptor: ['project', 'wood', 'easy'],
        },
      ],
      supportingPools: {
        savedProjects: [],
        continueProjects: [
          {
            entityType: 'PROJECT',
            entityId: 'project-1',
            recordId: 'build-1',
            diagnosticDescriptor: ['project', 'wood', 'easy'],
          },
        ],
      },
      rankingInputFingerprint: stableHash({ inputs: 1 }),
    };
    const projected = projectAuthoritativeResponse(
      {
        profileCompletion: {
          hasInterests: true,
          hasSavedLocation: false,
          hasSavedProjects: false,
          hasActivity: true,
        },
        sections: [
          {
            key: 'suggested_materials',
            items: [
              {
                type: 'material',
                score: 10,
                reasons: ['Material reason'],
                material: { id: 'material-1' },
              },
            ],
          },
          {
            key: 'suggested_projects',
            items: [
              {
                type: 'project',
                score: 8,
                reasons: ['Project reason'],
                project: { id: 'project-1' },
              },
            ],
          },
          {
            key: 'continue_projects',
            items: [
              {
                type: 'continue_project',
                score: 0,
                reasons: ['Continue building'],
                build: { id: 'build-1', projectId: 'project-1' },
              },
            ],
          },
        ],
      },
      candidates,
    );

    assert.deepEqual(
      projected.sections.map((section) => section.orderedItems[0]?.entityId),
      ['material-1', 'project-1', 'project-1'],
    );
    assert.equal(projected.sections[2]!.orderedItems[0]!.recordId, 'build-1');
  });

  test('labels candidate capture as reconstructed evidence and fingerprints ranking inputs', () => {
    const reconstructed = buildReconstructedCandidateSnapshot({
      interests: ['wood'],
      savedLocation: { city: 'Hebron', area: null },
      materials: [
        {
          id: 'material-1',
          title: 'Material',
          materialType: 'wood',
          categoryNameEn: 'Wood',
          city: 'Hebron',
          createdAt: new Date('2026-07-01T00:00:00.000Z'),
        },
      ],
      projectContext: {
        behavior: { likedMaterials: [] },
        projects: [
          {
            id: 'project-1',
            title: 'Project',
            categoryNameEn: 'Wood',
            difficulty: 'EASY',
          },
        ],
        savedProjects: [],
        inProgressBuilds: [],
        hasSavedProjects: false,
      },
    });
    assert.equal(reconstructed.counts.total, 2);
    assert.match(reconstructed.rankingInputFingerprint, /^sha256:[a-f0-9]{64}$/);
  });

  test('rejects prohibited duplicates but allows project reuse across sections', () => {
    const reusableProject = {
      position: 1,
      itemType: 'project' as const,
      entityType: 'PROJECT' as const,
      entityId: 'project-1',
      recordId: 'project-1',
      diagnosticDescriptor: ['project', 'wood', 'easy'],
      score: 1,
      reasons: ['Reason'],
    };
    assert.doesNotThrow(() =>
      validateSnapshotInvariants(
        stablePersona({
          sections: [
            { key: 'suggested_projects', count: 1, orderedItems: [reusableProject] },
            { key: 'popular_projects', count: 1, orderedItems: [reusableProject] },
          ],
        }),
      ),
    );

    const materialItem = {
      ...reusableProject,
      itemType: 'material' as const,
      entityType: 'MATERIAL' as const,
      entityId: 'material-1',
      recordId: 'material-1',
    };
    assertBaselineError(
      () =>
        validateSnapshotInvariants(
          stablePersona({
            sections: [
              { key: 'suggested_materials', count: 1, orderedItems: [materialItem] },
              {
                key: 'free_materials_near_you',
                count: 1,
                orderedItems: [materialItem],
              },
            ],
          }),
        ),
      'DUPLICATE_IDENTITY',
    );
  });

  test('reports bounded stable comparison paths', () => {
    assert.deepEqual(findDifferences({ a: [1, 2] }, { a: [1, 3] }), [
      { path: '$.a[1]', expected: 2, actual: 3 },
    ]);
    assert.equal(BASELINE_SCHEMA_VERSION, 'learner-home-deterministic-baseline-v1');
  });
});
