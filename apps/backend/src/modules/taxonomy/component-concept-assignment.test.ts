import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  TAXONOMY_CONCEPT_SEEDS,
  type TaxonomyConceptSeed,
} from './taxonomy-foundation.data.js';
import { TAXONOMY_ALIAS_SOURCE } from './learner-interest-resolver.js';
import {
  diffComponentConceptAssignments,
  resolveComponentConceptAssignments,
  toComponentConceptIds,
  type ComponentConceptAssignmentRegistry,
  type ComponentConceptAssignmentRegistryConcept,
} from './component-concept-assignment.js';
import { normalizeTaxonomyAlias } from './taxonomy-normalization.js';

const projectSeed = (
  seed: TaxonomyConceptSeed,
): ComponentConceptAssignmentRegistryConcept => ({
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

const foundationRegistry = (): ComponentConceptAssignmentRegistry => ({
  concepts: TAXONOMY_CONCEPT_SEEDS.map(projectSeed),
  componentNameMappings: TAXONOMY_CONCEPT_SEEDS.flatMap((seed) =>
    seed.conceptType === 'COMPONENT'
      ? seed.mappingRules.flatMap((rule) =>
          rule.provenance === 'REVIEWED'
            ? (rule.componentNameValues ?? []).map((value) => ({
                value,
                canonicalKey: seed.canonicalKey,
                provenance: 'REVIEWED' as const,
                source: rule.source,
              }))
            : [])
      : []),
  componentTypeMappings: TAXONOMY_CONCEPT_SEEDS.flatMap((seed) =>
    seed.conceptType === 'COMPONENT'
      ? seed.mappingRules.flatMap((rule) =>
          rule.provenance === 'REVIEWED'
            ? (rule.componentTypeValues ?? []).map((value) => ({
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
  input: Partial<ComponentConceptAssignmentRegistryConcept> = {},
): ComponentConceptAssignmentRegistryConcept => ({
  id: `persisted:${canonicalKey}`,
  canonicalKey,
  conceptType: canonicalKey.startsWith('component:')
    ? 'COMPONENT'
    : canonicalKey.startsWith('material-form:')
      ? 'MATERIAL_FORM'
      : 'INTEREST',
  status: 'ACTIVE',
  aliases: [],
  ...input,
});

describe('component concept assignment engine', () => {
  test('type-only resolution yields one COMPONENT assignment', () => {
    const result = resolveComponentConceptAssignments(
      {
        componentName: 'totally-unknown-name',
        materialType: 'Breadboard',
      },
      foundationRegistry(),
    );
    assert.equal(result.status, 'READY');
    assert.deepEqual(toComponentConceptIds(result), [
      'persisted:component:breadboard',
    ]);
    assert.equal(result.assignments[0]?.canonicalKey, 'component:breadboard');
  });

  test('name-only resolution yields one COMPONENT assignment', () => {
    const result = resolveComponentConceptAssignments(
      {
        componentName: 'Arduino board',
        materialType: 'totally-unknown-type',
      },
      foundationRegistry(),
    );
    assert.equal(result.status, 'READY');
    assert.equal(result.assignments[0]?.canonicalKey, 'component:arduino-board');
  });

  test('both fields resolving to the same key yield one assignment', () => {
    const result = resolveComponentConceptAssignments(
      {
        componentName: 'Breadboard',
        materialType: 'Breadboard',
      },
      foundationRegistry(),
    );
    assert.equal(result.status, 'READY');
    assert.equal(result.assignments.length, 1);
    assert.equal(result.assignments[0]?.canonicalKey, 'component:breadboard');
  });

  test('both fields resolving to different keys yield empty ambiguous set', () => {
    const result = resolveComponentConceptAssignments(
      {
        componentName: 'Arduino board',
        materialType: 'Breadboard',
      },
      foundationRegistry(),
    );
    assert.equal(result.status, 'AMBIGUOUS');
    assert.deepEqual(toComponentConceptIds(result), []);
    assert.ok(
      result.unmatched.some((item) => item.reason === 'CONFLICTING_EVIDENCE'),
    );
  });

  test('labels are not semantic identity without reviewed alias path', () => {
    const result = resolveComponentConceptAssignments(
      {
        componentName: 'Clear Acrylic Sheets',
        materialType: 'unknown-type',
      },
      foundationRegistry(),
    );
    // labelEn is a reviewed label alias for component:acrylic-sheets
    assert.equal(result.status, 'READY');
    assert.equal(result.assignments[0]?.canonicalKey, 'component:acrylic-sheets');

    const unknown = resolveComponentConceptAssignments(
      {
        componentName: 'arbitrary free text label',
        materialType: 'also unknown',
      },
      foundationRegistry(),
    );
    assert.equal(unknown.status, 'UNMAPPED');
    assert.deepEqual(toComponentConceptIds(unknown), []);
    assert.ok(
      unknown.unmatched.every((item) => item.reason === 'UNKNOWN_VALUE'),
    );
  });

  test('inactive target is classified separately from unknown', () => {
    const base = foundationRegistry();
    const registry: ComponentConceptAssignmentRegistry = {
      ...base,
      concepts: base.concepts.map((row) =>
        row.canonicalKey === 'component:breadboard'
          ? { ...row, status: 'INACTIVE' as const }
          : row,
      ),
    };
    const result = resolveComponentConceptAssignments(
      {
        componentName: 'unknown',
        materialType: 'Breadboard',
      },
      registry,
    );
    assert.equal(result.status, 'UNMAPPED');
    assert.deepEqual(toComponentConceptIds(result), []);
    assert.ok(
      result.unmatched.some((item) => item.reason === 'INACTIVE_TARGET'),
    );
  });

  test('wrong-type canonical target is classified separately', () => {
    const registry: ComponentConceptAssignmentRegistry = {
      concepts: [
        concept('material-form:arduino-uno', { conceptType: 'MATERIAL_FORM' }),
      ],
      componentNameMappings: [],
      componentTypeMappings: [
        {
          value: 'Arduino Uno',
          canonicalKey: 'material-form:arduino-uno',
          provenance: 'REVIEWED',
          source: 'test',
        },
      ],
    };
    const result = resolveComponentConceptAssignments(
      {
        componentName: 'unknown',
        materialType: 'Arduino Uno',
      },
      registry,
    );
    assert.deepEqual(toComponentConceptIds(result), []);
    assert.ok(
      result.unmatched.some((item) => item.reason === 'WRONG_CONCEPT_TYPE'),
    );
  });

  test('mapping target missing is classified separately', () => {
    const registry: ComponentConceptAssignmentRegistry = {
      concepts: [],
      componentNameMappings: [],
      componentTypeMappings: [
        {
          value: 'Ghost Type',
          canonicalKey: 'component:ghost',
          provenance: 'REVIEWED',
          source: 'test',
        },
      ],
    };
    const result = resolveComponentConceptAssignments(
      {
        componentName: 'unknown',
        materialType: 'Ghost Type',
      },
      registry,
    );
    assert.ok(
      result.unmatched.some((item) => item.reason === 'MAPPING_TARGET_MISSING'),
    );
  });

  test('malformed component canonical key is invalid', () => {
    const result = resolveComponentConceptAssignments(
      {
        componentName: 'component:',
        materialType: 'unknown',
      },
      foundationRegistry(),
    );
    assert.ok(
      result.unmatched.some(
        (item) =>
          item.field === 'component.componentName'
          && (item.reason === 'INVALID_CANONICAL_TARGET'
            || item.reason === 'UNKNOWN_VALUE'),
      ),
    );
  });

  test('ambiguous reviewed mapping does not pick a concept', () => {
    const registry: ComponentConceptAssignmentRegistry = {
      concepts: [
        concept('component:a'),
        concept('component:b'),
      ],
      componentNameMappings: [],
      componentTypeMappings: [
        {
          value: 'shared form',
          canonicalKey: 'component:a',
          provenance: 'REVIEWED',
          source: 'test',
        },
        {
          value: 'shared form',
          canonicalKey: 'component:b',
          provenance: 'REVIEWED',
          source: 'test',
        },
      ],
    };
    const result = resolveComponentConceptAssignments(
      {
        componentName: 'unknown',
        materialType: 'shared form',
      },
      registry,
    );
    assert.equal(result.status, 'AMBIGUOUS');
    assert.deepEqual(toComponentConceptIds(result), []);
    assert.ok(
      result.unmatched.some((item) => item.reason === 'AMBIGUOUS_MAPPING'),
    );
  });

  test('duplicate normalized mapping values collapse to one identity', () => {
    const result = resolveComponentConceptAssignments(
      {
        componentName: '  BREADBOARD  ',
        materialType: 'breadboard',
      },
      foundationRegistry(),
    );
    assert.equal(result.status, 'READY');
    assert.equal(result.assignments.length, 1);
    assert.equal(result.assignments[0]?.canonicalKey, 'component:breadboard');
  });
});

describe('diffComponentConceptAssignments', () => {
  test('identical sets produce no writes', () => {
    const diff = diffComponentConceptAssignments(['a', 'b'], ['b', 'a']);
    assert.equal(diff.identical, true);
    assert.deepEqual(diff.toCreate, []);
    assert.deepEqual(diff.toDelete, []);
  });

  test('missing assignment produces create-only diff', () => {
    const diff = diffComponentConceptAssignments([], ['concept-1']);
    assert.equal(diff.identical, false);
    assert.deepEqual(diff.toCreate, ['concept-1']);
    assert.deepEqual(diff.toDelete, []);
  });

  test('stale assignment produces delete-only diff', () => {
    const diff = diffComponentConceptAssignments(['stale'], []);
    assert.equal(diff.identical, false);
    assert.deepEqual(diff.toCreate, []);
    assert.deepEqual(diff.toDelete, ['stale']);
  });

  test('replacement deletes stale and creates missing sorted', () => {
    const diff = diffComponentConceptAssignments(['old', 'keep'], ['keep', 'new']);
    assert.deepEqual(diff.toCreate, ['new']);
    assert.deepEqual(diff.toDelete, ['old']);
  });

  test('expected empty removes all current', () => {
    const diff = diffComponentConceptAssignments(['a', 'b'], []);
    assert.deepEqual(diff.toDelete, ['a', 'b']);
    assert.deepEqual(diff.toCreate, []);
  });
});
