import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  TAXONOMY_ALIAS_SOURCE,
  resolveLearnerInterests,
  type LearnerInterestRegistryAlias,
  type LearnerInterestRegistryConcept,
  type LearnerInterestResolution,
} from '../taxonomy/learner-interest-resolver.js';
import { normalizeTaxonomyAlias } from '../taxonomy/taxonomy-normalization.js';
import {
  asciiCompare,
  buildCanonicalShadowUserFeatures,
  computeArtifactUserFeatureOverlap,
  resolveCanonicalShadowUserFeatures,
} from './canonical-shadow-user-features.js';
import {
  loadRecommendationFeatureTokenContract,
  validateCanonicalFeatureToken,
} from './recommendation-feature-token-contract.js';

let sequence = 0;

const registryAlias = (
  value: string,
  source: string = TAXONOMY_ALIAS_SOURCE.REVIEWED_EXPLICIT,
  language: 'EN' | 'AR' = 'EN',
): LearnerInterestRegistryAlias => ({
  id: `alias-${(sequence += 1)}`,
  alias: value,
  normalizedAlias: normalizeTaxonomyAlias(value),
  language,
  aliasType:
    source === TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_EN
      ? 'CANONICAL'
      : language === 'AR'
        ? 'TRANSLATION'
        : 'EXPLICIT',
  source,
  isActive: true,
});

const registryConcept = (
  overrides: Partial<LearnerInterestRegistryConcept> &
    Pick<LearnerInterestRegistryConcept, 'canonicalKey'>,
): LearnerInterestRegistryConcept => ({
  id: `concept-${(sequence += 1)}`,
  conceptType: 'INTEREST',
  status: 'ACTIVE',
  labelEn: overrides.canonicalKey,
  labelAr: overrides.canonicalKey,
  aliases: [],
  learnerInterests: [],
  ...overrides,
});

const dualInterestRegistry = (): LearnerInterestRegistryConcept[] => [
  registryConcept({
    canonicalKey: 'interest:arduino',
    labelEn: 'Arduino',
    labelAr: 'أردوينو',
    aliases: [
      registryAlias('Arduino board'),
      registryAlias('Arduino', TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_EN),
      registryAlias('أردوينو', TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_AR, 'AR'),
    ],
    learnerInterests: [{ id: 'legacy-arduino', learnerInterestKey: 'arduino' }],
  }),
  registryConcept({
    canonicalKey: 'interest:robotics',
    labelEn: 'Robotics',
    labelAr: 'الروبوتات',
    aliases: [
      registryAlias('robot'),
      registryAlias('Robotics', TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_EN),
      registryAlias('الروبوتات', TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_AR, 'AR'),
    ],
    learnerInterests: [
      { id: 'legacy-robotics', learnerInterestKey: 'robotics' },
    ],
  }),
];

describe('RP-01.4 canonical shadow user features', () => {
  test('FULLY_MAPPED canonical keys become exact weight-1.0 features', () => {
    const resolution = resolveLearnerInterests(
      ['interest:arduino', 'interest:robotics'],
      dualInterestRegistry(),
    );
    assert.equal(resolution.status, 'FULLY_MAPPED');
    const built = buildCanonicalShadowUserFeatures({ resolution });
    assert.equal(built.resolutionStatus, 'FULLY_MAPPED');
    assert.deepEqual(built.features, [
      ['interest:arduino', 1],
      ['interest:robotics', 1],
    ]);
    assert.equal(built.canonicalFeatureCount, 2);
    assert.equal(built.hasDeclaredInterestFeatures, true);
    assert.equal(built.candidateIndependent, true);
  });

  test('PARTIALLY_MAPPED uses mapped keys only', () => {
    const resolution = resolveLearnerInterests(
      ['interest:arduino', 'totally-unknown-interest'],
      dualInterestRegistry(),
    );
    assert.equal(resolution.status, 'PARTIALLY_MAPPED');
    const built = buildCanonicalShadowUserFeatures({ resolution });
    assert.deepEqual(built.features, [['interest:arduino', 1]]);
    assert.equal(built.mappedInputCount, 1);
    assert.ok((built.unmappedInputCount ?? 0) >= 1);
    assert.ok((built.unmappedReasonCounts.UNKNOWN_INTEREST ?? 0) >= 1);
  });

  test('NO_INTERESTS and UNMAPPED_INTERESTS produce zero features with distinct status', () => {
    const empty = buildCanonicalShadowUserFeatures({
      resolution: resolveLearnerInterests([], dualInterestRegistry()),
    });
    assert.equal(empty.resolutionStatus, 'NO_INTERESTS');
    assert.deepEqual(empty.features, []);
    assert.equal(empty.hasDeclaredInterestFeatures, false);

    const unmapped = buildCanonicalShadowUserFeatures({
      resolution: resolveLearnerInterests(
        ['totally-unknown-interest'],
        dualInterestRegistry(),
      ),
    });
    assert.equal(unmapped.resolutionStatus, 'UNMAPPED_INTERESTS');
    assert.deepEqual(unmapped.features, []);
    assert.notEqual(unmapped.resolutionStatus, empty.resolutionStatus);
  });

  test('duplicate aliases and inputs produce one token without doubled interest prefix', () => {
    const resolution = resolveLearnerInterests(
      [
        'arduino',
        'Arduino board',
        'أردوينو',
        'interest:arduino',
        'arduino',
      ],
      dualInterestRegistry(),
    );
    const built = buildCanonicalShadowUserFeatures({ resolution });
    assert.deepEqual(built.features, [['interest:arduino', 1]]);
    assert.ok(built.features.every(([token]) => !token.startsWith('interest:interest:')));
  });

  test('asciiCompare sorts deterministically independent of input and registry order', () => {
    const registry = dualInterestRegistry();
    const forward = buildCanonicalShadowUserFeatures({
      resolution: resolveLearnerInterests(
        ['interest:robotics', 'interest:arduino'],
        registry,
      ),
    });
    const reversedInputs = buildCanonicalShadowUserFeatures({
      resolution: resolveLearnerInterests(
        ['interest:arduino', 'interest:robotics'],
        registry,
      ),
    });
    const reversedRegistry = buildCanonicalShadowUserFeatures({
      resolution: resolveLearnerInterests(
        ['interest:robotics', 'interest:arduino'],
        [...registry].reverse(),
      ),
    });
    const aliasPath = buildCanonicalShadowUserFeatures({
      resolution: resolveLearnerInterests(
        ['الروبوتات', 'Arduino board'],
        registry,
      ),
    });

    const expected = [
      ['interest:arduino', 1],
      ['interest:robotics', 1],
    ];
    assert.deepEqual(forward.features, expected);
    assert.deepEqual(reversedInputs.features, expected);
    assert.deepEqual(reversedRegistry.features, expected);
    assert.deepEqual(aliasPath.features, expected);
    assert.equal(asciiCompare('interest:arduino', 'interest:robotics'), -1);
    assert.equal(asciiCompare('interest:robotics', 'interest:arduino'), 1);
    assert.equal(asciiCompare('interest:arduino', 'interest:arduino'), 0);
  });

  test('no labels, hashes, DB IDs, or custom values escape as features', () => {
    const resolution = resolveLearnerInterests(
      ['custom:unmapped-thing', 'Arduino'],
      dualInterestRegistry(),
    );
    const built = buildCanonicalShadowUserFeatures({ resolution });
    for (const [token] of built.features) {
      assert.match(token, /^interest:[a-z0-9][a-z0-9./-]*$/);
      assert.doesNotMatch(token, /^interest:[0-9a-f]{64}$/);
      assert.doesNotMatch(token, /custom:/);
      assert.doesNotMatch(token, /Arduino|أردوينو|concept-/);
    }
  });

  test('contract validates exact declared-interest tokens from the builder', async () => {
    const contract = await loadRecommendationFeatureTokenContract();
    const built = buildCanonicalShadowUserFeatures({
      resolution: resolveLearnerInterests(
        ['interest:arduino', 'interest:robotics'],
        dualInterestRegistry(),
      ),
    });
    for (const [token, weight] of built.features) {
      assert.doesNotThrow(() =>
        validateCanonicalFeatureToken(contract, {
          token,
          groupId: 'user.declared-interest',
          side: 'user',
          domain: 'material',
          weight,
        }),
      );
      assert.doesNotThrow(() =>
        validateCanonicalFeatureToken(contract, {
          token,
          groupId: 'user.declared-interest',
          side: 'user',
          domain: 'project',
          weight,
        }),
      );
    }
  });

  test('artifact overlap statuses are exact and privacy-safe', () => {
    const none = computeArtifactUserFeatureOverlap({
      runtimeFeatures: [],
      artifactUserFeatureNames: ['interest:arduino'],
    });
    assert.equal(none.artifactUserFeatureOverlapStatus, 'NO_RUNTIME_FEATURES');

    const zero = computeArtifactUserFeatureOverlap({
      runtimeFeatures: [
        ['interest:arduino', 1],
        ['interest:robotics', 1],
      ],
      artifactUserFeatureNames: [
        'interest:010c482045749b43b9467ca651fa63788bd9b244e9059becfb35096bcddbccb8',
      ],
    });
    assert.equal(zero.artifactUserFeatureOverlapStatus, 'ZERO_OVERLAP');
    assert.equal(zero.canonicalUserFeatureCount, 2);
    assert.equal(zero.artifactMatchedUserFeatureCount, 0);
    assert.equal(zero.artifactMissingUserFeatureCount, 2);

    const partial = computeArtifactUserFeatureOverlap({
      runtimeFeatures: [
        ['interest:arduino', 1],
        ['interest:robotics', 1],
      ],
      artifactUserFeatureNames: ['interest:arduino', 'interest:other'],
    });
    assert.equal(partial.artifactUserFeatureOverlapStatus, 'PARTIAL_OVERLAP');
    assert.equal(partial.artifactMatchedUserFeatureCount, 1);
    assert.equal(partial.artifactMissingUserFeatureCount, 1);

    const full = computeArtifactUserFeatureOverlap({
      runtimeFeatures: [
        ['interest:arduino', 1],
        ['interest:robotics', 1],
      ],
      artifactUserFeatureNames: ['interest:arduino', 'interest:robotics'],
    });
    assert.equal(full.artifactUserFeatureOverlapStatus, 'FULL_OVERLAP');
    assert.equal(full.artifactMatchedUserFeatureCount, 2);
    assert.equal(full.artifactMissingUserFeatureCount, 0);
  });

  test('resolveCanonicalShadowUserFeatures loads registry once and builds features', async () => {
    let loads = 0;
    const result = await resolveCanonicalShadowUserFeatures({
      storedInterests: ['arduino', 'robotics'],
      loadRegistry: async () => {
        loads += 1;
        return dualInterestRegistry();
      },
    });
    assert.equal(loads, 1);
    assert.equal(result.resolutionStatus, 'FULLY_MAPPED');
    assert.deepEqual(result.features, [
      ['interest:arduino', 1],
      ['interest:robotics', 1],
    ]);
  });

  test('empty storedInterests short-circuits without loading the registry', async () => {
    let loads = 0;
    const throwingLoader = async () => {
      loads += 1;
      throw new Error('taxonomy_registry_should_not_load');
    };

    for (const storedInterests of [null, undefined, [] as string[]]) {
      loads = 0;
      const result = await resolveCanonicalShadowUserFeatures({
        storedInterests,
        loadRegistry: throwingLoader,
      });
      assert.equal(loads, 0);
      assert.equal(result.resolutionStatus, 'NO_INTERESTS');
      assert.deepEqual(result.features, []);
      assert.equal(result.canonicalFeatureCount, 0);
    }
  });

  test('blank or unresolved interests still load the registry', async () => {
    let loads = 0;
    const blank = await resolveCanonicalShadowUserFeatures({
      storedInterests: ['   '],
      loadRegistry: async () => {
        loads += 1;
        return dualInterestRegistry();
      },
    });
    assert.equal(loads, 1);
    // Blank-only inputs still resolve to NO_INTERESTS, but must not skip the loader.
    assert.equal(blank.resolutionStatus, 'NO_INTERESTS');
    assert.deepEqual(blank.features, []);

    loads = 0;
    const unknown = await resolveCanonicalShadowUserFeatures({
      storedInterests: ['totally-unknown-interest'],
      loadRegistry: async () => {
        loads += 1;
        return dualInterestRegistry();
      },
    });
    assert.equal(loads, 1);
    assert.equal(unknown.resolutionStatus, 'UNMAPPED_INTERESTS');
  });

  test('candidate independence is enforced by builder signature', () => {
    const resolution: LearnerInterestResolution = resolveLearnerInterests(
      ['interest:arduino'],
      dualInterestRegistry(),
    );
    const withEmptyPool = buildCanonicalShadowUserFeatures({ resolution });
    const withPopulatedPool = buildCanonicalShadowUserFeatures({ resolution });
    assert.deepEqual(withEmptyPool.features, withPopulatedPool.features);
    assert.equal(
      buildCanonicalShadowUserFeatures.length,
      1,
      'builder must accept a single options object without candidates',
    );
  });
});
