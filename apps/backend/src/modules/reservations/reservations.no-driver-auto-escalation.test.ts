import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { listAdminNoShowReports } from '../admin-no-show-reports/admin-no-show-reports.service.js';

import {
  isNoDriverAutoEscalationDue,
  resolveNoDriverAutoEscalationDeadline,
} from './reservation-no-driver-auto-escalation.js';
import { NO_DRIVER_AUTO_ESCALATION_HOURS } from './reservation-timing-policy.js';
import { listMyReservations } from './reservations.service.js';
import { escalateStaleNoDriverDeliveriesByIds } from './reservations.no-driver-auto-escalation.repository.js';

const TEST_MARKER = '[test-reservation-no-driver-auto-escalation]';

type TestContext = {
  learnerId: string;
  supplierId: string;
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
  role: 'LEARNER' | 'SUPPLIER';
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
    },
  });
}

async function createStaleNoDriverReservation(
  ctx: TestContext,
  supplierPickupWindowEnd: Date,
) {
  const supplierPickupStart = new Date(
    supplierPickupWindowEnd.getTime() - 3_600_000,
  );

  const material = await prisma.material.create({
    data: {
      ownerId: ctx.supplierId,
      categoryId: ctx.categoryId,
      locationId: ctx.locationId,
      title: `${TEST_MARKER} material ${Date.now()}`,
      description: 'No-driver auto-escalation test',
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
    await prisma.user.deleteMany({
      where: { id: { in: ctx.createdUserIds } },
    });
  }
}

describe('reservation no-driver auto-escalation', () => {
  const ctx: TestContext = {
    learnerId: '',
    supplierId: '',
    categoryId: '',
    locationId: '',
    createdUserIds: [],
    createdMaterialIds: [],
    createdReservationIds: [],
    createdDeliveryIds: [],
    createdReportIds: [],
  };

  before(async () => {
    const category = await prisma.category.findFirst();
    assert.ok(category);
    ctx.categoryId = category.id;

    const location = await prisma.location.findFirst();
    assert.ok(location);
    ctx.locationId = location.id;

    const learner = await createUser({
      displayName: 'Learner',
      emailSuffix: 'learner',
      role: 'LEARNER',
    });
    ctx.learnerId = learner.id;
    ctx.createdUserIds.push(learner.id);

    const supplier = await createUser({
      displayName: 'Supplier',
      emailSuffix: 'supplier',
      role: 'SUPPLIER',
    });
    ctx.supplierId = supplier.id;
    ctx.createdUserIds.push(supplier.id);
  });

  after(async () => {
    await cleanup(ctx);
  });

  test('isNoDriverAutoEscalationDue respects 24h deadline', () => {
    const windowEnd = new Date('2026-01-01T12:00:00.000Z');
    const deadline = resolveNoDriverAutoEscalationDeadline(windowEnd);
    assert.equal(
      deadline.toISOString(),
      new Date('2026-01-02T12:00:00.000Z').toISOString(),
    );

    assert.equal(
      isNoDriverAutoEscalationDue(
        {
          status: 'ACCEPTED',
          fulfillmentMethod: 'DELIVERY',
          supplierPickupWindowEnd: windowEnd,
          deliveryStatus: 'WAITING_FOR_DRIVER',
          assignedDriverProfileId: null,
          hasNoDriverReport: false,
        },
        new Date('2026-01-02T11:59:59.000Z'),
      ),
      false,
    );

    assert.equal(
      isNoDriverAutoEscalationDue(
        {
          status: 'ACCEPTED',
          fulfillmentMethod: 'DELIVERY',
          supplierPickupWindowEnd: windowEnd,
          deliveryStatus: 'WAITING_FOR_DRIVER',
          assignedDriverProfileId: null,
          hasNoDriverReport: false,
        },
        new Date('2026-01-02T12:00:01.000Z'),
      ),
      true,
    );
  });

  test('lazy escalation moves stale no-driver delivery to admin review', async () => {
    const supplierPickupWindowEnd = new Date(
      Date.now() - (NO_DRIVER_AUTO_ESCALATION_HOURS + 1) * 3_600_000,
    );
    const { reservation, material } = await createStaleNoDriverReservation(
      ctx,
      supplierPickupWindowEnd,
    );

    const escalated = await escalateStaleNoDriverDeliveriesByIds([
      reservation.id,
    ]);
    assert.deepEqual(escalated, [reservation.id]);

    const refreshed = await prisma.reservation.findUnique({
      where: { id: reservation.id },
      include: {
        deliveries: true,
      },
    });
    assert.ok(refreshed);
    assert.equal(refreshed.status, 'AWAITING_RESOLUTION');
    assert.equal(refreshed.deliveries[0]?.status, 'AWAITING_RESOLUTION');

    const materialAfter = await prisma.material.findUnique({
      where: { id: material.id },
    });
    assert.ok(materialAfter);
    assert.equal(materialAfter.status, 'RESERVED');
    assert.equal(Number(materialAfter.quantity), 2);

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
  });

  test('listMyReservations triggers lazy no-driver escalation', async () => {
    const supplierPickupWindowEnd = new Date(
      Date.now() - (NO_DRIVER_AUTO_ESCALATION_HOURS + 2) * 3_600_000,
    );
    const { reservation } = await createStaleNoDriverReservation(
      ctx,
      supplierPickupWindowEnd,
    );

    const listed = await listMyReservations(ctx.learnerId);
    const mapped = listed.find((entry) => entry.id === reservation.id);
    assert.ok(mapped);
    assert.equal(mapped.status, 'AWAITING_RESOLUTION');
    assert.equal(mapped.activeDelivery?.status, 'AWAITING_RESOLUTION');

    const reports = await listAdminNoShowReports({
      status: 'PENDING_REVIEW',
      page: 1,
      limit: 50,
    });
    const item = reports.items.find(
      (entry) => entry.reservationId === reservation.id,
    );
    assert.ok(item);
    ctx.createdReportIds.push(item.id);
  });
});
