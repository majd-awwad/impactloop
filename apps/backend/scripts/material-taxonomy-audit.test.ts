import assert from 'node:assert/strict';
import test from 'node:test';

import { Prisma } from '../src/generated/prisma/client.js';
import { TAXONOMY_ALIAS_SOURCE } from '../src/modules/taxonomy/learner-interest-resolver.js';
import type { MaterialConceptAssignmentRegistryConcept } from '../src/modules/taxonomy/material-concept-assignment.js';
import type { MaterialTaxonomyAuditReport } from '../src/modules/taxonomy/material-taxonomy-audit.js';
import {
  MaterialTaxonomyAuditCliUsageError,
  executeMaterialTaxonomyAudit,
  parseMaterialTaxonomyAuditCliArgs,
  runMaterialTaxonomyAudit,
  type MaterialTaxonomyAuditClient,
  type MaterialTaxonomyAuditTxClient,
} from './material-taxonomy-audit.js';

const family: MaterialConceptAssignmentRegistryConcept = {
  id: 'fam-1',
  canonicalKey: 'material-family:wood',
  conceptType: 'MATERIAL_FAMILY',
  status: 'ACTIVE',
  aliases: [],
};

const formBoard: MaterialConceptAssignmentRegistryConcept = {
  id: 'form-board',
  canonicalKey: 'material-form:board',
  conceptType: 'MATERIAL_FORM',
  status: 'ACTIVE',
  aliases: [
    {
      normalizedAlias: 'board',
      source: TAXONOMY_ALIAS_SOURCE.REVIEWED_EXPLICIT,
      isActive: true,
    },
  ],
};

type FixtureMaterial = {
  id: string;
  status: 'AVAILABLE' | 'PENDING_RESERVATION' | 'RESERVED' | 'REUSED' | 'UNAVAILABLE';
  categoryId: string;
  materialType: string;
  title: string;
  updatedAt: Date;
  concepts: Array<{
    conceptId: string;
    canonicalKey: string;
    conceptType: string;
    status: string;
  }>;
};

const taxonomyRepository = {
  loadMaterialConceptAssignmentConcepts: async () => [family, formBoard],
};

const createMockClient = (input: {
  materials: FixtureMaterial[];
  failTransaction?: Error;
  onTransactionOptions?: (options: {
    isolationLevel: typeof Prisma.TransactionIsolationLevel.RepeatableRead;
    timeout: number;
    maxWait: number;
  }) => void;
}): {
  client: MaterialTaxonomyAuditClient;
  queryCounts: { material: number; materialConcept: number };
  disconnectCount: { value: number };
} => {
  const queryCounts = { material: 0, materialConcept: 0 };
  const disconnectCount = { value: 0 };

  const tx: MaterialTaxonomyAuditTxClient = {
    material: {
      findMany: async (args) => {
        queryCounts.material += 1;
        return input.materials
          .filter((row) => row.id > args.where.id.gt)
          .sort((left, right) => (left.id < right.id ? -1 : 1))
          .slice(0, args.take)
          .map((row) => ({
            id: row.id,
            status: row.status,
            categoryId: row.categoryId,
            materialType: row.materialType,
            title: row.title,
            updatedAt: row.updatedAt,
          }));
      },
    },
    materialConcept: {
      findMany: async (args) => {
        queryCounts.materialConcept += 1;
        const idSet = new Set(args.where.materialId.in);
        const rows = input.materials
          .filter((material) => idSet.has(material.id))
          .flatMap((material) =>
            material.concepts.map((concept) => ({
              materialId: material.id,
              conceptId: concept.conceptId,
              createdAt: new Date('2026-07-01T00:00:00.000Z'),
              concept: {
                id: concept.conceptId,
                canonicalKey: concept.canonicalKey,
                conceptType: concept.conceptType,
                status: concept.status,
              },
            })));
        rows.sort((left, right) =>
          left.materialId < right.materialId
            ? -1
            : left.materialId > right.materialId
              ? 1
              : left.conceptId < right.conceptId
                ? -1
                : left.conceptId > right.conceptId
                  ? 1
                  : 0);
        return rows;
      },
    },
    category: {
      findMany: async () => [
        {
          id: 'cat-wood',
          categoryType: 'MATERIAL' as const,
          isActive: true,
          materialFamilyConceptId: family.id,
          materialFamilyConcept: {
            id: family.id,
            canonicalKey: family.canonicalKey,
            conceptType: 'MATERIAL_FAMILY' as const,
            status: 'ACTIVE' as const,
          },
        },
      ],
    },
    materialType: {
      findMany: async () => [],
    },
  };

  const client: MaterialTaxonomyAuditClient = {
    $transaction: async (fn, options) => {
      input.onTransactionOptions?.(options);
      if (input.failTransaction) {
        throw input.failTransaction;
      }
      return fn(tx);
    },
    $disconnect: async () => {
      disconnectCount.value += 1;
    },
  };

  return { client, queryCounts, disconnectCount };
};

test('parseMaterialTaxonomyAuditCliArgs accepts report and check modes', () => {
  assert.deepEqual(parseMaterialTaxonomyAuditCliArgs(['--json']), {
    json: true,
    check: false,
    sampleLimit: 20,
    batchSize: 100,
    timeoutMs: 60_000,
    help: false,
  });
  assert.equal(parseMaterialTaxonomyAuditCliArgs(['--check', '--json']).check, true);
  assert.equal(parseMaterialTaxonomyAuditCliArgs(['--help']).help, true);
});

test('parseMaterialTaxonomyAuditCliArgs rejects unknown and write flags', () => {
  assert.throws(
    () => parseMaterialTaxonomyAuditCliArgs(['--repair']),
    MaterialTaxonomyAuditCliUsageError,
  );
  assert.throws(
    () => parseMaterialTaxonomyAuditCliArgs(['--nope']),
    MaterialTaxonomyAuditCliUsageError,
  );
  assert.throws(
    () => parseMaterialTaxonomyAuditCliArgs(['--sample-limit', '999']),
    MaterialTaxonomyAuditCliUsageError,
  );
  assert.throws(
    () => parseMaterialTaxonomyAuditCliArgs(['positional']),
    MaterialTaxonomyAuditCliUsageError,
  );
  assert.throws(
    () => parseMaterialTaxonomyAuditCliArgs(['--batch-size', '0']),
    MaterialTaxonomyAuditCliUsageError,
  );
});

test('report mode exits 0 with findings; check mode exits 1 on critical fixture', async () => {
  const materials: FixtureMaterial[] = [
    {
      id: 'm1',
      status: 'AVAILABLE',
      categoryId: 'cat-wood',
      materialType: 'board',
      title: 'Board Offcut',
      updatedAt: new Date('2026-07-20T00:00:00.000Z'),
      concepts: [],
    },
  ];

  let sawRepeatableRead = false;
  const { client, disconnectCount } = createMockClient({
    materials,
    onTransactionOptions: (options) => {
      sawRepeatableRead =
        options.isolationLevel
        === Prisma.TransactionIsolationLevel.RepeatableRead;
    },
  });

  const outputs: string[] = [];
  const reportExecution = await executeMaterialTaxonomyAudit({
    client,
    args: ['--json'],
    write: (output) => {
      outputs.push(output);
    },
    generatedAt: '2026-07-24T00:00:00.000Z',
    taxonomyRepository: taxonomyRepository as never,
  });

  assert.equal(reportExecution.exitCode, 0);
  assert.equal(disconnectCount.value, 1);
  assert.equal(sawRepeatableRead, true);
  assert.equal(outputs.join('').includes('Board Offcut'), false);
  assert.ok(reportExecution.report);
  assert.equal(reportExecution.report?.assignmentCoverage.missingAll, 1);

  const checkOutputs: string[] = [];
  const { client: checkClient, disconnectCount: checkDisconnect } =
    createMockClient({ materials });
  const checkExecution = await executeMaterialTaxonomyAudit({
    client: checkClient,
    args: ['--check', '--json'],
    write: (output) => {
      checkOutputs.push(output);
    },
    generatedAt: '2026-07-24T00:00:00.000Z',
    taxonomyRepository: taxonomyRepository as never,
  });

  assert.equal(checkExecution.exitCode, 1);
  assert.equal(checkDisconnect.value, 1);
  assert.ok(checkOutputs.length > 0);
});

test('pagination batch sizes produce identical totals and contentHash', async () => {
  const materials: FixtureMaterial[] = [
    {
      id: 'a',
      status: 'AVAILABLE',
      categoryId: 'cat-wood',
      materialType: 'totally-unknown',
      title: 'A',
      updatedAt: new Date('2026-07-21T00:00:00.000Z'),
      concepts: [
        {
          conceptId: family.id,
          canonicalKey: family.canonicalKey,
          conceptType: 'MATERIAL_FAMILY',
          status: 'ACTIVE',
        },
      ],
    },
    {
      id: 'b',
      status: 'AVAILABLE',
      categoryId: 'cat-wood',
      materialType: 'board',
      title: 'B',
      updatedAt: new Date('2026-07-22T00:00:00.000Z'),
      concepts: [
        {
          conceptId: family.id,
          canonicalKey: family.canonicalKey,
          conceptType: 'MATERIAL_FAMILY',
          status: 'ACTIVE',
        },
        {
          conceptId: formBoard.id,
          canonicalKey: formBoard.canonicalKey,
          conceptType: 'MATERIAL_FORM',
          status: 'ACTIVE',
        },
      ],
    },
    {
      id: 'c',
      status: 'REUSED',
      categoryId: 'cat-wood',
      materialType: 'board',
      title: 'C',
      updatedAt: new Date('2026-07-23T00:00:00.000Z'),
      concepts: [],
    },
  ];

  const run = async (batchSize: number) => {
    const { client, queryCounts } = createMockClient({ materials });
    const report = await runMaterialTaxonomyAudit({
      client,
      options: {
        json: true,
        check: true,
        sampleLimit: 20,
        batchSize,
        timeoutMs: 60_000,
        help: false,
      },
      generatedAt: '2026-07-24T00:00:00.000Z',
      taxonomyRepository: taxonomyRepository as never,
    });
    return { report, queryCounts };
  };

  const small = await run(1);
  const large = await run(100);

  assert.equal(small.report.summary.totalMaterials, 3);
  assert.equal(large.report.summary.totalMaterials, 3);
  assert.equal(small.report.contentHash, large.report.contentHash);
  assert.equal(
    small.report.assignmentCoverage.exactFamilyOnly,
    large.report.assignmentCoverage.exactFamilyOnly,
  );
  assert.ok(small.queryCounts.material >= 3);
  assert.equal(small.queryCounts.materialConcept, 3);
  assert.ok(large.queryCounts.materialConcept <= 2);
  assert.ok(large.queryCounts.material >= 1);
});

test('missing expected form is gated critical; healthy family-only is not', async () => {
  const critical = await runMaterialTaxonomyAudit({
    client: createMockClient({
      materials: [
        {
          id: 'crit',
          status: 'AVAILABLE',
          categoryId: 'cat-wood',
          materialType: 'board',
          title: 'Needs Form',
          updatedAt: new Date('2026-07-20T00:00:00.000Z'),
          concepts: [
            {
              conceptId: family.id,
              canonicalKey: family.canonicalKey,
              conceptType: 'MATERIAL_FAMILY',
              status: 'ACTIVE',
            },
          ],
        },
      ],
    }).client,
    options: {
      json: true,
      check: true,
      sampleLimit: 20,
      batchSize: 10,
      timeoutMs: 60_000,
      help: false,
    },
    generatedAt: '2026-07-24T00:00:00.000Z',
    taxonomyRepository: taxonomyRepository as never,
  });

  assert.equal(critical.assignmentCoverage.missingExpectedForm, 1);
  assert.equal(critical.summary.gatedCriticalFailures, 1);

  const healthy = await runMaterialTaxonomyAudit({
    client: createMockClient({
      materials: [
        {
          id: 'ok',
          status: 'AVAILABLE',
          categoryId: 'cat-wood',
          materialType: 'totally-unknown',
          title: 'Family Only',
          updatedAt: new Date('2026-07-20T00:00:00.000Z'),
          concepts: [
            {
              conceptId: family.id,
              canonicalKey: family.canonicalKey,
              conceptType: 'MATERIAL_FAMILY',
              status: 'ACTIVE',
            },
          ],
        },
      ],
    }).client,
    options: {
      json: true,
      check: true,
      sampleLimit: 20,
      batchSize: 10,
      timeoutMs: 60_000,
      help: false,
    },
    generatedAt: '2026-07-24T00:00:00.000Z',
    taxonomyRepository: taxonomyRepository as never,
  });

  assert.equal(healthy.assignmentCoverage.exactFamilyOnly, 1);
  assert.equal(healthy.summary.gatedCriticalFailures, 0);
});

test('console JSON contains no raw titles', async () => {
  const secretTitle = 'SuperSecretRawTitleXYZ';
  const report: MaterialTaxonomyAuditReport = await runMaterialTaxonomyAudit({
    client: createMockClient({
      materials: [
        {
          id: 'm-secret',
          status: 'AVAILABLE',
          categoryId: 'cat-wood',
          materialType: 'totally-unknown',
          title: secretTitle,
          updatedAt: new Date('2026-07-20T00:00:00.000Z'),
          concepts: [
            {
              conceptId: family.id,
              canonicalKey: family.canonicalKey,
              conceptType: 'MATERIAL_FAMILY',
              status: 'ACTIVE',
            },
          ],
        },
      ],
    }).client,
    options: {
      json: true,
      check: false,
      sampleLimit: 20,
      batchSize: 10,
      timeoutMs: 60_000,
      help: false,
    },
    generatedAt: '2026-07-24T00:00:00.000Z',
    taxonomyRepository: taxonomyRepository as never,
  });

  assert.equal(JSON.stringify(report).includes(secretTitle), false);
});

test('execution failure path rejects for CLI exit 3 mapping', async () => {
  const { client } = createMockClient({
    materials: [],
    failTransaction: new Error('simulated db timeout'),
  });

  await assert.rejects(
    () =>
      runMaterialTaxonomyAudit({
        client,
        options: {
          json: true,
          check: false,
          sampleLimit: 20,
          batchSize: 10,
          timeoutMs: 60_000,
          help: false,
        },
        taxonomyRepository: taxonomyRepository as never,
      }),
    /simulated db timeout/,
  );
});

test('read-only audit leaves Material and taxonomy tables unchanged', async () => {
  const { prisma } = await import('../src/database/prisma.js');

  const sampleMaterials = await prisma.material.findMany({
    take: 8,
    orderBy: { id: 'asc' },
    select: { id: true, updatedAt: true },
  });
  const sampleIds = sampleMaterials.map((row) => row.id);

  const capture = async () => ({
    materialCount: await prisma.material.count(),
    materialConceptCount: await prisma.materialConcept.count(),
    taxonomyConceptCount: await prisma.taxonomyConcept.count(),
    taxonomyAliasCount: await prisma.taxonomyAlias.count(),
    sampleMaterials: await prisma.material.findMany({
      where: { id: { in: sampleIds } },
      select: { id: true, updatedAt: true },
      orderBy: { id: 'asc' },
    }),
    sampleConceptLinks: await prisma.materialConcept.findMany({
      where: { materialId: { in: sampleIds } },
      select: { id: true, materialId: true, conceptId: true },
      orderBy: [{ materialId: 'asc' }, { conceptId: 'asc' }],
    }),
  });

  const before = await capture();

  const client: MaterialTaxonomyAuditClient = {
    $transaction: (fn, options) =>
      prisma.$transaction(
        (tx) => fn(tx as unknown as MaterialTaxonomyAuditTxClient),
        options,
      ),
    $disconnect: async () => {
      // Keep shared prisma alive for the rest of the suite.
    },
  };

  const report = await runMaterialTaxonomyAudit({
    client,
    options: {
      json: true,
      check: false,
      sampleLimit: 5,
      batchSize: 50,
      timeoutMs: 180_000,
      help: false,
    },
    generatedAt: '2026-07-24T00:00:00.000Z',
  });

  const after = await capture();
  assert.equal(report.schemaVersion, 'material-taxonomy-audit-v1');
  assert.equal(after.materialCount, before.materialCount);
  assert.equal(after.materialConceptCount, before.materialConceptCount);
  assert.equal(after.taxonomyConceptCount, before.taxonomyConceptCount);
  assert.equal(after.taxonomyAliasCount, before.taxonomyAliasCount);
  assert.deepEqual(
    after.sampleMaterials.map((row) => ({
      id: row.id,
      updatedAt: row.updatedAt.toISOString(),
    })),
    before.sampleMaterials.map((row) => ({
      id: row.id,
      updatedAt: row.updatedAt.toISOString(),
    })),
  );
  assert.deepEqual(after.sampleConceptLinks, before.sampleConceptLinks);
});
