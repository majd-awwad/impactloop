import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';
import { assertExportWithinLimit } from '../admin-export/admin-export.preflight.js';

import {
  exportAdminPeopleCsv,
  exportAdminPeopleXlsx,
  preflightAdminPeopleExport,
} from './admin-people.export.js';
import {
  USER_EXPORT_HEADERS,
  USER_EXPORT_LAST_LOGIN_AT_COLUMN,
} from './admin-people.export-mapper.js';
import * as repository from './admin-people.repository.js';
import { listAdminPeople } from './admin-people.service.js';

const TEST_MARKER = '[test-admin-people-export]';

type TestContext = {
  actorAdminId: string;
  learnerId: string;
  supplierId: string;
  sparseUserId: string;
  formulaUserId: string;
  userIds: string[];
  categoryId: string;
  locationId: string;
  materialIds: string[];
};

const ctx: TestContext = {
  actorAdminId: '',
  learnerId: '',
  supplierId: '',
  sparseUserId: '',
  formulaUserId: '',
  userIds: [],
  categoryId: '',
  locationId: '',
  materialIds: [],
};

async function createUser(input: {
  suffix: string;
  role: 'LEARNER' | 'SUPPLIER' | 'ADMIN';
  displayName?: string;
  email?: string;
  accountStatus?: 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION' | 'DISABLED';
  createdAt?: Date;
  lastLoginAt?: Date | null;
  withSupplier?: boolean;
}) {
  const passwordHash = await hashPassword('TestPassword123!');
  const stamp = input.createdAt ?? new Date();
  const user = await prisma.user.create({
    data: {
      displayName: input.displayName ?? `${TEST_MARKER} ${input.suffix}`,
      email:
        input.email ??
        `${TEST_MARKER}-${input.suffix}-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: input.accountStatus ?? 'ACTIVE',
      emailVerifiedAt: new Date(),
      createdAt: stamp,
      updatedAt: stamp,
      lastLoginAt:
        input.lastLoginAt === undefined ? undefined : input.lastLoginAt,
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
        input.role === 'SUPPLIER' || input.withSupplier
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

  const admin = await createUser({ suffix: 'actor-admin', role: 'ADMIN' });
  ctx.actorAdminId = admin.id;

  const tiedStamp = new Date('2026-07-20T10:00:00.000Z');
  for (let index = 0; index < 5; index += 1) {
    const user = await createUser({
      suffix: `tied-${index}`,
      role: 'LEARNER',
      createdAt: tiedStamp,
      lastLoginAt: index === 0 ? new Date('2026-07-21T10:00:00.000Z') : null,
      displayName:
        index === 0
          ? `${TEST_MARKER} Tied خشب ${index}`
          : `${TEST_MARKER} Tied ${index}`,
    });
    if (index === 1) {
      ctx.sparseUserId = user.id;
      ctx.learnerId = user.id;
    }
  }

  const supplier = await createUser({
    suffix: 'supplier',
    role: 'SUPPLIER',
    createdAt: new Date('2026-07-19T10:00:00.000Z'),
    lastLoginAt: new Date('2026-07-22T10:00:00.000Z'),
  });
  ctx.supplierId = supplier.id;

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
      title: `${TEST_MARKER} Material`,
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
  ctx.materialIds.push(material.id);

  const formulaUser = await createUser({
    suffix: 'formula',
    role: 'LEARNER',
    displayName: `=HYPERLINK("evil") ${TEST_MARKER}`,
    createdAt: new Date('2026-07-18T10:00:00.000Z'),
    lastLoginAt: null,
  });
  ctx.formulaUserId = formulaUser.id;

  await createUser({
    suffix: 'suspended',
    role: 'LEARNER',
    accountStatus: 'SUSPENDED',
    createdAt: new Date('2026-07-17T10:00:00.000Z'),
    lastLoginAt: null,
  });
});

after(async () => {
  if (ctx.materialIds.length) {
    await prisma.material.deleteMany({ where: { id: { in: ctx.materialIds } } });
  }
  if (ctx.userIds.length) {
    await prisma.supplierProfile.deleteMany({
      where: { userId: { in: ctx.userIds } },
    });
    await prisma.learnerProfile.deleteMany({
      where: { userId: { in: ctx.userIds } },
    });
    await prisma.userRoleAssignment.deleteMany({
      where: { userId: { in: ctx.userIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: ctx.userIds } } });
  }
  if (ctx.locationId) {
    await prisma.location.delete({ where: { id: ctx.locationId } });
  }
});

describe('admin people export', () => {
  test('preflight count matches list total and exposes xlsx/csv only', async () => {
    const filters = { search: TEST_MARKER, tab: 'ALL' as const };
    const [preflight, list] = await Promise.all([
      preflightAdminPeopleExport(filters),
      listAdminPeople(ctx.actorAdminId, { page: 1, limit: 100, ...filters }),
    ]);
    assert.equal(preflight.count, list.pagination.total);
    assert.ok(preflight.count >= 7);
    assert.ok(preflight.formats.xlsx);
    assert.ok(preflight.formats.csv);
    assert.equal('pdf' in preflight.formats, false);
  });

  test('tab, search, and status filters match list counts', async () => {
    const cases = [
      { tab: 'LEARNERS' as const, search: TEST_MARKER },
      { tab: 'SUPPLIERS' as const, search: TEST_MARKER },
      { tab: 'ADMINS' as const, search: TEST_MARKER },
      { tab: 'ALL' as const, search: TEST_MARKER, status: 'SUSPENDED' as const },
      { tab: 'ALL' as const, search: TEST_MARKER, status: 'ACTIVE' as const },
    ];

    for (const filters of cases) {
      const [preflight, list] = await Promise.all([
        preflightAdminPeopleExport(filters),
        listAdminPeople(ctx.actorAdminId, { page: 1, limit: 100, ...filters }),
      ]);
      assert.equal(
        preflight.count,
        list.pagination.total,
        `mismatch for ${JSON.stringify(filters)}`,
      );
    }
  });

  test('keyset batching with tied createdAt returns every id once', async () => {
    const filters = { search: `${TEST_MARKER} Tied`, tab: 'ALL' as const };
    const first = await repository.listAdminPeopleExportBatch({
      query: filters,
      take: 2,
    });
    assert.equal(first.length, 2);
    const second = await repository.listAdminPeopleExportBatch({
      query: filters,
      cursor: { createdAt: first[1]!.createdAt, id: first[1]!.id },
      take: 2,
    });
    assert.equal(second.length, 2);
    const third = await repository.listAdminPeopleExportBatch({
      query: filters,
      cursor: { createdAt: second[1]!.createdAt, id: second[1]!.id },
      take: 2,
    });
    assert.equal(third.length, 1);
    const ids = [...first, ...second, ...third].map((row) => row.id);
    assert.equal(new Set(ids).size, 5);
  });

  test('csv export returns safe columns and blank nullables', async () => {
    const buffer = await exportAdminPeopleCsv({
      search: TEST_MARKER,
      tab: 'ALL',
    });
    const text = buffer.toString('utf8');
    assert.ok(text.startsWith('\uFEFF'));
    assert.ok(text.includes(USER_EXPORT_HEADERS[0]!));
    assert.ok(text.includes('خشب'));
    assert.ok(text.includes("'=HYPERLINK") || text.includes("\"'=HYPERLINK"));
    assert.ok(text.includes(ctx.sparseUserId));
    assert.ok(text.includes(ctx.supplierId));

    assert.equal(text.includes('passwordHash'), false);
    assert.equal(text.includes('SECRET_ADDRESS'), false);
    assert.equal(text.includes('SENSITIVE_DESCRIPTION'), false);
    assert.equal(text.includes('31.9'), false);
    assert.equal(text.includes('35.2'), false);

    const lines = text.replace(/^\uFEFF/, '').trimEnd().split(/\r\n/);
    const header = lines[0]!.split(',');
    const idCol = header.indexOf('User ID');
    const lastLoginCol = header.indexOf('Last Login At');
    const supplierCol = header.indexOf('Supplier Name');
    const driverCol = header.indexOf('Driver Status');
    const materialsCol = header.indexOf('Materials Count');

    const parse = (line: string) => {
      const fields: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i]!;
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i += 1;
          } else {
            inQuotes = !inQuotes;
          }
          continue;
        }
        if (ch === ',' && !inQuotes) {
          fields.push(current);
          current = '';
          continue;
        }
        current += ch;
      }
      fields.push(current);
      return fields;
    };

    const sparse = lines
      .slice(1)
      .map(parse)
      .find((fields) => fields[idCol] === ctx.sparseUserId);
    assert.ok(sparse);
    assert.equal(sparse[lastLoginCol], '');
    assert.equal(sparse[supplierCol], '');
    assert.equal(sparse[driverCol], '');
    assert.equal(sparse[materialsCol], '0');

    const supplier = lines
      .slice(1)
      .map(parse)
      .find((fields) => fields[idCol] === ctx.supplierId);
    assert.ok(supplier);
    assert.ok(supplier[supplierCol]!.includes('Supplier'));
    assert.equal(supplier[materialsCol], '1');
  });

  test('xlsx export keeps blank nullables and typed dates', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const buffer = await exportAdminPeopleXlsx({
      search: TEST_MARKER,
      tab: 'ALL',
    });
    assert.equal(buffer.subarray(0, 2).toString('utf8'), 'PK');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    const sheet = workbook.getWorksheet('Users');
    assert.ok(sheet);

    const header = sheet.getRow(1);
    const col = (name: string) => {
      for (let i = 1; i <= USER_EXPORT_HEADERS.length; i += 1) {
        if (header.getCell(i).value === name) return i;
      }
      throw new Error(`missing ${name}`);
    };

    const findRow = (userId: string) => {
      for (let r = 2; r <= sheet.rowCount; r += 1) {
        const row = sheet.getRow(r);
        if (row.getCell(col('User ID')).value === userId) return row;
      }
      throw new Error(`missing row ${userId}`);
    };

    const sparse = findRow(ctx.sparseUserId);
    assert.equal(sparse.getCell(col('Last Login At')).value, null);
    assert.equal(sparse.getCell(col('Supplier Name')).value, null);
    assert.equal(sparse.getCell(col('Driver Status')).value, null);
    assert.equal(sparse.getCell(col('Location City')).value, null);
    assert.ok(sparse.getCell(col('Created At')).value instanceof Date);
    assert.equal(sparse.getCell(col('Materials Count')).value, 0);

    const supplier = findRow(ctx.supplierId);
    assert.ok(supplier.getCell(col('Last Login At')).value instanceof Date);
    assert.ok(
      String(supplier.getCell(col('Supplier Name')).value).includes('Supplier'),
    );
    assert.equal(supplier.getCell(col('Materials Count')).value, 1);

    for (let r = 2; r <= sheet.rowCount; r += 1) {
      const row = sheet.getRow(r);
      for (let c = 1; c <= USER_EXPORT_HEADERS.length; c += 1) {
        const value = row.getCell(c).value;
        if (value === 34) {
          assert.fail(`unexpected 34 at ${r},${c}`);
        }
        if (value instanceof Date) {
          assert.notEqual(value.toISOString().slice(0, 10), '1900-02-03');
        }
      }
    }

    assert.equal(
      sheet.getColumn(USER_EXPORT_LAST_LOGIN_AT_COLUMN).numFmt,
      'yyyy-mm-dd hh:mm',
    );
  });

  test('zero results still builds empty CSV with headers', async () => {
    const buffer = await exportAdminPeopleCsv({
      search: `${TEST_MARKER}-no-such-user-xyz`,
      tab: 'ALL',
    });
    const text = buffer.toString('utf8');
    assert.ok(text.includes('User ID'));
    assert.equal(text.includes(ctx.sparseUserId), false);
  });

  test('page and limit are not part of export filters', async () => {
    const preflight = await preflightAdminPeopleExport({
      search: TEST_MARKER,
      tab: 'ALL',
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
