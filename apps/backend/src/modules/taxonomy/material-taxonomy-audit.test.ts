import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { AppError } from '../../utils/app-error.js';
import { TAXONOMY_ALIAS_SOURCE } from './learner-interest-resolver.js';
import type { MaterialConceptAssignmentRegistryConcept } from './material-concept-assignment.js';
import {
  accumulateMaterialClassification,
  auditRegistryHealth,
  buildMaterialEvidenceAliasUniverse,
  buildMaterialTaxonomyAuditReport,
  classifyMaterialTaxonomyAssignment,
  classifyMaterialTypeCatalogResolution,
  classifyReviewedMappingTargetState,
  createMaterialTaxonomyAuditAccumulator,
  hashTaxonomyEvidence,
  mapPersistenceAppErrorToAuditBlocker,
  resolveDesiredMaterialAssignment,
  type AuditMaterialInput,
  type CategoryOwnershipForAudit,
  type StoredConceptRow,
} from './material-taxonomy-audit.js';

const concept = (input: {
  id: string;
  canonicalKey: string;
  conceptType: MaterialConceptAssignmentRegistryConcept['conceptType'];
  status?: 'ACTIVE' | 'INACTIVE';
  aliases?: MaterialConceptAssignmentRegistryConcept['aliases'];
}): MaterialConceptAssignmentRegistryConcept => ({
  id: input.id,
  canonicalKey: input.canonicalKey,
  conceptType: input.conceptType,
  status: input.status ?? 'ACTIVE',
  aliases: input.aliases ?? [],
});

const family = concept({
  id: 'fam-1',
  canonicalKey: 'material-family:wood',
  conceptType: 'MATERIAL_FAMILY',
});
const formBoard = concept({
  id: 'form-board',
  canonicalKey: 'material-form:board',
  conceptType: 'MATERIAL_FORM',
  aliases: [{
    normalizedAlias: 'board',
    source: TAXONOMY_ALIAS_SOURCE.REVIEWED_EXPLICIT,
    isActive: true,
  }],
});
const formSheet = concept({
  id: 'form-sheet',
  canonicalKey: 'material-form:sheet',
  conceptType: 'MATERIAL_FORM',
  aliases: [{
    normalizedAlias: 'sheet',
    source: TAXONOMY_ALIAS_SOURCE.REVIEWED_EXPLICIT,
    isActive: true,
  }],
});
const componentBolt = concept({
  id: 'comp-bolt',
  canonicalKey: 'component:bolt',
  conceptType: 'COMPONENT',
  aliases: [{
    normalizedAlias: 'bolt',
    source: 'component-domain-alias',
    isActive: true,
  }],
});

const ownedCategory = (): CategoryOwnershipForAudit => ({
  id: 'cat-wood',
  categoryType: 'MATERIAL',
  isActive: true,
  materialFamilyConceptId: family.id,
  materialFamilyConcept: {
    id: family.id,
    canonicalKey: family.canonicalKey,
    conceptType: 'MATERIAL_FAMILY',
    status: 'ACTIVE',
  },
});

const material = (input: {
  id?: string;
  status?: AuditMaterialInput['status'];
  materialType?: string;
  title?: string;
  updatedAt?: string;
  stored?: StoredConceptRow[];
}): AuditMaterialInput => ({
  id: input.id ?? 'mat-1',
  status: input.status ?? 'AVAILABLE',
  categoryId: 'cat-wood',
  materialType: input.materialType ?? 'unknown-type',
  title: input.title ?? 'Some Title',
  updatedAt: input.updatedAt ?? '2026-07-24T00:00:00.000Z',
  storedConcepts: input.stored ?? [],
});

const stored = (
  row: MaterialConceptAssignmentRegistryConcept,
  status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE',
): StoredConceptRow => ({
  conceptId: row.id,
  canonicalKey: row.canonicalKey,
  conceptType: row.conceptType,
  status,
});

const classifyWithDesired = (
  mat: AuditMaterialInput,
  concepts: MaterialConceptAssignmentRegistryConcept[],
  category: CategoryOwnershipForAudit | null = ownedCategory(),
) => {
  const desired = resolveDesiredMaterialAssignment({
    category,
    materialType: mat.materialType,
    title: mat.title,
    concepts,
  });
  return {
    desired,
    classification: classifyMaterialTaxonomyAssignment({ material: mat, desired }),
  };
};

describe('material taxonomy audit classification', () => {
  test('exact family-only and family+form', () => {
    assert.equal(
      classifyWithDesired(
        material({ materialType: 'totally-unknown', stored: [stored(family)] }),
        [family, formBoard],
      ).classification.primary,
      'EXACT_FAMILY_ONLY',
    );
    assert.equal(
      classifyWithDesired(
        material({
          materialType: 'board',
          stored: [stored(family), stored(formBoard)],
        }),
        [family, formBoard],
      ).classification.primary,
      'EXACT_FAMILY_AND_FORM',
    );
  });

  test('complete issue set before primary for stale family+form', () => {
    const otherFamily = concept({
      id: 'fam-2',
      canonicalKey: 'material-family:metal',
      conceptType: 'MATERIAL_FAMILY',
    });
    const { classification } = classifyWithDesired(
      material({
        materialType: 'board',
        stored: [stored(otherFamily), stored(formSheet)],
      }),
      [family, otherFamily, formBoard, formSheet],
    );
    assert.equal(classification.primary, 'STALE_FAMILY');
    assert.ok(classification.secondaryIssues.includes('STALE_FORM'));
    assert.ok(classification.secondaryIssues.includes('EXTRA_ASSIGNMENTS'));
  });

  test('missing family and missing expected form both counted', () => {
    const { classification } = classifyWithDesired(
      material({ materialType: 'board', stored: [] }),
      [family, formBoard],
    );
    assert.equal(classification.primary, 'MISSING_ALL_ASSIGNMENTS');
    assert.ok(classification.allIssues.includes('MISSING_FAMILY'));
    assert.ok(classification.allIssues.includes('MISSING_EXPECTED_FORM'));
  });

  test('unsupported extra and EXTRA_ASSIGNMENTS both present', () => {
    const { classification } = classifyWithDesired(
      material({
        materialType: 'totally-unknown',
        stored: [stored(family), stored(componentBolt)],
      }),
      [family, formBoard, componentBolt],
    );
    assert.equal(classification.primary, 'UNSUPPORTED_STORED_CONCEPT_TYPE');
    assert.ok(classification.secondaryIssues.includes('EXTRA_ASSIGNMENTS'));
  });

  test('inactive stale form includes inactive and form mismatch', () => {
    const { classification } = classifyWithDesired(
      material({
        materialType: 'board',
        stored: [stored(family), stored(formSheet, 'INACTIVE')],
      }),
      [family, formBoard, formSheet],
    );
    assert.ok(classification.allIssues.includes('INACTIVE_STORED_CONCEPT'));
    assert.ok(classification.allIssues.includes('STALE_FORM'));
  });

  test('title-only form keeps materialType match kind unknown', () => {
    const titled = concept({
      id: 'form-title',
      canonicalKey: 'material-form:title-board',
      conceptType: 'MATERIAL_FORM',
      aliases: [{
        normalizedAlias: 'title board offcut',
        source: TAXONOMY_ALIAS_SOURCE.REVIEWED_EXPLICIT,
        isActive: true,
      }],
    });
    const { classification, desired } = classifyWithDesired(
      material({
        materialType: 'totally-unknown-type',
        title: 'Title Board Offcut',
        stored: [stored(family), stored(titled)],
      }),
      [family, titled],
    );
    assert.equal(desired.ok, true);
    if (desired.ok) assert.equal(desired.formFromTitleFallback, true);
    assert.equal(classification.formFromTitleFallback, true);
    assert.equal(classification.materialTypeMatchKind, 'unknown');
  });

  test('AppError mapping and historical not gated', () => {
    assert.equal(
      mapPersistenceAppErrorToAuditBlocker(
        new AppError('x', 409, 'MATERIAL_TAXONOMY_NOT_READY', {
          reason: 'AMBIGUOUS_MAPPING',
        }),
      ).primary,
      'MATERIAL_EVIDENCE_STRUCTURAL_ERROR',
    );
    assert.equal(
      classifyWithDesired(
        material({ status: 'REUSED', materialType: 'board', stored: [] }),
        [family, formBoard],
      ).classification.gatedCritical,
      false,
    );
  });
});

describe('material taxonomy audit registry health', () => {
  test('one form + component shared reviewed alias is warning not critical', () => {
    const shared = 'shared-token';
    const formWithShared = concept({
      id: 'form-shared',
      canonicalKey: 'material-form:shared',
      conceptType: 'MATERIAL_FORM',
      aliases: [{
        normalizedAlias: shared,
        source: TAXONOMY_ALIAS_SOURCE.REVIEWED_EXPLICIT,
        isActive: true,
      }],
    });
    const componentWithShared = concept({
      id: 'comp-shared',
      canonicalKey: 'component:shared',
      conceptType: 'COMPONENT',
      aliases: [{
        normalizedAlias: shared,
        source: TAXONOMY_ALIAS_SOURCE.REVIEWED_EXPLICIT,
        isActive: true,
      }],
    });
    const health = auditRegistryHealth({
      concepts: [family, formWithShared, componentWithShared],
      reachedNormalizedEvidence: new Set([shared]),
      sampleLimit: 20,
    });
    assert.equal(health.criticalByCode.AMBIGUOUS_MATERIAL_FORM_ALIAS ?? 0, 0);
    assert.equal(health.warningByCode.CROSS_DOMAIN_SHARED_ALIAS ?? 0, 1);
    const desired = resolveDesiredMaterialAssignment({
      category: ownedCategory(),
      materialType: shared,
      title: 'Title',
      concepts: [family, formWithShared, componentWithShared],
    });
    assert.equal(desired.ok, true);
    if (desired.ok) assert.equal(desired.form?.conceptId, formWithShared.id);
  });

  test('two forms with same reviewed alias are critical', () => {
    const shared = 'two-forms';
    const a = concept({
      id: 'form-a',
      canonicalKey: 'material-form:a',
      conceptType: 'MATERIAL_FORM',
      aliases: [{
        normalizedAlias: shared,
        source: TAXONOMY_ALIAS_SOURCE.REVIEWED_EXPLICIT,
        isActive: true,
      }],
    });
    const b = concept({
      id: 'form-b',
      canonicalKey: 'material-form:b',
      conceptType: 'MATERIAL_FORM',
      aliases: [{
        normalizedAlias: shared,
        source: TAXONOMY_ALIAS_SOURCE.REVIEWED_EXPLICIT,
        isActive: true,
      }],
    });
    const health = auditRegistryHealth({
      concepts: [family, a, b],
      reachedNormalizedEvidence: new Set(),
      sampleLimit: 10,
    });
    assert.equal(health.criticalByCode.AMBIGUOUS_MATERIAL_FORM_ALIAS ?? 0, 1);
  });

  test('component-only reviewed alias is not global form-authority critical', () => {
    const token = 'component-only';
    const componentOnly = concept({
      id: 'comp-only',
      canonicalKey: 'component:only',
      conceptType: 'COMPONENT',
      aliases: [{
        normalizedAlias: token,
        source: TAXONOMY_ALIAS_SOURCE.REVIEWED_EXPLICIT,
        isActive: true,
      }],
    });
    const health = auditRegistryHealth({
      concepts: [family, formBoard, componentOnly],
      reachedNormalizedEvidence: new Set([token]),
      sampleLimit: 20,
    });
    assert.equal(health.criticalByCode.AMBIGUOUS_MATERIAL_FORM_ALIAS ?? 0, 0);
    assert.equal(health.criticalByCode.CROSS_DOMAIN_SHARED_ALIAS ?? 0, 0);
    const desired = resolveDesiredMaterialAssignment({
      category: ownedCategory(),
      materialType: token,
      title: 'Title',
      concepts: [family, formBoard, componentOnly],
    });
    assert.equal(desired.ok, false);
    if (!desired.ok) {
      assert.equal(desired.primary, 'MATERIAL_EVIDENCE_STRUCTURAL_ERROR');
      assert.equal(desired.reason, 'WRONG_CONCEPT_TYPE');
    }
  });

  test('non-engine alias sources do not create material-form authority criticals', () => {
    const shared = 'non-engine';
    const form = concept({
      id: 'form-ne',
      canonicalKey: 'material-form:ne',
      conceptType: 'MATERIAL_FORM',
      aliases: [{
        normalizedAlias: shared,
        source: 'non-reviewed-alias',
        isActive: true,
      }],
    });
    const other = concept({
      id: 'form-ne-2',
      canonicalKey: 'material-form:ne-2',
      conceptType: 'MATERIAL_FORM',
      aliases: [{
        normalizedAlias: shared,
        source: 'also-non-reviewed',
        isActive: true,
      }],
    });
    const health = auditRegistryHealth({
      concepts: [family, form, other],
      reachedNormalizedEvidence: new Set([shared]),
      sampleLimit: 20,
    });
    assert.equal(health.criticalByCode.AMBIGUOUS_MATERIAL_FORM_ALIAS ?? 0, 0);
  });

  test('legitimate component alias alone is not a global registry failure', () => {
    const health = auditRegistryHealth({
      concepts: [family, formBoard, componentBolt],
      reachedNormalizedEvidence: new Set(),
      sampleLimit: 20,
    });
    assert.equal(
      Object.values(health.byCode).some((bucket) =>
        bucket.samples.some((sample) => sample.normalizedAlias === 'bolt')),
      false,
    );
  });

  test('reviewed mapping invalid-canonical diagnostic is distinct', () => {
    assert.equal(
      classifyReviewedMappingTargetState({
        canonicalKey: 'component:wrong',
        conflicts: new Set(),
        targets: [],
      }),
      'INVALID_CANONICAL',
    );
    assert.equal(
      classifyReviewedMappingTargetState({
        canonicalKey: 'material-form:board',
        conflicts: new Set(),
        targets: [formBoard],
      }),
      null,
    );
    assert.equal(
      classifyReviewedMappingTargetState({
        canonicalKey: 'not a key',
        conflicts: new Set(),
        targets: [],
      }),
      'INVALID_CANONICAL',
    );
  });

  test('reviewed material-form namespace conflict remains critical', () => {
    const wrong = concept({
      id: 'wrong-form-key',
      canonicalKey: 'material-form:not-really-form',
      conceptType: 'COMPONENT',
    });
    const health = auditRegistryHealth({
      concepts: [family, wrong],
      reachedNormalizedEvidence: new Set(),
      sampleLimit: 5,
    });
    assert.ok((health.criticalByCode.CANONICAL_NAMESPACE_TYPE_MISMATCH ?? 0) > 0);
  });

  test('bidirectional namespace/type mismatches are registry-critical', () => {
    const formWrongNs = concept({
      id: 'form-wrong-ns',
      canonicalKey: 'component:wrong',
      conceptType: 'MATERIAL_FORM',
    });
    const familyWrongNs = concept({
      id: 'family-wrong-ns',
      canonicalKey: 'component:wrong-family',
      conceptType: 'MATERIAL_FAMILY',
    });
    const health = auditRegistryHealth({
      concepts: [formWrongNs, familyWrongNs],
      reachedNormalizedEvidence: new Set(),
      sampleLimit: 10,
    });
    assert.equal(health.criticalByCode.CANONICAL_NAMESPACE_TYPE_MISMATCH ?? 0, 2);
    assert.equal(health.criticalByCode.MALFORMED_CANONICAL_KEY ?? 0, 0);
  });

  test('reviewed mapping invalid canonical is critical and separate from malformed syntax', () => {
    const malformedConcept = concept({
      id: 'bad-syntax',
      canonicalKey: 'not a canonical key',
      conceptType: 'MATERIAL_FORM',
    });
    const health = auditRegistryHealth({
      concepts: [family, malformedConcept],
      reachedNormalizedEvidence: new Set(),
      sampleLimit: 10,
    });
    assert.ok((health.criticalByCode.MALFORMED_CANONICAL_KEY ?? 0) >= 1);
    assert.equal(health.criticalByCode.CANONICAL_NAMESPACE_TYPE_MISMATCH ?? 0, 0);
  });

  test('registry health samples and contentHash are order-independent', () => {
    const shared = 'order-token';
    const form = concept({
      id: 'form-order',
      canonicalKey: 'material-form:order',
      conceptType: 'MATERIAL_FORM',
      aliases: [{
        normalizedAlias: shared,
        source: TAXONOMY_ALIAS_SOURCE.REVIEWED_EXPLICIT,
        isActive: true,
      }],
    });
    const component = concept({
      id: 'comp-order',
      canonicalKey: 'component:order',
      conceptType: 'COMPONENT',
      aliases: [{
        normalizedAlias: shared,
        source: TAXONOMY_ALIAS_SOURCE.REVIEWED_EXPLICIT,
        isActive: true,
      }],
    });
    const wrongNs = concept({
      id: 'wrong-ns-order',
      canonicalKey: 'component:as-form',
      conceptType: 'MATERIAL_FORM',
    });
    const normal = [family, form, component, wrongNs, formBoard];
    const reversed = [...normal].reverse();
    const permuted = [wrongNs, formBoard, component, family, form];
    const run = (concepts: MaterialConceptAssignmentRegistryConcept[]) => {
      const health = auditRegistryHealth({
        concepts,
        reachedNormalizedEvidence: new Set([shared, 'board']),
        sampleLimit: 20,
      });
      const acc = createMaterialTaxonomyAuditAccumulator(
        20,
        buildMaterialEvidenceAliasUniverse(concepts),
      );
      const mat = material({
        materialType: 'board',
        stored: [stored(family), stored(formBoard)],
      });
      const desired = resolveDesiredMaterialAssignment({
        category: ownedCategory(),
        materialType: mat.materialType,
        title: mat.title,
        concepts,
      });
      accumulateMaterialClassification(
        acc,
        classifyMaterialTaxonomyAssignment({ material: mat, desired }),
        mat.materialType,
        mat.title,
      );
      const report = buildMaterialTaxonomyAuditReport({
        generatedAt: '2026-07-24T00:00:00.000Z',
        sampleLimit: 20,
        batchSize: 10,
        timeoutMs: 60_000,
        checkMode: false,
        outputMode: 'json',
        accumulator: acc,
        concepts,
        materialTypeCatalog: {
          totalActive: 0,
          withAtLeastOneMaterial: 0,
          withActivePaidPriceRule: 0,
          resolveToReviewedForm: 0,
          resolveFamilyOnly: 0,
          ambiguous: 0,
          invalidOrMissingTarget: 0,
        },
      });
      return { health, report };
    };

    const a = run(normal);
    const b = run(reversed);
    const c = run(permuted);
    assert.deepEqual(a.health.criticalByCode, b.health.criticalByCode);
    assert.deepEqual(a.health.warningByCode, b.health.warningByCode);
    assert.deepEqual(a.health.byCode, b.health.byCode);
    assert.deepEqual(a.health, c.health);
    assert.equal(a.report.contentHash, b.report.contentHash);
    assert.equal(a.report.contentHash, c.report.contentHash);
    assert.deepEqual(a.report.registryHealth, b.report.registryHealth);
  });
});

describe('material taxonomy audit gated issue totals', () => {
  test('perGatedIssueCounts exclude historical REUSED materials', () => {
    const concepts = [family, formBoard];
    const acc = createMaterialTaxonomyAuditAccumulator(
      20,
      buildMaterialEvidenceAliasUniverse(concepts),
    );
    const operational = material({
      id: 'op-missing',
      status: 'AVAILABLE',
      materialType: 'totally-unknown',
      stored: [],
    });
    const historical = material({
      id: 'hist-missing',
      status: 'REUSED',
      materialType: 'totally-unknown',
      stored: [],
      updatedAt: '2026-07-20T00:00:00.000Z',
    });
    for (const mat of [operational, historical]) {
      const desired = resolveDesiredMaterialAssignment({
        category: ownedCategory(),
        materialType: mat.materialType,
        title: mat.title,
        concepts,
      });
      accumulateMaterialClassification(
        acc,
        classifyMaterialTaxonomyAssignment({ material: mat, desired }),
        mat.materialType,
        mat.title,
      );
    }
    const report = buildMaterialTaxonomyAuditReport({
      generatedAt: '2026-07-24T00:00:00.000Z',
      sampleLimit: 20,
      batchSize: 10,
      timeoutMs: 60_000,
      checkMode: true,
      outputMode: 'json',
      accumulator: acc,
      concepts,
      materialTypeCatalog: {
        totalActive: 0,
        withAtLeastOneMaterial: 0,
        withActivePaidPriceRule: 0,
        resolveToReviewedForm: 0,
        resolveFamilyOnly: 0,
        ambiguous: 0,
        invalidOrMissingTarget: 0,
      },
    });
    assert.equal(report.summary.perIssueCounts.MISSING_ALL_ASSIGNMENTS, 2);
    assert.equal(report.summary.perIssueCounts.MISSING_FAMILY, 2);
    assert.equal(report.summary.perGatedIssueCounts.MISSING_ALL_ASSIGNMENTS, 1);
    assert.equal(report.summary.perGatedIssueCounts.MISSING_FAMILY, 1);
    assert.equal(report.summary.gatedCriticalFailures, 1);
    assert.equal(report.summary.checkPassed, false);
  });
});

describe('material taxonomy audit streaming and coverage', () => {
  test('title fallback increments without reviewed materialType match', () => {
    const titled = concept({
      id: 'form-title-2',
      canonicalKey: 'material-form:title-2',
      conceptType: 'MATERIAL_FORM',
      aliases: [{
        normalizedAlias: 'oak plank',
        source: TAXONOMY_ALIAS_SOURCE.REVIEWED_EXPLICIT,
        isActive: true,
      }],
    });
    const concepts = [family, titled];
    const acc = createMaterialTaxonomyAuditAccumulator(
      20,
      buildMaterialEvidenceAliasUniverse(concepts),
    );
    const mat = material({
      materialType: 'unknown-material-type',
      title: 'Oak Plank',
      stored: [stored(family), stored(titled)],
    });
    const desired = resolveDesiredMaterialAssignment({
      category: ownedCategory(),
      materialType: mat.materialType,
      title: mat.title,
      concepts,
    });
    const classification = classifyMaterialTaxonomyAssignment({ material: mat, desired });
    accumulateMaterialClassification(acc, classification, mat.materialType, mat.title);
    assert.equal(acc.titleFallbackFormCount, 1);
    assert.equal(acc.materialTypeMatchCounts.unknown, 1);
    assert.equal(acc.materialTypeMatchCounts.reviewed_mapping, 0);
    assert.equal(acc.materialTypeMatchCounts.reviewed_explicit_alias, 0);
  });

  test('catalog probe title fallback does not count as MaterialType form coverage', () => {
    const titled = concept({
      id: 'form-probe',
      canonicalKey: 'material-form:probe',
      conceptType: 'MATERIAL_FORM',
      aliases: [{
        normalizedAlias: 'catalog-probe-title',
        source: TAXONOMY_ALIAS_SOURCE.REVIEWED_EXPLICIT,
        isActive: true,
      }],
    });
    const desired = resolveDesiredMaterialAssignment({
      category: ownedCategory(),
      materialType: 'unknown-catalog-type',
      title: 'catalog-probe-title',
      concepts: [family, titled],
    });
    assert.equal(desired.ok, true);
    if (desired.ok) {
      assert.ok(desired.form);
      assert.equal(desired.formFromTitleFallback, true);
    }
    assert.equal(
      classifyMaterialTypeCatalogResolution(desired),
      'resolveFamilyOnly',
    );
  });

  test('streaming totals and samples respect sampleLimit and batch independence', () => {
    const concepts = [family, formBoard];
    const universe = buildMaterialEvidenceAliasUniverse(concepts);
    const run = (sampleLimit: number) => {
      const acc = createMaterialTaxonomyAuditAccumulator(sampleLimit, universe);
      for (let index = 0; index < 25; index += 1) {
        const mat = material({
          id: `m-${String(index).padStart(2, '0')}`,
          materialType: 'board',
          stored: [],
          updatedAt: `2026-07-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
        });
        const desired = resolveDesiredMaterialAssignment({
          category: ownedCategory(),
          materialType: mat.materialType,
          title: mat.title,
          concepts,
        });
        accumulateMaterialClassification(
          acc,
          classifyMaterialTaxonomyAssignment({ material: mat, desired }),
          mat.materialType,
          mat.title,
        );
      }
      return buildMaterialTaxonomyAuditReport({
        generatedAt: '2026-07-24T00:00:00.000Z',
        sampleLimit,
        batchSize: 1,
        timeoutMs: 60_000,
        checkMode: true,
        outputMode: 'json',
        accumulator: acc,
        concepts,
        materialTypeCatalog: {
          totalActive: 0,
          withAtLeastOneMaterial: 0,
          withActivePaidPriceRule: 0,
          resolveToReviewedForm: 0,
          resolveFamilyOnly: 0,
          ambiguous: 0,
          invalidOrMissingTarget: 0,
        },
      });
    };

    const report = run(5);
    assert.equal(report.summary.totalMaterials, 25);
    for (const bucket of Object.values(report.samples.byPrimary)) {
      assert.ok(bucket.samples.length <= 5);
    }
    for (const bucket of Object.values(report.samples.byIssue)) {
      assert.ok(bucket.samples.length <= 5);
    }
    for (const bucket of Object.values(report.registryHealth.byCode)) {
      assert.ok(bucket.samples.length <= 5);
    }

    const a = createMaterialTaxonomyAuditAccumulator(20, universe);
    const b = createMaterialTaxonomyAuditAccumulator(20, universe);
    const mats = [
      material({ id: 'a', materialType: 'totally-unknown', stored: [stored(family)] }),
      material({
        id: 'b',
        materialType: 'board',
        stored: [stored(family), stored(formBoard)],
        updatedAt: '2026-07-23T00:00:00.000Z',
      }),
    ];
    for (const mat of mats) {
      const desired = resolveDesiredMaterialAssignment({
        category: ownedCategory(),
        materialType: mat.materialType,
        title: mat.title,
        concepts,
      });
      const classification = classifyMaterialTaxonomyAssignment({ material: mat, desired });
      accumulateMaterialClassification(a, classification, mat.materialType, mat.title);
      accumulateMaterialClassification(b, classification, mat.materialType, mat.title);
    }
    const reportA = buildMaterialTaxonomyAuditReport({
      generatedAt: '2026-07-24T01:00:00.000Z',
      sampleLimit: 20,
      batchSize: 1,
      timeoutMs: 10,
      checkMode: false,
      outputMode: 'json',
      accumulator: a,
      concepts,
      materialTypeCatalog: {
        totalActive: 0,
        withAtLeastOneMaterial: 0,
        withActivePaidPriceRule: 0,
        resolveToReviewedForm: 0,
        resolveFamilyOnly: 0,
        ambiguous: 0,
        invalidOrMissingTarget: 0,
      },
    });
    const reportB = buildMaterialTaxonomyAuditReport({
      generatedAt: '2026-07-24T02:00:00.000Z',
      sampleLimit: 20,
      batchSize: 100,
      timeoutMs: 99,
      checkMode: true,
      outputMode: 'text',
      accumulator: b,
      concepts,
      materialTypeCatalog: {
        totalActive: 0,
        withAtLeastOneMaterial: 0,
        withActivePaidPriceRule: 0,
        resolveToReviewedForm: 0,
        resolveFamilyOnly: 0,
        ambiguous: 0,
        invalidOrMissingTarget: 0,
      },
    });
    assert.equal(reportA.contentHash, reportB.contentHash);
    assert.equal(reportA.summary.totalMaterials, reportB.summary.totalMaterials);
  });

  test('evidence hash never embeds raw title text', () => {
    const title = 'Secret Raw Title Value';
    assert.equal(hashTaxonomyEvidence(title).includes('Secret'), false);
  });
});
