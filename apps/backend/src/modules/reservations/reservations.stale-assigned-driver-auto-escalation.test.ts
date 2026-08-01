import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { listAdminNoShowReports } from '../admin-no-show-reports/admin-no-show-reports.service.js';

import {
  isAssignedDriverPickupOverdue,
  isStaleAssignedDriverAutoEscalationDue,
  resolveStaleAssignedDriverAutoEscalationDeadline,
} from './reservation-assigned-driver-pickup-overdue.js';
import { NO_DRIVER_AUTO_ESCALATION_HOURS } from './reservation-timing-policy.js';
import { listMyReservations } from './reservations.service.js';
import { escalateStaleAssignedDriverPickupsByIds } from './reservations.stale-assigned-driver-auto-escalation.repository.js';
import { DRIVER_DELIVERY_NOTIFICATION_TYPES } from '../notifications/driver-delivery-notification-types.js';
import { getDriverDeliveryInactiveContext } from '../driver/driver.service.js';

const TEST_MARKER = '[test-stale-assigned-driver-auto-escalation]';

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
  createdNotificationIds: string[];
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
      driverProfile:
        input.role === 'DRIVER'
          ? {
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
            }
          : undefined,
    },
    include: {
      driverProfile: { select: { id: true } },
    },
  });
}

async function createStaleAssignedDriverReservation(
  ctx: TestContext,
  supplierPickupWindowEnd: Date,
  deliveryStatus: 'DRIVER_ASSIGNED' | 'ARRIVED_PICKUP' = 'DRIVER_ASSIGNED',
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
      description: 'Assigned-driver auto-escalation test',
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
      status: deliveryStatus,
      requestedAt: supplierPickupStart,
      assignedAt: supplierPickupStart,
      arrivedPickupAt:
        deliveryStatus === 'ARRIVED_PICKUP' ? supplierPickupWindowEnd : null,
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

  return { reservation, material, delivery };
}

async function cleanup(ctx: TestContext) {
  if (ctx.createdNotificationIds.length) {
    await prisma.notification.deleteMany({
      where: { id: { in: ctx.createdNotificationIds } },
    });
  }

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

describe('stale assigned-driver auto-escalation', () => {
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
    createdNotificationIds: [],
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

    const driver = await createUser({
      displayName: 'Driver',
      emailSuffix: 'driver',
      role: 'DRIVER',
    });
    ctx.driverProfileId = driver.driverProfile!.id;
    ctx.driverId = driver.id;
    ctx.createdUserIds.push(driver.id);
  });

  after(async () => {
    await cleanup(ctx);
  });

  test('isAssignedDriverPickupOverdue is true after grace', () => {
    const windowEnd = new Date(Date.now() - 45 * 60_000);

    assert.equal(
      isAssignedDriverPickupOverdue({
        supplierPickupWindowEnd: windowEnd,
        deliveryStatus: 'DRIVER_ASSIGNED',
      }),
      true,
    );

    assert.equal(
      isAssignedDriverPickupOverdue({
        supplierPickupWindowEnd: windowEnd,
        deliveryStatus: 'WAITING_FOR_DRIVER',
      }),
      false,
    );
  });

  test('isStaleAssignedDriverAutoEscalationDue respects 24h deadline', () => {
    const windowEnd = new Date('2026-01-01T12:00:00.000Z');
    const deadline = resolveStaleAssignedDriverAutoEscalationDeadline(windowEnd);
    assert.equal(
      deadline.toISOString(),
      new Date('2026-01-02T12:00:00.000Z').toISOString(),
    );

    const base = {
      status: 'ACCEPTED',
      fulfillmentMethod: 'DELIVERY',
      supplierPickupWindowEnd: windowEnd,
      deliveryStatus: 'DRIVER_ASSIGNED' as const,
      assignedDriverProfileId: 'driver-profile-id',
      hasPendingReport: false,
    };

    assert.equal(
      isStaleAssignedDriverAutoEscalationDue(
        base,
        new Date('2026-01-02T11:59:59.000Z'),
      ),
      false,
    );

    assert.equal(
      isStaleAssignedDriverAutoEscalationDue(
        base,
        new Date('2026-01-02T12:00:01.000Z'),
      ),
      true,
    );
  });

  test('lazy escalation moves stale assigned-driver delivery to admin review', async () => {
    const supplierPickupWindowEnd = new Date(
      Date.now() - (NO_DRIVER_AUTO_ESCALATION_HOURS + 1) * 3_600_000,
    );
    const { reservation, material, delivery } = await createStaleAssignedDriverReservation(
      ctx,
      supplierPickupWindowEnd,
    );

    const escalated = await escalateStaleAssignedDriverPickupsByIds([
      reservation.id,
    ]);
    assert.deepEqual(escalated, [reservation.id]);

    const refreshed = await prisma.reservation.findUnique({
      where: { id: reservation.id },
      include: { deliveries: true },
    });
    assert.ok(refreshed);
    assert.equal(refreshed.status, 'AWAITING_RESOLUTION');
    assert.equal(refreshed.deliveries[0]?.status, 'AWAITING_RESOLUTION');
    assert.equal(refreshed.deliveries[0]?.assignedDriverProfileId, null);

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
    assert.equal(item.targetRole, 'DRIVER');
    assert.equal(item.reasonCode, 'NO_RESPONSE_AFTER_PICKUP_WINDOW');
    ctx.createdReportIds.push(item.id);

    const driverNotification = await prisma.notification.findFirst({
      where: {
        userId: ctx.driverId,
        notificationType:
          DRIVER_DELIVERY_NOTIFICATION_TYPES.DRIVER_DELIVERY_MOVED_TO_ADMIN_REVIEW,
        relatedEntityType: 'DELIVERY',
        relatedEntityId: delivery.id,
      },
    });
    assert.ok(driverNotification);
    ctx.createdNotificationIds.push(driverNotification.id);

    const inactiveContext = await getDriverDeliveryInactiveContext(
      ctx.driverId,
      delivery.id,
    );
    assert.equal(inactiveContext.isActive, false);
    assert.equal(inactiveContext.closureReason, 'MOVED_TO_ADMIN_REVIEW');
  });

  test('ARRIVED_PICKUP auto-escalation keeps SYSTEM target and notifies driver', async () => {
    const supplierPickupWindowEnd = new Date(
      Date.now() - (NO_DRIVER_AUTO_ESCALATION_HOURS + 1) * 3_600_000,
    );
    const { reservation, delivery } = await createStaleAssignedDriverReservation(
      ctx,
      supplierPickupWindowEnd,
      'ARRIVED_PICKUP',
    );

    await escalateStaleAssignedDriverPickupsByIds([reservation.id]);

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

    const driverNotification = await prisma.notification.findFirst({
      where: {
        userId: ctx.driverId,
        notificationType:
          DRIVER_DELIVERY_NOTIFICATION_TYPES.DRIVER_DELIVERY_MOVED_TO_ADMIN_REVIEW,
        relatedEntityId: delivery.id,
      },
    });
    assert.ok(driverNotification);
    ctx.createdNotificationIds.push(driverNotification.id);
  });

  test('listMyReservations triggers lazy assigned-driver escalation', async () => {
    const supplierPickupWindowEnd = new Date(
      Date.now() - (NO_DRIVER_AUTO_ESCALATION_HOURS + 2) * 3_600_000,
    );
    const { reservation } = await createStaleAssignedDriverReservation(
      ctx,
      supplierPickupWindowEnd,
      'ARRIVED_PICKUP',
    );

    const listed = await listMyReservations(ctx.learnerId);
    const mapped = listed.find((entry) => entry.id === reservation.id);
    assert.ok(mapped);
    assert.equal(mapped.status, 'AWAITING_RESOLUTION');
    assert.equal(mapped.activeDelivery?.status, 'AWAITING_RESOLUTION');
    assert.equal(mapped.pendingIncidentReasonCode, 'NO_RESPONSE_AFTER_PICKUP_WINDOW');
    assert.equal(mapped.assignedDriverPickupOverdue, false);

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
