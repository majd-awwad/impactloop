import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  TAXONOMY_ALIAS_SOURCE,
  resolveLearnerInterests,
  type LearnerInterestRegistryAlias,
  type LearnerInterestRegistryConcept,
} from './learner-interest-resolver.js';
import { normalizeTaxonomyAlias } from './taxonomy-normalization.js';

let sequence = 0;

const registryAlias = (
  value: string,
  source: string = TAXONOMY_ALIAS_SOURCE.REVIEWED_EXPLICIT,
  language: 'EN' | 'AR' = 'EN',
  isActive = true,
): LearnerInterestRegistryAlias => ({
  id: `alias-${sequence += 1}`,
  alias: value,
  normalizedAlias: normalizeTaxonomyAlias(value),
  language,
  aliasType: source === TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_EN
    ? 'CANONICAL'
    : language === 'AR'
      ? 'TRANSLATION'
      : 'EXPLICIT',
  source,
  isActive,
});

const registryConcept = (
  overrides: Partial<LearnerInterestRegistryConcept> &
    Pick<LearnerInterestRegistryConcept, 'canonicalKey'>,
): LearnerInterestRegistryConcept => ({
  id: `concept-${sequence += 1}`,
  conceptType: 'INTEREST',
  status: 'ACTIVE',
  labelEn: overrides.canonicalKey,
  labelAr: overrides.canonicalKey,
  aliases: [],
  learnerInterests: [],
  ...overrides,
});

const arduinoRegistry = (): LearnerInterestRegistryConcept[] => [
  registryConcept({
    canonicalKey: 'interest:arduino',
    labelEn: 'Arduino',
    labelAr: 'أردوينو',
    aliases: [
      registryAlias('Arduino board'),
      registryAlias(
        'Arduino',
        TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_EN,
      ),
      registryAlias(
        'أردوينو',
        TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_AR,
        'AR',
      ),
    ],
    learnerInterests: [{ id: 'legacy-arduino', learnerInterestKey: 'arduino' }],
  }),
  registryConcept({
    canonicalKey: 'component:arduino-board',
    conceptType: 'COMPONENT',
    labelEn: 'Arduino Board',
    labelAr: 'لوحة أردوينو',
    aliases: [
      registryAlias('Arduino'),
      registryAlias(
        'لوحة أردوينو',
        TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_AR,
        'AR',
      ),
    ],
  }),
  registryConcept({
    canonicalKey: 'material-form:arduino-uno',
    conceptType: 'MATERIAL_FORM',
    labelEn: 'Arduino Uno',
    labelAr: 'أردوينو أونو',
    aliases: [
      registryAlias(
        'Arduino Uno',
        TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_EN,
      ),
    ],
  }),
];

describe('RP-01.3 canonical learner-interest resolver', () => {
  test('resolves canonical and unique legacy identity without depending on database IDs', () => {
    const first = arduinoRegistry();
    const second = first.map((concept, index) => ({
      ...concept,
      id: `replacement-${index}`,
    }));

    const expected = ['interest:arduino'];
    assert.deepEqual(
      resolveLearnerInterests(['interest:arduino', 'arduino'], first).canonicalKeys,
      expected,
    );
    assert.deepEqual(
      resolveLearnerInterests(['interest:arduino', 'arduino'], second).canonicalKeys,
      expected,
    );
    assert.deepEqual(
      resolveLearnerInterests(['interest:arduino', 'arduino'], first).mapped.map(
        ({ matchSource }) => matchSource,
      ),
      ['CANONICAL_KEY', 'LEGACY_BARE_KEY'],
    );
  });

  test('known inactive and wrong-type canonical keys do not fall through', () => {
    const inactive = registryConcept({
      canonicalKey: 'interest:retired-canonical',
      status: 'INACTIVE',
    });
    const wrongType = registryConcept({
      canonicalKey: 'component:wrong-canonical',
      conceptType: 'COMPONENT',
    });
    const fallback = registryConcept({
      canonicalKey: 'interest:fallback-target',
      aliases: [
        registryAlias('interest:retired-canonical'),
        registryAlias('component:wrong-canonical'),
      ],
    });

    const result = resolveLearnerInterests(
      ['interest:retired-canonical', 'component:wrong-canonical'],
      [fallback, wrongType, inactive],
    );

    assert.deepEqual(result.canonicalKeys, []);
    assert.deepEqual(
      result.unmapped.map(({ reason }) => reason),
      ['INACTIVE_TARGET', 'WRONG_CONCEPT_TYPE'],
    );
  });

  test('unknown canonical-shaped input falls through to a reviewed explicit alias', () => {
    const registry = [
      registryConcept({
        canonicalKey: 'interest:reviewed-crosswalk-target',
        aliases: [registryAlias('interest:legacy-crosswalk')],
      }),
    ];

    const result = resolveLearnerInterests(
      ['interest:legacy-crosswalk'],
      registry,
    );

    assert.equal(result.status, 'FULLY_MAPPED');
    assert.deepEqual(result.canonicalKeys, ['interest:reviewed-crosswalk-target']);
    assert.equal(result.mapped[0]!.matchSource, 'REVIEWED_ALIAS');
  });

  test('unknown canonical-shaped input remains unknown after all stages miss', () => {
    const result = resolveLearnerInterests(
      ['interest:no-reviewed-mapping'],
      arduinoRegistry(),
    );

    assert.equal(result.status, 'UNMAPPED_INTERESTS');
    assert.deepEqual(result.unmapped, [
      {
        rawInput: 'interest:no-reviewed-mapping',
        normalizedInput: 'interest no-reviewed-mapping',
        reason: 'UNKNOWN_INTEREST',
      },
    ]);
  });

  test('uses persisted explicit and label provenance for English and Arabic input', () => {
    const result = resolveLearnerInterests(
      ['  ARDUINO   BOARD ', ' Arduino ', '  أَرْدُوِينُو  '],
      arduinoRegistry(),
    );

    assert.equal(result.status, 'FULLY_MAPPED');
    assert.deepEqual(result.canonicalKeys, ['interest:arduino']);
    assert.deepEqual(
      result.mapped.map(({ matchSource }) => matchSource),
      ['REVIEWED_ALIAS', 'REVIEWED_LABEL', 'REVIEWED_LABEL'],
    );
    assert.equal(result.mapped[2]!.normalizedInput, 'اردوينو');
  });

  test('does not infer substrings and diagnoses current wrong-type reviewed text', () => {
    const result = resolveLearnerInterests(
      ['Arduino projects for beginners', 'Arduino Uno', 'لوحة أردوينو'],
      arduinoRegistry(),
    );

    assert.deepEqual(
      result.unmapped.map(({ reason }) => reason),
      ['UNKNOWN_INTEREST', 'WRONG_CONCEPT_TYPE', 'WRONG_CONCEPT_TYPE'],
    );
    assert.equal(result.status, 'UNMAPPED_INTERESTS');
  });

  test('custom interests use only complete explicit aliases, never label provenance', () => {
    const registry = arduinoRegistry();
    const result = resolveLearnerInterests(
      ['custom:arduino_board', 'custom:Arduino', 'custom:my_future_idea'],
      registry,
    );

    assert.deepEqual(result.canonicalKeys, ['interest:arduino']);
    assert.equal(result.mapped[0]!.matchSource, 'REVIEWED_ALIAS');
    assert.deepEqual(
      result.unmapped.map(({ reason }) => reason),
      ['WRONG_CONCEPT_TYPE', 'CUSTOM_UNMAPPED'],
    );
    assert.ok(!result.canonicalKeys.some((key) => key.startsWith('custom:')));
  });

  test('reports inactive and wrong-type targets without falling through', () => {
    const inactive = registryConcept({
      canonicalKey: 'interest:inactive-topic',
      status: 'INACTIVE',
      aliases: [registryAlias('retired topic')],
      learnerInterests: [{ id: 'legacy-inactive', learnerInterestKey: 'inactive_topic' }],
    });
    const wrongType = registryConcept({
      canonicalKey: 'project-topic:wrong-topic',
      conceptType: 'PROJECT_TOPIC',
      aliases: [registryAlias('wrong topic')],
      learnerInterests: [{ id: 'legacy-wrong', learnerInterestKey: 'wrong_topic' }],
    });
    const result = resolveLearnerInterests(
      ['interest:inactive-topic', 'inactive_topic', 'retired topic', 'wrong_topic', 'wrong topic'],
      [inactive, wrongType],
    );

    assert.deepEqual(
      result.unmapped.map(({ reason }) => reason),
      [
        'INACTIVE_TARGET',
        'INACTIVE_TARGET',
        'INACTIVE_TARGET',
        'WRONG_CONCEPT_TYPE',
        'WRONG_CONCEPT_TYPE',
      ],
    );
  });

  test('generalizes ambiguity across explicit aliases, labels, and defensive legacy input', () => {
    const explicitA = registryConcept({
      canonicalKey: 'interest:ambiguous-a',
      aliases: [registryAlias('shared explicit')],
      learnerInterests: [{ id: 'legacy-a', learnerInterestKey: 'shared_legacy' }],
    });
    const explicitB = registryConcept({
      canonicalKey: 'interest:ambiguous-b',
      aliases: [registryAlias('shared explicit')],
      learnerInterests: [{ id: 'legacy-b', learnerInterestKey: 'shared_legacy' }],
    });
    const labelA = registryConcept({
      canonicalKey: 'interest:label-a',
      aliases: [registryAlias('shared label', TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_EN)],
    });
    const labelB = registryConcept({
      canonicalKey: 'interest:label-b',
      aliases: [registryAlias('shared label', TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_EN)],
    });
    const result = resolveLearnerInterests(
      ['shared explicit', 'shared label', 'shared_legacy'],
      [explicitB, labelB, explicitA, labelA],
    );

    assert.deepEqual(
      result.unmapped.map(({ reason }) => reason),
      ['AMBIGUOUS_MAPPING', 'AMBIGUOUS_MAPPING', 'AMBIGUOUS_MAPPING'],
    );
  });

  test('deduplicates duplicate rows by canonical identity before ambiguity checks', () => {
    const concept = registryConcept({
      canonicalKey: 'interest:duplicate-alias',
      aliases: [registryAlias('duplicate text'), registryAlias('duplicate text')],
    });
    const result = resolveLearnerInterests(['duplicate text'], [concept]);

    assert.equal(result.status, 'FULLY_MAPPED');
    assert.deepEqual(result.canonicalKeys, ['interest:duplicate-alias']);
  });

  test('distinguishes blank-only profiles from meaningful malformed input', () => {
    const registry = arduinoRegistry();
    const missing = resolveLearnerInterests(undefined, registry);
    const empty = resolveLearnerInterests([], registry);
    const blank = resolveLearnerInterests(['   '], registry);
    const malformedCustom = resolveLearnerInterests(['custom:'], registry);
    const punctuation = resolveLearnerInterests(['###'], registry);
    const partial = resolveLearnerInterests(['arduino', '###'], registry);

    assert.equal(missing.status, 'NO_INTERESTS');
    assert.equal(empty.status, 'NO_INTERESTS');
    assert.equal(blank.status, 'NO_INTERESTS');
    assert.equal(blank.meaningfulInputCount, 0);
    assert.equal(blank.unmapped[0]!.reason, 'INVALID_INPUT');
    assert.equal(malformedCustom.status, 'UNMAPPED_INTERESTS');
    assert.equal(malformedCustom.unmapped[0]!.reason, 'INVALID_INPUT');
    assert.equal(punctuation.status, 'UNMAPPED_INTERESTS');
    assert.equal(punctuation.unmapped[0]!.reason, 'INVALID_INPUT');
    assert.equal(partial.status, 'PARTIALLY_MAPPED');
  });

  test('retains per-input diagnostics while emitting canonical keys once in first-occurrence order', () => {
    const robotics = registryConcept({
      canonicalKey: 'interest:robotics',
      aliases: [registryAlias('Robots')],
      learnerInterests: [{ id: 'legacy-robotics', learnerInterestKey: 'robotics' }],
    });
    const result = resolveLearnerInterests(
      ['Robots', 'arduino', 'Arduino board', 'أردوينو', 'robotics'],
      [...arduinoRegistry(), robotics],
    );

    assert.equal(result.mapped.length, 5);
    assert.deepEqual(result.canonicalKeys, ['interest:robotics', 'interest:arduino']);
    assert.equal(result.status, 'FULLY_MAPPED');
  });

  test('ignores inactive alias rows and aliases with unknown provenance', () => {
    const concept = registryConcept({
      canonicalKey: 'interest:controlled',
      aliases: [
        registryAlias('inactive alias', TAXONOMY_ALIAS_SOURCE.REVIEWED_EXPLICIT, 'EN', false),
        registryAlias('unknown source', 'unreviewed-source'),
      ],
    });
    const result = resolveLearnerInterests(
      ['inactive alias', 'unknown source'],
      [concept],
    );

    assert.deepEqual(
      result.unmapped.map(({ reason }) => reason),
      ['UNKNOWN_INTEREST', 'UNKNOWN_INTEREST'],
    );
  });
});
