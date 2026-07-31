import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';
import { assertExportWithinLimit } from '../admin-export/admin-export.preflight.js';

import {
  exportAdminMaterialReportsCsv,
  exportAdminMaterialReportsXlsx,
  preflightAdminMaterialReportsExport,
} from './admin-material-reports.export.js';
import { MATERIAL_REPORT_EXPORT_HEADERS } from './admin-material-reports.export-mapper.js';
import { listAdminMaterialReports } from './admin-materials.service.js';

const TEST_MARKER = '[test-admin-material-reports-export]';

type TestContext = {
  supplierId: string;
  learnerId: string;
  categoryId: string;
  locationId: string;
  materialId: string;
  reportIds: string[];
  userIds: string[];
};

const ctx: TestContext = {
  supplierId: '',
  learnerId: '',
  categoryId: '',
  locationId: '',
  materialId: '',
  reportIds: [],
  userIds: [],
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
      addressLine: 'SECRET_ADDRESS_SHOULD_NOT_EXPORT',
      latitude: 31.9,
      longitude: 35.2,
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

  const profile = await prisma.supplierProfile.findUnique({
    where: { userId: supplier.id },
    select: { id: true },
  });

  const material = await prisma.material.create({
    data: {
      ownerId: supplier.id,
      supplierProfileId: profile?.id,
      categoryId: ctx.categoryId,
      locationId: ctx.locationId,
      title: `${TEST_MARKER} Material خشب`,
      description: 'SENSITIVE_DESCRIPTION',
      materialType: 'Wood',
      quantity: 2,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'AVAILABLE',
      isFree: true,
      currency: 'NIS',
    },
  });
  ctx.materialId = material.id;

  const tiedStamp = new Date('2026-07-25T12:00:00.000Z');
  for (let index = 0; index < 5; index += 1) {
    const report = await prisma.materialReport.create({
      data: {
        materialId: material.id,
        reporterId: learner.id,
        reason:
          index % 2 === 0 ? 'MISLEADING_INFORMATION' : 'WRONG_PRICE',
        status: 'PENDING',
        note:
          index === 0
            ? `=HYPERLINK("evil")\nmultiline note ${TEST_MARKER}`
            : `${TEST_MARKER} note ${index}`,
        createdAt: tiedStamp,
        updatedAt: tiedStamp,
      },
    });
    ctx.reportIds.push(report.id);
  }

  const resolved = await prisma.materialReport.create({
    data: {
      materialId: material.id,
      reporterId: learner.id,
      reason: 'OTHER',
      status: 'RESOLVED',
      note: `${TEST_MARKER} resolved`,
      adminNote: 'resolved by admin',
      reviewedAt: new Date('2026-07-26T12:00:00.000Z'),
      createdAt: new Date('2026-07-24T12:00:00.000Z'),
    },
  });
  ctx.reportIds.push(resolved.id);
});

after(async () => {
  if (ctx.reportIds.length) {
    await prisma.materialReport.deleteMany({
      where: { id: { in: ctx.reportIds } },
    });
  }
  if (ctx.materialId) {
    await prisma.material.deleteMany({ where: { id: ctx.materialId } });
  }
  if (ctx.userIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: ctx.userIds } } });
  }
  if (ctx.locationId) {
    await prisma.location.delete({ where: { id: ctx.locationId } });
  }
});

describe('admin material reports export', () => {
  test('preflight count matches list total and exposes xlsx/csv only', async () => {
    const filters = { search: TEST_MARKER, status: 'PENDING' as const };
    const [preflight, list] = await Promise.all([
      preflightAdminMaterialReportsExport(filters),
      listAdminMaterialReports({ page: 1, limit: 100, ...filters }),
    ]);
    assert.equal(preflight.count, list.pagination.total);
    assert.ok(preflight.count >= 5);
    assert.ok(preflight.formats.xlsx);
    assert.ok(preflight.formats.csv);
    assert.equal('pdf' in preflight.formats, false);
  });

  test('search and status filters match list counts', async () => {
    const pending = await preflightAdminMaterialReportsExport({
      search: TEST_MARKER,
      status: 'PENDING',
    });
    const listPending = await listAdminMaterialReports({
      page: 1,
      limit: 100,
      search: TEST_MARKER,
      status: 'PENDING',
    });
    assert.equal(pending.count, listPending.pagination.total);

    const byReason = await preflightAdminMaterialReportsExport({
      search: TEST_MARKER,
      status: 'PENDING',
      reason: 'WRONG_PRICE',
    });
    const listReason = await listAdminMaterialReports({
      page: 1,
      limit: 100,
      search: TEST_MARKER,
      status: 'PENDING',
      reason: 'WRONG_PRICE',
    });
    assert.equal(byReason.count, listReason.pagination.total);
    assert.ok(byReason.count >= 1);

    const byMaterial = await preflightAdminMaterialReportsExport({
      materialId: ctx.materialId,
      status: 'PENDING',
    });
    const listMaterial = await listAdminMaterialReports({
      page: 1,
      limit: 100,
      materialId: ctx.materialId,
      status: 'PENDING',
    });
    assert.equal(byMaterial.count, listMaterial.pagination.total);
  });

  test('keyset export returns every tied createdAt row exactly once', async () => {
    const buffer = await exportAdminMaterialReportsCsv({
      search: TEST_MARKER,
      status: 'PENDING',
    });
    const text = buffer.toString('utf8');

    const pendingIds = ctx.reportIds.slice(0, 5);
    for (const id of pendingIds) {
      const matches = text.split(id).length - 1;
      assert.equal(matches, 1, `expected id ${id} exactly once`);
    }

    assert.ok(text.startsWith('\uFEFF'));
    assert.ok(text.includes(MATERIAL_REPORT_EXPORT_HEADERS[0]!));
    assert.ok(text.includes('خشب'));
    assert.ok(text.includes("'=HYPERLINK") || text.includes('\'=HYPERLINK'));
    assert.equal(text.includes('passwordHash'), false);
    assert.equal(text.includes('SECRET_ADDRESS'), false);
    assert.equal(text.includes('SENSITIVE_DESCRIPTION'), false);
    assert.equal(text.includes('31.9'), false);
  });

  test('xlsx export succeeds with safe headers', async () => {
    const buffer = await exportAdminMaterialReportsXlsx({
      search: TEST_MARKER,
      status: 'PENDING',
    });
    assert.equal(buffer.subarray(0, 2).toString('utf8'), 'PK');
  });

  test('zero results still builds empty CSV with headers', async () => {
    const buffer = await exportAdminMaterialReportsCsv({
      search: `${TEST_MARKER}-no-such-report-xyz`,
      status: 'PENDING',
    });
    const text = buffer.toString('utf8');
    assert.ok(text.includes('Report ID'));
    assert.equal(text.includes(ctx.reportIds[0]!), false);
  });

  test('page and limit are not part of export filter schema effect', async () => {
    const preflight = await preflightAdminMaterialReportsExport({
      search: TEST_MARKER,
      status: 'PENDING',
    });
    assert.ok(preflight.count > 1);
    assert.equal(preflight.filters.search, TEST_MARKER);
    assert.equal(preflight.filters.status, 'PENDING');
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
