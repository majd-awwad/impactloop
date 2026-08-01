import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import type { TaxonomyConceptType } from '../../generated/prisma/client.js';
import {
  prismaTaxonomyCompatibilityReader,
  TaxonomyCompatibilityQueryInputError,
  TaxonomyCompatibilityRepository,
  type TaxonomyCompatibilityReader,
} from './taxonomy-compatibility.repository.js';
import { validateTaxonomyConceptRelation } from './taxonomy-concept-relation.js';

const marker = `lm03-${process.pid}-${Date.now()}`;
const conceptIds = new Set<string>();
let sequence = 0;

const createConcept = async (conceptType: TaxonomyConceptType) => {
  sequence += 1;
  const namespace = conceptType.toLowerCase().replaceAll('_', '-');
  const concept = await prisma.taxonomyConcept.create({
    data: {
      canonicalKey: `${namespace}:${marker}-${sequence}`,
      conceptType,
      labelEn: `${marker} ${sequence}`,
      labelAr: `${marker} ${sequence}`,
      status: 'ACTIVE',
    },
  });
  conceptIds.add(concept.id);
  return concept;
};

const createRelation = async (
  relationType: 'INTEREST_RELEVANT_TO' | 'SATISFIED_BY',
  sourceConcept: Awaited<ReturnType<typeof createConcept>>,
  targetConcept: Awaited<ReturnType<typeof createConcept>>,
) => {
  const validation = validateTaxonomyConceptRelation({
    relationType,
    sourceConcept,
    targetConcept,
  });
  assert.equal(validation.valid, true);
  if (!validation.valid) throw new Error('unexpected_invalid_relation');
  return prisma.taxonomyConceptRelation.create({ data: validation.createData });
};

describe('LM-03 taxonomy compatibility batch query', () => {
  let interestA: Awaited<ReturnType<typeof createConcept>>;
  let interestB: Awaited<ReturnType<typeof createConcept>>;
  let inactiveInterest: Awaited<ReturnType<typeof createConcept>>;
  let family: Awaited<ReturnType<typeof createConcept>>;
  let form: Awaited<ReturnType<typeof createConcept>>;
  let inactiveForm: Awaited<ReturnType<typeof createConcept>>;
  let component: Awaited<ReturnType<typeof createConcept>>;
  const extraFamilies: Array<Awaited<ReturnType<typeof createConcept>>> = [];

  before(async () => {
    interestA = await createConcept('INTEREST');
    interestB = await createConcept('INTEREST');
    inactiveInterest = await createConcept('INTEREST');
    family = await createConcept('MATERIAL_FAMILY');
    form = await createConcept('MATERIAL_FORM');
    inactiveForm = await createConcept('MATERIAL_FORM');
    component = await createConcept('COMPONENT');
    await createRelation('INTEREST_RELEVANT_TO', interestA, family);
    await createRelation('INTEREST_RELEVANT_TO', interestA, form);
    await createRelation('INTEREST_RELEVANT_TO', interestB, family);
    await createRelation('INTEREST_RELEVANT_TO', inactiveInterest, family);
    await createRelation('INTEREST_RELEVANT_TO', interestB, inactiveForm);
    await createRelation('SATISFIED_BY', component, form);
    for (let index = 0; index < 9; index += 1) {
      const extra = await createConcept('MATERIAL_FAMILY');
      extraFamilies.push(extra);
      await createRelation('INTEREST_RELEVANT_TO', interestA, extra);
    }
    await prisma.taxonomyConcept.update({
      where: { id: inactiveInterest.id },
      data: { status: 'INACTIVE' },
    });
    await prisma.taxonomyConcept.update({
      where: { id: inactiveForm.id },
      data: { status: 'INACTIVE' },
    });
  });

  after(async () => {
    try {
      const ids = [...conceptIds];
      await prisma.taxonomyConceptRelation.deleteMany({
        where: {
          OR: [
            { sourceConceptId: { in: ids } },
            { targetConceptId: { in: ids } },
          ],
        },
      });
      await prisma.taxonomyConcept.deleteMany({ where: { id: { in: ids } } });
    } finally {
      await prisma.$disconnect();
    }
  });

  test('resolves multiple sources in one deterministic deduplicated batch', async () => {
    let queryCount = 0;
    const reader: TaxonomyCompatibilityReader = {
      findSourceConcepts: async (keys) => {
        queryCount += 1;
        return prismaTaxonomyCompatibilityReader.findSourceConcepts(keys);
      },
      findOutgoingRelations: async (input) => {
        queryCount += 1;
        return prismaTaxonomyCompatibilityReader.findOutgoingRelations(input);
      },
    };
    const result = await new TaxonomyCompatibilityRepository(reader).queryBatch({
      relationType: 'INTEREST_RELEVANT_TO',
      sourceCanonicalKeys: [
        interestB.canonicalKey,
        interestA.canonicalKey,
        interestA.canonicalKey,
      ],
      expectedSourceConceptTypes: ['INTEREST'],
      expectedTargetConceptTypes: ['MATERIAL_FAMILY', 'MATERIAL_FORM'],
    });
    assert.equal(queryCount, 2);
    assert.equal(result.matches.length, 2);
    assert.deepEqual(
      result.matches.map((entry) => entry.sourceCanonicalKey),
      [interestA.canonicalKey, interestB.canonicalKey].sort(),
    );
    const first = result.matches.find(
      (entry) => entry.sourceCanonicalKey === interestA.canonicalKey,
    );
    assert.ok(first);
    assert.deepEqual(first.targetCanonicalKeys, [
      ...new Set([
        family.canonicalKey,
        form.canonicalKey,
        ...extraFamilies.map((entry) => entry.canonicalKey),
      ]),
    ].sort());
    assert.equal(result.diagnostics.requestedSourceCount, 3);
    assert.equal(result.diagnostics.uniqueSourceCount, 2);
  });

  test('preserves SATISFIED_BY direction and fails closed for wrong direction/type', async () => {
    const repository = new TaxonomyCompatibilityRepository();
    const satisfied = await repository.queryBatch({
      relationType: 'SATISFIED_BY',
      sourceCanonicalKeys: [component.canonicalKey],
      expectedSourceConceptTypes: ['COMPONENT'],
      expectedTargetConceptTypes: ['MATERIAL_FORM'],
    });
    assert.deepEqual(satisfied.matches[0]?.targetCanonicalKeys, [form.canonicalKey]);

    const reversed = await repository.queryBatch({
      relationType: 'INTEREST_RELEVANT_TO',
      sourceCanonicalKeys: [family.canonicalKey],
      expectedSourceConceptTypes: ['INTEREST'],
      expectedTargetConceptTypes: ['MATERIAL_FAMILY'],
    });
    assert.deepEqual(reversed.matches[0]?.targetCanonicalKeys, []);
    assert.equal(reversed.diagnostics.rejectedCounts.SOURCE_TYPE_MISMATCH, 1);

    const wrongType = await repository.queryBatch({
      relationType: 'SATISFIED_BY',
      sourceCanonicalKeys: [interestA.canonicalKey],
      expectedSourceConceptTypes: ['COMPONENT'],
      expectedTargetConceptTypes: ['MATERIAL_FORM'],
    });
    assert.deepEqual(wrongType.matches[0]?.targetCanonicalKeys, []);
    assert.equal(wrongType.diagnostics.rejectedCounts.SOURCE_TYPE_MISMATCH, 1);
    await assert.rejects(
      () =>
        repository.queryBatch({
          relationType: 'SATISFIED_BY',
          sourceCanonicalKeys: [component.canonicalKey],
          expectedSourceConceptTypes: ['INTEREST'],
          expectedTargetConceptTypes: ['MATERIAL_FORM'],
        }),
      TaxonomyCompatibilityQueryInputError,
    );
  });

  test('diagnoses unknown and inactive sources and inactive targets', async () => {
    const repository = new TaxonomyCompatibilityRepository();
    const sources = await repository.queryBatch({
      relationType: 'INTEREST_RELEVANT_TO',
      sourceCanonicalKeys: [
        `interest:${marker}-unknown`,
        inactiveInterest.canonicalKey,
      ],
      expectedSourceConceptTypes: ['INTEREST'],
      expectedTargetConceptTypes: ['MATERIAL_FAMILY', 'MATERIAL_FORM'],
    });
    assert.equal(sources.diagnostics.rejectedCounts.UNKNOWN_SOURCE, 1);
    assert.equal(sources.diagnostics.rejectedCounts.INACTIVE_SOURCE, 1);
    assert.ok(sources.matches.every((entry) => entry.targetCanonicalKeys.length === 0));

    const targets = await repository.queryBatch({
      relationType: 'INTEREST_RELEVANT_TO',
      sourceCanonicalKeys: [interestB.canonicalKey],
      expectedSourceConceptTypes: ['INTEREST'],
      expectedTargetConceptTypes: ['MATERIAL_FAMILY', 'MATERIAL_FORM'],
    });
    assert.equal(targets.diagnostics.rejectedCounts.INACTIVE_TARGET, 1);
    assert.ok(!targets.matches[0]?.targetCanonicalKeys.includes(inactiveForm.canonicalKey));
  });

  test('bounds diagnostics while retaining exact rejection totals', async () => {
    const result = await new TaxonomyCompatibilityRepository().queryBatch({
      relationType: 'INTEREST_RELEVANT_TO',
      sourceCanonicalKeys: [interestA.canonicalKey],
      expectedSourceConceptTypes: ['INTEREST'],
      expectedTargetConceptTypes: ['MATERIAL_FORM'],
      diagnosticLimit: 3,
    });
    assert.equal(result.diagnostics.rejectedCounts.TARGET_TYPE_MISMATCH, 10);
    const bucket = result.diagnostics.rejectedSamples.TARGET_TYPE_MISMATCH;
    assert.equal(bucket?.total, 10);
    assert.equal(bucket?.sample.length, 3);
    assert.equal(bucket?.sampleLimit, 3);
    assert.equal(bucket?.truncated, true);
  });

  test('defensively rejects malformed and duplicate rows returned by the reader', async () => {
    const malformedReader: TaxonomyCompatibilityReader = {
      findSourceConcepts: (keys) =>
        prismaTaxonomyCompatibilityReader.findSourceConcepts(keys),
      findOutgoingRelations: async (input) => {
        const rows = await prismaTaxonomyCompatibilityReader.findOutgoingRelations(
          input,
        );
        const first = rows[0]!;
        return [
          {
            ...first,
            sourceConceptType: 'COMPONENT' as const,
          },
          ...rows.slice(1),
          rows[1]!,
        ];
      },
    };
    const result = await new TaxonomyCompatibilityRepository(
      malformedReader,
    ).queryBatch({
      relationType: 'INTEREST_RELEVANT_TO',
      sourceCanonicalKeys: [interestA.canonicalKey],
      expectedSourceConceptTypes: ['INTEREST'],
      expectedTargetConceptTypes: ['MATERIAL_FAMILY', 'MATERIAL_FORM'],
    });
    assert.equal(result.diagnostics.rejectedCounts.MALFORMED_SOURCE_ENDPOINT, 1);
    assert.equal(result.diagnostics.rejectedCounts.DUPLICATE_USABLE_MATCH, 1);
  });

  test('empty input performs no queries', async () => {
    let queryCount = 0;
    const reader: TaxonomyCompatibilityReader = {
      findSourceConcepts: async () => {
        queryCount += 1;
        return [];
      },
      findOutgoingRelations: async () => {
        queryCount += 1;
        return [];
      },
    };
    const result = await new TaxonomyCompatibilityRepository(reader).queryBatch({
      relationType: 'INTEREST_RELEVANT_TO',
      sourceCanonicalKeys: [],
      expectedSourceConceptTypes: ['INTEREST'],
      expectedTargetConceptTypes: ['MATERIAL_FAMILY'],
    });
    assert.equal(queryCount, 0);
    assert.deepEqual(result.matches, []);
  });
});
