import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { getMaterialById } from '../materials/materials.service.js';
import { listAdminNoShowReports } from '../admin-no-show-reports/admin-no-show-reports.service.js';

import { ReservationLifecycleWorker } from './reservation-lifecycle.worker.js';
import { findDuePendingExpiryCandidates } from './reservations.pending-expiry.repository.js';
import { findDueMissedPickupExpiryIds } from './reservations.missed-pickup-expiry.repository.js';
import { findDueNoDriverEscalationIds } from './reservations.no-driver-auto-escalation.repository.js';
import { findDueAssignedDriverEscalationIds } from './reservations.stale-assigned-driver-auto-escalation.repository.js';
import {
  MISSED_PICKUP_AUTO_CLOSE_GRACE_HOURS,
  MISSED_PICKUP_EXPIRY_REASON,
  NO_DRIVER_AUTO_ESCALATION_HOURS,
} from './reservation-timing-policy.js';
import { createReservation } from './reservations.service.js';
import type { CreateReservationInput } from './reservations.validation.js';

const TEST_MARKER = '[test-reservation-lifecycle-worker]';

type TestContext = {
  learnerId: string;
  supplierId: string;
  driverId: string;
  driverProfileId: string;
  categoryId: string;
  locationId: string;
  createdUserIds: string[];
  createdMaterialIds: string[];
  createdReservationIds: string[];
  createdDeliveryIds: string[];
  createdReportIds: string[];
};

async function createUser(input: {
  displayName: string;
  emailSuffix: string;
  role: 'LEARNER' | 'SUPPLIER' | 'DRIVER';
}) {
  const passwordHash = await hashPassword('TestPassword123!');

  return prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} ${input.displayName}`,
      email: `${TEST_MARKER}-${input.emailSuffix}-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: {
        create: [{ role: input.role, isPrimary: true }],
      },
      ...(input.role === 'LEARNER'
        ? {
            learnerProfile: {
              create: {
                learnerType: 'STUDENT',
                skillLevel: 'BEGINNER',
              },
            },
          }
        : {}),
      ...(input.role === 'SUPPLIER'
        ? {
            supplierProfile: {
              create: {
                supplierType: 'INDIVIDUAL_SUPPLIER',
                publicName: `${TEST_MARKER} supplier`,
                verificationStatus: 'VERIFIED',
              },
            },
          }
        : {}),
      ...(input.role === 'DRIVER'
        ? {
            driverProfile: {
              create: {
                displayName: `${TEST_MARKER} Driver`,
                phone: `+97059${Math.floor(Math.random() * 1_000_000)
                  .toString()
                  .padStart(6, '0')}`,
                city: 'Ramallah',
                area: 'Center',
                transportationType: 'BICYCLE',
                vehicleType: 'BICYCLE',
              },
            },
          }
        : {}),
    },
    include: {
      driverProfile: { select: { id: true } },
    },
  });
}

function futurePreferredWindow(hoursFromNow = 24, durationHours = 2) {
  const start = new Date(Date.now() + hoursFromNow * 3_600_000);
  const end = new Date(start.getTime() + durationHours * 3_600_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function pastPreferredWindow(hoursAgoEnd = 1, durationHours = 2) {
  const end = new Date(Date.now() - hoursAgoEnd * 3_600_000);
  const start = new Date(end.getTime() - durationHours * 3_600_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function createMaterial(ctx: TestContext, quantity = 5) {
  const supplierProfile = await prisma.supplierProfile.findUnique({
    where: { userId: ctx.supplierId },
    select: { id: true },
  });

  const material = await prisma.material.create({
    data: {
      ownerId: ctx.supplierId,
      supplierProfileId: supplierProfile?.id,
      categoryId: ctx.categoryId,
      locationId: ctx.locationId,
      title: `${TEST_MARKER} material ${Date.now()}`,
      description: 'Lifecycle worker test material',
      materialType: 'Test material',
      quantity,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'AVAILABLE',
      isFree: true,
      deliveryAllowed: true,
      pickupAllowed: true,
    },
    select: { id: true },
  });

  ctx.createdMaterialIds.push(material.id);
  return material;
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
  if (ctx.locationId) {
    await prisma.location.deleteMany({ where: { id: ctx.locationId } });
  }
  if (ctx.createdUserIds.length) {
    await prisma.user.deleteMany({
      where: { id: { in: ctx.createdUserIds } },
    });
  }
}

describe('reservation lifecycle worker due-only batch', () => {
  const ctx: TestContext = {
    learnerId: '',
    supplierId: '',
    driverId: '',
    driverProfileId: '',
    categoryId: '',
    locationId: '',
    createdUserIds: [],
    createdMaterialIds: [],
    createdReservationIds: [],
    createdDeliveryIds: [],
    createdReportIds: [],
  };

  before(async () => {
    const category = await prisma.category.findFirst({
      where: { categoryType: { in: ['MATERIAL', 'BOTH'] } },
      select: { id: true },
    });
    assert.ok(category, 'Expected at least one material category');

    const location = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: 'Nablus',
        area: `${TEST_MARKER}-area`,
        visibility: 'PUBLIC_APPROXIMATE',
        isApproximate: true,
      },
      select: { id: true },
    });

    const learner = await createUser({
      displayName: 'learner',
      emailSuffix: 'learner',
      role: 'LEARNER',
    });
    const supplier = await createUser({
      displayName: 'supplier',
      emailSuffix: 'supplier',
      role: 'SUPPLIER',
    });
    const driver = await createUser({
      displayName: 'driver',
      emailSuffix: 'driver',
      role: 'DRIVER',
    });

    ctx.categoryId = category.id;
    ctx.locationId = location.id;
    ctx.learnerId = learner.id;
    ctx.supplierId = supplier.id;
    ctx.driverId = driver.id;
    ctx.driverProfileId = driver.driverProfile!.id;
    ctx.createdUserIds.push(learner.id, supplier.id, driver.id);
  });

  after(async () => {
    await cleanup(ctx);
    await prisma.$disconnect();
  });

  test('future PENDING is not discovered as due', async () => {
    const material = await createMaterial(ctx);
    const payload: CreateReservationInput = {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
      learnerPreferredPickupWindows: [futurePreferredWindow()],
    };
    const reservation = await createReservation(ctx.learnerId, payload);
    ctx.createdReservationIds.push(reservation.id);

    const due = await findDuePendingExpiryCandidates(100);
    assert.equal(
      due.some((row) => row.id === reservation.id),
      false,
    );
  });

  test('due PENDING is discovered and expired by worker; idempotent re-run', async () => {
    const material = await createMaterial(ctx, 5);
    const reservation = await createReservation(ctx.learnerId, {
      materialId: material.id,
      quantityRequested: 2,
      fulfillmentMethod: 'PICKUP',
      learnerPreferredPickupWindows: [futurePreferredWindow()],
    });
    ctx.createdReservationIds.push(reservation.id);

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        learnerPreferredPickupWindows: [pastPreferredWindow()],
      },
    });

    const due = await findDuePendingExpiryCandidates(100);
    assert.ok(due.some((row) => row.id === reservation.id));

    const worker = new ReservationLifecycleWorker(60_000, 100, 60_000);
    const first = await worker.runOnce();
    assert.ok(first);
    assert.ok(first.pendingExpired >= 1);
    assert.ok(first.transitionCount >= 1);

    const row = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    assert.equal(row.status, 'EXPIRED');

    const detail = await getMaterialById(material.id);
    assert.equal(detail.availableQuantity, 5);

    const second = await worker.runOnce();
    assert.ok(second);
    assert.equal(second.pendingExpired, 0);
    assert.equal(
      (await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } }))
        .status,
      'EXPIRED',
    );
  });

  test('non-due active-ish statuses are not discovered by due queries', async () => {
    const material = await createMaterial(ctx);
    const reservation = await prisma.reservation.create({
      data: {
        materialId: material.id,
        requesterId: ctx.learnerId,
        ownerId: ctx.supplierId,
        quantityRequested: 1,
        status: 'AWAITING_RESOLUTION',
        fulfillmentMethod: 'DELIVERY',
        supplierPickupWindowStart: new Date(Date.now() - 48 * 3_600_000),
        supplierPickupWindowEnd: new Date(Date.now() - 24 * 3_600_000),
      },
    });
    ctx.createdReservationIds.push(reservation.id);

    const [pendingDue, missedDue, noDriverDue, assignedDue] = await Promise.all([
      findDuePendingExpiryCandidates(100),
      findDueMissedPickupExpiryIds(100),
      findDueNoDriverEscalationIds(100),
      findDueAssignedDriverEscalationIds(100),
    ]);

    assert.equal(pendingDue.some((row) => row.id === reservation.id), false);
    assert.equal(missedDue.includes(reservation.id), false);
    assert.equal(noDriverDue.includes(reservation.id), false);
    assert.equal(assignedDue.includes(reservation.id), false);

    const worker = new ReservationLifecycleWorker(60_000, 100, 60_000);
    const result = await worker.runOnce();
    assert.ok(result);
    const after = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    assert.equal(after.status, 'AWAITING_RESOLUTION');
  });

  test('due missed pickup is expired by worker', async () => {
    const material = await createMaterial(ctx, 4);
    const pickupWindowEnd = new Date(
      Date.now() -
        (MISSED_PICKUP_AUTO_CLOSE_GRACE_HOURS + 1) * 60 * 60 * 1000,
    );
    const reservation = await prisma.reservation.create({
      data: {
        materialId: material.id,
        requesterId: ctx.learnerId,
        ownerId: ctx.supplierId,
        quantityRequested: 1,
        status: 'ACCEPTED',
        fulfillmentMethod: 'PICKUP',
        pickupWindowStart: new Date(pickupWindowEnd.getTime() - 2 * 3_600_000),
        pickupWindowEnd,
        acceptedAt: pickupWindowEnd,
      },
    });
    ctx.createdReservationIds.push(reservation.id);

    assert.ok((await findDueMissedPickupExpiryIds(100)).includes(reservation.id));

    const worker = new ReservationLifecycleWorker(60_000, 100, 60_000);
    const result = await worker.runOnce();
    assert.ok(result);
    assert.ok(result.missedPickupExpired >= 1);

    const row = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    assert.equal(row.status, 'EXPIRED');
    assert.equal(row.rejectionReason, MISSED_PICKUP_EXPIRY_REASON);
  });

  test('due no-driver escalation is processed once by worker', async () => {
    const material = await createMaterial(ctx);
    const supplierPickupWindowEnd = new Date(
      Date.now() - (NO_DRIVER_AUTO_ESCALATION_HOURS + 2) * 3_600_000,
    );
    const supplierPickupStart = new Date(
      supplierPickupWindowEnd.getTime() - 3_600_000,
    );
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
        status: 'WAITING_FOR_DRIVER',
        requestedAt: supplierPickupStart,
      },
    });
    ctx.createdDeliveryIds.push(delivery.id);

    assert.ok((await findDueNoDriverEscalationIds(100)).includes(reservation.id));

    const worker = new ReservationLifecycleWorker(60_000, 100, 60_000);
    const first = await worker.runOnce();
    assert.ok(first);
    assert.ok(first.noDriverEscalated >= 1);

    const row = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    assert.equal(row.status, 'AWAITING_RESOLUTION');

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

    const second = await worker.runOnce();
    assert.ok(second);
    assert.equal(second.noDriverEscalated, 0);
  });

  test('due assigned-driver escalation is processed by worker', async () => {
    const material = await createMaterial(ctx);
    const supplierPickupWindowEnd = new Date(
      Date.now() - (NO_DRIVER_AUTO_ESCALATION_HOURS + 2) * 3_600_000,
    );
    const supplierPickupStart = new Date(
      supplierPickupWindowEnd.getTime() - 3_600_000,
    );
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

    assert.ok(
      (await findDueAssignedDriverEscalationIds(100)).includes(reservation.id),
    );

    const worker = new ReservationLifecycleWorker(60_000, 100, 60_000);
    const result = await worker.runOnce();
    assert.ok(result);
    assert.ok(result.assignedDriverEscalated >= 1);

    const row = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    assert.equal(row.status, 'AWAITING_RESOLUTION');

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
  });

  test('self-overlap guard skips concurrent runOnce', async () => {
    const worker = new ReservationLifecycleWorker(60_000, 100, 60_000);
    (worker as unknown as { running: boolean }).running = true;
    const skipped = await worker.runOnce();
    assert.equal(skipped, null);
    (worker as unknown as { running: boolean }).running = false;
  });

  test('health snapshot exposes separate reminder interval', () => {
    const worker = new ReservationLifecycleWorker(300_000, 100, 60_000);
    const snapshot = worker.getHealthSnapshot();
    assert.equal(snapshot.intervalMs, 300_000);
    assert.equal(snapshot.reminderIntervalMs, 60_000);
  });
});
