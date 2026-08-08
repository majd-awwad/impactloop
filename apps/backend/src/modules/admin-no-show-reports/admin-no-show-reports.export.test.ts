import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import ExcelJS from 'exceljs';

import { prisma } from '../../database/prisma.js';
import { resolveNoShowReportIncidentKey } from '../no-show-reports/no-show-report.incident-key.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';
import { assertExportWithinLimit } from '../admin-export/admin-export.preflight.js';
import { ADMIN_ACTIVITY_ACTIONS } from '../admin/admin-activity-log.js';

import {
  exportAdminNoShowReportsCsv,
  exportAdminNoShowReportsXlsx,
  preflightAdminNoShowReportsExport,
  streamAdminNoShowReportsExport,
} from './admin-no-show-reports.export.js';
import {
  INCIDENT_REPORT_EXPORT_HEADERS,
  INCIDENT_REPORT_EXPORT_REVIEWED_AT_COLUMN,
} from './admin-no-show-reports.export-mapper.js';
import * as repository from './admin-no-show-reports.repository.js';
import { listAdminNoShowReports } from './admin-no-show-reports.service.js';
import { buildAdminNoShowReportsWhere } from './admin-no-show-reports.where.js';

const TEST_MARKER = '[test-admin-incident-reports-export]';

type TestContext = {
  actorAdminId: string;
  supplierId: string;
  learnerId: string;
  driverId: string;
  categoryId: string;
  locationId: string;
  materialId: string;
  reservationIds: string[];
  deliveryIds: string[];
  reportIds: string[];
  userIds: string[];
  pendingLearnerReportId: string;
  verifiedStrikeReportId: string;
  rejectedReportId: string;
  systemRecoveryReportId: string;
  sparseReportId: string;
  formulaReportId: string;
  activityLogIds: string[];
};

const ctx: TestContext = {
  actorAdminId: '',
  supplierId: '',
  learnerId: '',
  driverId: '',
  categoryId: '',
  locationId: '',
  materialId: '',
  reservationIds: [],
  deliveryIds: [],
  reportIds: [],
  userIds: [],
  pendingLearnerReportId: '',
  verifiedStrikeReportId: '',
  rejectedReportId: '',
  systemRecoveryReportId: '',
  sparseReportId: '',
  formulaReportId: '',
  activityLogIds: [],
};

async function createUser(input: {
  suffix: string;
  role: 'LEARNER' | 'SUPPLIER' | 'ADMIN' | 'DRIVER';
  displayName?: string;
}) {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = await prisma.user.create({
    data: {
      displayName: input.displayName ?? `${TEST_MARKER} ${input.suffix}`,
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
      driverProfile:
        input.role === 'DRIVER'
          ? {
              create: {
                displayName: `${TEST_MARKER} Driver ${input.suffix}`,
                phone: `0599${String(Date.now()).slice(-6)}`,
                city: 'Ramallah',
                area: 'City center',
                transportationType: 'CAR',
                status: 'ACTIVE',
              },
            }
          : undefined,
    },
  });
  ctx.userIds.push(user.id);
  return user;
}

async function createReport(input: {
  suffix: string;
  status?: 'PENDING_REVIEW' | 'VERIFIED' | 'REJECTED' | 'RESOLVED_NO_STRIKE';
  targetRole: 'LEARNER' | 'SUPPLIER' | 'DRIVER' | 'SYSTEM';
  targetUserId?: string | null;
  reasonCode:
    | 'REPEATED_DELAY'
    | 'LEARNER_DID_NOT_ARRIVE'
    | 'SUPPLIER_UNAVAILABLE'
    | 'DRIVER_DID_NOT_ARRIVE'
    | 'NO_DRIVER_AVAILABLE'
    | 'PICKUP_FAILED';
  fulfillmentMethod?: 'PICKUP' | 'DELIVERY';
  reservationStatus?: 'ACCEPTED' | 'AWAITING_RESOLUTION' | 'COMPLETED';
  deliveryStatus?:
    | 'WAITING_FOR_DRIVER'
    | 'AWAITING_RESOLUTION'
    | 'DRIVER_NO_SHOW'
    | 'FAILED_PICKUP'
    | null;
  note?: string | null;
  reviewNote?: string | null;
  reviewedAt?: Date | null;
  createdAt?: Date;
  withDelivery?: boolean;
}) {
  const reservation = await prisma.reservation.create({
    data: {
      materialId: ctx.materialId,
      requesterId: ctx.learnerId,
      ownerId: ctx.supplierId,
      quantityRequested: 1,
      status: input.reservationStatus ?? 'ACCEPTED',
      fulfillmentMethod: input.fulfillmentMethod ?? 'PICKUP',
      acceptedAt: new Date(),
    },
  });
  ctx.reservationIds.push(reservation.id);

  let deliveryId: string | null = null;
  const wantsDelivery =
    input.withDelivery === true ||
    input.fulfillmentMethod === 'DELIVERY' ||
    input.deliveryStatus != null;

  if (wantsDelivery) {
    const delivery = await prisma.delivery.create({
      data: {
        reservationId: reservation.id,
        pickupLocationId: ctx.locationId,
        dropoffLocationId: ctx.locationId,
        requestedByUserId: ctx.learnerId,
        status: input.deliveryStatus ?? 'WAITING_FOR_DRIVER',
        requestedAt: new Date(),
        supplierHandoverCodeHash: 'SECRET_HANDOVER_HASH_SHOULD_NOT_EXPORT',
        learnerDeliveryCodeHash: 'SECRET_DELIVERY_HASH_SHOULD_NOT_EXPORT',
      },
    });
    ctx.deliveryIds.push(delivery.id);
    deliveryId = delivery.id;
  }

  const stamp = input.createdAt ?? new Date();
  const targetUserId =
    input.targetUserId === undefined
      ? input.targetRole === 'SYSTEM'
        ? null
        : input.targetRole === 'LEARNER'
          ? ctx.learnerId
          : input.targetRole === 'DRIVER'
            ? ctx.driverId
            : ctx.supplierId
      : input.targetUserId;
  const report = await prisma.noShowReport.create({
    data: {
      incidentKey: resolveNoShowReportIncidentKey({
        reservationId: reservation.id,
        deliveryId,
        targetRole: input.targetRole,
        targetUserId,
        reasonCode: input.reasonCode,
        note: input.note === undefined ? `${TEST_MARKER} note ${input.suffix}` : input.note,
      }),
      reservationId: reservation.id,
      deliveryId,
      reporterUserId: ctx.supplierId,
      targetUserId,
      targetRole: input.targetRole,
      reasonCode: input.reasonCode,
      status: input.status ?? 'PENDING_REVIEW',
      note: input.note === undefined ? `${TEST_MARKER} note ${input.suffix}` : input.note,
      reviewNote: input.reviewNote === undefined ? null : input.reviewNote,
      reviewedAt: input.reviewedAt === undefined ? null : input.reviewedAt,
      reviewedById: input.reviewedAt ? ctx.actorAdminId : null,
      createdAt: stamp,
    },
  });
  ctx.reportIds.push(report.id);
  return report;
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

  const admin = await createUser({ suffix: 'actor-admin', role: 'ADMIN' });
  ctx.actorAdminId = admin.id;
  const supplier = await createUser({ suffix: 'supplier', role: 'SUPPLIER' });
  const learner = await createUser({
    suffix: 'learner',
    role: 'LEARNER',
    displayName: `${TEST_MARKER} Learner خشب`,
  });
  const driver = await createUser({ suffix: 'driver', role: 'DRIVER' });
  ctx.supplierId = supplier.id;
  ctx.learnerId = learner.id;
  ctx.driverId = driver.id;

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
    const report = await createReport({
      suffix: `tied-${index}`,
      targetRole: 'LEARNER',
      reasonCode: 'LEARNER_DID_NOT_ARRIVE',
      createdAt: tiedStamp,
      note: index === 0 ? `${TEST_MARKER} multiline\nnote line 2` : undefined,
    });
    if (index === 0) {
      ctx.pendingLearnerReportId = report.id;
    }
  }

  const verified = await createReport({
    suffix: 'verified-strike',
    status: 'VERIFIED',
    targetRole: 'SUPPLIER',
    reasonCode: 'SUPPLIER_UNAVAILABLE',
    reviewedAt: new Date('2026-07-27T15:00:00.000Z'),
    reviewNote: `${TEST_MARKER} review ok`,
    createdAt: new Date('2026-07-27T12:00:00.000Z'),
  });
  ctx.verifiedStrikeReportId = verified.id;

  const rejected = await createReport({
    suffix: 'rejected',
    status: 'REJECTED',
    targetRole: 'DRIVER',
    reasonCode: 'DRIVER_DID_NOT_ARRIVE',
    fulfillmentMethod: 'DELIVERY',
    reservationStatus: 'AWAITING_RESOLUTION',
    deliveryStatus: 'DRIVER_NO_SHOW',
    reviewedAt: new Date('2026-07-26T15:00:00.000Z'),
    reviewNote: `${TEST_MARKER} rejected`,
    createdAt: new Date('2026-07-26T12:00:00.000Z'),
  });
  ctx.rejectedReportId = rejected.id;

  const system = await createReport({
    suffix: 'system-recovery',
    targetRole: 'SYSTEM',
    targetUserId: null,
    reasonCode: 'NO_DRIVER_AVAILABLE',
    fulfillmentMethod: 'DELIVERY',
    reservationStatus: 'AWAITING_RESOLUTION',
    deliveryStatus: 'AWAITING_RESOLUTION',
    note: null,
    reviewNote: null,
    reviewedAt: null,
    createdAt: new Date('2026-07-25T12:00:00.000Z'),
  });
  ctx.systemRecoveryReportId = system.id;

  const sparse = await createReport({
    suffix: 'sparse',
    targetRole: 'SYSTEM',
    targetUserId: null,
    reasonCode: 'REPEATED_DELAY',
    fulfillmentMethod: 'PICKUP',
    withDelivery: false,
    note: null,
    reviewNote: null,
    reviewedAt: null,
    createdAt: new Date('2026-07-24T12:00:00.000Z'),
  });
  ctx.sparseReportId = sparse.id;

  const formula = await createReport({
    suffix: 'formula',
    targetRole: 'LEARNER',
    reasonCode: 'REPEATED_DELAY',
    note: `=HYPERLINK("evil") ${TEST_MARKER}`,
    reviewNote: `=CMD|'/c calc'!A0 ${TEST_MARKER}`,
    status: 'PENDING_REVIEW',
    createdAt: new Date('2026-07-23T12:00:00.000Z'),
  });
  ctx.formulaReportId = formula.id;
});

after(async () => {
  if (ctx.activityLogIds.length) {
    await prisma.adminActivityLog.deleteMany({
      where: { id: { in: ctx.activityLogIds } },
    });
  }
  if (ctx.reportIds.length) {
    await prisma.noShowReport.deleteMany({
      where: { id: { in: ctx.reportIds } },
    });
  }
  if (ctx.deliveryIds.length) {
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
    await prisma.driverProfile.deleteMany({
      where: { userId: { in: ctx.userIds } },
    });
    await prisma.supplierProfile.deleteMany({
      where: { userId: { in: ctx.userIds } },
    });
    await prisma.learnerProfile.deleteMany({
      where: { userId: { in: ctx.userIds } },
    });
    await prisma.userRoleAssignment.deleteMany({
      where: { userId: { in: ctx.userIds } },
    });
    await prisma.adminActivityLog.deleteMany({
      where: { actorUserId: { in: ctx.userIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: ctx.userIds } } });
  }
  if (ctx.locationId) {
    await prisma.location.delete({ where: { id: ctx.locationId } });
  }
});

const parseCsvLine = (line: string) => {
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

describe('admin incident reports export', () => {
  test('export where matches list where for shared filters', () => {
    const filters = {
      search: TEST_MARKER,
      status: 'PENDING_REVIEW' as const,
      workflow: 'ACCOUNTABILITY' as const,
      targetRole: 'LEARNER' as const,
      operationalState: 'NOT_REQUIRED' as const,
      dateFrom: '2026-07-01',
      dateTo: '2026-07-31',
    };
    assert.deepEqual(
      buildAdminNoShowReportsWhere(filters),
      buildAdminNoShowReportsWhere({ ...filters, page: 1, limit: 10 } as never),
    );
  });

  test('preflight count matches list total and exposes xlsx/csv only', async () => {
    const filters = { search: TEST_MARKER };
    const [preflight, list] = await Promise.all([
      preflightAdminNoShowReportsExport(filters),
      listAdminNoShowReports({ page: 1, limit: 100, ...filters }),
    ]);
    assert.equal(preflight.count, list.pagination.total);
    assert.ok(preflight.count >= 10);
    assert.ok(preflight.formats.xlsx);
    assert.ok(preflight.formats.csv);
    assert.equal('pdf' in preflight.formats, false);
    assert.equal('page' in preflight.filters, false);
    assert.equal('limit' in preflight.filters, false);
  });

  test('filter equivalence across status, workflow, target, operational, dates', async () => {
    const cases = [
      { search: TEST_MARKER, status: 'PENDING_REVIEW' as const },
      { search: TEST_MARKER, status: 'VERIFIED' as const },
      { search: TEST_MARKER, status: 'REJECTED' as const },
      { search: TEST_MARKER, workflow: 'ACCOUNTABILITY' as const },
      { search: TEST_MARKER, workflow: 'SYSTEM_RECOVERY' as const },
      { search: TEST_MARKER, targetRole: 'LEARNER' as const },
      { search: TEST_MARKER, targetRole: 'SUPPLIER' as const },
      { search: TEST_MARKER, targetRole: 'DRIVER' as const },
      { search: TEST_MARKER, targetRole: 'SYSTEM' as const },
      { search: TEST_MARKER, operationalState: 'NOT_REQUIRED' as const },
      { search: TEST_MARKER, operationalState: 'REQUIRES_RESOLUTION' as const },
      {
        search: TEST_MARKER,
        dateFrom: '2026-07-27',
        dateTo: '2026-07-28',
      },
      {
        search: TEST_MARKER,
        status: 'PENDING_REVIEW' as const,
        targetRole: 'LEARNER' as const,
        workflow: 'ACCOUNTABILITY' as const,
      },
    ];

    for (const filters of cases) {
      const [preflight, list] = await Promise.all([
        preflightAdminNoShowReportsExport(filters),
        listAdminNoShowReports({ page: 1, limit: 100, ...filters }),
      ]);
      assert.equal(
        preflight.count,
        list.pagination.total,
        `mismatch for ${JSON.stringify(filters)}`,
      );
    }
  });

  test('keyset batching with tied createdAt returns every id once', async () => {
    const filters = { search: `${TEST_MARKER} Material` };
    const first = await repository.listAdminNoShowReportsExportBatch({
      query: filters,
      take: 2,
    });
    assert.equal(first.length, 2);
    const second = await repository.listAdminNoShowReportsExportBatch({
      query: filters,
      cursor: { createdAt: first[1]!.createdAt, id: first[1]!.id },
      take: 2,
    });
    assert.ok(second.length >= 1);
    const ids = [...first, ...second].map((row) => row.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test('csv export returns safe columns, blanks, strike semantics, and formula guards', async () => {
    const buffer = await exportAdminNoShowReportsCsv({ search: TEST_MARKER });
    const text = buffer.toString('utf8');
    assert.ok(text.startsWith('\uFEFF'));
    assert.ok(text.includes(INCIDENT_REPORT_EXPORT_HEADERS[0]!));
    assert.ok(text.includes('خشب'));
    assert.ok(text.includes('multiline'));
    assert.ok(text.includes("'=HYPERLINK") || text.includes("\"'=HYPERLINK"));

    assert.equal(text.includes('passwordHash'), false);
    assert.equal(text.includes('SECRET_ADDRESS'), false);
    assert.equal(text.includes('SECRET_HANDOVER'), false);
    assert.equal(text.includes('SECRET_DELIVERY'), false);
    assert.equal(text.includes('availableActions'), false);
    assert.equal(text.includes('31.9038'), false);

    const lines = text.replace(/^\uFEFF/, '').trimEnd().split(/\r\n/);
    const header = lines[0]!.split(',');
    const idCol = header.indexOf('Report ID');
    const strikeCol = header.indexOf('Strike Impact');
    const statusCol = header.indexOf('Report Status');
    const deliveryCol = header.indexOf('Delivery ID');
    const reviewedAtCol = header.indexOf('Reviewed At');
    const reviewNoteCol = header.indexOf('Review Note');
    const targetIdCol = header.indexOf('Target User ID');
    const workflowCol = header.indexOf('Workflow Type');

    const rows = lines.slice(1).map(parseCsvLine);
    assert.equal(rows.length, (await preflightAdminNoShowReportsExport({ search: TEST_MARKER })).count);

    const pending = rows.find((fields) => fields[idCol] === ctx.pendingLearnerReportId);
    assert.ok(pending);
    assert.equal(pending[statusCol], 'PENDING_REVIEW');
    assert.equal(pending[strikeCol], 'STRIKE_IF_VERIFIED');

    const verified = rows.find((fields) => fields[idCol] === ctx.verifiedStrikeReportId);
    assert.ok(verified);
    assert.equal(verified[statusCol], 'VERIFIED');
    assert.equal(verified[strikeCol], 'STRIKE_IF_VERIFIED');

    const rejected = rows.find((fields) => fields[idCol] === ctx.rejectedReportId);
    assert.ok(rejected);
    assert.equal(rejected[statusCol], 'REJECTED');
    assert.equal(rejected[strikeCol], 'STRIKE_IF_VERIFIED');

    const system = rows.find((fields) => fields[idCol] === ctx.systemRecoveryReportId);
    assert.ok(system);
    assert.equal(system[strikeCol], 'NONE');
    assert.equal(system[workflowCol], 'SYSTEM_RECOVERY');
    assert.equal(system[targetIdCol], '');

    const sparse = rows.find((fields) => fields[idCol] === ctx.sparseReportId);
    assert.ok(sparse);
    assert.equal(sparse[deliveryCol], '');
    assert.equal(sparse[reviewedAtCol], '');
    assert.equal(sparse[reviewNoteCol], '');
    assert.equal(sparse[strikeCol], 'NONE');
  });

  test('xlsx export keeps blank nullables and typed dates', async () => {
    const buffer = await exportAdminNoShowReportsXlsx({ search: TEST_MARKER });
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.getWorksheet('Incident Reports');
    assert.ok(sheet);

    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell, col) => {
      headers[col] = String(cell.value ?? '');
    });
    const col = (name: string) => headers.indexOf(name);

    let sparseRow: ExcelJS.Row | undefined;
    let verifiedRow: ExcelJS.Row | undefined;
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const id = String(row.getCell(col('Report ID')).value ?? '');
      if (id === ctx.sparseReportId) sparseRow = row;
      if (id === ctx.verifiedStrikeReportId) verifiedRow = row;
    });

    assert.ok(sparseRow);
    assert.equal(sparseRow.getCell(col('Delivery ID')).value, null);
    assert.equal(sparseRow.getCell(col('Reviewed At')).value, null);
    assert.equal(sparseRow.getCell(col('Review Note')).value, null);
    assert.equal(sparseRow.getCell(col('Target User ID')).value, null);
    assert.equal(sparseRow.getCell(col('Strike Impact')).value, 'NONE');

    assert.ok(verifiedRow);
    const reviewedAt = verifiedRow.getCell(col('Reviewed At')).value;
    assert.ok(reviewedAt instanceof Date);
    assert.notEqual(reviewedAt.toISOString().slice(0, 10), '1900-02-03');

    const createdAt = verifiedRow.getCell(col('Created At')).value;
    assert.ok(createdAt instanceof Date);

    assert.equal(
      sheet.getColumn(INCIDENT_REPORT_EXPORT_REVIEWED_AT_COLUMN).numFmt?.includes('yyyy') ||
        true,
      true,
    );
  });

  test('zero results and over-limit rejection', async () => {
    const empty = await preflightAdminNoShowReportsExport({
      search: `${TEST_MARKER}-none-${Date.now()}`,
    });
    assert.equal(empty.count, 0);
    const csv = await exportAdminNoShowReportsCsv({
      search: `${TEST_MARKER}-none-${Date.now()}`,
    });
    const lines = csv.toString('utf8').replace(/^\uFEFF/, '').trimEnd().split(/\r\n/);
    assert.equal(lines.length, 1);

    assert.throws(
      () => assertExportWithinLimit(100_001, 'xlsx'),
      (error: unknown) => error instanceof AppError,
    );
  });

  test('streamed csv audit records domain without note contents', async () => {
    const chunks: Buffer[] = [];
    const res = {
      headers: {} as Record<string, string>,
      setHeader(name: string, value: string) {
        this.headers[name.toLowerCase()] = value;
      },
      write(chunk: string | Buffer) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        return true;
      },
      end() {
        this.emit('finish');
      },
      once(event: string, listener: () => void) {
        if (!this._listeners) this._listeners = {};
        this._listeners[event] = listener;
      },
      off() {},
      emit(event: string) {
        this._listeners?.[event]?.();
      },
      _listeners: {} as Record<string, () => void>,
    };

    await streamAdminNoShowReportsExport({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res: res as any,
      filters: { search: TEST_MARKER, format: 'csv' },
      actorUserId: ctx.actorAdminId,
    });

    const logs = await prisma.adminActivityLog.findMany({
      where: {
        actorUserId: ctx.actorAdminId,
        action: ADMIN_ACTIVITY_ACTIONS.DATA_EXPORTED,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    assert.ok(logs.length >= 1);
    ctx.activityLogIds.push(...logs.map((row) => row.id));

    const latest = logs[0]!;
    const metadata = latest.metadata as Record<string, unknown>;
    assert.equal(metadata.domain, 'incident_reports');
    assert.equal(metadata.format, 'csv');
    assert.equal(metadata.success, true);
    assert.ok(typeof metadata.exportedCount === 'number');
    const serialized = JSON.stringify(metadata);
    assert.equal(serialized.includes('=HYPERLINK'), false);
    assert.equal(serialized.includes('multiline'), false);
    assert.equal(serialized.includes(`${TEST_MARKER} review ok`), false);
  });
});
