import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { before, describe, test } from 'node:test';

import type {
  MaterialCondition,
  ProjectDifficulty,
} from '../../generated/prisma/client.js';
import type { LearnerInterestResolution } from '../taxonomy/learner-interest-resolver.js';
import { buildCanonicalShadowUserFeatures } from './canonical-shadow-user-features.js';
import {
  buildCanonicalMaterialRuntimeFeatures,
  buildCanonicalProjectRuntimeFeatures,
  compileCanonicalRuntimeFeatureAuthority,
  type CanonicalConceptAssociationInput,
  type CanonicalRuntimeFeatureAuthority,
} from './canonical-runtime-item-features.js';
import {
  scorePortableLightFm,
  type WeightedFeature,
} from './ml-lightfm-scorer.js';
import type { PortableModelArtifact } from './ml-model-artifact.js';
import {
  compileRecommendationFeatureReadinessContract,
  evaluateRecommendationFeatureReadiness,
  type CompiledRecommendationFeatureReadinessContract,
} from './recommendation-feature-readiness.js';
import {
  loadRecommendationFeatureTokenContract,
  validatePortableFeatureRow,
  type PortableFeatureOccurrence,
  type RecommendationFeatureDomain,
  type RecommendationFeatureSide,
} from './recommendation-feature-token-contract.js';

type Expected = {
  tokens?: string[];
  occurrenceCount: number;
  uniqueTokenCount: number;
  readiness: 'READY' | 'NOT_READY' | 'REJECTED';
  missingRequiredGroupIds?: string[];
  errorCode?: string;
};

type Fixture = {
  canonicalVocabulary: unknown;
  users: Array<{
    userId: string;
    interestKeys: string[];
    expected: Expected;
  }>;
  materials: Array<{
    materialId: string;
    concepts: CanonicalConceptAssociationInput[];
    condition: MaterialCondition;
    isFree: boolean;
    pickupAllowed: boolean;
    deliveryAllowed: boolean;
    expected: Expected;
  }>;
  projects: Array<{
    projectId: string;
    topicConcepts: CanonicalConceptAssociationInput[];
    componentConcepts: Array<CanonicalConceptAssociationInput & { isRequired: boolean }>;
    difficulty: ProjectDifficulty;
    expected: Expected;
  }>;
  validationCases: Array<{
    name: string;
    side: RecommendationFeatureSide;
    domain: RecommendationFeatureDomain;
    features: Array<[string, string, number]>;
    expected: Expected;
  }>;
  aggregationProbe: {
    userFeatures: Array<{ name: string; weight: number; bias: number; embedding: number[] }>;
    itemFeatures: Array<{ name: string; weight: number; bias: number; embedding: number[] }>;
    expectedScore: number;
  };
};

const fixtureUrl = new URL(
  '../../../../../ml/recommendation/tests/fixtures/lm05_feature_parity_v1.json',
  import.meta.url,
);

const occurrences = (
  value: Fixture['validationCases'][number],
): PortableFeatureOccurrence[] =>
  value.features.map(([token, groupId, weight]) => ({
    token,
    groupId,
    side: value.side,
    domain: value.domain,
    weight,
  }));

describe('LM-05 shared canonical feature parity', () => {
  let fixture: Fixture;
  let authority: CanonicalRuntimeFeatureAuthority;
  let compiled: CompiledRecommendationFeatureReadinessContract;

  before(async () => {
    fixture = JSON.parse(await readFile(fixtureUrl, 'utf8')) as Fixture;
    const contract = await loadRecommendationFeatureTokenContract();
    authority = compileCanonicalRuntimeFeatureAuthority(contract);
    compiled = compileRecommendationFeatureReadinessContract(contract);
  });

  test('validates user expectations through the LM-03 user builder', () => {
    for (const user of fixture.users) {
      const resolution = {
        status: 'FULLY_MAPPED',
        inputCount: user.interestKeys.length,
        meaningfulInputCount: user.interestKeys.length,
        uniqueInputCount: new Set(user.interestKeys).size,
        mappedInputCount: user.interestKeys.length,
        unmappedInputCount: 0,
        canonicalKeys: user.interestKeys,
        mapped: [],
        unmapped: [],
      } as LearnerInterestResolution;
      const result = buildCanonicalShadowUserFeatures({ resolution });
      assert.deepEqual(result.features.map(([token]) => token), user.expected.tokens);
      assert.equal(user.interestKeys.length, user.expected.occurrenceCount);
      assert.equal(result.features.length, user.expected.uniqueTokenCount);
      assert.ok(result.features.every(([token, weight]) => token.startsWith('interest:') && weight === 1));
    }
  });

  test('validates material expectations through the LM-03 item builder', () => {
    for (const material of fixture.materials) {
      const result = buildCanonicalMaterialRuntimeFeatures({
        authority,
        concepts: material.concepts,
        condition: material.condition,
        isFree: material.isFree,
        pickupAllowed: material.pickupAllowed,
        deliveryAllowed: material.deliveryAllowed,
      });
      assert.deepEqual(result.features.map(([token]) => token), material.expected.tokens);
      assert.equal(result.features.length, material.expected.uniqueTokenCount);
      assert.equal(result.scoringEligible, material.expected.readiness === 'READY');
      assert.deepEqual(result.missingRequiredGroupIds, material.expected.missingRequiredGroupIds);
    }
  });

  test('validates project expectations and one component prefix through LM-03', () => {
    for (const project of fixture.projects) {
      const result = buildCanonicalProjectRuntimeFeatures({
        authority,
        topicConcepts: project.topicConcepts,
        componentConcepts: project.componentConcepts,
        difficulty: project.difficulty,
      });
      assert.deepEqual(result.features.map(([token]) => token), project.expected.tokens);
      assert.equal(result.features.length, project.expected.uniqueTokenCount);
      assert.ok(result.features.every(([token]) => !token.startsWith('component:component:')));
    }
  });

  test('uses LM-03 authority for missing, duplicate, unknown, and membership cases', () => {
    for (const value of fixture.validationCases) {
      assert.equal(value.features.length, value.expected.occurrenceCount);
      assert.equal(new Set(value.features.map(([token]) => token)).size, value.expected.uniqueTokenCount);
      if (value.expected.readiness === 'REJECTED') {
        assert.throws(() =>
          validatePortableFeatureRow(authority.contract, {
            side: value.side,
            domain: value.domain,
            features: occurrences(value),
          }),
        );
        continue;
      }
      const result = validatePortableFeatureRow(authority.contract, {
        side: value.side,
        domain: value.domain,
        features: occurrences(value),
      });
      assert.equal(result.scoringEligible, value.expected.readiness === 'READY');
      assert.equal(result.features.length, value.expected.uniqueTokenCount);
      assert.deepEqual(result.missingRequiredGroupIds, value.expected.missingRequiredGroupIds);

      const readiness = evaluateRecommendationFeatureReadiness({
        compiledContract: compiled,
        domain: value.domain,
        user: {
          features: [['interest:arduino', 1]],
          resolutionStatus: 'FULLY_MAPPED',
        },
        itemRows: [{
          candidateKey: value.name,
          features: value.features.map(([token, , weight]) => [token, weight] as const),
        }],
        artifact: {
          modelVersion: 'lm05-local-test',
          featureSchemaVersion: 'lm05-local-test',
          feature_contract_id: compiled.expectedContractId,
          feature_contract_version: compiled.expectedContractVersion,
          feature_contract_fingerprint: compiled.expectedTaxonomyFingerprint,
          userFeatureNames: ['interest:arduino'],
          itemFeatureNames: value.features.map(([token]) => token),
        },
      });
      assert.equal(readiness.items.constructedOccurrenceCount, value.expected.occurrenceCount);
      assert.equal(readiness.items.constructedUniqueCount, value.expected.uniqueTokenCount);
    }
  });

  test('does not use the fixture vocabulary as TypeScript taxonomy authority', () => {
    assert.ok(fixture.canonicalVocabulary);
    const unknownIdentity = fixture.validationCases.find(
      (value) => value.name === 'unknown-canonical-identity',
    );
    const unknownNamespace = fixture.validationCases.find(
      (value) => value.name === 'unknown-namespace',
    );
    assert.ok(unknownIdentity && unknownNamespace);
    assert.throws(() => validatePortableFeatureRow(authority.contract, {
      side: unknownIdentity.side,
      domain: unknownIdentity.domain,
      features: occurrences(unknownIdentity),
    }));
    assert.throws(() => validatePortableFeatureRow(authority.contract, {
      side: unknownNamespace.side,
      domain: unknownNamespace.domain,
      features: occurrences(unknownNamespace),
    }));
  });

  test('confirms current RP-06.1 scoring is the same weighted additive sum', () => {
    const probe = fixture.aggregationProbe;
    const artifact: PortableModelArtifact = {
      artifact_version: 'impactloop-lightfm-portable-v1',
      model_version: 'lm05-local-test',
      domain: 'project',
      feature_schema_version: 'lm05-local-test',
      latent_dimension: 3,
      catalog_snapshot_hash: 'lm05-local-test',
      training_dataset_hash: 'lm05-local-test',
      mapping_hash: 'lm05-local-test',
      hyperparameters: {},
      python_version: 'lm05-local-test',
      lightfm_version: 'lm05-local-test',
      exported_at_utc: '2026-07-26T00:00:00Z',
      user_features: probe.userFeatures.map((feature) => ({
        name: feature.name,
        bias: String(feature.bias),
        embedding: feature.embedding.map(String),
      })),
      item_features: probe.itemFeatures.map((feature) => ({
        name: feature.name,
        bias: String(feature.bias),
        embedding: feature.embedding.map(String),
      })),
      content_hash: 'lm05-local-test',
    };
    const userFeatures = probe.userFeatures.map(
      (feature) => [feature.name, feature.weight] as const,
    ) as WeightedFeature[];
    const result = scorePortableLightFm(artifact, userFeatures, [{
      candidateKey: 'p-01',
      features: probe.itemFeatures.map(
        (feature) => [feature.name, feature.weight] as const,
      ) as WeightedFeature[],
    }]);
    assert.equal(result.outcome, 'SCORED');
    assert.equal(result.scored.length, 1);
    assert.ok(Math.abs(result.scored[0]!.score - probe.expectedScore) <= 1e-12);
  });
});
