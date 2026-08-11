import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import type {
  TaxonomyConceptStatus,
  TaxonomyConceptType,
} from '../../generated/prisma/client.js';
import {
  TAXONOMY_COMPATIBILITY_RELATION_SEEDS,
  type TaxonomyCompatibilityRelationSeed,
} from './taxonomy-compatibility-relations.data.js';
import { seedTaxonomyCompatibilityRelations } from './taxonomy-compatibility-relations.seed.js';
import { validateTaxonomyConceptRelation } from './taxonomy-concept-relation.js';
import { seedTaxonomyFoundation } from './taxonomy-foundation.repository.js';

const marker = `lm02-${process.pid}-${Date.now()}`;
const syntheticConceptIds = new Set<string>();
let sequence = 0;

const prefixForType: Record<TaxonomyConceptType, string> = {
  INTEREST: 'interest',
  MATERIAL_FAMILY: 'material-family',
  MATERIAL_FORM: 'material-form',
  PROJECT_TOPIC: 'project-topic',
  COMPONENT: 'component',
};

const createSyntheticConcept = async (
  conceptType: TaxonomyConceptType,
  status: TaxonomyConceptStatus = 'ACTIVE',
) => {
  sequence += 1;
  const canonicalKey = `${prefixForType[conceptType]}:${marker}-${sequence}`;
  const concept = await prisma.taxonomyConcept.create({
    data: {
      canonicalKey,
      conceptType,
      labelEn: canonicalKey,
      labelAr: canonicalKey,
      status,
    },
  });
  syntheticConceptIds.add(concept.id);
  return concept;
};

const interestRelation = (
  sourceCanonicalKey: string,
  targetCanonicalKey: string,
  targetConceptType: 'MATERIAL_FAMILY' | 'MATERIAL_FORM' = 'MATERIAL_FAMILY',
): TaxonomyCompatibilityRelationSeed => ({
  relationType: 'INTEREST_RELEVANT_TO',
  sourceCanonicalKey,
  sourceConceptType: 'INTEREST',
  targetCanonicalKey,
  targetConceptType,
});

const relationRows = async () => {
  const concepts = await prisma.taxonomyConcept.findMany({
    where: {
      canonicalKey: {
        in: [...new Set(TAXONOMY_COMPATIBILITY_RELATION_SEEDS.flatMap((relation) => [
          relation.sourceCanonicalKey,
          relation.targetCanonicalKey,
        ]))],
      },
    },
    select: { id: true, canonicalKey: true },
  });
  const ids = new Map(concepts.map((concept) => [concept.canonicalKey, concept.id]));

  return Promise.all(TAXONOMY_COMPATIBILITY_RELATION_SEEDS.map((relation) =>
    prisma.taxonomyConceptRelation.findUnique({
      where: {
        relationType_sourceConceptId_targetConceptId: {
          relationType: relation.relationType,
          sourceConceptId: ids.get(relation.sourceCanonicalKey)!,
          targetConceptId: ids.get(relation.targetCanonicalKey)!,
        },
      },
    }),
  ));
};

describe('LM-02 taxonomy compatibility seed integration', { concurrency: false }, () => {
  before(async () => {
    await seedTaxonomyFoundation();
  });

  after(async () => {
    const ids = [...syntheticConceptIds];
    if (ids.length > 0) {
      await prisma.taxonomyConceptRelation.deleteMany({
        where: {
          OR: [
            { sourceConceptId: { in: ids } },
            { targetConceptId: { in: ids } },
          ],
        },
      });
      await prisma.taxonomyConcept.updateMany({
        where: { id: { in: ids } },
        data: { parentId: null },
      });
      await prisma.taxonomyConcept.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.$disconnect();
  });

  test('seeds the foundation first and inserts every reviewed relation', async () => {
    const requiredKeys = [...new Set(TAXONOMY_COMPATIBILITY_RELATION_SEEDS.flatMap((relation) => [
      relation.sourceCanonicalKey,
      relation.targetCanonicalKey,
    ]))];
    assert.equal(
      await prisma.taxonomyConcept.count({ where: { canonicalKey: { in: requiredKeys } } }),
      requiredKeys.length,
    );

    const result = await seedTaxonomyCompatibilityRelations();
    assert.equal(result.expectedCount, TAXONOMY_COMPATIBILITY_RELATION_SEEDS.length);
    assert.equal(result.createdCount + result.existingCount, TAXONOMY_COMPATIBILITY_RELATION_SEEDS.length);

    const rows = await relationRows();
    assert.equal(rows.every(Boolean), true);
    assert.deepEqual(
      rows.map((row) => row && [row.relationType, row.sourceConceptType, row.targetConceptType]),
      TAXONOMY_COMPATIBILITY_RELATION_SEEDS.map((relation) => [
        relation.relationType,
        relation.sourceConceptType,
        relation.targetConceptType,
      ]),
    );
  });

  test('rerunning creates no duplicates and leaves an exact row unchanged', async () => {
    const beforeRows = await relationRows();
    const exactBefore = beforeRows[0]!;

    const result = await seedTaxonomyCompatibilityRelations();
    const exactAfter = (await relationRows())[0]!;

    assert.deepEqual(result, {
      expectedCount: TAXONOMY_COMPATIBILITY_RELATION_SEEDS.length,
      existingCount: TAXONOMY_COMPATIBILITY_RELATION_SEEDS.length,
      createdCount: 0,
    });
    assert.deepEqual(exactAfter, exactBefore);
  });

  test('preserves an unrelated pre-existing relation', async () => {
    const source = await createSyntheticConcept('INTEREST');
    const target = await createSyntheticConcept('MATERIAL_FAMILY');
    const validation = validateTaxonomyConceptRelation({
      relationType: 'INTEREST_RELEVANT_TO',
      sourceConcept: source,
      targetConcept: target,
    });
    assert.equal(validation.valid, true);
    if (!validation.valid) return;

    const unrelatedBefore = await prisma.taxonomyConceptRelation.create({
      data: validation.createData,
    });
    await seedTaxonomyCompatibilityRelations();
    const unrelatedAfter = await prisma.taxonomyConceptRelation.findUniqueOrThrow({
      where: { id: unrelatedBefore.id },
    });
    assert.deepEqual(unrelatedAfter, unrelatedBefore);
  });

  test('fails closed for a missing source or target', async () => {
    const source = await createSyntheticConcept('INTEREST');
    const target = await createSyntheticConcept('MATERIAL_FAMILY');

    await assert.rejects(
      () => seedTaxonomyCompatibilityRelations([
        interestRelation(`interest:${marker}-missing-source`, target.canonicalKey),
      ]),
      /Missing taxonomy concept: interest:lm02-/,
    );
    await assert.rejects(
      () => seedTaxonomyCompatibilityRelations([
        interestRelation(source.canonicalKey, `material-family:${marker}-missing-target`),
      ]),
      /Missing taxonomy concept: material-family:lm02-/,
    );
  });

  test('fails closed for inactive source and target concepts', async () => {
    const inactiveSource = await createSyntheticConcept('INTEREST', 'INACTIVE');
    const activeTarget = await createSyntheticConcept('MATERIAL_FAMILY');
    await assert.rejects(
      () => seedTaxonomyCompatibilityRelations([
        interestRelation(inactiveSource.canonicalKey, activeTarget.canonicalKey),
      ]),
      /INACTIVE_SOURCE/,
    );

    const activeSource = await createSyntheticConcept('INTEREST');
    const inactiveTarget = await createSyntheticConcept('MATERIAL_FAMILY', 'INACTIVE');
    await assert.rejects(
      () => seedTaxonomyCompatibilityRelations([
        interestRelation(activeSource.canonicalKey, inactiveTarget.canonicalKey),
      ]),
      /INACTIVE_TARGET/,
    );
  });

  test('fails closed when stored source or target types differ from the matrix', async () => {
    const wrongSource = await createSyntheticConcept('COMPONENT');
    const family = await createSyntheticConcept('MATERIAL_FAMILY');
    await assert.rejects(
      () => seedTaxonomyCompatibilityRelations([
        interestRelation(wrongSource.canonicalKey, family.canonicalKey),
      ]),
      /type mismatch.*expected INTEREST, found COMPONENT/,
    );

    const interest = await createSyntheticConcept('INTEREST');
    const wrongTarget = await createSyntheticConcept('COMPONENT');
    await assert.rejects(
      () => seedTaxonomyCompatibilityRelations([
        interestRelation(interest.canonicalKey, wrongTarget.canonicalKey),
      ]),
      /type mismatch.*expected MATERIAL_FAMILY, found COMPONENT/,
    );
  });

  test('rolls back an earlier create when a later relation fails', async () => {
    const source = await createSyntheticConcept('INTEREST');
    const target = await createSyntheticConcept('MATERIAL_FAMILY');
    const missingSourceKey = `interest:${marker}-rollback-missing`;

    await assert.rejects(
      () => seedTaxonomyCompatibilityRelations([
        interestRelation(source.canonicalKey, target.canonicalKey),
        interestRelation(missingSourceKey, target.canonicalKey),
      ]),
      /Missing taxonomy concept/,
    );

    assert.equal(
      await prisma.taxonomyConceptRelation.count({
        where: {
          relationType: 'INTEREST_RELEVANT_TO',
          sourceConceptId: source.id,
          targetConceptId: target.id,
        },
      }),
      0,
    );
  });

  test('does not modify any taxonomy concept row', async () => {
    const keys = [...new Set(TAXONOMY_COMPATIBILITY_RELATION_SEEDS.flatMap((relation) => [
      relation.sourceCanonicalKey,
      relation.targetCanonicalKey,
    ]))];
    const beforeRows = await prisma.taxonomyConcept.findMany({
      where: { canonicalKey: { in: keys } },
      orderBy: { canonicalKey: 'asc' },
    });

    await seedTaxonomyCompatibilityRelations();

    const afterRows = await prisma.taxonomyConcept.findMany({
      where: { canonicalKey: { in: keys } },
      orderBy: { canonicalKey: 'asc' },
    });
    assert.deepEqual(afterRows, beforeRows);
  });
});
