import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import type { DeliveryStatus } from '../../generated/prisma/client.js';
import { hashPassword } from '../../utils/password.js';

import {
  getAdminDeliveryById,
  listAdminDeliveries,
  reopenAdminDeliveryDriverAssignment,
} from '../admin-deliveries/admin-deliveries.service.js';
import {
  getAdminReservationById,
  listAdminReservations,
} from '../admin-reservations/admin-reservations.service.js';
import {
  ADMIN_FILTERABLE_RESERVATION_STATUSES,
} from './admin-reservations.status.js';

const TEST_MARKER = '[test-admin-reservations-deliveries]';

type TestContext = {
  learnerId: string;
  supplierId: string;
  adminId: string;
  driverProfileId: string;
  categoryId: string;
  locationId: string;
  reservationWithDeliveryId: string;
  reservationWithoutDeliveryId: string;
  deliveryId: string;
  userIds: string[];
  materialIds: string[];
  reservationIds: string[];
  deliveryIds: string[];
};

const ctx: TestContext = {
  learnerId: '',
  supplierId: '',
  adminId: '',
  driverProfileId: '',
  categoryId: '',
  locationId: '',
  reservationWithDeliveryId: '',
  reservationWithoutDeliveryId: '',
  deliveryId: '',
  userIds: [],
  materialIds: [],
  reservationIds: [],
  deliveryIds: [],
};

async function createUser(input: {
  suffix: string;
  role: 'LEARNER' | 'SUPPLIER' | 'DRIVER' | 'ADMIN';
}) {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} ${input.suffix}`,
      email: `${TEST_MARKER}-${input.suffix}-${Date.now()}@impactloop.test`,
      passwordHash,
      phone: `+97059${Math.floor(Math.random() * 1_000_000)
        .toString()
        .padStart(6, '0')}`,
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
                publicName: `${TEST_MARKER} Supplier`,
                verificationStatus: 'VERIFIED',
              },
            }
          : undefined,
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
  ctx.userIds.push(user.id);
  return user;
}

async function createMaterial(ownerId: string, title: string) {
  const material = await prisma.material.create({
    data: {
      ownerId,
      categoryId: ctx.categoryId,
      locationId: ctx.locationId,
      title,
      description: `${TEST_MARKER} material`,
      materialType: 'Test',
      quantity: 1,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'AVAILABLE',
      deliveryAllowed: true,
    },
  });
  ctx.materialIds.push(material.id);
  return material;
}

async function createReservation(materialId: string, withDelivery: boolean) {
  const reservation = await prisma.reservation.create({
    data: {
      materialId,
      requesterId: ctx.learnerId,
      ownerId: ctx.supplierId,
      quantityRequested: 1,
      status: 'ACCEPTED',
      acceptedAt: new Date(),
    },
  });
  ctx.reservationIds.push(reservation.id);
  return reservation;
}

async function createDelivery(
  reservationId: string,
  status: DeliveryStatus = 'DRIVER_ASSIGNED',
  options: {
    markPickupProgress?: boolean;
    createAssignment?: boolean;
    driverProfileId?: string;
  } = {},
) {
  const markPickupProgress = options.markPickupProgress ?? true;
  const assignedDriverProfileId = options.driverProfileId ?? ctx.driverProfileId;
  const delivery = await prisma.delivery.create({
    data: {
      reservationId,
      pickupLocationId: ctx.locationId,
      dropoffLocationId: ctx.locationId,
      requestedByUserId: ctx.learnerId,
      assignedDriverProfileId,
      status,
      assignedAt: new Date(),
      arrivedPickupAt: markPickupProgress ? new Date() : null,
      pickedUpAt: markPickupProgress ? new Date() : null,
    },
  });
  ctx.deliveryIds.push(delivery.id);

  if (options.createAssignment) {
    await prisma.deliveryAssignment.create({
      data: {
        deliveryId: delivery.id,
        driverProfileId: assignedDriverProfileId,
        status: 'ACTIVE',
      },
    });
  }

  await prisma.deliveryLocationPing.create({
    data: {
      deliveryId: delivery.id,
      driverProfileId: assignedDriverProfileId,
      latitude: 31.9038,
      longitude: 35.2034,
      capturedAt: new Date(),
    },
  });

  await prisma.deliveryStatusHistory.create({
    data: {
      deliveryId: delivery.id,
      oldStatus: 'WAITING_FOR_DRIVER',
      newStatus: status,
      changedByUserId: ctx.learnerId,
      note: `${TEST_MARKER} status change`,
    },
  });

  return delivery;
}

describe('admin reservations and deliveries monitoring', () => {
  before(async () => {
    const category = await prisma.category.findFirst({ select: { id: true } });
    const location = await prisma.location.findFirst({ select: { id: true } });
    assert.ok(category && location, 'seed category and location required');

    ctx.categoryId = category.id;
    ctx.locationId = location.id;

    const learner = await createUser({ suffix: 'learner', role: 'LEARNER' });
    const supplier = await createUser({ suffix: 'supplier', role: 'SUPPLIER' });
    const driver = await createUser({ suffix: 'driver', role: 'DRIVER' });
    const admin = await createUser({ suffix: 'admin', role: 'ADMIN' });

    ctx.learnerId = learner.id;
    ctx.supplierId = supplier.id;
    ctx.driverProfileId = driver.driverProfile!.id;
    ctx.adminId = admin.id;

    const materialWithDelivery = await createMaterial(
      ctx.supplierId,
      `${TEST_MARKER} With Delivery`,
    );
    const materialWithoutDelivery = await createMaterial(
      ctx.supplierId,
      `${TEST_MARKER} No Delivery`,
    );

    const reservationWithDelivery = await createReservation(
      materialWithDelivery.id,
      true,
    );
    const reservationWithoutDelivery = await createReservation(
      materialWithoutDelivery.id,
      false,
    );

    ctx.reservationWithDeliveryId = reservationWithDelivery.id;
    ctx.reservationWithoutDeliveryId = reservationWithoutDelivery.id;

    const delivery = await createDelivery(reservationWithDelivery.id, 'PICKED_UP', {
      markPickupProgress: true,
      createAssignment: true,
    });
    ctx.deliveryId = delivery.id;
  });

  after(async () => {
    if (ctx.deliveryIds.length) {
      await prisma.deliveryAssignment.deleteMany({
        where: { deliveryId: { in: ctx.deliveryIds } },
      });
      await prisma.deliveryLocationPing.deleteMany({
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
      await prisma.reservationStatusHistory.deleteMany({
        where: { reservationId: { in: ctx.reservationIds } },
      });
      await prisma.reservation.deleteMany({
        where: { id: { in: ctx.reservationIds } },
      });
    }
    if (ctx.materialIds.length) {
      await prisma.material.deleteMany({
        where: { id: { in: ctx.materialIds } },
      });
    }
    if (ctx.userIds.length) {
      await prisma.notification.deleteMany({
        where: { userId: { in: ctx.userIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: ctx.userIds } } });
    }
  });

  test('admin reservations list returns summaries with material/learner/supplier', async () => {
    const result = await listAdminReservations({
      page: 1,
      limit: 20,
      search: TEST_MARKER,
    });

    assert.ok(result.summary.total >= 2);
    assert.ok(result.items.length >= 2);
    const item = result.items.find((row) => row.id === ctx.reservationWithDeliveryId);
    assert.ok(item);
    assert.equal(item.material.title.includes(TEST_MARKER), true);
    assert.ok(item.learner.displayName);
    assert.ok(item.supplier.displayName);
    assert.equal(item.hasDelivery, true);
    assert.ok(item.delivery);
    assert.deepEqual(
      result.filterOptions.statuses,
      ADMIN_FILTERABLE_RESERVATION_STATUSES,
    );
  });

  test('admin reservation KPIs include confirmation and resolution states', async () => {
    const before = await listAdminReservations({ page: 1, limit: 20 });
    const material = await createMaterial(
      ctx.supplierId,
      `${TEST_MARKER} KPI lifecycle`,
    );
    const statuses = [
      'PENDING',
      'AWAITING_LEARNER_CONFIRMATION',
      'AWAITING_SUPPLIER_CONFIRMATION',
      'ACCEPTED',
      'AWAITING_RESOLUTION',
      'COMPLETED',
    ] as const;

    for (const status of statuses) {
      const reservation = await prisma.reservation.create({
        data: {
          materialId: material.id,
          requesterId: ctx.learnerId,
          ownerId: ctx.supplierId,
          quantityRequested: 1,
          status,
          acceptedAt:
            status === 'ACCEPTED' || status === 'AWAITING_RESOLUTION'
              ? new Date()
              : null,
          completedAt: status === 'COMPLETED' ? new Date() : null,
        },
      });
      ctx.reservationIds.push(reservation.id);
    }

    const after = await listAdminReservations({ page: 1, limit: 20 });

    assert.equal(after.summary.total, before.summary.total + statuses.length);
    assert.equal(after.summary.pending, before.summary.pending + 3);
    assert.equal(
      after.summary.acceptedActive,
      before.summary.acceptedActive + 2,
    );
    assert.equal(after.summary.completed, before.summary.completed + 1);
    assert.equal(after.summary.withDelivery, before.summary.withDelivery);
  });

  test('admin reservation details returns linked delivery summary when exists', async () => {
    const detail = await getAdminReservationById(ctx.reservationWithDeliveryId);
    assert.equal(detail.id, ctx.reservationWithDeliveryId);
    assert.ok(detail.material.title);
    assert.ok(detail.learner.email);
    assert.ok(detail.supplier.displayName);
    assert.ok(detail.delivery);
    assert.equal(detail.delivery?.id, ctx.deliveryId);

    const withoutDelivery = await getAdminReservationById(
      ctx.reservationWithoutDeliveryId,
    );
    assert.equal(withoutDelivery.delivery, null);
  });

  test('admin deliveries list returns delivery summaries', async () => {
    const result = await listAdminDeliveries({
      page: 1,
      limit: 20,
      search: TEST_MARKER,
    });

    assert.ok(result.summary.total >= 1);
    const item = result.items.find((row) => row.id === ctx.deliveryId);
    assert.ok(item);
    assert.ok(item.material.title);
    assert.ok(item.learner.email);
    assert.ok(item.supplier.displayName);
    assert.ok(item.driver);
  });

  test('admin delivery details returns timeline and location history', async () => {
    const detail = await getAdminDeliveryById(ctx.deliveryId);
    assert.equal(detail.id, ctx.deliveryId);
    assert.ok(detail.timeline.length > 0);
    assert.ok(detail.locationHistory.count >= 1);
    assert.ok(detail.pickup.location.label);
    assert.ok(detail.dropoff.learnerName);
    assert.ok(detail.driver);
    assert.equal(detail.canReopenDriverAssignment, false);
  });

  test('admin reopen preserves the driver accepting-new-jobs preference', async () => {
    const reopenDriver = await createUser({
      suffix: 'reopen-driver',
      role: 'DRIVER',
    });
    const reopenDriverProfileId = reopenDriver.driverProfile!.id;

    const material = await createMaterial(
      ctx.supplierId,
      `${TEST_MARKER} Reopen Assigned`,
    );
    const reservation = await createReservation(material.id, true);
    const delivery = await createDelivery(reservation.id, 'DRIVER_ASSIGNED', {
      markPickupProgress: false,
      createAssignment: true,
      driverProfileId: reopenDriverProfileId,
    });

    await prisma.driverProfile.update({
      where: { id: reopenDriverProfileId },
      data: { availability: 'ON_DELIVERY', acceptingNewJobs: false },
    });

    const result = await reopenAdminDeliveryDriverAssignment(
      delivery.id,
      ctx.adminId,
    );

    assert.equal(result.status, 'WAITING_FOR_DRIVER');
    assert.equal(result.driver, null);
    assert.equal(result.assignedAt, null);
    assert.equal(result.canReopenDriverAssignment, false);

    const storedDelivery = await prisma.delivery.findUniqueOrThrow({
      where: { id: delivery.id },
      select: {
        status: true,
        assignedDriverProfileId: true,
        assignedAt: true,
        reservation: { select: { status: true, quantityRequested: true } },
      },
    });
    assert.equal(storedDelivery.status, 'WAITING_FOR_DRIVER');
    assert.equal(storedDelivery.assignedDriverProfileId, null);
    assert.equal(storedDelivery.assignedAt, null);
    assert.equal(storedDelivery.reservation.status, 'ACCEPTED');
    assert.equal(Number(storedDelivery.reservation.quantityRequested), 1);

    const assignment = await prisma.deliveryAssignment.findFirstOrThrow({
      where: { deliveryId: delivery.id },
      select: { status: true, releasedAt: true, releaseReason: true },
    });
    assert.equal(assignment.status, 'RELEASED');
    assert.ok(assignment.releasedAt);
    assert.equal(
      assignment.releaseReason,
      'Admin reopened delivery to driver pool',
    );

    const driver = await prisma.driverProfile.findUniqueOrThrow({
      where: { id: reopenDriverProfileId },
      select: { availability: true, acceptingNewJobs: true, userId: true },
    });
    assert.equal(driver.acceptingNewJobs, false);
    assert.equal(driver.availability, 'OFFLINE');

    const notification = await prisma.notification.findFirst({
      where: {
        userId: driver.userId,
        relatedEntityType: 'DELIVERY',
        relatedEntityId: delivery.id,
        notificationType: 'DRIVER_DELIVERY_UNASSIGNED_BY_ADMIN',
      },
    });
    assert.ok(notification);
  });

  test('admin cannot reopen a delivery once pickup has started', async () => {
    await assert.rejects(
      () => reopenAdminDeliveryDriverAssignment(ctx.deliveryId, ctx.adminId),
      (error) => {
        assert.equal((error as { code?: string }).code, 'CONFLICT');
        assert.match(
          (error as Error).message,
          /Pickup has already started/i,
        );
        return true;
      },
    );
  });

  test('filters and pagination work without 500 on missing optional relations', async () => {
    const filtered = await listAdminReservations({
      page: 1,
      limit: 1,
      status: 'ACCEPTED',
      hasDelivery: 'YES',
      search: TEST_MARKER,
    });
    assert.equal(filtered.pagination.limit, 1);
    assert.ok(filtered.items.length <= 1);

    const deliveries = await listAdminDeliveries({
      page: 1,
      limit: 20,
      assignment: 'ASSIGNED',
      status: 'PICKED_UP',
      search: TEST_MARKER,
    });
    assert.ok(deliveries.items.some((item) => item.id === ctx.deliveryId));
  });
});
