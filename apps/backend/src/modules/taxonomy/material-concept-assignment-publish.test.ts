import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { AppError } from '../../utils/app-error.js';
import { TAXONOMY_ALIAS_SOURCE } from './learner-interest-resolver.js';
import {
  TAXONOMY_CONCEPT_SEEDS,
  type TaxonomyConceptSeed,
} from './taxonomy-foundation.data.js';
import {
  resolveMaterialConceptAssignments,
  type MaterialConceptAssignmentInput,
  type MaterialConceptAssignmentRegistry,
  type MaterialConceptAssignmentRegistryConcept,
  type MaterialConceptAssignmentResult,
  type MaterialConceptUnmatchedEvidence,
} from './material-concept-assignment.js';
import {
  buildEvidenceScopedAssignmentRegistry,
  collectConflictedCanonicalKeys,
  resolveFreeMaterialConceptIds,
  toFreeCreateConceptIds,
} from './material-concept-assignment-publish.js';
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

const foundationConcepts = (): MaterialConceptAssignmentRegistryConcept[] =>
  TAXONOMY_CONCEPT_SEEDS.map(projectSeed);

const ownedCategory = (
  overrides: Partial<MaterialConceptAssignmentInput['category']> = {},
): MaterialConceptAssignmentInput['category'] => ({
  id: 'category-electronics',
  categoryType: 'MATERIAL',
  isActive: true,
  materialFamilyConceptId: 'persisted:material-family:electronics',
  materialFamilyConcept: {
    id: 'persisted:material-family:electronics',
    canonicalKey: 'material-family:electronics',
    conceptType: 'MATERIAL_FAMILY',
    status: 'ACTIVE',
  },
  ...overrides,
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

describe('buildEvidenceScopedAssignmentRegistry', () => {
  test('unrelated missing reviewed mapping target does not block registry build', () => {
    const concepts = foundationConcepts().filter(
      (row) => row.canonicalKey !== 'material-form:wood-glue',
    );

    const built = buildEvidenceScopedAssignmentRegistry({
      concepts,
      finalMaterialType: 'Arduino Uno',
      categoryFamilyCanonicalKey: 'material-family:electronics',
    });

    assert.equal(built.ok, true);
    if (!built.ok) {
      return;
    }
    assert.ok(
      built.registry.materialTypeMappings.every(
        (mapping) => mapping.canonicalKey !== 'material-form:wood-glue',
      ),
    );
    assert.ok(
      built.registry.materialTypeMappings.some(
        (mapping) =>
          normalizeTaxonomyAlias(mapping.value) === normalizeTaxonomyAlias('Arduino Uno'),
      ),
    );
  });

  test('unrelated registry conflict does not block registry build', () => {
    const concepts = [
      ...foundationConcepts(),
      concept('material-form:ghost-unrelated', {
        id: 'conflict-a',
        status: 'ACTIVE',
      }),
      concept('material-form:ghost-unrelated', {
        id: 'conflict-b',
        status: 'INACTIVE',
      }),
    ];

    const built = buildEvidenceScopedAssignmentRegistry({
      concepts,
      finalMaterialType: 'Arduino Uno',
      categoryFamilyCanonicalKey: 'material-family:electronics',
    });

    assert.equal(built.ok, true);
    assert.ok(collectConflictedCanonicalKeys(concepts).has('material-form:ghost-unrelated'));
  });

  test('current materialType matching invalid reviewed mapping target fails', () => {
    const concepts = foundationConcepts().filter(
      (row) => row.canonicalKey !== 'material-form:arduino-uno',
    );

    const built = buildEvidenceScopedAssignmentRegistry({
      concepts,
      finalMaterialType: 'Arduino Uno',
      categoryFamilyCanonicalKey: 'material-family:electronics',
    });

    assert.equal(built.ok, false);
    if (built.ok) {
      return;
    }
    assert.equal(built.code, 'MATERIAL_TAXONOMY_NOT_READY');
    assert.equal(built.reason, 'CURRENT_MATERIAL_TYPE_MAPPING_TARGET_INVALID');
  });

  test('current category-family canonical identity conflict fails', () => {
    const concepts = [
      ...foundationConcepts().filter(
        (row) => row.canonicalKey !== 'material-family:electronics',
      ),
      concept('material-family:electronics', {
        id: 'family-a',
        conceptType: 'MATERIAL_FAMILY',
      }),
      concept('material-family:electronics', {
        id: 'family-b',
        conceptType: 'MATERIAL_FAMILY',
        status: 'INACTIVE',
      }),
    ];

    const built = buildEvidenceScopedAssignmentRegistry({
      concepts,
      finalMaterialType: 'Unmatched custom type',
      categoryFamilyCanonicalKey: 'material-family:electronics',
    });

    assert.equal(built.ok, false);
    if (built.ok) {
      return;
    }
    assert.equal(built.code, 'CATEGORY_TAXONOMY_NOT_READY');
    assert.equal(built.reason, 'CATEGORY_FAMILY_REGISTRY_CONFLICT');
  });
});

describe('toFreeCreateConceptIds publish policy', () => {
  const baseReadyFamilyOnly = (): MaterialConceptAssignmentResult => ({
    status: 'READY_FAMILY_ONLY',
    canonicalKeys: ['material-family:electronics'],
    assignments: [
      {
        conceptId: 'persisted:material-family:electronics',
        canonicalKey: 'material-family:electronics',
        conceptType: 'MATERIAL_FAMILY',
        role: 'MATERIAL_FAMILY',
        source: 'CATEGORY_OWNERSHIP',
        evidenceField: 'category.materialFamilyConceptId',
        normalizedEvidence: 'material-family:electronics',
        evidence: [],
      },
    ],
    unmatched: [],
    summary: {
      familyAssignmentCount: 1,
      formAssignmentCount: 0,
      unmatchedEvidenceCount: 0,
    },
  });

  const unmatched = (
    field: string,
    reason: MaterialConceptUnmatchedEvidence['reason'],
  ): MaterialConceptUnmatchedEvidence => ({
    field,
    rawValue: 'x',
    normalizedValue: 'x',
    reason,
    candidateCanonicalKeys: [],
  });

  test('UNKNOWN_VALUE on materialType and title allows family-only', () => {
    const result = baseReadyFamilyOnly();
    result.unmatched = [
      unmatched('material.materialType', 'UNKNOWN_VALUE'),
      unmatched('material.title', 'UNKNOWN_VALUE'),
    ];
    result.summary.unmatchedEvidenceCount = 2;

    assert.deepEqual(
      toFreeCreateConceptIds(result, foundationConcepts()),
      ['persisted:material-family:electronics'],
    );
  });

  for (const reason of [
    'AMBIGUOUS_MAPPING',
    'INACTIVE_TARGET',
    'WRONG_CONCEPT_TYPE',
    'INVALID_CANONICAL_TARGET',
    'REGISTRY_CONFLICT',
  ] as const) {
    test(`materialType ${reason} fails closed`, () => {
      const result = baseReadyFamilyOnly();
      result.unmatched = [unmatched('material.materialType', reason)];
      result.summary.unmatchedEvidenceCount = 1;

      assert.throws(
        () => toFreeCreateConceptIds(result, foundationConcepts()),
        (error: unknown) => {
          assert.ok(error instanceof AppError);
          assert.equal(error.code, 'MATERIAL_TAXONOMY_NOT_READY');
          return true;
        },
      );
    });

    test(`title-only ${reason} allows family-only when materialType is UNKNOWN_VALUE`, () => {
      const result = baseReadyFamilyOnly();
      result.unmatched = [
        unmatched('material.materialType', 'UNKNOWN_VALUE'),
        unmatched('material.title', reason),
      ];
      result.summary.unmatchedEvidenceCount = 2;

      assert.deepEqual(
        toFreeCreateConceptIds(result, foundationConcepts()),
        ['persisted:material-family:electronics'],
      );
    });
  }

  test('materialType MAPPING_TARGET_MISSING fails closed', () => {
    const result = baseReadyFamilyOnly();
    result.unmatched = [unmatched('material.materialType', 'MAPPING_TARGET_MISSING')];
    result.summary.unmatchedEvidenceCount = 1;

    assert.throws(
      () => toFreeCreateConceptIds(result, foundationConcepts()),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'MATERIAL_TAXONOMY_NOT_READY');
        return true;
      },
    );
  });

  test('CONFLICTING_EVIDENCE keeps materialType form', () => {
    const result: MaterialConceptAssignmentResult = {
      status: 'READY_WITH_FORMS',
      canonicalKeys: [
        'material-family:electronics',
        'material-form:arduino-uno',
      ],
      assignments: [
        {
          conceptId: 'persisted:material-family:electronics',
          canonicalKey: 'material-family:electronics',
          conceptType: 'MATERIAL_FAMILY',
          role: 'MATERIAL_FAMILY',
          source: 'CATEGORY_OWNERSHIP',
          evidenceField: 'category.materialFamilyConceptId',
          normalizedEvidence: 'material-family:electronics',
          evidence: [],
        },
        {
          conceptId: 'persisted:material-form:arduino-uno',
          canonicalKey: 'material-form:arduino-uno',
          conceptType: 'MATERIAL_FORM',
          role: 'MATERIAL_FORM',
          source: 'REVIEWED_MATERIAL_TYPE_RULE',
          evidenceField: 'material.materialType',
          normalizedEvidence: 'arduino uno',
          evidence: [],
        },
      ],
      unmatched: [unmatched('material.title', 'CONFLICTING_EVIDENCE')],
      summary: {
        familyAssignmentCount: 1,
        formAssignmentCount: 1,
        unmatchedEvidenceCount: 1,
      },
    };

    assert.deepEqual(
      toFreeCreateConceptIds(result, foundationConcepts()),
      [
        'persisted:material-family:electronics',
        'persisted:material-form:arduino-uno',
      ],
    );
  });

  test('INVALID_INPUT is an internal invariant failure', () => {
    const result = baseReadyFamilyOnly();
    result.unmatched = [unmatched('material.materialType', 'INVALID_INPUT')];
    result.summary.unmatchedEvidenceCount = 1;

    assert.throws(
      () => toFreeCreateConceptIds(result, foundationConcepts()),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'INTERNAL_ERROR');
        assert.equal(error.statusCode, 500);
        return true;
      },
    );
  });

  test('BLOCKED_INVALID_CATEGORY_OWNERSHIP fails closed', () => {
    const result: MaterialConceptAssignmentResult = {
      status: 'BLOCKED_INVALID_CATEGORY_OWNERSHIP',
      canonicalKeys: [],
      assignments: [],
      unmatched: [unmatched('category.materialFamilyConceptId', 'CATEGORY_OWNERSHIP_MISSING')],
      summary: {
        familyAssignmentCount: 0,
        formAssignmentCount: 0,
        unmatchedEvidenceCount: 1,
      },
    };

    assert.throws(
      () => toFreeCreateConceptIds(result, foundationConcepts()),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'CATEGORY_TAXONOMY_NOT_READY');
        return true;
      },
    );
  });
});

describe('resolveFreeMaterialConceptIds', () => {
  test('family-only for unknown materialType/title', () => {
    const conceptIds = resolveFreeMaterialConceptIds({
      category: ownedCategory(),
      materialType: 'Unmatched create material',
      title: 'A unique free title',
      concepts: foundationConcepts(),
    });

    assert.deepEqual(conceptIds, ['persisted:material-family:electronics']);
  });

  test('family plus form for reviewed materialType', () => {
    const conceptIds = resolveFreeMaterialConceptIds({
      category: ownedCategory(),
      materialType: 'Arduino Uno',
      title: 'Arduino Uno R3 surplus',
      concepts: foundationConcepts(),
    });

    assert.deepEqual(conceptIds, [
      'persisted:material-family:electronics',
      'persisted:material-form:arduino-uno',
    ]);
  });

  test('engine still sees WRONG_CONCEPT_TYPE from non-form aliases in full registry', () => {
    const concepts = foundationConcepts();
    const registry: MaterialConceptAssignmentRegistry = {
      concepts,
      materialTypeMappings: [],
    };

    const result = resolveMaterialConceptAssignments(
      {
        category: ownedCategory(),
        material: {
          materialType: 'Arduino board',
          title: 'Unused title',
        },
      },
      registry,
    );

    assert.equal(result.status, 'READY_FAMILY_ONLY');
    assert.ok(
      result.unmatched.some(
        (item) =>
          item.field === 'material.materialType'
          && item.reason === 'WRONG_CONCEPT_TYPE',
      ),
    );

    assert.throws(
      () => toFreeCreateConceptIds(result, concepts),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'MATERIAL_TAXONOMY_NOT_READY');
        return true;
      },
    );
  });
});
