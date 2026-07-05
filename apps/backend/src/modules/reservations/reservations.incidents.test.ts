import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';
import {
  getAdminNoShowReportById,
  listAdminNoShowReports,
  rejectAdminNoShowReport,
  resolveAdminNoShowReport,
  verifyAdminNoShowReport,
} from '../admin-no-show-reports/admin-no-show-reports.service.js';
import {
  countVerifiedStrikesForUser,
} from './account-suspension.js';
import {
  listMyReservations,
  reportLearnerSupplierIssue,
  reportNoDriverAvailable,
} from './reservations.service.js';
import { reportSupplierNoDriverAvailable } from '../supplier-reservations/supplier-reservations.service.js';
import { submitSupplierNoShowReport } from '../supplier-reservations/supplier-reservations.service.js';

const TEST_MARKER = '[test-reservation-incidents]';

const pickupWindowEndAfterGrace = () =>
  new Date(Date.now() - (31 * 60 + 5) * 1000);

type TestContext = {
  supplierId: string;
  learnerId: string;
  adminId: string;
  categoryId: string;
  locationId: string;
  createdReservationIds: string[];
  createdMaterialIds: string[];
  createdReportIds: string[];
  createdDeliveryIds: string[];
  createdUserIds: string[];
};

async function createAcceptedPickupReservation(
  ctx: TestContext,
  pickupWindowEnd: Date,
) {
  const material = await prisma.material.create({
    data: {
      ownerId: ctx.supplierId,
      categoryId: ctx.categoryId,
      locationId: ctx.locationId,
      title: `${TEST_MARKER} material ${Date.now()}`,
      description: 'Incident test material',
      materialType: 'Test',
      quantity: 2,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'RESERVED',
    },
  });
  ctx.createdMaterialIds.push(material.id);

  const start = new Date(pickupWindowEnd.getTime() - 3_600_000);
  const reservation = await prisma.reservation.create({
    data: {
      materialId: material.id,
      requesterId: ctx.learnerId,
      ownerId: ctx.supplierId,
      quantityRequested: 1,
      status: 'ACCEPTED',
      fulfillmentMethod: 'PICKUP',
      pickupWindowStart: start,
      pickupWindowEnd,
      acceptedAt: start,
    },
  });
  ctx.createdReservationIds.push(reservation.id);

  return { reservation, material };
}

async function createAcceptedDeliveryReservation(ctx: TestContext) {
  const pastSupplierPickupEnd = pickupWindowEndAfterGrace();
  const supplierPickupStart = new Date(
    pastSupplierPickupEnd.getTime() - 3_600_000,
  );

  const material = await prisma.material.create({
    data: {
      ownerId: ctx.supplierId,
      categoryId: ctx.categoryId,
      locationId: ctx.locationId,
      title: `${TEST_MARKER} delivery ${Date.now()}`,
      description: 'Delivery incident test',
      materialType: 'Test',
      quantity: 2,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'RESERVED',
      deliveryAllowed: true,
    },
  });
  ctx.createdMaterialIds.push(material.id);

  const reservation = await prisma.reservation.create({
    data: {
      materialId: material.id,
      requesterId: ctx.learnerId,
      ownerId: ctx.supplierId,
      quantityRequested: 1,
      status: 'ACCEPTED',
      fulfillmentMethod: 'DELIVERY',
      deliveryRequested: true,
      supplierPickupWindowStart: supplierPickupStart,
      supplierPickupWindowEnd: pastSupplierPickupEnd,
      acceptedAt: supplierPickupStart,
    },
  });
  ctx.createdReservationIds.push(reservation.id);

  const delivery = await prisma.delivery.create({
    data: {
      reservationId: reservation.id,
      pickupLocationId: ctx.locationId,
      dropoffLocationId: ctx.locationId,
      requestedByUserId: ctx.learnerId,
      status: 'WAITING_FOR_DRIVER',
      requestedAt: supplierPickupStart,
    },
  });
  ctx.createdDeliveryIds.push(delivery.id);

  return { reservation, material, delivery };
}

async function cleanup(ctx: TestContext) {
  if (ctx.createdReportIds.length) {
    await prisma.noShowReport.deleteMany({
      where: { id: { in: ctx.createdReportIds } },
    });
  }

  if (ctx.createdDeliveryIds.length) {
    await prisma.deliveryStatusHistory.deleteMany({
      where: { deliveryId: { in: ctx.createdDeliveryIds } },
    });
    await prisma.delivery.deleteMany({
      where: { id: { in: ctx.createdDeliveryIds } },
    });
  }

  if (ctx.createdReservationIds.length) {
    await prisma.reservationMessage.deleteMany({
      where: { reservationId: { in: ctx.createdReservationIds } },
    });
    await prisma.noShowReport.deleteMany({
      where: { reservationId: { in: ctx.createdReservationIds } },
    });
    await prisma.reservationStatusHistory.deleteMany({
      where: { reservationId: { in: ctx.createdReservationIds } },
    });
    await prisma.reservation.deleteMany({
      where: { id: { in: ctx.createdReservationIds } },
    });
  }

  if (ctx.createdMaterialIds.length) {
    await prisma.material.deleteMany({
      where: { id: { in: ctx.createdMaterialIds } },
    });
  }

  if (ctx.createdUserIds.length) {
    await prisma.authToken.deleteMany({
      where: { userId: { in: ctx.createdUserIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: ctx.createdUserIds } },
    });
  }
}

describe('reservation incidents (phase 6+7)', () => {
  const ctx: TestContext = {
    supplierId: '',
    learnerId: '',
    adminId: '',
    categoryId: '',
    locationId: '',
    createdReservationIds: [],
    createdMaterialIds: [],
    createdReportIds: [],
    createdDeliveryIds: [],
    createdUserIds: [],
  };

  before(async () => {
    const passwordHash = await hashPassword('test-password');

    const category = await prisma.category.findFirst();
    assert.ok(category);
    ctx.categoryId = category.id;

    const location = await prisma.location.findFirst();
    assert.ok(location);
    ctx.locationId = location.id;

    const supplier = await prisma.user.create({
      data: {
        email: `${TEST_MARKER}-supplier-${Date.now()}@test.local`,
        passwordHash,
        displayName: 'Incident Supplier',
        accountStatus: 'ACTIVE',
        roles: { create: { role: 'SUPPLIER' } },
      },
    });
    ctx.supplierId = supplier.id;
    ctx.createdUserIds.push(supplier.id);

    const learner = await prisma.user.create({
      data: {
        email: `${TEST_MARKER}-learner-${Date.now()}@test.local`,
        passwordHash,
        displayName: 'Incident Learner',
        accountStatus: 'ACTIVE',
        roles: { create: { role: 'LEARNER' } },
      },
    });
    ctx.learnerId = learner.id;
    ctx.createdUserIds.push(learner.id);

    const admin = await prisma.user.create({
      data: {
        email: `${TEST_MARKER}-admin-${Date.now()}@test.local`,
        passwordHash,
        displayName: 'Incident Admin',
        accountStatus: 'ACTIVE',
        roles: { create: { role: 'ADMIN' } },
      },
    });
    ctx.adminId = admin.id;
    ctx.createdUserIds.push(admin.id);
  });

  after(async () => {
    await cleanup(ctx);
  });

  test('learner reports supplier issue -> pending admin report', async () => {
    const pastEnd = pickupWindowEndAfterGrace();
    const { reservation, material } = await createAcceptedPickupReservation(
      ctx,
      pastEnd,
    );
    const qtyBefore = Number(
      (await prisma.material.findUnique({ where: { id: material.id } }))
        ?.quantity,
    );

    const mapped = await reportLearnerSupplierIssue(ctx.learnerId, reservation.id, {
      reason: 'SUPPLIER_UNAVAILABLE',
      note: 'Supplier was not at pickup location',
    });

    assert.equal(mapped.status, 'AWAITING_RESOLUTION');

    const reports = await listAdminNoShowReports({
      status: 'PENDING_REVIEW',
      page: 1,
      limit: 50,
    });
    const item = reports.items.find(
      (entry) => entry.reservationId === reservation.id,
    );
    assert.ok(item);
    assert.equal(item.targetRole, 'SUPPLIER');
    ctx.createdReportIds.push(item.id);

    const qtyAfter = Number(
      (await prisma.material.findUnique({ where: { id: material.id } }))
        ?.quantity,
    );
    assert.equal(qtyBefore, qtyAfter);
  });

  test('no driver available -> system report without strike target', async () => {
    const { reservation } = await createAcceptedDeliveryReservation(ctx);

    const mapped = await reportNoDriverAvailable(ctx.learnerId, reservation.id, {
      note: 'No driver accepted',
    });
    assert.equal(mapped.status, 'AWAITING_RESOLUTION');

    const reports = await listAdminNoShowReports({
      status: 'PENDING_REVIEW',
      page: 1,
      limit: 50,
    });
    const item = reports.items.find(
      (entry) => entry.reservationId === reservation.id,
    );
    assert.ok(item);
    assert.equal(item.targetRole, 'SYSTEM');
    assert.equal(item.reasonCode, 'NO_DRIVER_AVAILABLE');
    ctx.createdReportIds.push(item.id);

    const verified = await verifyAdminNoShowReport(
      ctx.adminId,
      item.id,
      'No driver pool issue',
    );
    assert.equal(verified.targetVerifiedNoShowCount, 0);
    assert.equal(verified.targetSuspended, false);
  });

  test('admin resolve without strike does not increment strikes', async () => {
    const pastEnd = pickupWindowEndAfterGrace();
    const { reservation } = await createAcceptedPickupReservation(ctx, pastEnd);
    const report = await submitSupplierNoShowReport(
      ctx.supplierId,
      reservation.id,
      { reasonCode: 'LEARNER_DID_NOT_ARRIVE', note: 'Did not arrive' },
    );
    ctx.createdReportIds.push(report.noShowReport!.id);

    const resolved = await resolveAdminNoShowReport(
      ctx.adminId,
      report.noShowReport!.id,
      'Resolved administratively',
    );
    assert.equal(resolved.status, 'RESOLVED_NO_STRIKE');

    const strikes = await countVerifiedStrikesForUser(ctx.learnerId);
    assert.equal(strikes, 0);
  });

  test('pending and rejected reports do not suspend user', async () => {
    const pastEnd = pickupWindowEndAfterGrace();
    const { reservation } = await createAcceptedPickupReservation(ctx, pastEnd);
    const report = await submitSupplierNoShowReport(
      ctx.supplierId,
      reservation.id,
      { reasonCode: 'OTHER', note: 'Pending only' },
    );
    ctx.createdReportIds.push(report.noShowReport!.id);

    let user = await prisma.user.findUnique({
      where: { id: ctx.learnerId },
      select: { accountStatus: true },
    });
    assert.equal(user?.accountStatus, 'ACTIVE');

    const rejected = await rejectAdminNoShowReport(
      ctx.adminId,
      report.noShowReport!.id,
      'Not enough evidence',
    );
    assert.equal(rejected.status, 'REJECTED');

    user = await prisma.user.findUnique({
      where: { id: ctx.learnerId },
      select: { accountStatus: true },
    });
    assert.equal(user?.accountStatus, 'ACTIVE');
  });

  test('report detail includes reservation context', async () => {
    const pastEnd = pickupWindowEndAfterGrace();
    const { reservation } = await createAcceptedPickupReservation(ctx, pastEnd);
    const report = await submitSupplierNoShowReport(
      ctx.supplierId,
      reservation.id,
      { reasonCode: 'LEARNER_DID_NOT_ARRIVE', note: 'Detail test' },
    );
    ctx.createdReportIds.push(report.noShowReport!.id);

    const detail = await getAdminNoShowReportById(report.noShowReport!.id);
    assert.equal(detail.reservation?.id, reservation.id);
    assert.ok(detail.reservation?.material);
    assert.ok(detail.messages);
    assert.ok(detail.activityHistory);
  });

  test('learner list exposes report action flags after overdue pickup', async () => {
    const pastEnd = pickupWindowEndAfterGrace();
    const { reservation } = await createAcceptedPickupReservation(ctx, pastEnd);

    const reservations = await listMyReservations(ctx.learnerId);
    const item = reservations.find((entry) => entry.id === reservation.id);

    assert.ok(item);
    assert.equal(item.canLearnerReportSupplier, true);
    assert.equal(item.canSendMessage, true);
  });

  test('supplier reports no driver -> system report in admin queue', async () => {
    const { reservation } = await createAcceptedDeliveryReservation(ctx);

    await reportSupplierNoDriverAvailable(ctx.supplierId, reservation.id, {
      note: 'No drivers accepted the job',
    });

    const reports = await listAdminNoShowReports({
      status: 'PENDING_REVIEW',
      page: 1,
      limit: 50,
    });
    const item = reports.items.find(
      (entry) => entry.reservationId === reservation.id,
    );
    assert.ok(item);
    assert.equal(item.targetRole, 'SYSTEM');
    ctx.createdReportIds.push(item.id);
  });
});
