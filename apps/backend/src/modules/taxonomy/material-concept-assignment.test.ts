import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  TAXONOMY_CONCEPT_SEEDS,
  type TaxonomyConceptSeed,
} from './taxonomy-foundation.data.js';
import { TAXONOMY_ALIAS_SOURCE } from './learner-interest-resolver.js';
import {
  resolveMaterialConceptAssignments,
  type MaterialConceptAssignmentInput,
  type MaterialConceptAssignmentRegistry,
  type MaterialConceptAssignmentRegistryConcept,
} from './material-concept-assignment.js';
import { normalizeTaxonomyAlias } from './taxonomy-normalization.js';

const projectSeed = (
  seed: TaxonomyConceptSeed,
): MaterialConceptAssignmentRegistryConcept => ({
  id: `persisted:${seed.canonicalKey}`,
  canonicalKey: seed.canonicalKey,
  conceptType: seed.conceptType,
  status: 'ACTIVE',
  aliases: [
    {
      normalizedAlias: normalizeTaxonomyAlias(seed.labelEn),
      source: TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_EN,
      isActive: true,
    },
    {
      normalizedAlias: normalizeTaxonomyAlias(seed.labelAr),
      source: TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_AR,
      isActive: true,
    },
    ...seed.aliases.map((alias) => ({
      normalizedAlias: normalizeTaxonomyAlias(alias.alias),
      source: alias.source,
      isActive: true,
    })),
  ],
});

const foundationRegistry = (): MaterialConceptAssignmentRegistry => ({
  concepts: TAXONOMY_CONCEPT_SEEDS.map(projectSeed),
  materialTypeMappings: TAXONOMY_CONCEPT_SEEDS.flatMap((seed) =>
    seed.conceptType === 'MATERIAL_FORM'
      ? seed.mappingRules.flatMap((rule) =>
          rule.provenance === 'REVIEWED'
            ? (rule.materialTypeNames ?? []).map((value) => ({
                value,
                canonicalKey: seed.canonicalKey,
                provenance: 'REVIEWED' as const,
                source: rule.source,
              }))
            : [])
      : []),
});

const concept = (
  canonicalKey: string,
  input: Partial<MaterialConceptAssignmentRegistryConcept> = {},
): MaterialConceptAssignmentRegistryConcept => ({
  id: `persisted:${canonicalKey}`,
  canonicalKey,
  conceptType: canonicalKey.startsWith('material-form:')
    ? 'MATERIAL_FORM'
    : canonicalKey.startsWith('material-family:')
      ? 'MATERIAL_FAMILY'
      : canonicalKey.startsWith('component:')
        ? 'COMPONENT'
        : 'INTEREST',
  status: 'ACTIVE',
  aliases: [],
  ...input,
});

const alias = (
  value: string,
  source: string = TAXONOMY_ALIAS_SOURCE.REVIEWED_EXPLICIT,
  isActive = true,
) => ({
  normalizedAlias: normalizeTaxonomyAlias(value),
  source,
  isActive,
});

const validInput = (
  overrides: Partial<MaterialConceptAssignmentInput['material']> = {},
): MaterialConceptAssignmentInput => ({
  category: {
    id: 'category-electronics',
    categoryType: 'MATERIAL',
    isActive: true,
    materialFamilyConceptId: 'family-db-id',
    materialFamilyConcept: {
      id: 'family-db-id',
      canonicalKey: 'material-family:electronics',
      conceptType: 'MATERIAL_FAMILY',
      status: 'ACTIVE',
    },
  },
  material: {
    materialType: 'Arduino Uno',
    title: 'Arduino Uno',
    ...overrides,
  },
});

const formAssignments = (
  result: ReturnType<typeof resolveMaterialConceptAssignments>,
) => result.assignments.filter(({ role }) => role === 'MATERIAL_FORM');

describe('RP-02.1 category-owned material family', () => {
  test('active MATERIAL and BOTH categories produce exactly one owned family', () => {
    for (const categoryType of ['MATERIAL', 'BOTH'] as const) {
      const input = validInput({ materialType: 'unknown', title: 'unknown title' });
      input.category.categoryType = categoryType;
      const result = resolveMaterialConceptAssignments(input, foundationRegistry());

      assert.equal(result.status, 'READY_FAMILY_ONLY');
      assert.equal(result.summary.familyAssignmentCount, 1);
      assert.equal(result.summary.formAssignmentCount, 0);
      assert.deepEqual(result.canonicalKeys, ['material-family:electronics']);
      assert.equal(result.assignments[0]!.source, 'CATEGORY_OWNERSHIP');
    }
  });

  test('PROJECT and inactive categories block all assignments', () => {
    const project = validInput();
    project.category.categoryType = 'PROJECT';
    const inactive = validInput();
    inactive.category.isActive = false;

    for (const [input, reason] of [
      [project, 'CATEGORY_TYPE_MISMATCH'],
      [inactive, 'CATEGORY_INACTIVE'],
    ] as const) {
      const result = resolveMaterialConceptAssignments(input, foundationRegistry());
      assert.equal(result.status, 'BLOCKED_INVALID_CATEGORY_OWNERSHIP');
      assert.deepEqual(result.assignments, []);
      assert.ok(result.unmatched.some((item) => item.reason === reason));
    }
  });

  test('missing, unresolved, and conflicting ownership block deterministically', () => {
    const missing = validInput();
    missing.category.materialFamilyConceptId = null;
    missing.category.materialFamilyConcept = null;

    const unresolved = validInput();
    unresolved.category.materialFamilyConcept = null;

    const conflict = validInput();
    conflict.category.materialFamilyConcept = {
      ...conflict.category.materialFamilyConcept!,
      id: 'different-id',
    };

    const expectations = [
      [missing, 'CATEGORY_OWNERSHIP_MISSING'],
      [unresolved, 'CATEGORY_OWNERSHIP_INVALID_TARGET'],
      [conflict, 'CATEGORY_OWNERSHIP_CONFLICT'],
    ] as const;
    for (const [input, reason] of expectations) {
      const result = resolveMaterialConceptAssignments(input, foundationRegistry());
      assert.equal(result.status, 'BLOCKED_INVALID_CATEGORY_OWNERSHIP');
      assert.ok(result.unmatched.some((item) => item.reason === reason));
    }
  });

  test('wrong-type, inactive, malformed, and wrong-namespace family targets block explicitly', () => {
    const wrongType = validInput();
    wrongType.category.materialFamilyConcept!.conceptType = 'INTEREST';
    const inactive = validInput();
    inactive.category.materialFamilyConcept!.status = 'INACTIVE';
    const malformed = validInput();
    malformed.category.materialFamilyConcept!.canonicalKey = 'not-a-key';
    const wrongNamespace = validInput();
    wrongNamespace.category.materialFamilyConcept!.canonicalKey = 'interest:electronics';

    for (const [input, reason] of [
      [wrongType, 'WRONG_CONCEPT_TYPE'],
      [inactive, 'INACTIVE_TARGET'],
      [malformed, 'CATEGORY_OWNERSHIP_INVALID_TARGET'],
      [wrongNamespace, 'CATEGORY_OWNERSHIP_INVALID_TARGET'],
    ] as const) {
      const result = resolveMaterialConceptAssignments(input, foundationRegistry());
      assert.equal(result.status, 'BLOCKED_INVALID_CATEGORY_OWNERSHIP');
      assert.ok(result.unmatched.some((item) => item.reason === reason));
    }
  });

  test('family canonical identity is independent of its generated database ID', () => {
    const first = validInput({ materialType: 'unknown', title: 'unknown' });
    const second = structuredClone(first);
    second.category.materialFamilyConceptId = 'replacement-id';
    second.category.materialFamilyConcept!.id = 'replacement-id';

    const firstResult = resolveMaterialConceptAssignments(first, foundationRegistry());
    const secondResult = resolveMaterialConceptAssignments(second, foundationRegistry());
    assert.equal(firstResult.assignments[0]!.canonicalKey, 'material-family:electronics');
    assert.equal(secondResult.assignments[0]!.canonicalKey, 'material-family:electronics');
  });
});

describe('RP-02.1 canonical and reviewed material-type precedence', () => {
  test('known active canonical MATERIAL_FORM resolves directly', () => {
    const result = resolveMaterialConceptAssignments(
      validInput({ materialType: 'material-form:arduino-uno', title: 'unmatched title' }),
      foundationRegistry(),
    );

    assert.equal(result.status, 'READY_WITH_FORMS');
    assert.equal(formAssignments(result)[0]!.source, 'CANONICAL_KEY');
    assert.equal(formAssignments(result)[0]!.canonicalKey, 'material-form:arduino-uno');
  });

  test('known inactive canonical target stops and prevents title fallback', () => {
    const registry = foundationRegistry();
    registry.concepts = registry.concepts.map((item) =>
      item.canonicalKey === 'material-form:arduino-uno'
        ? { ...item, status: 'INACTIVE' as const }
        : item);
    const result = resolveMaterialConceptAssignments(
      validInput({
        materialType: 'material-form:arduino-uno',
        title: 'Breadboard',
      }),
      registry,
    );

    assert.equal(result.status, 'READY_FAMILY_ONLY');
    assert.deepEqual(result.unmatched.map(({ reason }) => reason), ['INACTIVE_TARGET']);
  });

  test('known wrong-type canonical target stops and prevents title fallback', () => {
    const result = resolveMaterialConceptAssignments(
      validInput({ materialType: 'component:breadboard', title: 'Arduino Uno' }),
      foundationRegistry(),
    );

    assert.equal(result.status, 'READY_FAMILY_ONLY');
    assert.deepEqual(result.unmatched.map(({ reason }) => reason), ['WRONG_CONCEPT_TYPE']);
  });

  test('canonical lookup NO_MATCH falls through to reviewed mapping', () => {
    const registry = foundationRegistry();
    registry.materialTypeMappings = [
      ...registry.materialTypeMappings,
      {
        value: 'material-form:legacy-arduino',
        canonicalKey: 'material-form:arduino-uno',
        provenance: 'REVIEWED',
        source: 'reviewed-legacy-material-type',
      },
    ];
    const result = resolveMaterialConceptAssignments(
      validInput({
        materialType: 'material-form:legacy-arduino',
        title: 'unmatched title',
      }),
      registry,
    );

    assert.equal(result.status, 'READY_WITH_FORMS');
    assert.equal(formAssignments(result)[0]!.source, 'REVIEWED_MATERIAL_TYPE_RULE');
    assert.equal(formAssignments(result)[0]!.canonicalKey, 'material-form:arduino-uno');
  });

  test('canonical lookup NO_MATCH falls through to canonical-looking reviewed alias', () => {
    const registry = foundationRegistry();
    registry.concepts = registry.concepts.map((item) =>
      item.canonicalKey === 'material-form:arduino-uno'
        ? {
            ...item,
            aliases: [...item.aliases, alias('material-form:old-arduino')],
          }
        : item);
    const result = resolveMaterialConceptAssignments(
      validInput({
        materialType: 'material-form:old-arduino',
        title: 'unmatched title',
      }),
      registry,
    );

    assert.equal(formAssignments(result)[0]!.source, 'REVIEWED_ALIAS');
    assert.equal(formAssignments(result)[0]!.canonicalKey, 'material-form:arduino-uno');
  });

  test('unknown canonical-shaped input becomes UNKNOWN only after exact stages miss', () => {
    const result = resolveMaterialConceptAssignments(
      validInput({ materialType: 'material-form:not-reviewed', title: 'not reviewed title' }),
      foundationRegistry(),
    );

    assert.equal(result.status, 'READY_FAMILY_ONLY');
    assert.deepEqual(
      result.unmatched.map(({ field, reason }) => [field, reason]),
      [
        ['material.materialType', 'UNKNOWN_VALUE'],
        ['material.title', 'UNKNOWN_VALUE'],
      ],
    );
  });

  test('reviewed mapping uses case and Unicode-safe whitespace normalization', () => {
    const result = resolveMaterialConceptAssignments(
      validInput({ materialType: '  ARDUINO   UNO  ', title: 'unmatched title' }),
      foundationRegistry(),
    );
    assert.equal(formAssignments(result)[0]!.canonicalKey, 'material-form:arduino-uno');
    assert.equal(formAssignments(result)[0]!.source, 'REVIEWED_MATERIAL_TYPE_RULE');
  });

  test('unreviewed substring and broad family alias do not become a form', () => {
    const substring = resolveMaterialConceptAssignments(
      validInput({ materialType: 'Reusable Arduino Uno board', title: 'Reusable board' }),
      foundationRegistry(),
    );
    const familyAlias = resolveMaterialConceptAssignments(
      validInput({ materialType: 'electronic components', title: 'Electronics' }),
      foundationRegistry(),
    );

    assert.equal(substring.status, 'READY_FAMILY_ONLY');
    assert.equal(familyAlias.status, 'READY_FAMILY_ONLY');
    assert.equal(substring.summary.formAssignmentCount, 0);
    assert.equal(familyAlias.summary.formAssignmentCount, 0);
  });
});

describe('RP-02.1 title confirmation, conflict, and fallback', () => {
  test('materialType and title resolving to the same form aggregate evidence', () => {
    const result = resolveMaterialConceptAssignments(validInput(), foundationRegistry());
    const form = formAssignments(result)[0]!;

    assert.equal(result.status, 'READY_WITH_FORMS');
    assert.equal(result.summary.formAssignmentCount, 1);
    assert.deepEqual(
      form.evidence.map(({ field, source }) => [field, source]),
      [
        ['material.materialType', 'REVIEWED_MATERIAL_TYPE_RULE'],
        ['material.title', 'REVIEWED_LABEL'],
      ],
    );
  });

  test('conflicting title cannot replace or add to the materialType form', () => {
    const result = resolveMaterialConceptAssignments(
      validInput({ materialType: 'Arduino Uno', title: 'Breadboard' }),
      foundationRegistry(),
    );

    assert.equal(result.status, 'READY_WITH_FORMS');
    assert.deepEqual(
      formAssignments(result).map(({ canonicalKey }) => canonicalKey),
      ['material-form:arduino-uno'],
    );
    assert.deepEqual(result.unmatched, [{
      field: 'material.title',
      rawValue: 'Breadboard',
      normalizedValue: 'breadboard',
      reason: 'CONFLICTING_EVIDENCE',
      candidateCanonicalKeys: [
        'material-form:arduino-uno',
        'material-form:breadboard',
      ],
    }]);
  });

  test('UNKNOWN materialType permits exact-title fallback and retains its diagnostic', () => {
    const result = resolveMaterialConceptAssignments(
      validInput({ materialType: 'unknown type', title: 'Breadboard' }),
      foundationRegistry(),
    );

    assert.equal(result.status, 'READY_WITH_FORMS');
    assert.equal(formAssignments(result)[0]!.canonicalKey, 'material-form:breadboard');
    assert.equal(formAssignments(result)[0]!.evidenceField, 'material.title');
    assert.deepEqual(result.unmatched.map(({ reason }) => reason), ['UNKNOWN_VALUE']);
  });

  test('ambiguous materialType is retained and cannot fall back to exact title', () => {
    const registry = foundationRegistry();
    registry.concepts = [
      ...registry.concepts,
      concept('material-form:collision-a', { aliases: [alias('shared form')] }),
      concept('material-form:collision-b', { aliases: [alias('shared form')] }),
    ];
    const result = resolveMaterialConceptAssignments(
      validInput({ materialType: 'shared form', title: 'Arduino Uno' }),
      registry,
    );

    assert.equal(result.status, 'READY_FAMILY_ONLY');
    assert.deepEqual(result.unmatched.map(({ reason }) => reason), ['AMBIGUOUS_MAPPING']);
    assert.deepEqual(result.unmatched[0]!.candidateCanonicalKeys, [
      'material-form:collision-a',
      'material-form:collision-b',
    ]);
  });

  test('inactive, wrong-type, invalid, missing-target, and invalid-canonical primary evidence never falls back', () => {
    const scenarios: Array<{
      input: MaterialConceptAssignmentInput;
      registry: MaterialConceptAssignmentRegistry;
      reason: string;
    }> = [];

    const inactiveRegistry = foundationRegistry();
    inactiveRegistry.concepts = inactiveRegistry.concepts.map((item) =>
      item.canonicalKey === 'material-form:arduino-uno'
        ? { ...item, status: 'INACTIVE' as const }
        : item);
    scenarios.push({
      input: validInput({ materialType: 'material-form:arduino-uno', title: 'Breadboard' }),
      registry: inactiveRegistry,
      reason: 'INACTIVE_TARGET',
    });
    scenarios.push({
      input: validInput({ materialType: 'component:breadboard', title: 'Arduino Uno' }),
      registry: foundationRegistry(),
      reason: 'WRONG_CONCEPT_TYPE',
    });
    scenarios.push({
      input: validInput({ materialType: '' as string, title: 'Arduino Uno' }),
      registry: foundationRegistry(),
      reason: 'INVALID_INPUT',
    });
    const missingRegistry = foundationRegistry();
    missingRegistry.materialTypeMappings = [{
      value: 'orphan reviewed value',
      canonicalKey: 'material-form:missing-target',
      provenance: 'REVIEWED',
      source: 'reviewed-missing-fixture',
    }];
    scenarios.push({
      input: validInput({ materialType: 'orphan reviewed value', title: 'Arduino Uno' }),
      registry: missingRegistry,
      reason: 'MAPPING_TARGET_MISSING',
    });
    scenarios.push({
      input: validInput({ materialType: 'interest:bad-form', title: 'Arduino Uno' }),
      registry: {
        concepts: [
          ...foundationRegistry().concepts,
          concept('interest:bad-form', { conceptType: 'MATERIAL_FORM' }),
        ],
        materialTypeMappings: foundationRegistry().materialTypeMappings,
      },
      reason: 'INVALID_CANONICAL_TARGET',
    });

    for (const scenario of scenarios) {
      const result = resolveMaterialConceptAssignments(scenario.input, scenario.registry);
      assert.equal(result.status, 'READY_FAMILY_ONLY');
      assert.equal(formAssignments(result).length, 0);
      assert.deepEqual(result.unmatched.map(({ reason }) => reason), [scenario.reason]);
    }
  });
});

describe('RP-02.1 Arabic, type context, and portable rule identity', () => {
  test('reviewed Arabic aliases and labels resolve without translation', () => {
    const explicit = resolveMaterialConceptAssignments(
      validInput({
        materialType: 'لوحة أردوينو أونو',
        title: 'عنوان غير مطابق',
      }),
      foundationRegistry(),
    );
    const labelFallback = resolveMaterialConceptAssignments(
      validInput({
        materialType: 'نوع غير معروف',
        title: 'أَرْدُوِينُو أُونُو',
      }),
      foundationRegistry(),
    );

    assert.equal(formAssignments(explicit)[0]!.source, 'REVIEWED_ALIAS');
    assert.equal(formAssignments(labelFallback)[0]!.source, 'REVIEWED_LABEL');
    assert.equal(
      formAssignments(labelFallback)[0]!.canonicalKey,
      'material-form:arduino-uno',
    );
  });

  test('unrelated Arabic remains unmatched', () => {
    const result = resolveMaterialConceptAssignments(
      validInput({ materialType: 'مادة غير معروفة', title: 'عنوان غير معروف' }),
      foundationRegistry(),
    );
    assert.equal(result.status, 'READY_FAMILY_ONLY');
    assert.deepEqual(result.unmatched.map(({ reason }) => reason), [
      'UNKNOWN_VALUE',
      'UNKNOWN_VALUE',
    ]);
  });

  test('duplicate candidates for one form are not ambiguous', () => {
    const registry = foundationRegistry();
    const arduino = registry.concepts.find(
      ({ canonicalKey }) => canonicalKey === 'material-form:arduino-uno',
    )!;
    registry.concepts = [
      ...registry.concepts,
      { ...arduino, aliases: [alias('duplicate reviewed form')] },
      { ...arduino, aliases: [alias('duplicate reviewed form')] },
    ];
    const result = resolveMaterialConceptAssignments(
      validInput({ materialType: 'duplicate reviewed form', title: 'unmatched title' }),
      registry,
    );
    assert.equal(formAssignments(result).length, 1);
    assert.equal(formAssignments(result)[0]!.canonicalKey, 'material-form:arduino-uno');
  });

  test('one active form wins explicit type context over another concept type', () => {
    const registry = foundationRegistry();
    registry.concepts = [
      ...registry.concepts,
      concept('material-form:type-context', { aliases: [alias('typed collision')] }),
      concept('component:type-context', { aliases: [alias('typed collision')] }),
    ];
    const result = resolveMaterialConceptAssignments(
      validInput({ materialType: 'typed collision', title: 'unmatched title' }),
      registry,
    );
    assert.equal(formAssignments(result)[0]!.canonicalKey, 'material-form:type-context');
  });

  test('mapping target type and activity are validated after canonical-key binding', () => {
    for (const [target, reason] of [
      [concept('material-form:bound-inactive', { status: 'INACTIVE' }), 'INACTIVE_TARGET'],
      [concept('material-form:bound-wrong', { conceptType: 'COMPONENT' }), 'WRONG_CONCEPT_TYPE'],
    ] as const) {
      const registry = foundationRegistry();
      registry.concepts = [...registry.concepts, target];
      registry.materialTypeMappings = [{
        value: 'portable reviewed rule',
        canonicalKey: target.canonicalKey,
        provenance: 'REVIEWED',
        source: 'portable-test-rule',
      }];
      const result = resolveMaterialConceptAssignments(
        validInput({ materialType: 'portable reviewed rule', title: 'Arduino Uno' }),
        registry,
      );
      assert.equal(result.status, 'READY_FAMILY_ONLY');
      assert.deepEqual(result.unmatched.map((item) => item.reason), [reason]);
    }
  });

  test('foundation rules bind by canonical key across IDs and registry ordering', () => {
    const firstRegistry = foundationRegistry();
    const secondRegistry = foundationRegistry();
    secondRegistry.concepts = secondRegistry.concepts
      .map((item) => ({ ...item, id: `replacement:${item.canonicalKey}` }))
      .reverse();
    secondRegistry.materialTypeMappings = [...secondRegistry.materialTypeMappings].reverse();

    const first = resolveMaterialConceptAssignments(validInput(), firstRegistry);
    const second = resolveMaterialConceptAssignments(validInput(), secondRegistry);
    assert.deepEqual(first.canonicalKeys, second.canonicalKeys);
    assert.equal(
      formAssignments(first)[0]!.canonicalKey,
      formAssignments(second)[0]!.canonicalKey,
    );
    assert.notEqual(
      formAssignments(first)[0]!.conceptId,
      formAssignments(second)[0]!.conceptId,
    );
  });
});

describe('RP-02.1 MATERIAL_FORM canonical identity', () => {
  test('malformed, interest, and material-family namespaces are INVALID_CANONICAL_TARGET', () => {
    for (const [canonicalKey, materialType] of [
      ['not-a-key', 'not-a-key'],
      ['interest:arduino', 'interest:arduino'],
      ['material-family:electronics', 'material-family:electronics'],
    ] as const) {
      const registry: MaterialConceptAssignmentRegistry = {
        concepts: [
          concept(canonicalKey, { conceptType: 'MATERIAL_FORM' }),
        ],
        materialTypeMappings: [],
      };
      const result = resolveMaterialConceptAssignments(
        validInput({ materialType, title: 'unmatched title' }),
        registry,
      );

      assert.equal(result.status, 'READY_FAMILY_ONLY');
      assert.equal(formAssignments(result).length, 0);
      assert.deepEqual(result.unmatched.map(({ reason }) => reason), [
        'INVALID_CANONICAL_TARGET',
      ]);
      assert.deepEqual(result.unmatched[0]!.candidateCanonicalKeys, [canonicalKey]);
      assert.ok(!formAssignments(result).some(
        (assignment) => assignment.canonicalKey === canonicalKey,
      ));
      assert.ok(!result.assignments.some(
        (assignment) =>
          assignment.role === 'MATERIAL_FORM'
          && assignment.canonicalKey === canonicalKey,
      ));
    }
  });

  test('valid material-form identity remains eligible on the direct canonical path', () => {
    const result = resolveMaterialConceptAssignments(
      validInput({ materialType: 'material-form:arduino-uno', title: 'unmatched title' }),
      foundationRegistry(),
    );
    assert.equal(result.status, 'READY_WITH_FORMS');
    assert.equal(formAssignments(result)[0]!.canonicalKey, 'material-form:arduino-uno');
  });

  test('reviewed mapping, explicit alias, and label paths reject invalid canonical targets', () => {
    const invalidTarget = concept('interest:mapped-form', {
      conceptType: 'MATERIAL_FORM',
      aliases: [
        alias('reviewed invalid explicit'),
        {
          normalizedAlias: normalizeTaxonomyAlias('reviewed invalid label'),
          source: TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_EN,
          isActive: true,
        },
      ],
    });

    const mappingRegistry: MaterialConceptAssignmentRegistry = {
      concepts: [...foundationRegistry().concepts, invalidTarget],
      materialTypeMappings: [{
        value: 'reviewed invalid mapping',
        canonicalKey: invalidTarget.canonicalKey,
        provenance: 'REVIEWED',
        source: 'invalid-canonical-mapping',
      }],
    };
    const mapping = resolveMaterialConceptAssignments(
      validInput({ materialType: 'reviewed invalid mapping', title: 'Arduino Uno' }),
      mappingRegistry,
    );
    assert.deepEqual(mapping.unmatched.map(({ reason }) => reason), [
      'INVALID_CANONICAL_TARGET',
    ]);

    const aliasRegistry: MaterialConceptAssignmentRegistry = {
      concepts: [...foundationRegistry().concepts, invalidTarget],
      materialTypeMappings: [],
    };
    const explicit = resolveMaterialConceptAssignments(
      validInput({ materialType: 'reviewed invalid explicit', title: 'Arduino Uno' }),
      aliasRegistry,
    );
    assert.deepEqual(explicit.unmatched.map(({ reason }) => reason), [
      'INVALID_CANONICAL_TARGET',
    ]);

    const label = resolveMaterialConceptAssignments(
      validInput({ materialType: 'unknown type', title: 'reviewed invalid label' }),
      aliasRegistry,
    );
    assert.equal(label.status, 'READY_FAMILY_ONLY');
    assert.ok(label.unmatched.some(({ reason }) => reason === 'INVALID_CANONICAL_TARGET'));
    assert.equal(formAssignments(label).length, 0);
  });

  test('invalid canonical target at a matched stage does not fall through', () => {
    const registry = foundationRegistry();
    registry.concepts = [
      ...registry.concepts.map((item) =>
        item.canonicalKey === 'material-form:arduino-uno'
          ? { ...item, aliases: [...item.aliases, alias('interest:stop-here')] }
          : item),
      concept('interest:stop-here', { conceptType: 'MATERIAL_FORM' }),
    ];
    registry.materialTypeMappings = [
      ...registry.materialTypeMappings,
      {
        value: 'interest:stop-here',
        canonicalKey: 'material-form:arduino-uno',
        provenance: 'REVIEWED',
        source: 'should-not-reach',
      },
    ];
    const result = resolveMaterialConceptAssignments(
      validInput({ materialType: 'interest:stop-here', title: 'Breadboard' }),
      registry,
    );

    assert.equal(result.status, 'READY_FAMILY_ONLY');
    assert.deepEqual(result.unmatched.map(({ reason }) => reason), [
      'INVALID_CANONICAL_TARGET',
    ]);
    assert.deepEqual(result.canonicalKeys, ['material-family:electronics']);
  });
});

describe('RP-02.1 registry conflict policy', () => {
  test('exact repeated registry rows are not ambiguous', () => {
    const registry = foundationRegistry();
    const arduino = registry.concepts.find(
      ({ canonicalKey }) => canonicalKey === 'material-form:arduino-uno',
    )!;
    registry.concepts = [
      ...registry.concepts,
      { ...arduino },
      { ...arduino },
    ];
    const result = resolveMaterialConceptAssignments(
      validInput({ materialType: 'material-form:arduino-uno', title: 'unmatched title' }),
      registry,
    );
    assert.equal(result.status, 'READY_WITH_FORMS');
    assert.equal(formAssignments(result)[0]!.canonicalKey, 'material-form:arduino-uno');
  });

  test('ACTIVE/INACTIVE, type, and ID conflicts fail closed as REGISTRY_CONFLICT', () => {
    const base = concept('material-form:conflicted-form');
    const scenarios = [
      [
        { ...base, status: 'ACTIVE' as const },
        { ...base, status: 'INACTIVE' as const },
      ],
      [
        { ...base, conceptType: 'MATERIAL_FORM' as const },
        { ...base, conceptType: 'COMPONENT' as const },
      ],
      [
        { ...base, id: 'persisted-a' },
        { ...base, id: 'persisted-b' },
      ],
    ] as const;

    for (const [first, second] of scenarios) {
      const registry: MaterialConceptAssignmentRegistry = {
        concepts: [...foundationRegistry().concepts, first, second],
        materialTypeMappings: [],
      };
      const result = resolveMaterialConceptAssignments(
        validInput({
          materialType: 'material-form:conflicted-form',
          title: 'Arduino Uno',
        }),
        registry,
      );

      assert.equal(result.status, 'READY_FAMILY_ONLY');
      assert.deepEqual(result.unmatched.map(({ reason }) => reason), [
        'REGISTRY_CONFLICT',
      ]);
      assert.deepEqual(result.unmatched[0]!.candidateCanonicalKeys, [
        'material-form:conflicted-form',
      ]);
      assert.ok(!result.canonicalKeys.includes('material-form:conflicted-form'));
      assert.equal(formAssignments(result).length, 0);
    }
  });

  test('swapping conflicting IDs preserves the same REGISTRY_CONFLICT diagnostic', () => {
    const first: MaterialConceptAssignmentRegistry = {
      concepts: [
        ...foundationRegistry().concepts,
        concept('material-form:conflicted-form', { id: 'id-alpha' }),
        concept('material-form:conflicted-form', { id: 'id-beta' }),
      ],
      materialTypeMappings: [],
    };
    const swapped: MaterialConceptAssignmentRegistry = {
      concepts: [
        ...foundationRegistry().concepts,
        concept('material-form:conflicted-form', { id: 'id-beta' }),
        concept('material-form:conflicted-form', { id: 'id-alpha' }),
      ],
      materialTypeMappings: [],
    };
    const input = validInput({
      materialType: 'material-form:conflicted-form',
      title: 'unmatched title',
    });
    const left = resolveMaterialConceptAssignments(input, first);
    const right = resolveMaterialConceptAssignments(input, swapped);

    assert.deepEqual(left.unmatched, right.unmatched);
    assert.deepEqual(left.canonicalKeys, right.canonicalKeys);
    assert.deepEqual(left.unmatched[0]!.candidateCanonicalKeys, [
      'material-form:conflicted-form',
    ]);
  });

  test('conflicted canonical keys never enter assignments under permutation', () => {
    const conflicted = [
      concept('material-form:conflicted-form', { id: 'id-one' }),
      concept('material-form:conflicted-form', { id: 'id-two' }),
    ];
    const ordered: MaterialConceptAssignmentRegistry = {
      concepts: [...foundationRegistry().concepts, ...conflicted],
      materialTypeMappings: foundationRegistry().materialTypeMappings,
    };
    const permuted: MaterialConceptAssignmentRegistry = {
      concepts: [...ordered.concepts].reverse(),
      materialTypeMappings: [...ordered.materialTypeMappings].reverse(),
    };
    const input = validInput({
      materialType: 'material-form:conflicted-form',
      title: 'Breadboard',
    });
    const first = resolveMaterialConceptAssignments(input, ordered);
    const second = resolveMaterialConceptAssignments(input, permuted);

    assert.deepEqual(first, second);
    assert.equal(first.unmatched[0]!.reason, 'REGISTRY_CONFLICT');
    assert.ok(!first.canonicalKeys.includes('material-form:conflicted-form'));
    assert.ok(!first.assignments.some(
      ({ canonicalKey }) => canonicalKey === 'material-form:conflicted-form',
    ));
  });
});

describe('RP-02.1 deterministic boundaries', () => {
  test('only one family and zero or one form can be returned', () => {
    for (const input of [
      validInput(),
      validInput({ materialType: 'Arduino Uno', title: 'Breadboard' }),
      validInput({ materialType: 'unknown', title: 'Breadboard' }),
      validInput({ materialType: 'unknown', title: 'unknown' }),
    ]) {
      const result = resolveMaterialConceptAssignments(input, foundationRegistry());
      assert.equal(result.summary.familyAssignmentCount, 1);
      assert.ok(result.summary.formAssignmentCount === 0 || result.summary.formAssignmentCount === 1);
      assert.ok(formAssignments(result).length <= 1);
      assert.ok(result.assignments.every(({ conceptType }) =>
        conceptType === 'MATERIAL_FAMILY' || conceptType === 'MATERIAL_FORM'));
    }
  });

  test('registry permutations and repeated execution produce deep-equal output', () => {
    const registry = foundationRegistry();
    const permuted = {
      concepts: [...registry.concepts].reverse(),
      materialTypeMappings: [...registry.materialTypeMappings].reverse(),
    } satisfies MaterialConceptAssignmentRegistry;
    const input = validInput();
    const first = resolveMaterialConceptAssignments(input, registry);
    const repeated = resolveMaterialConceptAssignments(input, registry);
    const reordered = resolveMaterialConceptAssignments(input, permuted);

    assert.deepEqual(repeated, first);
    assert.deepEqual(reordered, first);
    assert.deepEqual(first.canonicalKeys, [
      'material-family:electronics',
      'material-form:arduino-uno',
    ]);
  });

  test('input boundary contains only materialType and title', () => {
    assert.deepEqual(Object.keys(validInput().material).sort(), ['materialType', 'title']);
  });
});
