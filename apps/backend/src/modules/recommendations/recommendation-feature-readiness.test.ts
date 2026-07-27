import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import {
  classifyArtifactFeatureToken,
  classifyRuntimeFeatureForScorer,
  classifyRuntimeFeatureToken,
  compileRecommendationFeatureReadinessContract,
  createFeatureReadinessSampleCollector,
  evaluateRecommendationFeatureReadiness,
  FEATURE_READINESS_SAMPLE_LIMIT,
  finalizeFeatureReadinessSamples,
  hashFeatureReadinessToken,
  recordFeatureReadinessIssue,
  type CompiledRecommendationFeatureReadinessContract,
} from './recommendation-feature-readiness.js';
import { loadRecommendationFeatureTokenContract } from './recommendation-feature-token-contract.js';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../',
);
const materialArtifactPath = path.join(
  root,
  'ml/recommendation/generated/portable-model/material-hybrid-runtime-v2.json',
);
const projectArtifactPath = path.join(
  root,
  'ml/recommendation/generated/portable-model/project-hybrid-runtime-v2.json',
);

const MATERIAL_CLOSED: string[] = [
  'material-condition:new',
  'material-condition:like-new',
  'material-condition:good',
  'material-condition:used',
  'material-condition:needs-repair',
  'material-is-free:true',
  'material-is-free:false',
  'material-pickup-allowed:true',
  'material-pickup-allowed:false',
  'material-delivery-allowed:true',
  'material-delivery-allowed:false',
];

const PROJECT_CLOSED: string[] = [
  'project-difficulty:beginner',
  'project-difficulty:intermediate',
  'project-difficulty:advanced',
];

const HEX64 = 'a'.repeat(64);

const completeMaterialItem = (key: string) => ({
  candidateKey: key,
  features: [
    ['material-family:electronics', 1],
    ['material-condition:new', 1],
    ['material-is-free:true', 1],
    ['material-pickup-allowed:true', 1],
    ['material-delivery-allowed:false', 1],
  ] as const,
});

const completeProjectItem = (key: string) => ({
  candidateKey: key,
  features: [
    ['project-topic:robotics', 1],
    ['project-difficulty:beginner', 1],
  ] as const,
});

describe('RP-01.5 recommendation feature readiness (corrected)', () => {
  let compiled: CompiledRecommendationFeatureReadinessContract;

  const compatibleMaterialArtifact = (extraItem: string[] = []) => ({
    modelVersion: 'synthetic-v3',
    featureSchemaVersion: 'synthetic-feature-schema',
    feature_contract_id: compiled.expectedContractId,
    feature_contract_version: compiled.expectedContractVersion,
    feature_contract_fingerprint: compiled.expectedTaxonomyFingerprint,
    userFeatureNames: ['interest:arduino'],
    itemFeatureNames: [
      ...MATERIAL_CLOSED,
      'material-family:electronics',
      ...extraItem,
    ],
  });

  it('compiles exact taxonomy membership, contract id, and taxonomy fingerprint', async () => {
    const parsed = await loadRecommendationFeatureTokenContract();
    compiled = compileRecommendationFeatureReadinessContract(parsed);
    assert.equal(
      compiled.expectedContractId,
      'recommendation-feature-token-contract-v3',
    );
    assert.equal(compiled.expectedContractVersion, '3.0.0');
    assert.equal(
      compiled.expectedTaxonomyFingerprint,
      parsed.taxonomyCompatibility.taxonomyVocabularyFingerprint,
    );
    assert.equal(compiled.expectedTaxonomyFingerprint.length, 64);
    const interestNs = compiled.namespaces.find((ns) => ns.id === 'interest');
    assert.ok(interestNs?.membership.has('interest:arduino'));
    assert.equal(interestNs?.membership.has(`interest:${HEX64}`), false);
  });

  it('accepts exact foundation taxonomy tokens and rejects non-foundation / hashed keys', () => {
    assert.equal(
      classifyRuntimeFeatureToken({
        compiledContract: compiled,
        domain: 'material',
        side: 'user',
        token: 'interest:arduino',
        weight: 1,
        artifactFeatureNames: new Set(['interest:arduino']),
      }).state,
      'RESOLVED',
    );
    assert.equal(
      classifyRuntimeFeatureToken({
        compiledContract: compiled,
        domain: 'material',
        side: 'item',
        token: 'material-family:electronics',
        weight: 1,
        artifactFeatureNames: new Set(['material-family:electronics']),
      }).state,
      'RESOLVED',
    );
    assert.equal(
      classifyRuntimeFeatureToken({
        compiledContract: compiled,
        domain: 'material',
        side: 'user',
        token: `interest:${HEX64}`,
        weight: 1,
        artifactFeatureNames: new Set(),
      }).state,
      'INVALID_RUNTIME_FEATURE_VALUE',
    );
    assert.equal(
      classifyRuntimeFeatureToken({
        compiledContract: compiled,
        domain: 'material',
        side: 'item',
        token: `material-family:${HEX64}`,
        weight: 1,
        artifactFeatureNames: new Set(),
      }).state,
      'INVALID_RUNTIME_FEATURE_VALUE',
    );
    assert.equal(
      classifyRuntimeFeatureToken({
        compiledContract: compiled,
        domain: 'material',
        side: 'user',
        token: 'interest:brand-new-approved-interest',
        weight: 1,
        artifactFeatureNames: new Set(),
      }).state,
      'INVALID_RUNTIME_FEATURE_VALUE',
    );
    assert.equal(
      classifyArtifactFeatureToken({
        compiledContract: compiled,
        domain: 'material',
        side: 'user',
        token: `interest:${HEX64}`,
      }).state,
      'INVALID_ARTIFACT_FEATURE_VALUE',
    );
  });

  it('classifies unknown, unsupported, and invalid closed values distinctly', () => {
    assert.equal(
      classifyRuntimeFeatureToken({
        compiledContract: compiled,
        domain: 'material',
        side: 'item',
        token: 'condition:NEW',
        artifactFeatureNames: new Set(),
      }).state,
      'UNKNOWN_RUNTIME_FEATURE',
    );
    assert.equal(
      classifyRuntimeFeatureToken({
        compiledContract: compiled,
        domain: 'material',
        side: 'item',
        token: 'category:abc',
        artifactFeatureNames: new Set(),
      }).state,
      'UNSUPPORTED_RUNTIME_FEATURE',
    );
    assert.equal(
      classifyRuntimeFeatureToken({
        compiledContract: compiled,
        domain: 'material',
        side: 'item',
        token: 'material-condition:destroyed',
        artifactFeatureNames: new Set(),
      }).state,
      'INVALID_RUNTIME_FEATURE_VALUE',
    );
  });

  it('refines scorer nonportable features without changing readiness classifications', () => {
    const base = {
      compiledContract: compiled,
      domain: 'material' as const,
      side: 'item' as const,
      artifactFeatureNames: new Set<string>(),
    };
    assert.equal(
      classifyRuntimeFeatureToken({ ...base, token: 'category:legacy' }).state,
      'UNSUPPORTED_RUNTIME_FEATURE',
    );
    assert.equal(
      classifyRuntimeFeatureForScorer({
        ...base,
        token: 'category:legacy',
      }).state,
      'NONPORTABLE_RUNTIME_FEATURE',
    );
    assert.equal(
      classifyRuntimeFeatureForScorer({
        ...base,
        token: 'project-topic:robotics',
      }).state,
      'UNSUPPORTED_RUNTIME_FEATURE',
    );
    assert.equal(
      classifyRuntimeFeatureForScorer({ ...base, token: 'invented:value' })
        .state,
      'UNKNOWN_RUNTIME_FEATURE',
    );
    assert.equal(
      classifyRuntimeFeatureForScorer({
        ...base,
        token: 'material-condition:destroyed',
      }).state,
      'INVALID_RUNTIME_FEATURE_VALUE',
    );
    assert.equal(
      classifyRuntimeFeatureForScorer({
        ...base,
        token: 'material-family:electronics',
        weight: 2,
      }).state,
      'INVALID_RUNTIME_FEATURE_WEIGHT',
    );
  });

  it('validates runtime weights and duplicate semantics', () => {
    const artifact = compatibleMaterialArtifact();
    const pass = evaluateRecommendationFeatureReadiness({
      compiledContract: compiled,
      domain: 'material',
      user: {
        features: [['interest:arduino', 1]],
        resolutionStatus: 'FULLY_MAPPED',
      },
      itemRows: [completeMaterialItem('m1')],
      artifact,
    });
    assert.equal(pass.coverageStatus, 'READY');
    assert.equal(pass.status, 'NOT_READY');
    assert.ok(pass.reasons.includes('FEATURE_CONTRACT_RUNTIME_INACTIVE'));
    assert.ok(pass.reasons.includes('FEATURE_CONTRACT_AGGREGATION_NOT_SELECTED'));
    assert.ok(pass.reasons.includes('FEATURE_CONTRACT_PORTABLE_ACTIVATION_BLOCKED'));

    for (const weight of [0, -1, 2, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = evaluateRecommendationFeatureReadiness({
        compiledContract: compiled,
        domain: 'material',
        user: {
          features: [['interest:arduino', 1]],
          resolutionStatus: 'FULLY_MAPPED',
        },
        itemRows: [
          {
            candidateKey: 'm1',
            features: [
              ['material-family:electronics', weight],
              ['material-condition:new', 1],
              ['material-is-free:true', 1],
              ['material-pickup-allowed:true', 1],
              ['material-delivery-allowed:false', 1],
            ],
          },
        ],
        artifact,
      });
      assert.equal(result.status, 'NOT_READY');
      assert.ok(result.reasons.includes('INVALID_RUNTIME_FEATURE_WEIGHT'));
      assert.ok(result.items.invalidWeightOccurrenceCount >= 1);
      assert.equal(result.groups['material.family']?.cardinalityStatus, 'MISSING_REQUIRED');
    }

    const duplicateOk = evaluateRecommendationFeatureReadiness({
      compiledContract: compiled,
      domain: 'material',
      user: {
        features: [['interest:arduino', 1]],
        resolutionStatus: 'FULLY_MAPPED',
      },
      itemRows: [
        {
          candidateKey: 'm1',
          features: [
            ['material-condition:new', 1],
            ['material-condition:new', 1],
            ['material-family:electronics', 1],
            ['material-is-free:true', 1],
            ['material-pickup-allowed:true', 1],
            ['material-delivery-allowed:false', 1],
          ],
        },
      ],
      artifact,
    });
    assert.equal(duplicateOk.coverageStatus, 'READY');
    assert.equal(duplicateOk.status, 'NOT_READY');
    assert.equal(duplicateOk.groups['material.condition']?.constructedUnique, 1);
    assert.equal(duplicateOk.items.constructedOccurrenceCount, 6);
    assert.equal(duplicateOk.items.artifactResolvedOccurrenceCount, 6);

    const conflict = evaluateRecommendationFeatureReadiness({
      compiledContract: compiled,
      domain: 'material',
      user: {
        features: [['interest:arduino', 1]],
        resolutionStatus: 'FULLY_MAPPED',
      },
      itemRows: [
        {
          candidateKey: 'm1',
          features: [
            ['material-condition:new', 1],
            ['material-condition:new', 2],
            ['material-family:electronics', 1],
            ['material-is-free:true', 1],
            ['material-pickup-allowed:true', 1],
            ['material-delivery-allowed:false', 1],
          ],
        },
      ],
      artifact,
    });
    assert.ok(conflict.reasons.includes('INVALID_RUNTIME_FEATURE_WEIGHT'));

    const twoConditions = evaluateRecommendationFeatureReadiness({
      compiledContract: compiled,
      domain: 'material',
      user: {
        features: [['interest:arduino', 1]],
        resolutionStatus: 'FULLY_MAPPED',
      },
      itemRows: [
        {
          candidateKey: 'm1',
          features: [
            ['material-condition:new', 1],
            ['material-condition:used', 1],
            ['material-family:electronics', 1],
            ['material-is-free:true', 1],
            ['material-pickup-allowed:true', 1],
            ['material-delivery-allowed:false', 1],
          ],
        },
      ],
      artifact,
    });
    assert.ok(twoConditions.reasons.includes('INVALID_RUNTIME_CARDINALITY'));
    assert.equal(
      twoConditions.groups['material.condition']?.exceededMaximumCandidateCount,
      1,
    );
  });

  it('keeps the issue collector bounded during aggregation', () => {
    const collector = createFeatureReadinessSampleCollector();
    const entries = Array.from({ length: 40 }, (_, index) => ({
      domain: 'material' as const,
      side: 'item' as const,
      groupId: null,
      issueCode: 'UNKNOWN_RUNTIME_FEATURE' as const,
      tokenHash: hashFeatureReadinessToken(`token-${String(index).padStart(2, '0')}`),
      candidateKeyHash: hashFeatureReadinessToken(`cand-${index}`),
      criticality: null,
      source: 'runtime' as const,
    }));
    for (const entry of [...entries].reverse()) {
      recordFeatureReadinessIssue(collector, entry);
      assert.ok(
        (collector.entries.get('UNKNOWN_RUNTIME_FEATURE')?.length ?? 0) <=
          FEATURE_READINESS_SAMPLE_LIMIT,
      );
    }
    const finalized = finalizeFeatureReadinessSamples(collector);
    const bucket = finalized.samples.UNKNOWN_RUNTIME_FEATURE!;
    assert.equal(bucket.total, 40);
    assert.equal(bucket.sample.length, FEATURE_READINESS_SAMPLE_LIMIT);
    assert.equal(bucket.truncated, true);
    const forward = createFeatureReadinessSampleCollector();
    for (const entry of entries) recordFeatureReadinessIssue(forward, entry);
    assert.deepEqual(
      finalizeFeatureReadinessSamples(forward).samples.UNKNOWN_RUNTIME_FEATURE
        ?.sample.map((entry) => entry.tokenHash),
      bucket.sample.map((entry) => entry.tokenHash),
    );
  });

  it('uses candidate-level group cardinality and ignores invalid tokens for group satisfaction', () => {
    const artifact = compatibleMaterialArtifact();
    const mixed = evaluateRecommendationFeatureReadiness({
      compiledContract: compiled,
      domain: 'material',
      user: {
        features: [['interest:arduino', 1]],
        resolutionStatus: 'FULLY_MAPPED',
      },
      itemRows: [
        {
          candidateKey: 'a',
          features: [
            ['material-condition:new', 1],
            ['material-is-free:true', 1],
            ['material-pickup-allowed:true', 1],
            ['material-delivery-allowed:false', 1],
          ],
        },
        completeMaterialItem('b'),
      ],
      artifact,
    });
    assert.equal(mixed.status, 'NOT_READY');
    assert.equal(mixed.items.affectedCandidateCount, 1);
    assert.equal(mixed.groups['material.family']?.missingRequiredCandidateCount, 1);
    assert.equal(mixed.groups['material.family']?.cardinalityStatus, 'MISSING_REQUIRED');

    const destroyed = evaluateRecommendationFeatureReadiness({
      compiledContract: compiled,
      domain: 'material',
      user: {
        features: [['interest:arduino', 1]],
        resolutionStatus: 'FULLY_MAPPED',
      },
      itemRows: [
        {
          candidateKey: 'm1',
          features: [
            ['material-family:electronics', 1],
            ['material-condition:destroyed', 1],
            ['material-is-free:true', 1],
            ['material-pickup-allowed:true', 1],
            ['material-delivery-allowed:false', 1],
          ],
        },
      ],
      artifact,
    });
    assert.ok(destroyed.reasons.includes('INVALID_RUNTIME_FEATURE_VALUE'));
    assert.ok(destroyed.reasons.includes('MISSING_CRITICAL_RUNTIME_GROUP'));
    assert.equal(destroyed.groups['material.condition']?.resolvedUnique, 0);
    assert.equal(
      destroyed.groups['material.condition']?.missingRequiredCandidateCount,
      1,
    );

    const invalidInArtifact = evaluateRecommendationFeatureReadiness({
      compiledContract: compiled,
      domain: 'material',
      user: {
        features: [['interest:arduino', 1]],
        resolutionStatus: 'FULLY_MAPPED',
      },
      itemRows: [completeMaterialItem('m1')],
      artifact: {
        ...artifact,
        itemFeatureNames: [
          ...artifact.itemFeatureNames,
          'material-condition:destroyed',
        ],
      },
    });
    assert.ok(
      invalidInArtifact.reasons.includes('INVALID_ARTIFACT_FEATURE_VALUE'),
    );
    assert.equal(
      invalidInArtifact.groups['material.condition']?.resolvedUnique,
      1,
    );
  });

  it('requires explicit contract id, version, and taxonomy fingerprint metadata', () => {
    const base = compatibleMaterialArtifact();
    const missingId = evaluateRecommendationFeatureReadiness({
      compiledContract: compiled,
      domain: 'material',
      user: {
        features: [['interest:arduino', 1]],
        resolutionStatus: 'FULLY_MAPPED',
      },
      itemRows: [completeMaterialItem('m1')],
      artifact: { ...base, feature_contract_id: null },
    });
    assert.ok(missingId.reasons.includes('ARTIFACT_CONTRACT_ID_MISSING'));
    assert.equal(missingId.items.affectedCandidateCount, 0);

    const badFp = evaluateRecommendationFeatureReadiness({
      compiledContract: compiled,
      domain: 'material',
      user: {
        features: [['interest:arduino', 1]],
        resolutionStatus: 'FULLY_MAPPED',
      },
      itemRows: [completeMaterialItem('m1')],
      artifact: { ...base, feature_contract_fingerprint: '0'.repeat(64) },
    });
    assert.ok(
      badFp.reasons.includes('ARTIFACT_CONTRACT_FINGERPRINT_INCOMPATIBLE'),
    );

    const missingFp = evaluateRecommendationFeatureReadiness({
      compiledContract: compiled,
      domain: 'material',
      user: {
        features: [['interest:arduino', 1]],
        resolutionStatus: 'FULLY_MAPPED',
      },
      itemRows: [completeMaterialItem('m1')],
      artifact: { ...base, feature_contract_fingerprint: null },
    });
    assert.ok(
      missingFp.reasons.includes('ARTIFACT_CONTRACT_FINGERPRINT_MISSING'),
    );
  });

  it('classifies current runtime-v2 artifacts as NOT_READY with hashed user features invalid', async () => {
    const materialRaw = JSON.parse(
      await readFile(materialArtifactPath, 'utf8'),
    ) as {
      model_version: string;
      feature_schema_version: string;
      user_features: Array<{ name: string }>;
      item_features: Array<{ name: string }>;
    };
    const projectRaw = JSON.parse(
      await readFile(projectArtifactPath, 'utf8'),
    ) as {
      model_version: string;
      feature_schema_version: string;
      user_features: Array<{ name: string }>;
      item_features: Array<{ name: string }>;
    };

    const material = evaluateRecommendationFeatureReadiness({
      compiledContract: compiled,
      domain: 'material',
      user: {
        features: [['interest:arduino', 1]],
        resolutionStatus: 'FULLY_MAPPED',
      },
      itemRows: [
        {
          candidateKey: 'm1',
          features: [
            ['category:abc', 1],
            ['condition:NEW', 1],
            ['free:1', 1],
            ['pickup:1', 1],
            ['delivery:0', 1],
          ],
        },
      ],
      artifact: {
        modelVersion: materialRaw.model_version,
        featureSchemaVersion: materialRaw.feature_schema_version,
        feature_contract_id: null,
        feature_contract_version: null,
        feature_contract_fingerprint: null,
        userFeatureNames: materialRaw.user_features.map((entry) => entry.name),
        itemFeatureNames: materialRaw.item_features.map((entry) => entry.name),
      },
    });
    assert.equal(material.status, 'NOT_READY');
    assert.ok(material.reasons.includes('ARTIFACT_CONTRACT_ID_MISSING'));
    assert.ok(material.reasons.includes('ARTIFACT_CONTRACT_VERSION_MISSING'));
    assert.ok(
      material.reasons.includes('ARTIFACT_CONTRACT_FINGERPRINT_MISSING'),
    );
    assert.equal(material.artifact.contractValidArtifactFeatureCount, 0);
    const hashedInvalid =
      material.artifact.contractInvalidArtifactFeatureCount;
    assert.ok(hashedInvalid >= materialRaw.user_features.length);
    assert.ok(
      material.items.unknownOccurrenceCount +
        material.items.unsupportedOccurrenceCount >
        0,
    );

    const project = evaluateRecommendationFeatureReadiness({
      compiledContract: compiled,
      domain: 'project',
      user: {
        features: [['interest:arduino', 1]],
        resolutionStatus: 'FULLY_MAPPED',
      },
      itemRows: [completeProjectItem('p1')],
      artifact: {
        modelVersion: projectRaw.model_version,
        featureSchemaVersion: projectRaw.feature_schema_version,
        feature_contract_id: null,
        feature_contract_version: null,
        feature_contract_fingerprint: null,
        userFeatureNames: projectRaw.user_features.map((entry) => entry.name),
        itemFeatureNames: projectRaw.item_features.map((entry) => entry.name),
      },
    });
    assert.equal(project.status, 'NOT_READY');
    assert.ok(project.reasons.includes('ARTIFACT_CONTRACT_VERSION_MISSING'));
  });

  it('keeps diagnostics privacy-safe; coverage may be READY while overall stays NOT_READY', () => {
    const result = evaluateRecommendationFeatureReadiness({
      compiledContract: compiled,
      domain: 'material',
      user: {
        features: [['interest:arduino', 1]],
        resolutionStatus: 'FULLY_MAPPED',
      },
      itemRows: [completeMaterialItem('m1')],
      artifact: compatibleMaterialArtifact(),
    });
    assert.equal(result.coverageStatus, 'READY');
    assert.equal(result.status, 'NOT_READY');
    assert.equal(compiled.lifecycle, 'SPECIFICATION_ONLY');
    assert.equal(compiled.runtimeActivation, 'INACTIVE');
    assert.equal(compiled.aggregationBlocked, true);
    assert.equal(compiled.aggregationSelectedMode, null);
    assert.equal(compiled.portableActivationAllowed, false);
    assert.equal(result.artifact.contractVersionCompatible, true);
    assert.ok(result.reasons.includes('FEATURE_CONTRACT_RUNTIME_INACTIVE'));
    assert.ok(result.reasons.includes('FEATURE_CONTRACT_AGGREGATION_NOT_SELECTED'));
    assert.ok(result.reasons.includes('FEATURE_CONTRACT_PORTABLE_ACTIVATION_BLOCKED'));
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes('interest:arduino'), false);
    assert.equal(serialized.includes('material-family:electronics'), false);
  });

  it('reserves USER_NO_INTERESTS for resolver NO_INTERESTS only', () => {
    const artifact = compatibleMaterialArtifact();
    const nonFoundation = evaluateRecommendationFeatureReadiness({
      compiledContract: compiled,
      domain: 'material',
      user: {
        features: [['interest:brand-new-approved-interest', 1]],
        resolutionStatus: 'FULLY_MAPPED',
      },
      itemRows: [completeMaterialItem('m1')],
      artifact,
    });
    assert.ok(nonFoundation.reasons.includes('INVALID_RUNTIME_FEATURE_VALUE'));
    assert.ok(nonFoundation.reasons.includes('USER_RUNTIME_REPRESENTATION_INVALID'));
    assert.equal(nonFoundation.reasons.includes('USER_NO_INTERESTS'), false);

    const badWeight = evaluateRecommendationFeatureReadiness({
      compiledContract: compiled,
      domain: 'material',
      user: {
        features: [['interest:arduino', 2]],
        resolutionStatus: 'FULLY_MAPPED',
      },
      itemRows: [completeMaterialItem('m1')],
      artifact,
    });
    assert.ok(badWeight.reasons.includes('INVALID_RUNTIME_FEATURE_WEIGHT'));
    assert.ok(badWeight.reasons.includes('USER_RUNTIME_REPRESENTATION_INVALID'));
    assert.equal(badWeight.reasons.includes('USER_NO_INTERESTS'), false);
    assert.equal(badWeight.reasons.includes('USER_ZERO_ARTIFACT_OVERLAP'), false);
    assert.equal(
      badWeight.reasons.includes('USER_PARTIAL_ARTIFACT_OVERLAP'),
      false,
    );

    const cold = evaluateRecommendationFeatureReadiness({
      compiledContract: compiled,
      domain: 'material',
      user: {
        features: [],
        resolutionStatus: 'NO_INTERESTS',
      },
      itemRows: [completeMaterialItem('m1')],
      artifact,
    });
    assert.ok(cold.reasons.includes('USER_NO_INTERESTS'));
  });

  it('does not reclassify invalid-weight user tokens as valid for overlap', () => {
    const present = evaluateRecommendationFeatureReadiness({
      compiledContract: compiled,
      domain: 'material',
      user: {
        features: [['interest:arduino', 2]],
        resolutionStatus: 'FULLY_MAPPED',
      },
      itemRows: [completeMaterialItem('m1')],
      artifact: compatibleMaterialArtifact(),
    });
    assert.ok(present.reasons.includes('INVALID_RUNTIME_FEATURE_WEIGHT'));
    assert.ok(present.reasons.includes('USER_RUNTIME_REPRESENTATION_INVALID'));
    assert.equal(present.reasons.includes('USER_ZERO_ARTIFACT_OVERLAP'), false);
    assert.equal(
      present.reasons.includes('USER_PARTIAL_ARTIFACT_OVERLAP'),
      false,
    );

    const absent = evaluateRecommendationFeatureReadiness({
      compiledContract: compiled,
      domain: 'material',
      user: {
        features: [['interest:arduino', 2]],
        resolutionStatus: 'FULLY_MAPPED',
      },
      itemRows: [completeMaterialItem('m1')],
      artifact: {
        ...compatibleMaterialArtifact(),
        userFeatureNames: [],
      },
    });
    assert.ok(absent.reasons.includes('INVALID_RUNTIME_FEATURE_WEIGHT'));
    assert.ok(absent.reasons.includes('USER_RUNTIME_REPRESENTATION_INVALID'));
    assert.equal(absent.reasons.includes('USER_ZERO_ARTIFACT_OVERLAP'), false);
    assert.equal(
      absent.reasons.includes('USER_PARTIAL_ARTIFACT_OVERLAP'),
      false,
    );

    const zeroOverlap = evaluateRecommendationFeatureReadiness({
      compiledContract: compiled,
      domain: 'material',
      user: {
        features: [['interest:arduino', 1]],
        resolutionStatus: 'FULLY_MAPPED',
      },
      itemRows: [completeMaterialItem('m1')],
      artifact: {
        ...compatibleMaterialArtifact(),
        userFeatureNames: [],
      },
    });
    assert.ok(zeroOverlap.reasons.includes('USER_ZERO_ARTIFACT_OVERLAP'));
    assert.equal(
      zeroOverlap.reasons.includes('USER_RUNTIME_REPRESENTATION_INVALID'),
      false,
    );

    const partial = evaluateRecommendationFeatureReadiness({
      compiledContract: compiled,
      domain: 'material',
      user: {
        features: [
          ['interest:arduino', 1],
          ['interest:robotics', 1],
        ],
        resolutionStatus: 'FULLY_MAPPED',
      },
      itemRows: [completeMaterialItem('m1')],
      artifact: compatibleMaterialArtifact(),
    });
    assert.ok(partial.reasons.includes('USER_PARTIAL_ARTIFACT_OVERLAP'));
    assert.equal(partial.user.artifactResolvedUniqueCount, 1);
  });

  it('requires exact artifact aggregation mode only when contract selects a mode', () => {
    const activated = {
      ...compiled,
      runtimeActivation: 'ACTIVE' as CompiledRecommendationFeatureReadinessContract['runtimeActivation'],
      aggregationBlocked: false,
      aggregationStatus: 'SELECTED' as const,
      aggregationSelectedMode: 'weighted-mean' as const,
      portableActivationAllowed: true,
    };

    const missingMode = evaluateRecommendationFeatureReadiness({
      compiledContract: activated,
      domain: 'material',
      user: {
        features: [['interest:arduino', 1]],
        resolutionStatus: 'FULLY_MAPPED',
      },
      itemRows: [completeMaterialItem('m1')],
      artifact: compatibleMaterialArtifact(),
    });
    assert.equal(missingMode.coverageStatus, 'NOT_READY');
    assert.equal(missingMode.status, 'NOT_READY');
    assert.ok(missingMode.reasons.includes('ARTIFACT_AGGREGATION_MODE_MISSING'));
    assert.equal(missingMode.artifact.aggregationModeCompatible, false);
    assert.equal(missingMode.artifact.expectedAggregationMode, 'weighted-mean');
    assert.equal(missingMode.artifact.featureAggregationMode, null);

    const incompatible = evaluateRecommendationFeatureReadiness({
      compiledContract: activated,
      domain: 'material',
      user: {
        features: [['interest:arduino', 1]],
        resolutionStatus: 'FULLY_MAPPED',
      },
      itemRows: [completeMaterialItem('m1')],
      artifact: {
        ...compatibleMaterialArtifact(),
        feature_aggregation_mode: 'weighted-sum',
      },
    });
    assert.equal(incompatible.coverageStatus, 'NOT_READY');
    assert.equal(incompatible.status, 'NOT_READY');
    assert.ok(
      incompatible.reasons.includes('ARTIFACT_AGGREGATION_MODE_INCOMPATIBLE'),
    );
    assert.equal(incompatible.artifact.aggregationModeCompatible, false);
    assert.equal(incompatible.artifact.featureAggregationMode, 'weighted-sum');

    const ready = evaluateRecommendationFeatureReadiness({
      compiledContract: activated,
      domain: 'material',
      user: {
        features: [['interest:arduino', 1]],
        resolutionStatus: 'FULLY_MAPPED',
      },
      itemRows: [completeMaterialItem('m1')],
      artifact: {
        ...compatibleMaterialArtifact(),
        feature_aggregation_mode: 'weighted-mean',
      },
    });
    assert.equal(ready.coverageStatus, 'READY');
    assert.equal(ready.status, 'READY');
    assert.equal(ready.artifact.aggregationModeCompatible, true);
    assert.equal(ready.artifact.featureAggregationMode, 'weighted-mean');
    assert.equal(ready.artifact.expectedAggregationMode, 'weighted-mean');
    assert.equal(
      ready.reasons.includes('ARTIFACT_AGGREGATION_MODE_MISSING'),
      false,
    );
    assert.equal(
      ready.reasons.includes('FEATURE_CONTRACT_AGGREGATION_NOT_SELECTED'),
      false,
    );

    // Current v3 contract (selectedMode null): artifact mode cannot unlock readiness.
    const currentContract = evaluateRecommendationFeatureReadiness({
      compiledContract: compiled,
      domain: 'material',
      user: {
        features: [['interest:arduino', 1]],
        resolutionStatus: 'FULLY_MAPPED',
      },
      itemRows: [completeMaterialItem('m1')],
      artifact: {
        ...compatibleMaterialArtifact(),
        feature_aggregation_mode: 'weighted-mean',
      },
    });
    assert.equal(currentContract.coverageStatus, 'READY');
    assert.equal(currentContract.status, 'NOT_READY');
    assert.equal(currentContract.artifact.aggregationModeCompatible, false);
    assert.equal(currentContract.artifact.expectedAggregationMode, null);
    assert.ok(
      currentContract.reasons.includes('FEATURE_CONTRACT_AGGREGATION_NOT_SELECTED'),
    );
    assert.equal(
      currentContract.reasons.includes('ARTIFACT_AGGREGATION_MODE_MISSING'),
      false,
    );
    assert.equal(
      currentContract.reasons.includes('ARTIFACT_AGGREGATION_MODE_INCOMPATIBLE'),
      false,
    );
  });

  it('counts every valid duplicate occurrence while unique/cardinality stay set-based', () => {
    const artifact = compatibleMaterialArtifact();
    const resolvedDup = evaluateRecommendationFeatureReadiness({
      compiledContract: compiled,
      domain: 'material',
      user: {
        features: [['interest:arduino', 1]],
        resolutionStatus: 'FULLY_MAPPED',
      },
      itemRows: [
        {
          candidateKey: 'm1',
          features: [
            ['material-family:electronics', 1],
            ['material-family:electronics', 1],
            ['material-condition:new', 1],
            ['material-is-free:true', 1],
            ['material-pickup-allowed:true', 1],
            ['material-delivery-allowed:false', 1],
          ],
        },
      ],
      artifact,
    });
    assert.equal(resolvedDup.items.constructedOccurrenceCount, 6);
    assert.equal(resolvedDup.items.artifactResolvedOccurrenceCount, 6);
    assert.equal(resolvedDup.items.constructedUniqueCount, 5);
    assert.equal(resolvedDup.groups['material.family']?.constructedUnique, 1);

    const missingDup = evaluateRecommendationFeatureReadiness({
      compiledContract: compiled,
      domain: 'material',
      user: {
        features: [['interest:arduino', 1]],
        resolutionStatus: 'FULLY_MAPPED',
      },
      itemRows: [
        {
          candidateKey: 'm1',
          features: [
            ['material-family:electronics', 1],
            ['material-family:electronics', 1],
            ['material-condition:new', 1],
            ['material-is-free:true', 1],
            ['material-pickup-allowed:true', 1],
            ['material-delivery-allowed:false', 1],
          ],
        },
      ],
      artifact: {
        ...artifact,
        itemFeatureNames: MATERIAL_CLOSED,
      },
    });
    assert.equal(missingDup.items.missingCriticalOccurrenceCount, 2);
    assert.equal(missingDup.items.missingCriticalUniqueCount, 1);

    const optionalDup = evaluateRecommendationFeatureReadiness({
      compiledContract: compiled,
      domain: 'material',
      user: {
        features: [['interest:arduino', 1]],
        resolutionStatus: 'FULLY_MAPPED',
      },
      itemRows: [
        {
          candidateKey: 'm1',
          features: [
            ...completeMaterialItem('m1').features,
            ['material-form:arduino-uno', 1],
            ['material-form:arduino-uno', 1],
          ],
        },
      ],
      artifact,
    });
    assert.equal(optionalDup.items.missingOptionalOccurrenceCount, 2);
    assert.equal(optionalDup.items.missingOptionalUniqueCount, 1);

    const across = evaluateRecommendationFeatureReadiness({
      compiledContract: compiled,
      domain: 'material',
      user: {
        features: [['interest:arduino', 1]],
        resolutionStatus: 'FULLY_MAPPED',
      },
      itemRows: [
        completeMaterialItem('a'),
        completeMaterialItem('b'),
      ],
      artifact: {
        ...artifact,
        itemFeatureNames: MATERIAL_CLOSED,
      },
    });
    assert.equal(across.items.missingCriticalOccurrenceCount, 2);
    assert.equal(across.items.missingCriticalUniqueCount, 1);
    assert.equal(across.items.affectedCandidateCount, 2);
  });
});
