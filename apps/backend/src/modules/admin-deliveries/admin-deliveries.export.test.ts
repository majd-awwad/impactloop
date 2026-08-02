import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';
import { assertExportWithinLimit } from '../admin-export/admin-export.preflight.js';

import {
  exportAdminDeliveriesCsv,
  exportAdminDeliveriesXlsx,
  preflightAdminDeliveriesExport,
} from './admin-deliveries.export.js';
import {
  DELIVERY_EXPORT_ASSIGNED_AT_COLUMN,
  DELIVERY_EXPORT_DELIVERED_AT_COLUMN,
  DELIVERY_EXPORT_HEADERS,
  DELIVERY_EXPORT_PICKED_UP_AT_COLUMN,
} from './admin-deliveries.export-mapper.js';
import * as repository from './admin-deliveries.repository.js';
import { listAdminDeliveries } from './admin-deliveries.service.js';

const TEST_MARKER = '[test-admin-deliveries-export]';

type TestContext = {
  supplierId: string;
  learnerId: string;
  categoryId: string;
  locationId: string;
  materialId: string;
  deliveryIds: string[];
  reservationIds: string[];
  reportIds: string[];
  userIds: string[];
  sparseDeliveryId: string;
  completedDeliveryId: string;
  incidentDeliveryId: string;
};

const ctx: TestContext = {
  supplierId: '',
  learnerId: '',
  categoryId: '',
  locationId: '',
  materialId: '',
  deliveryIds: [],
  reservationIds: [],
  reportIds: [],
  userIds: [],
  sparseDeliveryId: '',
  completedDeliveryId: '',
  incidentDeliveryId: '',
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

async function createDelivery(input: {
  titleSuffix: string;
  status?:
    | 'WAITING_FOR_DRIVER'
    | 'DELIVERED'
    | 'CANCELLED'
    | 'AWAITING_RESOLUTION';
  requestedAt?: Date;
  assignedAt?: Date | null;
  pickedUpAt?: Date | null;
  deliveredAt?: Date | null;
  withSecretCode?: boolean;
  withIncident?: boolean;
}) {
  const reservation = await prisma.reservation.create({
    data: {
      materialId: ctx.materialId,
      requesterId: ctx.learnerId,
      ownerId: ctx.supplierId,
      quantityRequested: 1,
      status: 'ACCEPTED',
      fulfillmentMethod: 'DELIVERY',
      acceptedAt: new Date(),
    },
  });
  ctx.reservationIds.push(reservation.id);

  const stamp = input.requestedAt ?? new Date();
  const delivery = await prisma.delivery.create({
    data: {
      reservationId: reservation.id,
      pickupLocationId: ctx.locationId,
      dropoffLocationId: ctx.locationId,
      requestedByUserId: ctx.learnerId,
      status: input.status ?? 'WAITING_FOR_DRIVER',
      requestedAt: stamp,
      assignedAt: input.assignedAt === undefined ? undefined : input.assignedAt,
      pickedUpAt: input.pickedUpAt === undefined ? undefined : input.pickedUpAt,
      deliveredAt:
        input.deliveredAt === undefined ? undefined : input.deliveredAt,
      supplierHandoverCodeHash: input.withSecretCode
        ? 'SECRET_HANDOVER_HASH_SHOULD_NOT_EXPORT'
        : undefined,
      learnerDeliveryCodeHash: input.withSecretCode
        ? 'SECRET_DELIVERY_HASH_SHOULD_NOT_EXPORT'
        : undefined,
      learnerNote: 'SENSITIVE_LEARNER_NOTE',
      failureReason: 'SENSITIVE_FAILURE_REASON',
    },
  });
  ctx.deliveryIds.push(delivery.id);

  if (input.withIncident) {
    const report = await prisma.noShowReport.create({
      data: {
        reservationId: reservation.id,
        deliveryId: delivery.id,
        reporterUserId: ctx.learnerId,
        targetUserId: ctx.supplierId,
        targetRole: 'SUPPLIER',
        reasonCode: 'SUPPLIER_UNAVAILABLE',
        status: 'PENDING_REVIEW',
        note: 'SENSITIVE_INCIDENT_NOTE_SHOULD_NOT_EXPORT',
      },
    });
    ctx.reportIds.push(report.id);
  }

  return delivery;
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
      latitude: 31.9038,
      longitude: 35.2034,
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

  const tiedStamp = new Date('2026-07-28T12:00:00.000Z');
  for (let index = 0; index < 5; index += 1) {
    const delivery = await createDelivery({
      titleSuffix: `tied-${index}`,
      requestedAt: tiedStamp,
      withSecretCode: index === 0,
      withIncident: index === 0,
    });
    if (index === 0) {
      ctx.incidentDeliveryId = delivery.id;
    }
    if (index === 1) {
      ctx.sparseDeliveryId = delivery.id;
    }
  }

  const completedStamp = new Date('2026-07-27T12:00:00.000Z');
  const completed = await createDelivery({
    titleSuffix: 'delivered',
    status: 'DELIVERED',
    requestedAt: completedStamp,
    assignedAt: new Date('2026-07-27T13:00:00.000Z'),
    pickedUpAt: new Date('2026-07-27T14:00:00.000Z'),
    deliveredAt: new Date('2026-07-27T15:00:00.000Z'),
  });
  ctx.completedDeliveryId = completed.id;
});

after(async () => {
  if (ctx.reportIds.length) {
    await prisma.noShowReport.deleteMany({
      where: { id: { in: ctx.reportIds } },
    });
  }
  if (ctx.deliveryIds.length) {
    await prisma.deliveryAssignment.deleteMany({
      where: { deliveryId: { in: ctx.deliveryIds } },
    });
    await prisma.deliveryStatusHistory.deleteMany({
      where: { deliveryId: { in: ctx.deliveryIds } },
    });
    await prisma.delivery.deleteMany({
      where: { id: { in: ctx.deliveryIds } },
    });
  }
  if (ctx.reservationIds.length) {
    await prisma.reservation.deleteMany({
      where: { id: { in: ctx.reservationIds } },
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

describe('admin deliveries export', () => {
  test('preflight count matches list total and exposes xlsx/csv only', async () => {
    const filters = { search: TEST_MARKER };
    const [preflight, list] = await Promise.all([
      preflightAdminDeliveriesExport(filters),
      listAdminDeliveries({ page: 1, limit: 100, ...filters }),
    ]);
    assert.equal(preflight.count, list.pagination.total);
    assert.ok(preflight.count >= 6);
    assert.ok(preflight.formats.xlsx);
    assert.ok(preflight.formats.csv);
    assert.equal('pdf' in preflight.formats, false);
  });

  test('filter parity: status, scope, assignment, incident, dates', async () => {
    const cases = [
      { status: 'WAITING_FOR_DRIVER' as const },
      { status: 'DELIVERED' as const },
      { scope: 'SINGLE' as const, search: TEST_MARKER },
      { assignment: 'UNASSIGNED' as const, search: TEST_MARKER },
      { incidentState: 'PENDING_REVIEW' as const, search: TEST_MARKER },
      {
        search: TEST_MARKER,
        dateFrom: '2026-07-28',
        dateTo: '2026-07-28',
      },
    ];

    for (const filters of cases) {
      const [preflight, list] = await Promise.all([
        preflightAdminDeliveriesExport(filters),
        listAdminDeliveries({ page: 1, limit: 100, ...filters }),
      ]);
      assert.equal(
        preflight.count,
        list.pagination.total,
        `mismatch for ${JSON.stringify(filters)}`,
      );
    }
  });

  test('keyset batching with tied requestedAt returns every id once', async () => {
    const filters = {
      search: TEST_MARKER,
      dateFrom: '2026-07-28',
      dateTo: '2026-07-28',
    };
    const first = await repository.listAdminDeliveriesExportBatch({
      query: filters,
      take: 2,
    });
    assert.equal(first.length, 2);
    const second = await repository.listAdminDeliveriesExportBatch({
      query: filters,
      cursor: {
        requestedAt: first[1]!.requestedAt,
        id: first[1]!.id,
      },
      take: 2,
    });
    assert.equal(second.length, 2);
    const third = await repository.listAdminDeliveriesExportBatch({
      query: filters,
      cursor: {
        requestedAt: second[1]!.requestedAt,
        id: second[1]!.id,
      },
      take: 2,
    });
    assert.equal(third.length, 1);

    const ids = [...first, ...second, ...third].map((row) => row.id);
    assert.equal(new Set(ids).size, 5);
  });

  test('csv export returns every tied row once with safe columns', async () => {
    const buffer = await exportAdminDeliveriesCsv({
      search: TEST_MARKER,
      dateFrom: '2026-07-28',
      dateTo: '2026-07-28',
    });
    const text = buffer.toString('utf8');

    const tiedIds = ctx.deliveryIds.slice(0, 5);
    for (const id of tiedIds) {
      const matches = text.split(id).length - 1;
      assert.equal(matches, 1, `expected id ${id} exactly once`);
    }

    assert.ok(text.startsWith('\uFEFF'));
    assert.ok(text.includes(DELIVERY_EXPORT_HEADERS[0]!));
    assert.ok(text.includes('خشب'));
    assert.ok(text.includes('SUPPLIER_UNAVAILABLE'));
    assert.ok(text.includes('PENDING_REVIEW'));
    assert.equal(text.includes('passwordHash'), false);
    assert.equal(text.includes('SECRET_ADDRESS'), false);
    assert.equal(text.includes('SECRET_HANDOVER_HASH'), false);
    assert.equal(text.includes('SECRET_DELIVERY_HASH'), false);
    assert.equal(text.includes('SENSITIVE_INCIDENT_NOTE'), false);
    assert.equal(text.includes('SENSITIVE_LEARNER_NOTE'), false);
    assert.equal(text.includes('SENSITIVE_FAILURE_REASON'), false);
    assert.equal(text.includes('31.9038'), false);
    assert.equal(text.includes('35.2034'), false);
  });

  test('xlsx export succeeds', async () => {
    const buffer = await exportAdminDeliveriesXlsx({
      search: TEST_MARKER,
    });
    assert.equal(buffer.subarray(0, 2).toString('utf8'), 'PK');
  });

  test('formula-like material title is guarded in CSV', async () => {
    const formulaMaterial = await prisma.material.create({
      data: {
        ownerId: ctx.supplierId,
        categoryId: ctx.categoryId,
        locationId: ctx.locationId,
        title: `=HYPERLINK("evil") ${TEST_MARKER}`,
        description: 'x',
        materialType: 'Wood',
        quantity: 1,
        unit: 'piece',
        condition: 'GOOD',
        sourceType: 'WORKSHOP_SURPLUS',
        status: 'AVAILABLE',
        isFree: true,
        currency: 'NIS',
      },
    });
    const reservation = await prisma.reservation.create({
      data: {
        materialId: formulaMaterial.id,
        requesterId: ctx.learnerId,
        ownerId: ctx.supplierId,
        quantityRequested: 1,
        status: 'ACCEPTED',
        fulfillmentMethod: 'DELIVERY',
        acceptedAt: new Date(),
      },
    });
    const delivery = await prisma.delivery.create({
      data: {
        reservationId: reservation.id,
        pickupLocationId: ctx.locationId,
        dropoffLocationId: ctx.locationId,
        requestedByUserId: ctx.learnerId,
        status: 'WAITING_FOR_DRIVER',
        requestedAt: new Date('2026-07-29T12:00:00.000Z'),
      },
    });
    ctx.deliveryIds.push(delivery.id);
    ctx.reservationIds.push(reservation.id);

    try {
      const buffer = await exportAdminDeliveriesCsv({
        search: TEST_MARKER,
        dateFrom: '2026-07-29',
        dateTo: '2026-07-29',
      });
      const text = buffer.toString('utf8');
      assert.ok(text.includes("'=HYPERLINK") || text.includes("\"'=HYPERLINK"));
    } finally {
      await prisma.delivery.delete({ where: { id: delivery.id } });
      await prisma.reservation.delete({ where: { id: reservation.id } });
      await prisma.material.delete({ where: { id: formulaMaterial.id } });
      ctx.deliveryIds = ctx.deliveryIds.filter((id) => id !== delivery.id);
      ctx.reservationIds = ctx.reservationIds.filter(
        (id) => id !== reservation.id,
      );
    }
  });

  test('nullable blanks stay blank in XLSX and CSV; populated dates stay typed', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const buffer = await exportAdminDeliveriesXlsx({
      search: TEST_MARKER,
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    const sheet = workbook.getWorksheet('Deliveries');
    assert.ok(sheet);

    const header = sheet.getRow(1);
    const col = (name: (typeof DELIVERY_EXPORT_HEADERS)[number]) => {
      for (let index = 1; index <= DELIVERY_EXPORT_HEADERS.length; index += 1) {
        if (header.getCell(index).value === name) return index;
      }
      throw new Error(`missing column ${name}`);
    };

    const findRow = (deliveryId: string) => {
      for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
        const row = sheet.getRow(rowNumber);
        if (row.getCell(col('Delivery ID')).value === deliveryId) {
          return row;
        }
      }
      throw new Error(`missing delivery row ${deliveryId}`);
    };

    const assertBlank = (value: unknown, label: string) => {
      assert.notEqual(value, 34, `${label} must not be shared-string index 34`);
      assert.notEqual(value, '');
      if (value instanceof Date) {
        assert.notEqual(
          value.toISOString().slice(0, 10),
          '1900-02-03',
          `${label} must not be Excel epoch 1900-02-03`,
        );
      }
      assert.equal(value, null, `${label} should be blank, got ${String(value)}`);
    };

    const sparse = findRow(ctx.sparseDeliveryId);
    assertBlank(sparse.getCell(col('Assigned At')).value, 'sparse Assigned At');
    assertBlank(sparse.getCell(col('Picked Up At')).value, 'sparse Picked Up At');
    assertBlank(sparse.getCell(col('Delivered At')).value, 'sparse Delivered At');
    assertBlank(sparse.getCell(col('Driver name')).value, 'sparse Driver name');
    assertBlank(sparse.getCell(col('Driver email')).value, 'sparse Driver email');
    assertBlank(
      sparse.getCell(col('Primary incident status')).value,
      'sparse Primary incident status',
    );
    assertBlank(
      sparse.getCell(col('Primary incident reason')).value,
      'sparse Primary incident reason',
    );
    assertBlank(sparse.getCell(col('Group ID')).value, 'sparse Group ID');
    assertBlank(sparse.getCell(col('Group status')).value, 'sparse Group status');
    assert.ok(sparse.getCell(col('Requested At')).value instanceof Date);

    const completed = findRow(ctx.completedDeliveryId);
    assert.ok(completed.getCell(col('Assigned At')).value instanceof Date);
    assert.ok(completed.getCell(col('Picked Up At')).value instanceof Date);
    assert.ok(completed.getCell(col('Delivered At')).value instanceof Date);
    assertBlank(
      completed.getCell(col('Driver name')).value,
      'completed Driver name (no driver assigned)',
    );
    assertBlank(
      completed.getCell(col('Primary incident status')).value,
      'completed Primary incident status',
    );

    const incident = findRow(ctx.incidentDeliveryId);
    assert.equal(
      incident.getCell(col('Primary incident status')).value,
      'PENDING_REVIEW',
    );
    assert.equal(
      incident.getCell(col('Primary incident reason')).value,
      'SUPPLIER_UNAVAILABLE',
    );
    assertBlank(
      incident.getCell(col('Delivered At')).value,
      'incident Delivered At',
    );

    // Guard: no exported cell equals 34 unless it is a real source value.
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      for (let column = 1; column <= DELIVERY_EXPORT_HEADERS.length; column += 1) {
        const value = row.getCell(column).value;
        if (value === 34) {
          assert.fail(
            `unexpected numeric 34 at row ${rowNumber} col ${column} (${DELIVERY_EXPORT_HEADERS[column - 1]})`,
          );
        }
        if (value instanceof Date) {
          assert.notEqual(
            value.toISOString().slice(0, 10),
            '1900-02-03',
            `unexpected epoch date at row ${rowNumber} col ${column}`,
          );
        }
      }
    }

    assert.equal(
      sheet.getColumn(DELIVERY_EXPORT_ASSIGNED_AT_COLUMN).numFmt,
      'yyyy-mm-dd hh:mm',
    );
    assert.equal(
      sheet.getColumn(DELIVERY_EXPORT_PICKED_UP_AT_COLUMN).numFmt,
      'yyyy-mm-dd hh:mm',
    );
    assert.equal(
      sheet.getColumn(DELIVERY_EXPORT_DELIVERED_AT_COLUMN).numFmt,
      'yyyy-mm-dd hh:mm',
    );

    const csv = (
      await exportAdminDeliveriesCsv({ search: TEST_MARKER })
    ).toString('utf8');
    const csvLines = csv.replace(/^\uFEFF/, '').trimEnd().split(/\r\n/);
    const csvHeader = csvLines[0]!.split(',');
    const csvCol = (name: string) => {
      const index = csvHeader.indexOf(name);
      assert.ok(index >= 0, `csv missing ${name}`);
      return index;
    };

    const parseCsvLine = (line: string): string[] => {
      const fields: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let index = 0; index < line.length; index += 1) {
        const char = line[index]!;
        if (char === '"') {
          if (inQuotes && line[index + 1] === '"') {
            current += '"';
            index += 1;
          } else {
            inQuotes = !inQuotes;
          }
          continue;
        }
        if (char === ',' && !inQuotes) {
          fields.push(current);
          current = '';
          continue;
        }
        current += char;
      }
      fields.push(current);
      return fields;
    };

    const sparseCsv = csvLines
      .slice(1)
      .map(parseCsvLine)
      .find((fields) => fields[csvCol('Delivery ID')] === ctx.sparseDeliveryId);
    assert.ok(sparseCsv);
    assert.equal(sparseCsv[csvCol('Assigned At')], '');
    assert.equal(sparseCsv[csvCol('Picked Up At')], '');
    assert.equal(sparseCsv[csvCol('Delivered At')], '');
    assert.equal(sparseCsv[csvCol('Driver name')], '');
    assert.equal(sparseCsv[csvCol('Driver email')], '');
    assert.equal(sparseCsv[csvCol('Primary incident status')], '');
    assert.equal(sparseCsv[csvCol('Primary incident reason')], '');
    assert.equal(sparseCsv[csvCol('Group ID')], '');

    const completedCsv = csvLines
      .slice(1)
      .map(parseCsvLine)
      .find((fields) => fields[csvCol('Delivery ID')] === ctx.completedDeliveryId);
    assert.ok(completedCsv);
    assert.match(completedCsv[csvCol('Assigned At')]!, /2026-07-27T13:00:00/);
    assert.match(completedCsv[csvCol('Picked Up At')]!, /2026-07-27T14:00:00/);
    assert.match(completedCsv[csvCol('Delivered At')]!, /2026-07-27T15:00:00/);

    const incidentCsv = csvLines
      .slice(1)
      .map(parseCsvLine)
      .find((fields) => fields[csvCol('Delivery ID')] === ctx.incidentDeliveryId);
    assert.ok(incidentCsv);
    assert.equal(incidentCsv[csvCol('Primary incident status')], 'PENDING_REVIEW');
    assert.equal(
      incidentCsv[csvCol('Primary incident reason')],
      'SUPPLIER_UNAVAILABLE',
    );
  });

  test('zero results still builds empty CSV with headers', async () => {
    const buffer = await exportAdminDeliveriesCsv({
      search: `${TEST_MARKER}-no-such-delivery-xyz`,
    });
    const text = buffer.toString('utf8');
    assert.ok(text.includes('Delivery ID'));
    assert.equal(text.includes(ctx.deliveryIds[0]!), false);
  });

  test('page and limit are not part of export filters', async () => {
    const preflight = await preflightAdminDeliveriesExport({
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
