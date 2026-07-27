import assert from 'node:assert/strict';
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
  CanonicalRuntimeFeatureBuildError,
  compileCanonicalRuntimeFeatureAuthority,
  type CanonicalConceptAssociationInput,
  type CanonicalRuntimeFeatureAuthority,
} from './canonical-runtime-item-features.js';
import { loadRecommendationFeatureTokenContract } from './recommendation-feature-token-contract.js';

let authority: CanonicalRuntimeFeatureAuthority;

const association = (
  canonicalKey: string,
  conceptType: CanonicalConceptAssociationInput['conceptType'],
  overrides: Partial<CanonicalConceptAssociationInput> = {},
): CanonicalConceptAssociationInput => ({
  canonicalKey,
  conceptType,
  status: 'ACTIVE',
  ...overrides,
});

const material = (
  overrides: Partial<
    Parameters<typeof buildCanonicalMaterialRuntimeFeatures>[0]
  > = {},
) =>
  buildCanonicalMaterialRuntimeFeatures({
    authority,
    concepts: [
      association('material-family:electronics', 'MATERIAL_FAMILY'),
      association('material-form:arduino-uno', 'MATERIAL_FORM'),
    ],
    condition: 'GOOD',
    isFree: true,
    pickupAllowed: true,
    deliveryAllowed: false,
    ...overrides,
  });

const project = (
  overrides: Partial<
    Parameters<typeof buildCanonicalProjectRuntimeFeatures>[0]
  > = {},
) =>
  buildCanonicalProjectRuntimeFeatures({
    authority,
    topicConcepts: [association('project-topic:robotics', 'PROJECT_TOPIC')],
    componentConcepts: [
      {
        ...association('component:dc-gear-motors', 'COMPONENT'),
        isRequired: true,
      },
    ],
    difficulty: 'BEGINNER',
    ...overrides,
  });

before(async () => {
  authority = compileCanonicalRuntimeFeatureAuthority(
    await loadRecommendationFeatureTokenContract(),
  );
});

describe('canonical runtime user-feature preservation', () => {
  test('keeps canonical interests interest-only, deduplicated, and ASCII-sorted', () => {
    const resolution: LearnerInterestResolution = {
      status: 'FULLY_MAPPED',
      inputCount: 3,
      meaningfulInputCount: 3,
      uniqueInputCount: 2,
      mappedInputCount: 3,
      unmappedInputCount: 0,
      canonicalKeys: [
        'interest:robotics',
        'interest:arduino',
        'interest:robotics',
      ],
      mapped: [],
      unmapped: [],
    };
    const built = buildCanonicalShadowUserFeatures({ resolution });
    assert.deepEqual(built.features, [
      ['interest:arduino', 1],
      ['interest:robotics', 1],
    ]);
    assert.ok(
      built.features.every(
        ([token]) =>
          token.startsWith('interest:') &&
          !token.startsWith('material-family:') &&
          !token.startsWith('material-form:'),
      ),
    );
  });
});

describe('canonical material runtime features', () => {
  test('emits exact v3 taxonomy, enum, and literal boolean tokens', () => {
    assert.deepEqual(material().features, [
      ['material-condition:good', 1],
      ['material-delivery-allowed:false', 1],
      ['material-family:electronics', 1],
      ['material-form:arduino-uno', 1],
      ['material-is-free:true', 1],
      ['material-pickup-allowed:true', 1],
    ]);
  });

  test('maps every material condition through the contract authority', () => {
    const expected: Record<MaterialCondition, string> = {
      NEW: 'material-condition:new',
      LIKE_NEW: 'material-condition:like-new',
      GOOD: 'material-condition:good',
      USED: 'material-condition:used',
      NEEDS_REPAIR: 'material-condition:needs-repair',
    };
    for (const [condition, token] of Object.entries(expected)) {
      assert.ok(material({ condition: condition as MaterialCondition }).features.some(
        ([name]) => name === token,
      ));
    }
  });

  test('uses set semantics, rejects conflicting weights, and sorts by ASCII', () => {
    const duplicate = association(
      'material-family:electronics',
      'MATERIAL_FAMILY',
    );
    const result = material({
      concepts: [
        association('material-form:arduino-uno', 'MATERIAL_FORM'),
        duplicate,
        duplicate,
      ],
    });
    assert.equal(
      result.features.filter(([token]) => token === duplicate.canonicalKey).length,
      1,
    );
    assert.deepEqual(
      result.features.map(([token]) => token),
      [...result.features.map(([token]) => token)].sort(),
    );
    assert.throws(() =>
      material({
        concepts: [duplicate, { ...duplicate, weight: 2 }],
      }),
    );
  });

  test('fails readiness without a family while forms remain optional', () => {
    const missing = material({ concepts: [] });
    assert.equal(missing.scoringEligible, false);
    assert.deepEqual(missing.missingRequiredGroupIds, ['material.family']);
    const noForms = material({
      concepts: [association('material-family:electronics', 'MATERIAL_FAMILY')],
    });
    assert.equal(noForms.scoringEligible, true);
  });

  test('excludes inactive and wrong-kind associations and rejects malformed keys', () => {
    const result = material({
      concepts: [
        association('material-family:electronics', 'MATERIAL_FAMILY'),
        association('material-form:arduino-uno', 'MATERIAL_FORM', {
          status: 'INACTIVE',
        }),
        association('project-topic:robotics', 'PROJECT_TOPIC'),
      ],
    });
    assert.deepEqual(
      result.features.filter(([token]) => token.includes('arduino-uno')),
      [],
    );
    assert.throws(
      () =>
        material({
          concepts: [
            association(
              'material-family:material-family:electronics',
              'MATERIAL_FAMILY',
            ),
          ],
        }),
      CanonicalRuntimeFeatureBuildError,
    );
    assert.throws(() =>
      material({ condition: 'BROKEN' as MaterialCondition }),
    );
  });
});

describe('canonical project runtime features', () => {
  test('emits exact topic, component, and difficulty tokens without wrappers', () => {
    const result = project();
    assert.deepEqual(result.features, [
      ['component:dc-gear-motors', 1],
      ['project-difficulty:beginner', 1],
      ['project-topic:robotics', 1],
    ]);
    assert.ok(
      result.features.every(
        ([token]) =>
          !token.startsWith('category:') &&
          !token.startsWith('concept:') &&
          !token.startsWith('component:component:'),
      ),
    );
  });

  test('maps every project difficulty through the contract authority', () => {
    const expected: Record<ProjectDifficulty, string> = {
      BEGINNER: 'project-difficulty:beginner',
      INTERMEDIATE: 'project-difficulty:intermediate',
      ADVANCED: 'project-difficulty:advanced',
    };
    for (const [difficulty, token] of Object.entries(expected)) {
      assert.ok(project({ difficulty: difficulty as ProjectDifficulty }).features.some(
        ([name]) => name === token,
      ));
    }
  });

  test('keeps only required active components and accepts no components', () => {
    const component = association('component:dc-gear-motors', 'COMPONENT');
    const result = project({
      componentConcepts: [
        { ...component, isRequired: false },
        { ...component, isRequired: true, status: 'INACTIVE' },
      ],
    });
    assert.equal(result.scoringEligible, true);
    assert.ok(!result.features.some(([token]) => token.startsWith('component:')));
  });

  test('deduplicates, sorts, rejects weight conflicts, and fails without a topic', () => {
    const topic = association('project-topic:robotics', 'PROJECT_TOPIC');
    const deduplicated = project({ topicConcepts: [topic, topic] });
    assert.equal(
      deduplicated.features.filter(([token]) => token === topic.canonicalKey)
        .length,
      1,
    );
    assert.deepEqual(
      deduplicated.features.map(([token]) => token),
      [...deduplicated.features.map(([token]) => token)].sort(),
    );
    assert.throws(() =>
      project({ topicConcepts: [topic, { ...topic, weight: 2 }] }),
    );
    const missing = project({
      topicConcepts: [association('material-family:electronics', 'MATERIAL_FAMILY')],
    });
    assert.equal(missing.scoringEligible, false);
    assert.deepEqual(missing.missingRequiredGroupIds, ['project.topic']);
    assert.throws(() =>
      project({ difficulty: 'EXPERT' as ProjectDifficulty }),
    );
  });
});
