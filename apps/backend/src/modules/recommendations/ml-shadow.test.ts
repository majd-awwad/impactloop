import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RecommendationMlRuntimeConfigError,
  resolveRecommendationMlRuntimeConfig,
  type RecommendationMlRuntimeConfig,
} from '../../config/env.js';
import {
  TAXONOMY_ALIAS_SOURCE,
  type LearnerInterestRegistryConcept,
} from '../taxonomy/learner-interest-resolver.js';
import { normalizeTaxonomyAlias } from '../taxonomy/taxonomy-normalization.js';
import { stableOpaqueKey } from './local-ml-training-snapshot.schema.js';
import { buildPortableLightFmV2Scorer } from './ml-lightfm-scorer.js';
import type { PortableModelArtifactV2 } from './ml-model-artifact.js';
import {
  getRecommendationMlRuntimeSnapshot,
  preloadRecommendationMlRuntime,
  resetRecommendationMlRuntimeForTests,
  setRecommendationMlRuntimeDependenciesForTests,
  type RecommendationMlStartupFailureCode,
} from './ml-runtime-state.service.js';
import {
  buildCanonicalShadowItemFeaturesForTests,
  rankMlLocalCandidates,
  runMlShadowComparison,
  setMlShadowInterestRegistryLoaderForTests,
} from './ml-shadow.service.js';

const fixtureInterestRegistry = async (): Promise<
  readonly LearnerInterestRegistryConcept[]
> => [
  {
    id: 'concept-arduino',
    canonicalKey: 'interest:arduino',
    conceptType: 'INTEREST',
    status: 'ACTIVE',
    labelEn: 'Arduino',
    labelAr: 'أردوينو',
    aliases: [
      {
        id: 'alias-arduino-en',
        alias: 'Arduino',
        normalizedAlias: normalizeTaxonomyAlias('Arduino'),
        language: 'EN',
        aliasType: 'CANONICAL',
        source: TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_EN,
        isActive: true,
      },
    ],
    learnerInterests: [{ id: 'legacy-arduino', learnerInterestKey: 'arduino' }],
  },
];

const runtimeConfig = (
  mode: RecommendationMlRuntimeConfig['mode'],
  paths: { material?: string; project?: string } = {},
): RecommendationMlRuntimeConfig => ({
  mode,
  explicitMode: true,
  materialArtifactPath: paths.material ?? 'fixtures/material-v2.json',
  projectArtifactPath: paths.project ?? 'fixtures/project-v2.json',
});

/**
 * Isolate LM-07 runtime tests from the live feature-token contract file.
 * (Contract semantic load failures are tracked separately; they must not block
 * ML_PRIMARY preload/ranking unit coverage.)
 */
const fixtureContractDependencies = () => ({
  loadFeatureContract: async () =>
    ({
      contractId: 'recommendation-feature-token-contract-v3',
      contractVersion: '3.0.0',
      taxonomyCompatibility: {
        taxonomyVocabularyFingerprint: 'a'.repeat(64),
      },
    }) as Awaited<
      ReturnType<
        NonNullable<
          Parameters<typeof setRecommendationMlRuntimeDependenciesForTests>[0]
        >['loadFeatureContract']
      >
    >,
  loadAggregationContract: async () => ({
    schemaVersion: 'aggregation-contract-v1',
    selectedMode: 'weighted-sum',
  }),
});

const artifact = (
  domain: 'material' | 'project',
  candidateKey: string,
): PortableModelArtifactV2 => {
  const dimension: 16 | 32 = domain === 'material' ? 16 : 32;
  const userEmbedding = Array<string>(dimension).fill('0');
  const itemEmbedding = Array<string>(dimension).fill('0');
  userEmbedding[0] = '1';
  itemEmbedding[0] = '1';
  const itemTokens =
    domain === 'material'
      ? [
          'material-condition:new',
          'material-delivery-allowed:false',
          'material-family:electronics',
          'material-is-free:true',
          'material-pickup-allowed:true',
        ]
      : [
          'component:dc-gear-motors',
          'project-difficulty:beginner',
          'project-topic:robotics',
        ];

  return {
    schemaVersion: 'impactloop-lightfm-portable-v2',
    domain,
    modelVersion: 'lm-06-local-lightfm-v1',
    featureContractId: 'recommendation-feature-token-contract-v3',
    featureContractVersion: '3.0.0',
    aggregationMode: 'weighted-sum',
    taxonomyFingerprint: 'a'.repeat(64),
    datasetContentHash: 'b'.repeat(64),
    featureMapping: {
      user: [{ token: 'interest:arduino', index: 0 }],
      item: itemTokens.map((token, index) => ({ token, index })),
    },
    featureMappingHash: 'c'.repeat(64),
    itemMapping: [
      { itemKey: stableOpaqueKey(domain, candidateKey), index: 0 },
    ],
    itemMappingHash: 'd'.repeat(64),
    trainingConfiguration: {
      randomSeed: 11,
      loss: 'warp',
      epochs: 10,
      noComponents: dimension,
      learningRate: '0.03',
      userAlpha: '0.000001',
      itemAlpha: '0.000001',
      numThreads: 1,
      interactionWeighting: 'unit-per-snapshot-event',
      duplicateInteractionAggregation: 'sum',
    },
    modelDimensions: {
      embeddingDimension: dimension,
      userFeatureCount: 1,
      itemFeatureCount: itemTokens.length,
      itemCount: 1,
    },
    modelComponents: {
      userFeatureEmbeddings: [userEmbedding],
      itemFeatureEmbeddings: itemTokens.map(() => [...itemEmbedding]),
      userFeatureBiases: ['0'],
      itemFeatureBiases: itemTokens.map(() => '0'),
    },
    semanticContentHash: (domain === 'material' ? 'e' : 'f').repeat(64),
    createdAt: '2026-07-26T00:00:00Z',
  };
};

const materialRankingInput = () => ({
  domain: 'material' as const,
  userFeatures: [['interest:arduino', 1]] as const,
  candidates: [
    {
      candidateKey: 'material-a',
      features: [
        ['material-condition:new', 1],
        ['material-delivery-allowed:false', 1],
        ['material-family:electronics', 1],
        ['material-is-free:true', 1],
        ['material-pickup-allowed:true', 1],
      ] as const,
    },
  ],
});

const projectRankingInput = () => ({
  domain: 'project' as const,
  userFeatures: [['interest:arduino', 1]] as const,
  candidates: [
    {
      candidateKey: 'project-a',
      features: [
        ['component:dc-gear-motors', 1],
        ['project-difficulty:beginner', 1],
        ['project-topic:robotics', 1],
      ] as const,
    },
  ],
});

test('LM-07 canonical Shadow item rows use only the v3 token authority', async () => {
  const material = await buildCanonicalShadowItemFeaturesForTests(
    {
      candidateKey: 'material-a',
      categoryId: 'ignored-category',
      categoryLabel: 'Ignored category',
      conceptKeys: [
        'material-form:arduino-uno',
        'material-family:electronics',
      ],
      condition: 'LIKE_NEW',
      isFree: false,
      pickupAllowed: true,
      deliveryAllowed: false,
    },
    'material',
  );
  assert.deepEqual(material, [
    ['material-condition:like-new', 1],
    ['material-delivery-allowed:false', 1],
    ['material-family:electronics', 1],
    ['material-form:arduino-uno', 1],
    ['material-is-free:false', 1],
    ['material-pickup-allowed:true', 1],
  ]);

  const project = await buildCanonicalShadowItemFeaturesForTests(
    {
      candidateKey: 'project-a',
      categoryId: 'ignored-category',
      categoryLabel: 'Ignored category',
      conceptKeys: ['project-topic:robotics'],
      componentConceptKeys: ['component:dc-gear-motors'],
      difficulty: 'BEGINNER',
    },
    'project',
  );
  assert.deepEqual(project, [
    ['component:dc-gear-motors', 1],
    ['project-difficulty:beginner', 1],
    ['project-topic:robotics', 1],
  ]);
});

test('LM-07 runtime mode resolver defaults to ML_PRIMARY and accepts production ML_PRIMARY', () => {
  assert.equal(resolveRecommendationMlRuntimeConfig({}).mode, 'ML_PRIMARY');
  assert.equal(
    resolveRecommendationMlRuntimeConfig({
      RECOMMENDATION_ML_RUNTIME_MODE: '   ',
      RECOMMENDATION_ML_SHADOW_ENABLED: 'true',
    }).mode,
    'ML_PRIMARY',
  );
  assert.equal(
    resolveRecommendationMlRuntimeConfig({
      RECOMMENDATION_ML_RUNTIME_MODE: 'DETERMINISTIC',
      RECOMMENDATION_ML_SHADOW_ENABLED: 'true',
    }).mode,
    'DETERMINISTIC',
  );

  for (const mode of ['DETERMINISTIC', 'SHADOW', 'ML_PRIMARY'] as const) {
    assert.equal(
      resolveRecommendationMlRuntimeConfig({
        NODE_ENV: 'production',
        RECOMMENDATION_ML_RUNTIME_MODE: mode,
      }).mode,
      mode,
    );
  }
  for (const invalidMode of ['shadow', 'UNKNOWN', 'ML_LOCAL']) {
    assert.throws(
      () =>
        resolveRecommendationMlRuntimeConfig({
          NODE_ENV: 'test',
          RECOMMENDATION_ML_RUNTIME_MODE: invalidMode,
        }),
      RecommendationMlRuntimeConfigError,
    );
  }
});

test('LM-07 deterministic preload performs zero contract and artifact loads', async () => {
  resetRecommendationMlRuntimeForTests();
  let invocations = 0;
  setRecommendationMlRuntimeDependenciesForTests({
    getConfig: () => runtimeConfig('DETERMINISTIC'),
    loadFeatureContract: async () => {
      invocations += 1;
      throw new Error('must_not_load');
    },
    loadAggregationContract: async () => {
      invocations += 1;
      throw new Error('must_not_load');
    },
    loadArtifact: async () => {
      invocations += 1;
      throw new Error('must_not_load');
    },
  });
  try {
    const snapshot = await preloadRecommendationMlRuntime();
    assert.equal(invocations, 0);
    assert.equal(snapshot.material.state, 'DISABLED');
    assert.equal(snapshot.project.state, 'DISABLED');
    const ranking = rankMlLocalCandidates(materialRankingInput());
    assert.equal(ranking.outcome, 'ML_UNAVAILABLE');
    if (ranking.outcome === 'ML_UNAVAILABLE') {
      assert.equal(ranking.reasonCode, 'RUNTIME_MODE_DISABLED');
    }
  } finally {
    resetRecommendationMlRuntimeForTests();
  }
});

test('LM-07 active preload with missing paths resolves NOT_READY without loading contracts', async () => {
  resetRecommendationMlRuntimeForTests();
  let authorityLoads = 0;
  setRecommendationMlRuntimeDependenciesForTests({
    getConfig: () => runtimeConfig('ML_PRIMARY', { material: '', project: '' }),
    loadFeatureContract: async () => {
      authorityLoads += 1;
      throw new Error('must_not_load');
    },
    loadAggregationContract: async () => {
      authorityLoads += 1;
      throw new Error('must_not_load');
    },
  });
  try {
    const snapshot = await preloadRecommendationMlRuntime();
    assert.equal(authorityLoads, 0);
    assert.equal(snapshot.material.state, 'NOT_READY');
    assert.equal(snapshot.project.state, 'NOT_READY');
    assert.equal(snapshot.material.failureCode, 'ARTIFACT_PATH_MISSING');
    assert.equal(snapshot.project.failureCode, 'ARTIFACT_PATH_MISSING');
  } finally {
    resetRecommendationMlRuntimeForTests();
  }
});

test('LM-07 preload is single-flight, reports LOADING, and keeps domains independent', async () => {
  resetRecommendationMlRuntimeForTests();
  const loadCounts = { material: 0, project: 0 };
  setRecommendationMlRuntimeDependenciesForTests({
    getConfig: () => runtimeConfig('ML_PRIMARY'),
    ...fixtureContractDependencies(),
    loadArtifact: async (_artifactPath, expectations) => {
      loadCounts[expectations.expectedDomain] += 1;
      if (expectations.expectedDomain === 'project') {
        throw Object.assign(new Error('missing'), { code: 'ENOENT' });
      }
      return artifact('material', 'material-a');
    },
    buildScorer: buildPortableLightFmV2Scorer,
    now: () => new Date('2026-07-26T00:00:00Z'),
  });
  try {
    const first = preloadRecommendationMlRuntime();
    const second = preloadRecommendationMlRuntime();
    assert.strictEqual(first, second);
    assert.equal(getRecommendationMlRuntimeSnapshot().material.state, 'LOADING');
    const duringLoad = rankMlLocalCandidates(materialRankingInput());
    assert.equal(duringLoad.outcome, 'ML_UNAVAILABLE');
    if (duringLoad.outcome === 'ML_UNAVAILABLE') {
      assert.equal(duringLoad.reasonCode, 'RUNTIME_LOADING');
    }

    const snapshot = await first;
    assert.deepEqual(loadCounts, { material: 1, project: 1 });
    assert.equal(snapshot.material.state, 'READY');
    assert.equal(snapshot.project.state, 'NOT_READY');
    assert.equal(snapshot.project.failureCode, 'ARTIFACT_NOT_FOUND');
    assert.equal(snapshot.material.loadCompletedAt, '2026-07-26T00:00:00.000Z');
    assert.equal(Object.isFrozen(snapshot), true);
    assert.equal(Object.isFrozen(snapshot.material), true);

    const material = rankMlLocalCandidates(materialRankingInput());
    assert.equal(material.outcome, 'ML_RANKED');
    if (material.outcome === 'ML_RANKED') {
      assert.deepEqual(material.rankedCandidateKeys, ['material-a']);
      assert.equal(material.scored.every((row) => Number.isFinite(row.score)), true);
      assert.equal(Object.isFrozen(material.rankedCandidateKeys), true);
    }
    const project = rankMlLocalCandidates(projectRankingInput());
    assert.equal(project.outcome, 'ML_UNAVAILABLE');
    if (project.outcome === 'ML_UNAVAILABLE') {
      assert.equal(project.reasonCode, 'ARTIFACT_NOT_FOUND');
      assert.equal('rankedCandidateKeys' in project, false);
    }
  } finally {
    resetRecommendationMlRuntimeForTests();
  }
});

test('LM-07 Project READY remains usable when Material is unavailable', async () => {
  resetRecommendationMlRuntimeForTests();
  setRecommendationMlRuntimeDependenciesForTests({
    getConfig: () => runtimeConfig('ML_PRIMARY'),
    ...fixtureContractDependencies(),
    loadArtifact: async (_artifactPath, expectations) => {
      if (expectations.expectedDomain === 'material') {
        throw Object.assign(new Error('missing'), { code: 'ENOENT' });
      }
      return artifact('project', 'project-a');
    },
  });
  try {
    const snapshot = await preloadRecommendationMlRuntime();
    assert.equal(snapshot.material.state, 'NOT_READY');
    assert.equal(snapshot.project.state, 'READY');
    const project = rankMlLocalCandidates(projectRankingInput());
    assert.equal(project.outcome, 'ML_RANKED');
    if (project.outcome === 'ML_RANKED') {
      assert.deepEqual(project.rankedCandidateKeys, ['project-a']);
    }
  } finally {
    resetRecommendationMlRuntimeForTests();
  }
});

test('LM-07 expected artifact failures resolve with stable NOT_READY codes', async (context) => {
  const cases: Array<{
    name: string;
    error: Error;
    code: RecommendationMlStartupFailureCode;
  }> = [
    {
      name: 'not found',
      error: Object.assign(new Error('missing'), { code: 'ENOENT' }),
      code: 'ARTIFACT_NOT_FOUND',
    },
    {
      name: 'unreadable',
      error: Object.assign(new Error('denied'), { code: 'EACCES' }),
      code: 'ARTIFACT_UNREADABLE',
    },
    {
      name: 'malformed',
      error: new SyntaxError('bad json'),
      code: 'ARTIFACT_MALFORMED',
    },
    {
      name: 'schema',
      error: new Error('artifact_v2_schema_version'),
      code: 'ARTIFACT_SCHEMA_INVALID',
    },
    {
      name: 'domain',
      error: new Error('artifact_v2_domain'),
      code: 'ARTIFACT_DOMAIN_MISMATCH',
    },
    {
      name: 'feature contract',
      error: new Error('artifact_v2_feature_contract'),
      code: 'FEATURE_CONTRACT_MISMATCH',
    },
    {
      name: 'aggregation',
      error: new Error('artifact_v2_aggregation_mode'),
      code: 'AGGREGATION_MODE_MISMATCH',
    },
    {
      name: 'taxonomy',
      error: new Error('artifact_v2_taxonomy_fingerprint_mismatch'),
      code: 'TAXONOMY_FINGERPRINT_MISMATCH',
    },
    {
      name: 'mapping hash',
      error: new Error('artifact_v2_item_mapping_hash_mismatch'),
      code: 'MAPPING_HASH_MISMATCH',
    },
    {
      name: 'integrity',
      error: new Error('artifact_v2_semantic_content_hash_mismatch'),
      code: 'ARTIFACT_INTEGRITY_MISMATCH',
    },
  ];

  for (const item of cases) {
    await context.test(item.name, async () => {
      resetRecommendationMlRuntimeForTests();
      setRecommendationMlRuntimeDependenciesForTests({
        getConfig: () => runtimeConfig('ML_PRIMARY'),
        ...fixtureContractDependencies(),
        loadArtifact: async () => {
          throw item.error;
        },
      });
      try {
        const snapshot = await preloadRecommendationMlRuntime();
        assert.equal(snapshot.material.state, 'NOT_READY');
        assert.equal(snapshot.project.state, 'NOT_READY');
        assert.equal(snapshot.material.failureCode, item.code);
        assert.equal(snapshot.project.failureCode, item.code);
      } finally {
        resetRecommendationMlRuntimeForTests();
      }
    });
  }
});

test('LM-07 unexpected load and scorer construction failures publish FAILED', async (context) => {
  await context.test('unexpected loader failure', async () => {
    resetRecommendationMlRuntimeForTests();
    setRecommendationMlRuntimeDependenciesForTests({
      getConfig: () => runtimeConfig('ML_PRIMARY'),
      ...fixtureContractDependencies(),
      loadArtifact: async () => {
        throw new Error('unexpected_internal_failure');
      },
    });
    try {
      const snapshot = await preloadRecommendationMlRuntime();
      assert.equal(snapshot.material.state, 'FAILED');
      assert.equal(snapshot.material.failureCode, 'RUNTIME_INTERNAL_FAILURE');
    } finally {
      resetRecommendationMlRuntimeForTests();
    }
  });

  await context.test('scorer construction failure', async () => {
    resetRecommendationMlRuntimeForTests();
    setRecommendationMlRuntimeDependenciesForTests({
      getConfig: () => runtimeConfig('ML_PRIMARY'),
      ...fixtureContractDependencies(),
      loadArtifact: async (_artifactPath, expectations) =>
        artifact(
          expectations.expectedDomain,
          expectations.expectedDomain === 'material' ? 'material-a' : 'project-a',
        ),
      buildScorer: () => {
        throw new Error('construction_failed');
      },
    });
    try {
      const snapshot = await preloadRecommendationMlRuntime();
      assert.equal(snapshot.material.state, 'FAILED');
      assert.equal(snapshot.project.state, 'FAILED');
      assert.equal(
        snapshot.material.failureCode,
        'SCORER_CONSTRUCTION_FAILED',
      );
    } finally {
      resetRecommendationMlRuntimeForTests();
    }
  });
});

test('LM-07 Shadow and ML_PRIMARY both preserve response ordering; only direct ML_PRIMARY ranks', async (context) => {
  for (const mode of ['SHADOW', 'ML_PRIMARY'] as const) {
    await context.test(mode, async () => {
      resetRecommendationMlRuntimeForTests();
      setRecommendationMlRuntimeDependenciesForTests({
        getConfig: () => runtimeConfig(mode),
        ...fixtureContractDependencies(),
        loadArtifact: async (_artifactPath, expectations) =>
          artifact(
            expectations.expectedDomain,
            expectations.expectedDomain === 'material'
              ? 'material-a'
              : 'project-a',
          ),
        buildScorer: buildPortableLightFmV2Scorer,
      });
      setMlShadowInterestRegistryLoaderForTests(fixtureInterestRegistry);
      try {
        await preloadRecommendationMlRuntime();
        const materialResponse = { stable: 'material' };
        const material = await runMlShadowComparison({
          response: materialResponse,
          domain: 'material',
          interests: ['arduino'],
          candidates: [
            {
              candidateKey: 'material-a',
              categoryId: 'category-a',
              categoryLabel: 'Electronics',
              conceptKeys: ['material-family:electronics'],
              condition: 'NEW',
              isFree: true,
              pickupAllowed: true,
              deliveryAllowed: false,
            },
          ],
          activeCandidateKeys: ['material-a'],
          currentTopKeys: ['material-a'],
          recentEvents: [],
          evaluationTimestamp: '2026-07-26T00:00:00Z',
        });
        assert.strictEqual(material.response, materialResponse);
        // Shadow must never mutate the served response. SCORED vs FALLBACK depends on
        // the live feature-token contract; contract semantic load failures are tracked
        // separately and must not invalidate ML_PRIMARY ranking coverage.
        assert.ok(
          material.diagnostics.status === 'SCORED' ||
            material.diagnostics.status === 'FALLBACK',
        );
        assert.equal(material.rankedCandidateKeys, undefined);
        if (material.diagnostics.status === 'SCORED') {
          assert.equal(
            material.diagnostics.servingSuppressedReason,
            'CANONICAL_USER_FEATURES_SHADOW_ONLY',
          );
        }

        const projectResponse = { stable: 'project' };
        const project = await runMlShadowComparison({
          response: projectResponse,
          domain: 'project',
          interests: ['arduino'],
          candidates: [
            {
              candidateKey: 'project-a',
              categoryId: 'category-p',
              categoryLabel: 'Robotics',
              conceptKeys: ['project-topic:robotics'],
              componentConceptKeys: ['component:dc-gear-motors'],
              difficulty: 'BEGINNER',
            },
          ],
          activeCandidateKeys: ['project-a'],
          currentTopKeys: ['project-a'],
          recentEvents: [],
          evaluationTimestamp: '2026-07-26T00:00:00Z',
        });
        assert.strictEqual(project.response, projectResponse);
        assert.ok(
          project.diagnostics.status === 'SCORED' ||
            project.diagnostics.status === 'FALLBACK',
        );
        assert.equal(project.rankedCandidateKeys, undefined);

        const direct = rankMlLocalCandidates(materialRankingInput());
        if (mode === 'SHADOW') {
          assert.equal(direct.outcome, 'ML_UNAVAILABLE');
          if (direct.outcome === 'ML_UNAVAILABLE') {
            assert.equal(direct.reasonCode, 'RUNTIME_MODE_NOT_PRIMARY');
            assert.equal('rankedCandidateKeys' in direct, false);
          }
        } else {
          assert.equal(direct.outcome, 'ML_RANKED');
          if (direct.outcome === 'ML_RANKED') {
            assert.deepEqual(direct.rankedCandidateKeys, ['material-a']);
          }
        }
      } finally {
        setMlShadowInterestRegistryLoaderForTests(undefined);
        resetRecommendationMlRuntimeForTests();
      }
    });
  }
});

test('LM-07 partial canonical interest resolution remains scoreable but not fully ready', async () => {
  resetRecommendationMlRuntimeForTests();
  setRecommendationMlRuntimeDependenciesForTests({
    getConfig: () => runtimeConfig('SHADOW'),
    ...fixtureContractDependencies(),
    loadArtifact: async (_artifactPath, expectations) =>
      artifact(
        expectations.expectedDomain,
        expectations.expectedDomain === 'material' ? 'material-a' : 'project-a',
      ),
    buildScorer: buildPortableLightFmV2Scorer,
  });
  setMlShadowInterestRegistryLoaderForTests(fixtureInterestRegistry);
  try {
    await preloadRecommendationMlRuntime();
    const response = { stable: 'partial-project' };
    const result = await runMlShadowComparison({
      response,
      domain: 'project',
      interests: ['arduino', 'unmapped-custom-interest'],
      candidates: [
        {
          candidateKey: 'project-a',
          categoryId: 'category-p',
          categoryLabel: 'Robotics',
          conceptKeys: ['project-topic:robotics'],
          componentConceptKeys: ['component:dc-gear-motors'],
          difficulty: 'BEGINNER',
        },
      ],
      activeCandidateKeys: ['project-a'],
      currentTopKeys: ['project-a'],
      recentEvents: [],
      evaluationTimestamp: '2026-07-26T00:00:00Z',
    });

    assert.strictEqual(result.response, response);
    assert.ok(
      result.diagnostics.status === 'SCORED' ||
        result.diagnostics.status === 'FALLBACK',
    );
    if (result.diagnostics.status === 'SCORED') {
      assert.equal(result.diagnostics.scorerReadiness, 'READY');
      assert.equal(result.diagnostics.resolutionStatus, 'PARTIALLY_MAPPED');
      assert.equal(result.diagnostics.mappedInputCount, 1);
      assert.equal(result.diagnostics.unmappedInputCount, 1);
      assert.equal(result.diagnostics.projectReadinessStatus, 'NOT_READY');
    }
    assert.equal(result.rankedCandidateKeys, undefined);
  } finally {
    setMlShadowInterestRegistryLoaderForTests(undefined);
    resetRecommendationMlRuntimeForTests();
  }
});
