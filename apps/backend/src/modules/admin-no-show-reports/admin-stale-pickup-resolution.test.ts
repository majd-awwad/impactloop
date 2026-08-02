import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { countVerifiedStrikesForUser } from '../reservations/account-suspension.js';
import {
  STALE_PICKUP_CANCEL_REASON,
  STALE_PICKUP_SUPPLIER_RECONFIRM_REASON,
} from '../reservations/reservation-timing-policy.js';
import { listSupplierReservations } from '../supplier-reservations/supplier-reservations.service.js';
import { submitNoDriverPickupWindow } from '../supplier-reservations/supplier-reservations.service.js';
import { listMyReservations } from '../reservations/reservations.service.js';
import { escalateStaleAssignedDriverPickupsByIds } from '../reservations/reservations.stale-assigned-driver-auto-escalation.repository.js';
import { NO_DRIVER_AUTO_ESCALATION_HOURS } from '../reservations/reservation-timing-policy.js';
import {
  cancelReleaseHoldAdminNoShowReport,
  listAdminNoShowReports,
  requestSupplierRescheduleAdminNoShowReport,
  resolveAdminNoShowReport,
  verifyAdminNoShowReport,
} from './admin-no-show-reports.service.js';

const TEST_MARKER = '[test-admin-stale-pickup-resolution]';

type TestContext = {
  supplierId: string;
  learnerId: string;
  driverId: string;
  driverProfileId: string;
  adminId: string;
  categoryId: string;
  locationId: string;
  createdReservationIds: string[];
  createdMaterialIds: string[];
  createdReportIds: string[];
  createdDeliveryIds: string[];
  createdUserIds: string[];
};

const futurePickupWindow = () => {
  const supplierPickupWindowStart = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const supplierPickupWindowEnd = new Date(
    supplierPickupWindowStart.getTime() + 2 * 60 * 60 * 1000,
  );
  return { supplierPickupWindowStart, supplierPickupWindowEnd };
};

async function createStalePickupRecoveryCase(ctx: TestContext) {
  const supplierPickupWindowEnd = new Date(
    Date.now() - (NO_DRIVER_AUTO_ESCALATION_HOURS + 1) * 3_600_000,
  );
  const supplierPickupStart = new Date(
    supplierPickupWindowEnd.getTime() - 3_600_000,
  );

  const material = await prisma.material.create({
    data: {
      ownerId: ctx.supplierId,
      categoryId: ctx.categoryId,
      locationId: ctx.locationId,
      title: `${TEST_MARKER} material ${Date.now()}`,
      description: 'Stale pickup recovery test',
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
      supplierPickupWindowEnd,
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
      assignedDriverProfileId: ctx.driverProfileId,
      status: 'DRIVER_ASSIGNED',
      requestedAt: supplierPickupStart,
      assignedAt: supplierPickupStart,
    },
  });
  ctx.createdDeliveryIds.push(delivery.id);

  await prisma.deliveryAssignment.create({
    data: {
      deliveryId: delivery.id,
      driverProfileId: ctx.driverProfileId,
      assignedByUserId: ctx.driverId,
      status: 'ACTIVE',
    },
  });

  await escalateStaleAssignedDriverPickupsByIds([reservation.id]);

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
    await prisma.user.deleteMany({
      where: { id: { in: ctx.createdUserIds } },
    });
  }
}

describe('admin stale assigned-driver pickup recovery', () => {
  const ctx: TestContext = {
    supplierId: '',
    learnerId: '',
    driverId: '',
    driverProfileId: '',
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
    const passwordHash = await hashPassword('TestPassword123!');
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
        displayName: 'Stale Pickup Supplier',
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
        displayName: 'Stale Pickup Learner',
        accountStatus: 'ACTIVE',
        roles: { create: { role: 'LEARNER' } },
      },
    });
    ctx.learnerId = learner.id;
    ctx.createdUserIds.push(learner.id);

    const driver = await prisma.user.create({
      data: {
        email: `${TEST_MARKER}-driver-${Date.now()}@test.local`,
        passwordHash,
        displayName: 'Stale Pickup Driver',
        accountStatus: 'ACTIVE',
        roles: { create: { role: 'DRIVER' } },
        driverProfile: {
          create: {
            displayName: 'Driver',
            phone: '+970591234567',
            city: 'Ramallah',
            area: 'Center',
            transportationType: 'BICYCLE',
            vehicleType: 'BICYCLE',
            acceptingNewJobs: true,
          },
        },
      },
      include: { driverProfile: { select: { id: true } } },
    });
    ctx.driverId = driver.id;
    ctx.driverProfileId = driver.driverProfile!.id;
    ctx.createdUserIds.push(driver.id);

    const admin = await prisma.user.create({
      data: {
        email: `${TEST_MARKER}-admin-${Date.now()}@test.local`,
        passwordHash,
        displayName: 'Stale Pickup Admin',
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

  test('generic resolve is blocked for stale pickup recovery reports', async () => {
    const { report } = await createStalePickupRecoveryCase(ctx);

    await assert.rejects(
      () => resolveAdminNoShowReport(ctx.adminId, report.id, 'Closed'),
      (error: Error & { code?: string }) => {
        assert.equal(error.code, 'REPORT_ACTION_NOT_AVAILABLE');
        return true;
      },
    );
  });

  test('ask supplier moves reservation out of awaiting resolution and resolves report', async () => {
    const { material, reservation, delivery, report } =
      await createStalePickupRecoveryCase(ctx);
    const qtyBefore = Number(material.quantity);

    const mapped = await requestSupplierRescheduleAdminNoShowReport(
      ctx.adminId,
      report.id,
      {},
    );

    assert.equal(mapped.status, 'PENDING_REVIEW');
    assert.equal(mapped.workflowType, 'ACCOUNTABILITY_AND_RECOVERY');
    assert.equal(mapped.operationalState, 'RESOLVED');
    assert.deepEqual(mapped.availableActions, [
      'VERIFY',
      'REJECT',
      'RESOLVE_WITHOUT_STRIKE',
    ]);

    const updatedReservation = await prisma.reservation.findUnique({
      where: { id: reservation.id },
    });
    assert.equal(updatedReservation?.status, 'AWAITING_SUPPLIER_CONFIRMATION');
    assert.equal(
      updatedReservation?.pendingRescheduleReason,
      STALE_PICKUP_SUPPLIER_RECONFIRM_REASON,
    );

    const updatedDelivery = await prisma.delivery.findUnique({
      where: { id: delivery.id },
    });
    assert.equal(updatedDelivery?.status, 'AWAITING_RESOLUTION');

    const updatedMaterial = await prisma.material.findUnique({
      where: { id: material.id },
    });
    assert.equal(Number(updatedMaterial?.quantity), qtyBefore);
    assert.equal(updatedMaterial?.status, 'RESERVED');

    const supplierList = await listSupplierReservations(ctx.supplierId, {
      status: 'needs_supplier',
    });
    const supplierItem = supplierList.find((entry) => entry.id === reservation.id);
    assert.ok(supplierItem);
    assert.equal(supplierItem.status, 'AWAITING_SUPPLIER_CONFIRMATION');
    assert.equal(supplierItem.canSubmitNoDriverPickupWindow, true);
  });

  test('supplier submitting new window reopens driver search', async () => {
    const { reservation, report } = await createStalePickupRecoveryCase(ctx);
    const windows = futurePickupWindow();

    await requestSupplierRescheduleAdminNoShowReport(ctx.adminId, report.id, {});

    const mapped = await submitNoDriverPickupWindow(ctx.supplierId, reservation.id, {
      pickupWindowStart: windows.supplierPickupWindowStart.toISOString(),
      pickupWindowEnd: windows.supplierPickupWindowEnd.toISOString(),
    });

    assert.equal(mapped.status, 'ACCEPTED');
    assert.equal(mapped.activeDelivery?.status, 'WAITING_FOR_DRIVER');
    assert.equal(mapped.canSubmitNoDriverPickupWindow, false);

    const learnerList = await listMyReservations(ctx.learnerId);
    const learnerItem = learnerList.find((entry) => entry.id === reservation.id);
    assert.ok(learnerItem);
    assert.equal(learnerItem.status, 'ACCEPTED');
    assert.equal(learnerItem.activeDelivery?.status, 'WAITING_FOR_DRIVER');
  });

  test('cancel and release hold expires reservation without reducing quantity', async () => {
    const { material, reservation, delivery, report } =
      await createStalePickupRecoveryCase(ctx);
    const qtyBefore = Number(material.quantity);

    const mapped = await cancelReleaseHoldAdminNoShowReport(
      ctx.adminId,
      report.id,
      {},
    );

    assert.equal(mapped.status, 'PENDING_REVIEW');
    assert.equal(mapped.operationalState, 'RESOLVED');

    const updatedReservation = await prisma.reservation.findUnique({
      where: { id: reservation.id },
    });
    assert.equal(updatedReservation?.status, 'EXPIRED');
    assert.equal(updatedReservation?.rejectionReason, STALE_PICKUP_CANCEL_REASON);

    const updatedDelivery = await prisma.delivery.findUnique({
      where: { id: delivery.id },
    });
    assert.equal(updatedDelivery?.status, 'CANCELLED');

    const updatedMaterial = await prisma.material.findUnique({
      where: { id: material.id },
    });
    assert.equal(Number(updatedMaterial?.quantity), qtyBefore);
    assert.notEqual(updatedMaterial?.status, 'RESERVED');
  });

  test('verify driver fault increments driver strike only for DRIVER target', async () => {
    const { report } = await createStalePickupRecoveryCase(ctx);

    assert.equal(report.targetRole, 'DRIVER');

    const verified = await verifyAdminNoShowReport(
      ctx.adminId,
      report.id,
      'Driver did not complete pickup',
    );

    assert.equal(verified.report.status, 'VERIFIED');

    const driverStrikes = await countVerifiedStrikesForUser(ctx.driverId);
    assert.equal(driverStrikes, 1);

    const learnerStrikes = await countVerifiedStrikesForUser(ctx.learnerId);
    assert.equal(learnerStrikes, 0);

    const updatedReservation = await prisma.reservation.findUnique({
      where: { id: report.reservationId },
    });
    assert.equal(updatedReservation?.status, 'AWAITING_RESOLUTION');

    const recovered = await requestSupplierRescheduleAdminNoShowReport(
      ctx.adminId,
      report.id,
      {},
    );
    assert.equal(recovered.status, 'VERIFIED');
    assert.equal(recovered.operationalState, 'RESOLVED');
    const afterRequest = await prisma.reservation.findUnique({
      where: { id: report.reservationId },
    });
    assert.equal(afterRequest?.status, 'AWAITING_SUPPLIER_CONFIRMATION');
  });
});
