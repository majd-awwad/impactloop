import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import {
  cancelReleaseHoldAdminNoShowReport,
  listAdminNoShowReports,
  requestSupplierRescheduleAdminNoShowReport,
} from './admin-no-show-reports.service.js';
import { countVerifiedStrikesForUser } from '../reservations/account-suspension.js';
import { NO_DRIVER_CANCEL_REASON, NO_DRIVER_SUPPLIER_RECONFIRM_REASON } from '../reservations/reservation-timing-policy.js';
import { reportNoDriverAvailable } from '../reservations/reservations.service.js';
import { listMyReservations } from '../reservations/reservations.service.js';
import { submitNoDriverPickupWindow } from '../supplier-reservations/supplier-reservations.service.js';

const TEST_MARKER = '[test-admin-no-driver-resolution]';

const pickupWindowEndAfterGrace = () =>
  new Date(Date.now() - (31 * 60 + 5) * 1000);

const futurePickupWindow = () => {
  const supplierPickupWindowStart = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const supplierPickupWindowEnd = new Date(
    supplierPickupWindowStart.getTime() + 2 * 60 * 60 * 1000,
  );
  return { supplierPickupWindowStart, supplierPickupWindowEnd };
};

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

async function createAwaitingResolutionNoDriverCase(ctx: TestContext) {
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
      description: 'Admin no-driver resolution test',
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

  await reportNoDriverAvailable(ctx.learnerId, reservation.id, {
    note: 'No driver accepted',
  });

  const reports = await listAdminNoShowReports({
    status: 'PENDING_REVIEW',
    page: 1,
    limit: 50,
  });
  const report = reports.items.find(
    (entry) => entry.reservationId === reservation.id,
  );
  assert.ok(report);
  ctx.createdReportIds.push(report.id);

  return { material, reservation, delivery, report };
}

async function cleanup(ctx: TestContext) {
  if (ctx.createdReportIds.length) {
    await prisma.noShowReport.deleteMany({
      where: { id: { in: ctx.createdReportIds } },
    });
  }

  if (ctx.createdDeliveryIds.length) {
    await prisma.deliveryAssignment.deleteMany({
      where: { deliveryId: { in: ctx.createdDeliveryIds } },
    });
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

describe('admin no-driver resolution', () => {
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
        displayName: 'No Driver Supplier',
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
        displayName: 'No Driver Learner',
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
        displayName: 'No Driver Admin',
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

  test('admin asks supplier for new pickup window without changing windows', async () => {
    const { material, reservation, delivery, report } =
      await createAwaitingResolutionNoDriverCase(ctx);
    const qtyBefore = Number(material.quantity);

    const result = await requestSupplierRescheduleAdminNoShowReport(
      ctx.adminId,
      report.id,
      { adminNote: 'Please propose a new handover time' },
    );

    assert.equal(result.status, 'RESOLVED_NO_STRIKE');

    const updatedReservation = await prisma.reservation.findUnique({
      where: { id: reservation.id },
    });
    assert.equal(updatedReservation?.status, 'AWAITING_SUPPLIER_CONFIRMATION');
    assert.equal(
      updatedReservation?.pendingRescheduleReason,
      NO_DRIVER_SUPPLIER_RECONFIRM_REASON,
    );
    assert.ok(updatedReservation?.supplierPickupWindowStart);

    const updatedDelivery = await prisma.delivery.findUnique({
      where: { id: delivery.id },
    });
    assert.equal(updatedDelivery?.status, 'AWAITING_RESOLUTION');

    const updatedMaterial = await prisma.material.findUnique({
      where: { id: material.id },
    });
    assert.equal(Number(updatedMaterial?.quantity), qtyBefore);
    assert.equal(updatedMaterial?.status, 'RESERVED');

    const strikes = await countVerifiedStrikesForUser(ctx.learnerId);
    assert.equal(strikes, 0);
  });

  test('supplier pickup window submission reopens driver search without strike', async () => {
    const { reservation, report } = await createAwaitingResolutionNoDriverCase(ctx);
    const windows = futurePickupWindow();

    await requestSupplierRescheduleAdminNoShowReport(ctx.adminId, report.id, {});

    const mapped = await submitNoDriverPickupWindow(ctx.supplierId, reservation.id, {
      pickupWindowStart: windows.supplierPickupWindowStart.toISOString(),
      pickupWindowEnd: windows.supplierPickupWindowEnd.toISOString(),
    });

    assert.equal(mapped.status, 'ACCEPTED');
    assert.equal(mapped.activeDelivery?.status, 'WAITING_FOR_DRIVER');
    assert.equal(mapped.canSubmitNoDriverPickupWindow, false);

    const updatedReport = await prisma.noShowReport.findUnique({
      where: { id: report.id },
    });
    assert.equal(updatedReport?.status, 'RESOLVED_NO_STRIKE');

    const learnerList = await listMyReservations(ctx.learnerId);
    const learnerItem = learnerList.find((entry) => entry.id === reservation.id);
    assert.ok(learnerItem);
    assert.equal(learnerItem.status, 'ACCEPTED');
    assert.equal(learnerItem.activeDelivery?.status, 'WAITING_FOR_DRIVER');
  });

  test('cancel and release hold expires reservation and releases material hold', async () => {
    const { material, reservation, delivery, report } =
      await createAwaitingResolutionNoDriverCase(ctx);
    const qtyBefore = Number(material.quantity);

    const resolved = await cancelReleaseHoldAdminNoShowReport(
      ctx.adminId,
      report.id,
      { adminNote: 'Cancelled after no driver' },
    );

    assert.equal(resolved.status, 'RESOLVED_NO_STRIKE');

    const updatedReservation = await prisma.reservation.findUnique({
      where: { id: reservation.id },
    });
    assert.equal(updatedReservation?.status, 'EXPIRED');
    assert.equal(updatedReservation?.rejectionReason, NO_DRIVER_CANCEL_REASON);

    const updatedDelivery = await prisma.delivery.findUnique({
      where: { id: delivery.id },
    });
    assert.equal(updatedDelivery?.status, 'CANCELLED');

    const updatedMaterial = await prisma.material.findUnique({
      where: { id: material.id },
    });
    assert.equal(Number(updatedMaterial?.quantity), qtyBefore);
    assert.notEqual(updatedMaterial?.status, 'RESERVED');

    const strikes = await countVerifiedStrikesForUser(ctx.learnerId);
    assert.equal(strikes, 0);
  });
});
