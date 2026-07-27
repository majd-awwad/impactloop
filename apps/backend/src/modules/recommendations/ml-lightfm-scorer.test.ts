import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import {
  buildPortableLightFmV2Scorer,
  scorePortableLightFm,
  type LightFmScorerContext,
  type WeightedFeature,
} from './ml-lightfm-scorer.js';
import {
  type PortableFeature,
  type PortableModelArtifact,
  type PortableModelArtifactV2,
} from './ml-model-artifact.js';
import { stableOpaqueKey } from './local-ml-training-snapshot.schema.js';
import {
  buildFeatureReadinessArtifactInput,
  compileRecommendationFeatureReadinessContract,
  evaluateRecommendationFeatureReadiness,
  FEATURE_READINESS_SAMPLE_LIMIT,
  type CompiledRecommendationFeatureReadinessContract,
} from './recommendation-feature-readiness.js';
import { loadRecommendationFeatureTokenContract } from './recommendation-feature-token-contract.js';

const feature = (
  name: string,
  bias = '0.1',
  embedding: string[] = ['0.2', '0.3'],
): PortableFeature => ({ name, bias, embedding });

const projectArtifact = (): PortableModelArtifact => ({
  artifact_version: 'impactloop-lightfm-portable-v1',
  model_version: 'synthetic-v1',
  domain: 'project',
  feature_schema_version: 'synthetic-feature-schema',
  latent_dimension: 2,
  catalog_snapshot_hash: 'synthetic',
  training_dataset_hash: 'synthetic',
  mapping_hash: 'synthetic',
  hyperparameters: {},
  python_version: 'synthetic',
  lightfm_version: 'synthetic',
  exported_at_utc: '2026-07-26T00:00:00Z',
  user_features: [feature('interest:arduino')],
  item_features: [
    feature('project-topic:robotics'),
    feature('project-difficulty:beginner'),
    feature('project-difficulty:intermediate'),
    feature('project-difficulty:advanced'),
  ],
  content_hash: 'synthetic',
});

const validUser: WeightedFeature[] = [['interest:arduino', 1]];
const validCandidates = () => [
  {
    candidateKey: 'candidate-safe-key',
    features: [
      ['project-topic:robotics', 1],
      ['project-difficulty:beginner', 1],
    ] as WeightedFeature[],
  },
];

describe('RP-06.1 LightFM scorer diagnostics', () => {
  let compiled: CompiledRecommendationFeatureReadinessContract;

  before(async () => {
    compiled = compileRecommendationFeatureReadinessContract(
      await loadRecommendationFeatureTokenContract(),
    );
  });

  const contextFor = (
    artifact: PortableModelArtifact,
    userFeatures: WeightedFeature[],
    candidates: ReturnType<typeof validCandidates>,
  ): LightFmScorerContext => {
    Object.assign(artifact, {
      feature_contract_id: compiled.expectedContractId,
      feature_contract_version: compiled.expectedContractVersion,
      feature_contract_fingerprint: compiled.expectedTaxonomyFingerprint,
      feature_aggregation_mode: compiled.aggregationSelectedMode,
    });
    const readinessInput = {
      compiledContract: compiled,
      domain: artifact.domain,
      user: { features: userFeatures, resolutionStatus: 'FULLY_MAPPED' },
      itemRows: candidates,
      artifact: buildFeatureReadinessArtifactInput(artifact),
    } as const;
    return {
      readinessInput,
      featureReadiness:
        evaluateRecommendationFeatureReadiness(readinessInput),
    };
  };

  it('preserves the legacy finite score calculation and tie ordering', () => {
    const artifact = projectArtifact();
    const candidates = [
      { ...validCandidates()[0]!, candidateKey: 'candidate-b' },
      { ...validCandidates()[0]!, candidateKey: 'candidate-a' },
    ];
    const result = scorePortableLightFm(artifact, validUser, candidates);
    assert.equal(result.outcome, 'SCORED');
    assert.equal(result.scoringReadiness, 'NOT_READY');
    assert.deepEqual(
      result.scored.map((value) => value.candidateKey),
      ['candidate-a', 'candidate-b'],
    );
    assert.equal(result.scored[0]!.score, 0.56);
    assert.equal(result.scored[1]!.score, 0.56);
  });

  it('returns a successful READY result for a complete synthetic fixture', () => {
    const artifact = projectArtifact();
    const candidates = validCandidates();
    const result = scorePortableLightFm(
      artifact,
      validUser,
      candidates,
      contextFor(artifact, validUser, candidates),
    );
    assert.equal(result.outcome, 'SCORED');
    assert.equal(result.scoringReadiness, 'READY');
    assert.equal(result.reasonCodes.length, 0);
    assert.equal(result.scored.length, 1);
    assert.ok(Number.isFinite(result.scored[0]!.score));
    assert.equal(result.diagnostics.groups['user.declared-interest']?.resolvedUnique, 1);
    assert.equal(result.diagnostics.groups['project.topic']?.resolvedUnique, 1);
  });

  const assertContextMismatch = (
    result: ReturnType<typeof scorePortableLightFm>,
  ): void => {
    assert.equal(result.outcome, 'FAILED_CLOSED');
    assert.equal(result.scoringReadiness, 'NOT_READY');
    assert.deepEqual(result.scored, []);
    assert.ok(result.reasonCodes.includes('FEATURE_CONTEXT_MISMATCH'));
  };

  it('rejects same-domain readiness for a different artifact identity or vocabulary', () => {
    const readinessArtifact = projectArtifact();
    const candidates = validCandidates();
    const context = contextFor(readinessArtifact, validUser, candidates);
    const scoredArtifact = structuredClone(readinessArtifact);
    scoredArtifact.model_version = 'different-model';
    scoredArtifact.content_hash = 'different-content-hash';
    scoredArtifact.item_features.push(feature('component:arduino-board'));
    assertContextMismatch(
      scorePortableLightFm(scoredArtifact, validUser, candidates, context),
    );
  });

  it('rejects same-domain readiness generated for different user features', () => {
    const artifact = projectArtifact();
    const candidates = validCandidates();
    const context = contextFor(artifact, validUser, candidates);
    assertContextMismatch(
      scorePortableLightFm(
        artifact,
        [['interest:electronics', 1]],
        candidates,
        context,
      ),
    );
  });

  it('rejects same-domain readiness generated for a different candidate set', () => {
    const artifact = projectArtifact();
    const readinessCandidates = validCandidates();
    const context = contextFor(artifact, validUser, readinessCandidates);
    const scoredCandidates = [
      ...readinessCandidates,
      { ...validCandidates()[0]!, candidateKey: 'second-candidate' },
    ];
    assertContextMismatch(
      scorePortableLightFm(artifact, validUser, scoredCandidates, context),
    );
  });

  it('rejects readiness whose required group is absent from actual candidate features', () => {
    const artifact = projectArtifact();
    const readinessCandidates = validCandidates();
    const context = contextFor(artifact, validUser, readinessCandidates);
    const scoredCandidates = validCandidates();
    scoredCandidates[0]!.features = [['project-topic:robotics', 1]];
    assert.equal(context.featureReadiness.coverageStatus, 'READY');
    assert.equal(
      context.featureReadiness.groups['project.difficulty']
        ?.missingRequiredCandidateCount,
      0,
    );
    assertContextMismatch(
      scorePortableLightFm(artifact, validUser, scoredCandidates, context),
    );
  });

  it('keeps missing totals exact beyond the deterministic sample limit', () => {
    const artifact = projectArtifact();
    const missingInterests = [
      'interest:electronics',
      'interest:robotics',
      'interest:sensors',
      'interest:circuits',
      'interest:displays',
      'interest:wires-connectors',
      'interest:audio-media',
      'interest:woodworking',
      'interest:fabric-textiles',
      'interest:art-crafts',
      'interest:recycling',
      'interest:home-diy',
    ].map((name) => [name, 1] as WeightedFeature);
    const user = [...validUser, ...missingInterests];
    const candidates = validCandidates();
    const result = scorePortableLightFm(
      artifact,
      user,
      candidates,
      contextFor(artifact, user, candidates),
    );
    assert.equal(result.outcome, 'FAILED_CLOSED');
    assert.equal(result.diagnostics.missing.occurrenceCount, 12);
    assert.equal(result.diagnostics.missing.uniqueCount, 12);
    assert.equal(
      result.diagnostics.missing.sample.length,
      FEATURE_READINESS_SAMPLE_LIMIT,
    );
    assert.equal(result.diagnostics.missing.truncated, true);
  });

  it('counts duplicate missing occurrences separately from unique tokens', () => {
    const artifact = projectArtifact();
    const duplicates = Array.from(
      { length: 10 },
      () => ['interest:electronics', 1] as WeightedFeature,
    );
    const user = [...validUser, ...duplicates];
    const candidates = validCandidates();
    const result = scorePortableLightFm(
      artifact,
      user,
      candidates,
      contextFor(artifact, user, candidates),
    );
    assert.equal(result.diagnostics.missing.occurrenceCount, 10);
    assert.equal(result.diagnostics.missing.uniqueCount, 1);
    assert.equal(result.diagnostics.missing.sample.length, 1);
    assert.equal(result.diagnostics.missing.truncated, true);
  });

  it('samples missing features deterministically across input order', () => {
    const artifact = projectArtifact();
    const names = [
      'interest:electronics',
      'interest:robotics',
      'interest:sensors',
      'interest:circuits',
      'interest:displays',
      'interest:wires-connectors',
      'interest:audio-media',
      'interest:woodworking',
      'interest:fabric-textiles',
    ];
    const candidates = validCandidates();
    const score = (ordered: string[]) => {
      const user = [
        ...validUser,
        ...ordered.map((name) => [name, 1] as WeightedFeature),
      ];
      return scorePortableLightFm(
        artifact,
        user,
        candidates,
        contextFor(artifact, user, candidates),
      ).diagnostics.missing.sample;
    };
    assert.deepEqual(score(names), score([...names].reverse()));
  });

  it('reports optional misses without promoting them to critical', () => {
    const artifact = projectArtifact();
    const candidates = validCandidates();
    candidates[0]!.features.push(['component:arduino-board', 1]);
    const result = scorePortableLightFm(
      artifact,
      validUser,
      candidates,
      contextFor(artifact, validUser, candidates),
    );
    assert.equal(result.outcome, 'SCORED');
    assert.equal(result.scoringReadiness, 'READY');
    assert.equal(result.diagnostics.missingOptional.occurrenceCount, 1);
    assert.equal(result.diagnostics.missingCritical.occurrenceCount, 0);
  });

  it('keeps unknown, unsupported, nonportable, and invalid values separate', () => {
    const cases = [
      ['invented:value', 'unknown', 'UNKNOWN_RUNTIME_FEATURE'],
      ['material-family:electronics', 'unsupported', 'UNSUPPORTED_RUNTIME_FEATURE'],
      ['category:legacy', 'nonportable', 'NONPORTABLE_RUNTIME_FEATURE'],
      ['project-difficulty:impossible', 'invalidValue', 'INVALID_RUNTIME_FEATURE_VALUE'],
    ] as const;
    for (const [token, bucket, reason] of cases) {
      const artifact = projectArtifact();
      const candidates = validCandidates();
      candidates[0]!.features.push([token, 1]);
      const result = scorePortableLightFm(
        artifact,
        validUser,
        candidates,
        contextFor(artifact, validUser, candidates),
      );
      assert.equal(result.outcome, 'FAILED_CLOSED');
      assert.equal(result.diagnostics[bucket].occurrenceCount, 1);
      assert.ok(result.reasonCodes.includes(reason));
    }
  });

  it('fails closed for invalid and nonfinite runtime weights', () => {
    for (const weight of [2, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const artifact = projectArtifact();
      const candidates = validCandidates();
      candidates[0]!.features[0] = ['project-topic:robotics', weight];
      const result = scorePortableLightFm(
        artifact,
        validUser,
        candidates,
        contextFor(artifact, validUser, candidates),
      );
      assert.equal(result.outcome, 'FAILED_CLOSED');
      assert.deepEqual(result.scored, []);
      assert.equal(result.diagnostics.invalidWeight.occurrenceCount, 1);
      assert.ok(
        result.reasonCodes.includes(
          Number.isFinite(weight)
            ? 'INVALID_RUNTIME_FEATURE_WEIGHT'
            : 'NONFINITE_RUNTIME_INPUT',
        ),
      );
    }
  });

  it('fails closed for invalid and nonfinite artifact values', () => {
    for (const bias of ['not-a-number', 'Infinity']) {
      const artifact = projectArtifact();
      artifact.user_features[0]!.bias = bias;
      const candidates = validCandidates();
      const result = scorePortableLightFm(
        artifact,
        validUser,
        candidates,
        contextFor(artifact, validUser, candidates),
      );
      assert.equal(result.outcome, 'FAILED_CLOSED');
      assert.deepEqual(result.scored, []);
      assert.ok(
        result.reasonCodes.includes(
          bias === 'Infinity' ? 'NONFINITE_MODEL_INPUT' : 'INVALID_MODEL_VALUE',
        ),
      );
    }
  });

  it('fails closed for nonfinite intermediate and output calculations', () => {
    const intermediateArtifact = projectArtifact();
    intermediateArtifact.user_features[0]!.bias = String(Number.MAX_VALUE);
    const duplicateUser: WeightedFeature[] = [
      ['interest:arduino', 1],
      ['interest:arduino', 1],
    ];
    const intermediateCandidates = validCandidates();
    const intermediate = scorePortableLightFm(
      intermediateArtifact,
      duplicateUser,
      intermediateCandidates,
      contextFor(intermediateArtifact, duplicateUser, intermediateCandidates),
    );
    assert.equal(intermediate.outcome, 'FAILED_CLOSED');
    assert.ok(intermediate.reasonCodes.includes('NONFINITE_INTERMEDIATE'));

    const outputArtifact = projectArtifact();
    outputArtifact.user_features[0]!.embedding = [String(Number.MAX_VALUE), '0'];
    outputArtifact.item_features.find(
      (entry) => entry.name === 'project-topic:robotics',
    )!.embedding = [String(Number.MAX_VALUE), '0'];
    const outputCandidates = validCandidates();
    const output = scorePortableLightFm(
      outputArtifact,
      validUser,
      outputCandidates,
      contextFor(outputArtifact, validUser, outputCandidates),
    );
    assert.equal(output.outcome, 'FAILED_CLOSED');
    assert.ok(output.reasonCodes.includes('NONFINITE_OUTPUT'));
  });

  it('does not mark an empty critical representation READY', () => {
    const artifact = projectArtifact();
    const candidates = validCandidates();
    const result = scorePortableLightFm(
      artifact,
      [],
      candidates,
      contextFor(artifact, [], candidates),
    );
    assert.equal(result.outcome, 'FAILED_CLOSED');
    assert.equal(result.scoringReadiness, 'NOT_READY');
    assert.ok(result.reasonCodes.includes('EMPTY_CRITICAL_REPRESENTATION'));
    assert.ok(result.reasonCodes.includes('MISSING_REQUIRED_GROUP'));
  });

  it('serializes only bounded hashed diagnostic identities', () => {
    const artifact = projectArtifact();
    const secretToken = 'secret@example.com/C:/private/model.json';
    const candidateKey = 'user-42-secret-candidate';
    const candidates = validCandidates();
    candidates[0] = {
      candidateKey,
      features: [...candidates[0]!.features, [secretToken, 1]],
    };
    const result = scorePortableLightFm(
      artifact,
      validUser,
      candidates,
      contextFor(artifact, validUser, candidates),
    );
    const serialized = JSON.stringify(result.diagnostics);
    assert.equal(serialized.includes(secretToken), false);
    assert.equal(serialized.includes(candidateKey), false);
    assert.equal(serialized.includes('private/model.json'), false);
    assert.ok(result.diagnostics.unknown.sample.length <= FEATURE_READINESS_SAMPLE_LIMIT);
  });
});

const v2Artifact = (
  candidateKeys: readonly string[] = ['candidate-a', 'candidate-b'],
): PortableModelArtifactV2 => {
  const dimension = 16;
  const zeros = (): string[] => Array<string>(dimension).fill('0');
  const userEmbedding = zeros();
  userEmbedding[0] = '1';
  const itemEmbedding = zeros();
  itemEmbedding[0] = '1';
  return {
    schemaVersion: 'impactloop-lightfm-portable-v2',
    domain: 'material',
    modelVersion: 'lm-06-local-lightfm-v1',
    featureContractId: 'recommendation-feature-token-contract-v3',
    featureContractVersion: '3.0.0',
    aggregationMode: 'weighted-sum',
    taxonomyFingerprint: 'a'.repeat(64),
    datasetContentHash: 'b'.repeat(64),
    featureMapping: {
      user: [{ token: 'interest:arduino', index: 0 }],
      item: [{ token: 'material-family:electronics', index: 0 }],
    },
    featureMappingHash: 'c'.repeat(64),
    itemMapping: [...candidateKeys]
      .map((candidateKey) => ({
        itemKey: stableOpaqueKey('material', candidateKey),
        index: 0,
      }))
      .sort((left, right) =>
        left.itemKey < right.itemKey ? -1 : left.itemKey > right.itemKey ? 1 : 0,
      )
      .map((entry, index) => ({ ...entry, index })),
    itemMappingHash: 'd'.repeat(64),
    trainingConfiguration: {
      randomSeed: 11,
      loss: 'warp',
      epochs: 10,
      noComponents: 16,
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
      itemFeatureCount: 1,
      itemCount: candidateKeys.length,
    },
    modelComponents: {
      userFeatureEmbeddings: [userEmbedding],
      itemFeatureEmbeddings: [itemEmbedding],
      userFeatureBiases: ['0'],
      itemFeatureBiases: ['0'],
    },
    semanticContentHash: 'e'.repeat(64),
    createdAt: '2026-07-26T00:00:00Z',
  };
};

const v2Candidate = (candidateKey: string) => ({
  candidateKey,
  features: [['material-family:electronics', 1]] as const,
});

describe('LM-07 contained portable V2 scoring', () => {
  it('scores only the supplied pool and applies the ASCII tie-break', () => {
    const scorer = buildPortableLightFmV2Scorer(v2Artifact());
    const result = scorer.score({
      domain: 'material',
      userFeatures: [['interest:arduino', 1]],
      candidates: [v2Candidate('candidate-b'), v2Candidate('candidate-a')],
    });
    assert.equal(result.outcome, 'SCORED');
    if (result.outcome !== 'SCORED') return;
    assert.deepEqual(result.rankedCandidateKeys, ['candidate-a', 'candidate-b']);
    assert.equal(result.scored.every((row) => Number.isFinite(row.score)), true);
    assert.equal(Object.isFrozen(result.scored), true);
    assert.equal(Object.isFrozen(result.rankedCandidateKeys), true);
  });

  it('deduplicates identical candidates and rejects conflicting duplicates', () => {
    const scorer = buildPortableLightFmV2Scorer(v2Artifact(['candidate-a']));
    const duplicate = v2Candidate('candidate-a');
    const deduplicated = scorer.score({
      domain: 'material',
      userFeatures: [['interest:arduino', 1]],
      candidates: [duplicate, duplicate],
    });
    assert.equal(deduplicated.outcome, 'SCORED');
    assert.equal(deduplicated.diagnostics.duplicateCandidateCount, 1);
    if (deduplicated.outcome === 'SCORED') {
      assert.deepEqual(deduplicated.rankedCandidateKeys, ['candidate-a']);
    }

    const conflict = scorer.score({
      domain: 'material',
      userFeatures: [['interest:arduino', 1]],
      candidates: [
        duplicate,
        { candidateKey: 'candidate-a', features: [] },
      ],
    });
    assert.equal(conflict.outcome, 'UNAVAILABLE');
    if (conflict.outcome === 'UNAVAILABLE') {
      assert.equal(conflict.reasonCode, 'DUPLICATE_CANDIDATE_CONFLICT');
    }
  });

  it('fails the whole request for missing item mappings with bounded hashed samples', () => {
    const scorer = buildPortableLightFmV2Scorer(v2Artifact(['candidate-a']));
    const result = scorer.score({
      domain: 'material',
      userFeatures: [['interest:arduino', 1]],
      candidates: [v2Candidate('missing-private-id')],
    });
    assert.equal(result.outcome, 'UNAVAILABLE');
    if (result.outcome !== 'UNAVAILABLE') return;
    assert.equal(result.reasonCode, 'CANDIDATE_MAPPING_MISSING');
    assert.equal(result.diagnostics.missingMappingCount, 1);
    assert.equal(result.diagnostics.missingMappingKeySamples.length, 1);
    assert.equal(JSON.stringify(result).includes('missing-private-id'), false);
    assert.equal('rankedCandidateKeys' in result, false);
  });

  it('fails closed for domain, feature mapping, and nonfinite inputs', () => {
    const scorer = buildPortableLightFmV2Scorer(v2Artifact(['candidate-a']));
    const domain = scorer.score({
      domain: 'project',
      userFeatures: [['interest:arduino', 1]],
      candidates: [v2Candidate('candidate-a')],
    });
    assert.equal(domain.outcome, 'UNAVAILABLE');
    if (domain.outcome === 'UNAVAILABLE') {
      assert.equal(domain.reasonCode, 'DOMAIN_MISMATCH');
    }

    const missingFeature = scorer.score({
      domain: 'material',
      userFeatures: [['interest:unknown', 1]],
      candidates: [v2Candidate('candidate-a')],
    });
    assert.equal(missingFeature.outcome, 'UNAVAILABLE');
    if (missingFeature.outcome === 'UNAVAILABLE') {
      assert.equal(missingFeature.reasonCode, 'FEATURE_MAPPING_MISSING');
    }

    const nonfinite = scorer.score({
      domain: 'material',
      userFeatures: [['interest:arduino', Number.POSITIVE_INFINITY]],
      candidates: [v2Candidate('candidate-a')],
    });
    assert.equal(nonfinite.outcome, 'UNAVAILABLE');
    if (nonfinite.outcome === 'UNAVAILABLE') {
      assert.equal(nonfinite.reasonCode, 'NONFINITE_RUNTIME_INPUT');
    }
  });
});
