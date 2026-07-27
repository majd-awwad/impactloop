import assert from 'node:assert/strict';
import { after, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import type {
  TaxonomyConceptStatus,
  TaxonomyConceptType,
} from '../../generated/prisma/client.js';
import {
  TAXONOMY_CONCEPT_RELATION_COMPATIBILITY,
  validateTaxonomyConceptRelation,
  type TaxonomyConceptRelationEndpoint,
} from './taxonomy-concept-relation.js';

const marker = `rp028-${process.pid}-${Date.now()}`;
const conceptIds = new Set<string>();
let conceptSequence = 0;

const endpoint = (
  id: string,
  conceptType: TaxonomyConceptType,
  status: TaxonomyConceptStatus = 'ACTIVE',
): TaxonomyConceptRelationEndpoint => ({ id, conceptType, status });

const validCreateData = (input: Parameters<typeof validateTaxonomyConceptRelation>[0]) => {
  const validation = validateTaxonomyConceptRelation(input);
  if (!validation.valid) {
    throw new Error(`Expected a valid relation, received ${validation.code}.`);
  }
  return validation.createData;
};

const createConcept = async (
  conceptType: TaxonomyConceptType,
  options: {
    status?: TaxonomyConceptStatus;
    parentId?: string;
  } = {},
) => {
  conceptSequence += 1;
  const typePrefix = conceptType.toLowerCase().replaceAll('_', '-');
  const concept = await prisma.taxonomyConcept.create({
    data: {
      canonicalKey: `${typePrefix}:${marker}-${conceptSequence}`,
      conceptType,
      labelEn: `${marker} ${conceptType} ${conceptSequence}`,
      labelAr: `${marker} ${conceptType} ${conceptSequence}`,
      status: options.status ?? 'ACTIVE',
      parentId: options.parentId,
    },
  });
  conceptIds.add(concept.id);
  return concept;
};

const errorEvidence = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return String(error);
  }
  const prismaError = error as Error & { code?: string; meta?: unknown };
  return [prismaError.name, prismaError.message, prismaError.code, JSON.stringify(prismaError.meta)]
    .filter(Boolean)
    .join(' ');
};

const assertConstraintRejected = async (
  operation: () => Promise<unknown>,
  constraintName: string,
) => {
  await assert.rejects(operation, (error: unknown) => {
    assert.match(errorEvidence(error), new RegExp(constraintName, 'u'));
    return true;
  });
};

describe('RP-02.8 taxonomy relation pure contract', () => {
  test('exports the frozen directed compatibility matrix', () => {
    assert.deepEqual(TAXONOMY_CONCEPT_RELATION_COMPATIBILITY, {
      INTEREST_RELEVANT_TO: {
        sourceTypes: ['INTEREST'],
        targetTypes: ['MATERIAL_FAMILY', 'MATERIAL_FORM'],
      },
      SATISFIED_BY: {
        sourceTypes: ['COMPONENT'],
        targetTypes: ['MATERIAL_FORM'],
      },
    });
  });

  test('returns typed create data for every allowed directed combination', () => {
    const cases = [
      {
        relationType: 'INTEREST_RELEVANT_TO' as const,
        sourceConcept: endpoint('interest-family', 'INTEREST'),
        targetConcept: endpoint('family', 'MATERIAL_FAMILY'),
      },
      {
        relationType: 'INTEREST_RELEVANT_TO' as const,
        sourceConcept: endpoint('interest-form', 'INTEREST'),
        targetConcept: endpoint('interest-target-form', 'MATERIAL_FORM'),
      },
      {
        relationType: 'SATISFIED_BY' as const,
        sourceConcept: endpoint('component', 'COMPONENT'),
        targetConcept: endpoint('component-target-form', 'MATERIAL_FORM'),
      },
    ];

    for (const input of cases) {
      const result = validateTaxonomyConceptRelation(input);
      assert.equal(result.valid, true);
      if (result.valid) {
        assert.deepEqual(result.createData, {
          relationType: input.relationType,
          sourceConceptId: input.sourceConcept.id,
          sourceConceptType: input.sourceConcept.conceptType,
          targetConceptId: input.targetConcept.id,
          targetConceptType: input.targetConcept.conceptType,
        });
      }
    }
  });

  test('rejects reversed, self, and every non-matrix endpoint type', () => {
    assert.deepEqual(
      validateTaxonomyConceptRelation({
        relationType: 'INTEREST_RELEVANT_TO',
        sourceConcept: endpoint('family', 'MATERIAL_FAMILY'),
        targetConcept: endpoint('interest', 'INTEREST'),
      }),
      { valid: false, code: 'SOURCE_TYPE_MISMATCH' },
    );
    assert.deepEqual(
      validateTaxonomyConceptRelation({
        relationType: 'SATISFIED_BY',
        sourceConcept: endpoint('same', 'COMPONENT'),
        targetConcept: endpoint('same', 'MATERIAL_FORM'),
      }),
      { valid: false, code: 'SELF_RELATION' },
    );

    const allTypes: readonly TaxonomyConceptType[] = [
      'INTEREST',
      'MATERIAL_FAMILY',
      'MATERIAL_FORM',
      'PROJECT_TOPIC',
      'COMPONENT',
    ];
    for (const sourceType of allTypes.filter((type) => type !== 'INTEREST')) {
      assert.deepEqual(
        validateTaxonomyConceptRelation({
          relationType: 'INTEREST_RELEVANT_TO',
          sourceConcept: endpoint(`source-${sourceType}`, sourceType),
          targetConcept: endpoint('target-family', 'MATERIAL_FAMILY'),
        }),
        { valid: false, code: 'SOURCE_TYPE_MISMATCH' },
      );
    }
    for (const targetType of allTypes.filter(
      (type) => type !== 'MATERIAL_FAMILY' && type !== 'MATERIAL_FORM',
    )) {
      assert.deepEqual(
        validateTaxonomyConceptRelation({
          relationType: 'INTEREST_RELEVANT_TO',
          sourceConcept: endpoint('source-interest', 'INTEREST'),
          targetConcept: endpoint(`target-${targetType}`, targetType),
        }),
        { valid: false, code: 'TARGET_TYPE_MISMATCH' },
      );
    }
    for (const sourceType of allTypes.filter((type) => type !== 'COMPONENT')) {
      assert.deepEqual(
        validateTaxonomyConceptRelation({
          relationType: 'SATISFIED_BY',
          sourceConcept: endpoint(`source-${sourceType}`, sourceType),
          targetConcept: endpoint('target-form', 'MATERIAL_FORM'),
        }),
        { valid: false, code: 'SOURCE_TYPE_MISMATCH' },
      );
    }
    for (const targetType of allTypes.filter((type) => type !== 'MATERIAL_FORM')) {
      assert.deepEqual(
        validateTaxonomyConceptRelation({
          relationType: 'SATISFIED_BY',
          sourceConcept: endpoint('source-component', 'COMPONENT'),
          targetConcept: endpoint(`target-${targetType}`, targetType),
        }),
        { valid: false, code: 'TARGET_TYPE_MISMATCH' },
      );
    }
  });

  test('rejects inactive endpoints after identity and type validation', () => {
    assert.deepEqual(
      validateTaxonomyConceptRelation({
        relationType: 'INTEREST_RELEVANT_TO',
        sourceConcept: endpoint('inactive-interest', 'INTEREST', 'INACTIVE'),
        targetConcept: endpoint('family', 'MATERIAL_FAMILY'),
      }),
      { valid: false, code: 'INACTIVE_SOURCE' },
    );
    assert.deepEqual(
      validateTaxonomyConceptRelation({
        relationType: 'SATISFIED_BY',
        sourceConcept: endpoint('component', 'COMPONENT'),
        targetConcept: endpoint('inactive-form', 'MATERIAL_FORM', 'INACTIVE'),
      }),
      { valid: false, code: 'INACTIVE_TARGET' },
    );
  });
});

describe('RP-02.8 taxonomy relation persisted contract', () => {
  after(async () => {
    try {
      const ids = [...conceptIds];
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
    } finally {
      await prisma.$disconnect();
    }
  });

  test('persists all allowed relations in the declared direction', async () => {
    const interest = await createConcept('INTEREST');
    const family = await createConcept('MATERIAL_FAMILY');
    const form = await createConcept('MATERIAL_FORM');
    const component = await createConcept('COMPONENT');

    const relations = await Promise.all([
      prisma.taxonomyConceptRelation.create({
        data: validCreateData({
          relationType: 'INTEREST_RELEVANT_TO',
          sourceConcept: interest,
          targetConcept: family,
        }),
      }),
      prisma.taxonomyConceptRelation.create({
        data: validCreateData({
          relationType: 'INTEREST_RELEVANT_TO',
          sourceConcept: interest,
          targetConcept: form,
        }),
      }),
      prisma.taxonomyConceptRelation.create({
        data: validCreateData({
          relationType: 'SATISFIED_BY',
          sourceConcept: component,
          targetConcept: form,
        }),
      }),
    ]);

    assert.deepEqual(
      relations.map(({ relationType, sourceConceptType, targetConceptType }) => ({
        relationType,
        sourceConceptType,
        targetConceptType,
      })),
      [
        {
          relationType: 'INTEREST_RELEVANT_TO',
          sourceConceptType: 'INTEREST',
          targetConceptType: 'MATERIAL_FAMILY',
        },
        {
          relationType: 'INTEREST_RELEVANT_TO',
          sourceConceptType: 'INTEREST',
          targetConceptType: 'MATERIAL_FORM',
        },
        {
          relationType: 'SATISFIED_BY',
          sourceConceptType: 'COMPONENT',
          targetConceptType: 'MATERIAL_FORM',
        },
      ],
    );
  });

  test('rejects reversal and incompatible source or target types in PostgreSQL', async () => {
    const interest = await createConcept('INTEREST');
    const family = await createConcept('MATERIAL_FAMILY');
    const form = await createConcept('MATERIAL_FORM');
    const component = await createConcept('COMPONENT');

    const invalidRows = [
      {
        relationType: 'INTEREST_RELEVANT_TO' as const,
        sourceConceptId: family.id,
        sourceConceptType: 'MATERIAL_FAMILY' as const,
        targetConceptId: interest.id,
        targetConceptType: 'INTEREST' as const,
      },
      {
        relationType: 'INTEREST_RELEVANT_TO' as const,
        sourceConceptId: component.id,
        sourceConceptType: 'COMPONENT' as const,
        targetConceptId: form.id,
        targetConceptType: 'MATERIAL_FORM' as const,
      },
      {
        relationType: 'SATISFIED_BY' as const,
        sourceConceptId: component.id,
        sourceConceptType: 'COMPONENT' as const,
        targetConceptId: family.id,
        targetConceptType: 'MATERIAL_FAMILY' as const,
      },
    ];

    for (const data of invalidRows) {
      await assertConstraintRejected(
        () => prisma.taxonomyConceptRelation.create({ data }),
        'taxonomy_concept_relations_compatibility_check',
      );
    }
    assert.equal(
      await prisma.taxonomyConceptRelation.count({
        where: {
          OR: invalidRows.map(({ sourceConceptId, targetConceptId, relationType }) => ({
            sourceConceptId,
            targetConceptId,
            relationType,
          })),
        },
      }),
      0,
    );
  });

  test('binds denormalized endpoint types to the referenced concepts', async () => {
    const component = await createConcept('COMPONENT');
    const form = await createConcept('MATERIAL_FORM');

    await assertConstraintRejected(
      () => prisma.taxonomyConceptRelation.create({
        data: {
          relationType: 'INTEREST_RELEVANT_TO',
          sourceConceptId: component.id,
          sourceConceptType: 'INTEREST',
          targetConceptId: form.id,
          targetConceptType: 'MATERIAL_FORM',
        },
      }),
      'taxonomy_relations_source_concept_type_fkey',
    );
  });

  test('prevents duplicate logical relations at the database layer', async () => {
    const component = await createConcept('COMPONENT');
    const form = await createConcept('MATERIAL_FORM');
    const data = validCreateData({
      relationType: 'SATISFIED_BY',
      sourceConcept: component,
      targetConcept: form,
    });

    await prisma.taxonomyConceptRelation.create({ data });
    await assert.rejects(
      () => prisma.taxonomyConceptRelation.create({ data }),
      (error: unknown) => {
        const prismaError = error as { code?: string; meta?: unknown };
        assert.equal(prismaError.code, 'P2002');
        assert.match(errorEvidence(error), /relation_type|source_concept_id|target_concept_id/u);
        return true;
      },
    );
  });

  test('rejects a self-relation independently of endpoint type binding', async () => {
    const interest = await createConcept('INTEREST');

    await assertConstraintRejected(
      () => prisma.taxonomyConceptRelation.create({
        data: {
          relationType: 'INTEREST_RELEVANT_TO',
          sourceConceptId: interest.id,
          sourceConceptType: 'INTEREST',
          targetConceptId: interest.id,
          targetConceptType: 'MATERIAL_FAMILY',
        },
      }),
      'taxonomy_concept_relations_distinct_concepts_check',
    );
  });

  test('cascades relation deletion when either endpoint is deleted', async () => {
    const sourceToDelete = await createConcept('INTEREST');
    const firstTarget = await createConcept('MATERIAL_FAMILY');
    const firstRelation = await prisma.taxonomyConceptRelation.create({
      data: validCreateData({
        relationType: 'INTEREST_RELEVANT_TO',
        sourceConcept: sourceToDelete,
        targetConcept: firstTarget,
      }),
    });

    await prisma.taxonomyConcept.delete({ where: { id: sourceToDelete.id } });
    assert.equal(
      await prisma.taxonomyConceptRelation.count({ where: { id: firstRelation.id } }),
      0,
    );
    assert.equal(await prisma.taxonomyConcept.count({ where: { id: firstTarget.id } }), 1);

    const secondSource = await createConcept('COMPONENT');
    const targetToDelete = await createConcept('MATERIAL_FORM');
    const secondRelation = await prisma.taxonomyConceptRelation.create({
      data: validCreateData({
        relationType: 'SATISFIED_BY',
        sourceConcept: secondSource,
        targetConcept: targetToDelete,
      }),
    });

    await prisma.taxonomyConcept.delete({ where: { id: targetToDelete.id } });
    assert.equal(
      await prisma.taxonomyConceptRelation.count({ where: { id: secondRelation.id } }),
      0,
    );
    assert.equal(await prisma.taxonomyConcept.count({ where: { id: secondSource.id } }), 1);
  });

  test('cascades compatible type updates and rejects incompatible updates', async () => {
    const interest = await createConcept('INTEREST');
    const target = await createConcept('MATERIAL_FAMILY');
    const relation = await prisma.taxonomyConceptRelation.create({
      data: validCreateData({
        relationType: 'INTEREST_RELEVANT_TO',
        sourceConcept: interest,
        targetConcept: target,
      }),
    });

    await prisma.taxonomyConcept.update({
      where: { id: target.id },
      data: { conceptType: 'MATERIAL_FORM' },
    });
    assert.equal(
      (await prisma.taxonomyConceptRelation.findUniqueOrThrow({ where: { id: relation.id } }))
        .targetConceptType,
      'MATERIAL_FORM',
    );

    await assertConstraintRejected(
      () => prisma.taxonomyConcept.update({
        where: { id: target.id },
        data: { conceptType: 'COMPONENT' },
      }),
      'taxonomy_concept_relations_compatibility_check',
    );
    assert.equal(
      (await prisma.taxonomyConcept.findUniqueOrThrow({ where: { id: target.id } })).conceptType,
      'MATERIAL_FORM',
    );
  });

  test('retains stored relations but marks them unusable while either endpoint is inactive', async () => {
    const component = await createConcept('COMPONENT');
    const form = await createConcept('MATERIAL_FORM');
    const relation = await prisma.taxonomyConceptRelation.create({
      data: validCreateData({
        relationType: 'SATISFIED_BY',
        sourceConcept: component,
        targetConcept: form,
      }),
    });

    const inactiveSource = await prisma.taxonomyConcept.update({
      where: { id: component.id },
      data: { status: 'INACTIVE' },
    });
    assert.equal(await prisma.taxonomyConceptRelation.count({ where: { id: relation.id } }), 1);
    assert.deepEqual(
      validateTaxonomyConceptRelation({
        relationType: relation.relationType,
        sourceConcept: inactiveSource,
        targetConcept: form,
      }),
      { valid: false, code: 'INACTIVE_SOURCE' },
    );

    const activeSource = await prisma.taxonomyConcept.update({
      where: { id: component.id },
      data: { status: 'ACTIVE' },
    });
    const inactiveTarget = await prisma.taxonomyConcept.update({
      where: { id: form.id },
      data: { status: 'INACTIVE' },
    });
    assert.deepEqual(
      validateTaxonomyConceptRelation({
        relationType: relation.relationType,
        sourceConcept: activeSource,
        targetConcept: inactiveTarget,
      }),
      { valid: false, code: 'INACTIVE_TARGET' },
    );

    const activeTarget = await prisma.taxonomyConcept.update({
      where: { id: form.id },
      data: { status: 'ACTIVE' },
    });
    assert.equal(
      validateTaxonomyConceptRelation({
        relationType: relation.relationType,
        sourceConcept: activeSource,
        targetConcept: activeTarget,
      }).valid,
      true,
    );
    assert.equal(await prisma.taxonomyConceptRelation.count({ where: { id: relation.id } }), 1);
  });

  test('keeps parentId hierarchy behavior separate from semantic relations', async () => {
    const parent = await createConcept('MATERIAL_FAMILY');
    const child = await createConcept('MATERIAL_FORM', { parentId: parent.id });
    const interest = await createConcept('INTEREST');
    const relation = await prisma.taxonomyConceptRelation.create({
      data: validCreateData({
        relationType: 'INTEREST_RELEVANT_TO',
        sourceConcept: interest,
        targetConcept: child,
      }),
    });

    assert.equal(
      (await prisma.taxonomyConcept.findUniqueOrThrow({ where: { id: child.id } })).parentId,
      parent.id,
    );
    await prisma.taxonomyConceptRelation.delete({ where: { id: relation.id } });
    assert.equal(
      (await prisma.taxonomyConcept.findUniqueOrThrow({ where: { id: child.id } })).parentId,
      parent.id,
    );

    await prisma.taxonomyConcept.delete({ where: { id: parent.id } });
    assert.equal(
      (await prisma.taxonomyConcept.findUniqueOrThrow({ where: { id: child.id } })).parentId,
      null,
    );
  });
});
