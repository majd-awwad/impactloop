import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';
import { assertExportWithinLimit } from '../admin-export/admin-export.preflight.js';

import {
  exportAdminMaterialsCsv,
  exportAdminMaterialsXlsx,
  preflightAdminMaterialsExport,
} from './admin-materials.export.js';
import { MATERIAL_EXPORT_HEADERS } from './admin-materials.export-mapper.js';
import { listAdminMaterials } from './admin-materials.service.js';

const TEST_MARKER = '[test-admin-materials-export]';

type TestContext = {
  supplierId: string;
  learnerId: string;
  categoryId: string;
  locationId: string;
  materialIds: string[];
  userIds: string[];
  reportIds: string[];
};

const ctx: TestContext = {
  supplierId: '',
  learnerId: '',
  categoryId: '',
  locationId: '',
  materialIds: [],
  userIds: [],
  reportIds: [],
};

async function createUser(input: {
  suffix: string;
  role: 'LEARNER' | 'SUPPLIER';
}) {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} ${input.suffix}`,
      email: `${TEST_MARKER}-${input.suffix}-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: input.role, isPrimary: true }] },
      learnerProfile:
        input.role === 'LEARNER'
          ? {
              create: {
                learnerType: 'STUDENT',
                skillLevel: 'BEGINNER',
              },
            }
          : undefined,
      supplierProfile:
        input.role === 'SUPPLIER'
          ? {
              create: {
                supplierType: 'INDIVIDUAL_SUPPLIER',
                publicName: `${TEST_MARKER} Supplier ${input.suffix}`,
                verificationStatus: 'VERIFIED',
              },
            }
          : undefined,
    },
  });
  ctx.userIds.push(user.id);
  return user;
}

async function createMaterial(input: {
  title: string;
  status?: 'AVAILABLE' | 'UNAVAILABLE' | 'RESERVED';
  isFree?: boolean;
  createdAt?: Date;
}) {
  const profile = await prisma.supplierProfile.findUnique({
    where: { userId: ctx.supplierId },
    select: { id: true },
  });
  const stamp = input.createdAt ?? new Date();
  const material = await prisma.material.create({
    data: {
      ownerId: ctx.supplierId,
      supplierProfileId: profile?.id,
      categoryId: ctx.categoryId,
      locationId: ctx.locationId,
      title: input.title,
      description: `${TEST_MARKER} description`,
      materialType: 'Test',
      quantity: 3,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: input.status ?? 'AVAILABLE',
      isFree: input.isFree ?? false,
      price: input.isFree ? null : 12.5,
      currency: 'NIS',
      createdAt: stamp,
      updatedAt: stamp,
    },
  });
  ctx.materialIds.push(material.id);
  return material;
}

before(async () => {
  const category = await prisma.category.findFirst({
    where: { categoryType: { in: ['MATERIAL', 'BOTH'] } },
    select: { id: true },
  });
  assert.ok(category, 'seed category required');
  ctx.categoryId = category.id;

  const location = await prisma.location.create({
    data: {
      country: 'Palestine',
      city: 'Ramallah',
      area: `${TEST_MARKER}-area`,
      visibility: 'ORDER_ONLY',
      isApproximate: true,
    },
    select: { id: true },
  });
  ctx.locationId = location.id;

  const supplier = await createUser({ suffix: 'supplier', role: 'SUPPLIER' });
  const learner = await createUser({ suffix: 'learner', role: 'LEARNER' });
  ctx.supplierId = supplier.id;
  ctx.learnerId = learner.id;

  const tiedStamp = new Date('2026-07-20T10:00:00.000Z');
  for (let index = 0; index < 5; index += 1) {
    await createMaterial({
      title: `${TEST_MARKER} Tied ${index} خشب`,
      createdAt: tiedStamp,
      isFree: index % 2 === 0,
    });
  }

  const freeMaterial = await createMaterial({
    title: `${TEST_MARKER} Free Panel`,
    isFree: true,
    status: 'AVAILABLE',
    createdAt: new Date('2026-07-21T10:00:00.000Z'),
  });

  const unavailable = await createMaterial({
    title: `${TEST_MARKER} Unavailable`,
    status: 'UNAVAILABLE',
    createdAt: new Date('2026-07-22T10:00:00.000Z'),
  });

  const reported = await createMaterial({
    title: `${TEST_MARKER} Reported`,
    createdAt: new Date('2026-07-23T10:00:00.000Z'),
  });
  const report = await prisma.materialReport.create({
    data: {
      materialId: reported.id,
      reporterId: learner.id,
      reason: 'MISLEADING_INFORMATION',
      status: 'PENDING',
      note: 'test note',
    },
  });
  ctx.reportIds.push(report.id);

  void freeMaterial;
  void unavailable;
});

after(async () => {
  if (ctx.reportIds.length) {
    await prisma.materialReport.deleteMany({
      where: { id: { in: ctx.reportIds } },
    });
  }
  if (ctx.materialIds.length) {
    await prisma.material.deleteMany({
      where: { id: { in: ctx.materialIds } },
    });
  }
  if (ctx.userIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: ctx.userIds } } });
  }
  if (ctx.locationId) {
    await prisma.location.delete({ where: { id: ctx.locationId } });
  }
});

describe('admin materials export', () => {
  test('preflight count matches list total and exposes xlsx/csv only', async () => {
    const search = TEST_MARKER;
    const [preflight, list] = await Promise.all([
      preflightAdminMaterialsExport({ search }),
      listAdminMaterials({ page: 1, limit: 100, search }),
    ]);

    assert.equal(preflight.count, list.pagination.total);
    assert.equal(preflight.formats.xlsx.allowed, true);
    assert.equal(preflight.formats.csv.allowed, true);
    assert.equal('pdf' in preflight.formats, false);
  });

  test('search status reportStatus isFree filters match list counts', async () => {
    const search = TEST_MARKER;

    const byStatus = await preflightAdminMaterialsExport({
      search,
      status: 'UNAVAILABLE',
    });
    const listStatus = await listAdminMaterials({
      page: 1,
      limit: 100,
      search,
      status: 'UNAVAILABLE',
    });
    assert.equal(byStatus.count, listStatus.pagination.total);
    assert.ok(byStatus.count >= 1);

    const byFree = await preflightAdminMaterialsExport({
      search,
      isFree: true,
    });
    const listFree = await listAdminMaterials({
      page: 1,
      limit: 100,
      search,
      isFree: true,
    });
    assert.equal(byFree.count, listFree.pagination.total);

    const byReport = await preflightAdminMaterialsExport({
      search,
      reportStatus: 'PENDING',
    });
    const listReport = await listAdminMaterials({
      page: 1,
      limit: 100,
      search,
      reportStatus: 'PENDING',
    });
    assert.equal(byReport.count, listReport.pagination.total);
    assert.ok(byReport.count >= 1);

    const combined = await preflightAdminMaterialsExport({
      search,
      status: 'AVAILABLE',
      isFree: true,
    });
    const listCombined = await listAdminMaterials({
      page: 1,
      limit: 100,
      search,
      status: 'AVAILABLE',
      isFree: true,
    });
    assert.equal(combined.count, listCombined.pagination.total);
  });

  test('keyset export returns every tied createdAt row exactly once', async () => {
    const search = TEST_MARKER;
    const buffer = await exportAdminMaterialsCsv({ search });
    const text = buffer.toString('utf8');

    for (const id of ctx.materialIds) {
      const matches = text.split(id).length - 1;
      assert.equal(matches, 1, `expected id ${id} exactly once`);
    }

    assert.ok(text.startsWith('\uFEFF'));
    assert.ok(text.includes(MATERIAL_EXPORT_HEADERS[0]!));
    assert.ok(text.includes('خشب'));
    assert.equal(text.includes('passwordHash'), false);
    assert.equal(text.includes('latitude'), false);
    assert.equal(text.includes('moderationReason'), false);
    assert.equal(text.includes('verificationAdminNote'), false);
  });

  test('xlsx export succeeds with safe headers', async () => {
    const buffer = await exportAdminMaterialsXlsx({ search: TEST_MARKER });
    assert.equal(buffer.subarray(0, 2).toString('utf8'), 'PK');
  });

  test('zero results still builds empty CSV with headers', async () => {
    const buffer = await exportAdminMaterialsCsv({
      search: `${TEST_MARKER}-no-such-material-xyz`,
    });
    const text = buffer.toString('utf8');
    assert.ok(text.includes('Material ID'));
    assert.equal(text.includes(ctx.materialIds[0]!), false);
  });

  test('page and limit are not part of export filter schema effect', async () => {
    const preflight = await preflightAdminMaterialsExport({
      search: TEST_MARKER,
    });
    assert.ok(preflight.count > 1);
    assert.equal(preflight.filters.search, TEST_MARKER);
    assert.equal('page' in preflight.filters, false);
    assert.equal('limit' in preflight.filters, false);
  });

  test('export limit exceeded throws EXPORT_LIMIT_EXCEEDED', () => {
    assert.throws(
      () => assertExportWithinLimit(100_001, 'xlsx'),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'EXPORT_LIMIT_EXCEEDED' &&
        (error.details as { format?: string }).format === 'xlsx',
    );
  });
});
