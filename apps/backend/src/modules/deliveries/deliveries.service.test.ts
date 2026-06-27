import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { NextFunction, Request, Response } from 'express';

import { prisma } from '../../database/prisma.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';
import {
  acceptDelivery,
  createDeliveryLocationPing,
  listAvailableDeliveries,
  updateDriverDeliveryStatus,
} from '../driver/driver.service.js';
import { createDeliveryLocationPingSchema } from '../driver/driver.validation.js';
import { completeSupplierReservation } from '../supplier-reservations/supplier-reservations.service.js';

import {
  getMyDelivery,
  listMyDeliveries,
  requestDeliveryForReservation,
} from './deliveries.service.js';

const TEST_MARKER = '[test-internal-delivery]';

type TestContext = {
  learnerId: string;
  otherLearnerId: string;
  supplierId: string;
  driverId: string;
  secondDriverId: string;
  categoryId: string;
  locationId: string;
  createdUserIds: string[];
  createdMaterialIds: string[];
  createdReservationIds: string[];
};

async function createUser(input: {
  displayName: string;
  emailSuffix: string;
  role: 'LEARNER' | 'SUPPLIER' | 'DRIVER';
  driverStatus?: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  driverAvailability?: 'OFFLINE' | 'AVAILABLE' | 'ON_DELIVERY';
}) {
  const passwordHash = await hashPassword('TestPassword123!');

  return prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} ${input.displayName}`,
      email: `${TEST_MARKER}-${input.emailSuffix}-${Date.now()}@impactloop.test`,
      passwordHash,
      phone: `+97059${Math.floor(Math.random() * 1000000)
        .toString()
        .padStart(6, '0')}`,
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
                displayName: `${TEST_MARKER} ${input.displayName}`,
                phone: `+97059${Math.floor(Math.random() * 1000000)
                  .toString()
                  .padStart(6, '0')}`,
                city: 'Ramallah',
                area: 'Downtown',
                transportationType: 'BICYCLE',
                vehicleType: 'BICYCLE',
                status: input.driverStatus ?? 'ACTIVE',
                availability: input.driverAvailability ?? 'AVAILABLE',
              },
            },
          }
        : {}),
    },
    select: { id: true },
  });
}

async function createAcceptedReservation(
  ctx: TestContext,
  input: {
    learnerId?: string;
    deliveryAllowed?: boolean;
    status?: 'PENDING' | 'ACCEPTED' | 'COMPLETED';
  } = {},
) {
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
      description: 'Test material for internal delivery',
      materialType: 'Test material',
      quantity: 1,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: input.status === 'PENDING' ? 'PENDING_RESERVATION' : 'RESERVED',
      isFree: true,
      pickupAllowed: true,
      deliveryAllowed: input.deliveryAllowed ?? true,
    },
  });
  ctx.createdMaterialIds.push(material.id);

  const now = new Date();
  const reservation = await prisma.reservation.create({
    data: {
      materialId: material.id,
      requesterId: input.learnerId ?? ctx.learnerId,
      ownerId: ctx.supplierId,
      quantityRequested: 1,
      status: input.status ?? 'ACCEPTED',
      pickupWindowStart:
        input.status === 'PENDING' ? undefined : now,
      pickupWindowEnd:
        input.status === 'PENDING'
          ? undefined
          : new Date(now.getTime() + 3_600_000),
      acceptedAt: input.status === 'PENDING' ? undefined : now,
      completedAt: input.status === 'COMPLETED' ? now : undefined,
    },
  });
  ctx.createdReservationIds.push(reservation.id);

  return { reservation, material };
}

const deliveryInput = () => ({
  dropoffLocation: {
    country: 'Palestine',
    city: 'Ramallah',
    area: TEST_MARKER,
    addressLine: 'Delivery test dropoff',
    latitude: 31.9,
    longitude: 35.2,
    visibility: 'PRIVATE' as const,
    isApproximate: false,
  },
  learnerNote: 'Please call before arrival',
});

async function createAvailableDriver(ctx: TestContext, suffix: string) {
  const driver = await createUser({
    displayName: `driver ${suffix}`,
    emailSuffix: `driver-${suffix}`,
    role: 'DRIVER',
    driverAvailability: 'AVAILABLE',
  });
  ctx.createdUserIds.push(driver.id);
  return driver.id;
}

async function createDriver(
  ctx: TestContext,
  suffix: string,
  input: {
    status?: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
    availability?: 'OFFLINE' | 'AVAILABLE' | 'ON_DELIVERY';
  } = {},
) {
  const driver = await createUser({
    displayName: `driver ${suffix}`,
    emailSuffix: `driver-${suffix}`,
    role: 'DRIVER',
    driverStatus: input.status,
    driverAvailability: input.availability ?? 'AVAILABLE',
  });
  ctx.createdUserIds.push(driver.id);
  return driver.id;
}

async function cleanup(ctx: TestContext) {
  await prisma.deliveryLocationPing.deleteMany({
    where: { delivery: { reservationId: { in: ctx.createdReservationIds } } },
  });
  await prisma.deliveryStatusHistory.deleteMany({
    where: { delivery: { reservationId: { in: ctx.createdReservationIds } } },
  });
  await prisma.deliveryAssignment.deleteMany({
    where: { delivery: { reservationId: { in: ctx.createdReservationIds } } },
  });
  await prisma.delivery.deleteMany({
    where: { reservationId: { in: ctx.createdReservationIds } },
  });

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

  await prisma.location.deleteMany({
    where: { area: TEST_MARKER },
  });

  if (ctx.createdUserIds.length) {
    await prisma.user.deleteMany({
      where: { id: { in: ctx.createdUserIds } },
    });
  }
}

async function progressToDelivered(driverId: string, deliveryId: string) {
  await updateDriverDeliveryStatus(driverId, deliveryId, {
    status: 'ARRIVED_PICKUP',
  });
  await updateDriverDeliveryStatus(driverId, deliveryId, {
    status: 'PICKED_UP',
  });
  await updateDriverDeliveryStatus(driverId, deliveryId, {
    status: 'ON_THE_WAY',
  });
  await updateDriverDeliveryStatus(driverId, deliveryId, {
    status: 'ARRIVED_DROPOFF',
  });
  return updateDriverDeliveryStatus(driverId, deliveryId, {
    status: 'DELIVERED',
  });
}

describe('internal delivery backend core', () => {
  const ctx: TestContext = {
    learnerId: '',
    otherLearnerId: '',
    supplierId: '',
    driverId: '',
    secondDriverId: '',
    categoryId: '',
    locationId: '',
    createdUserIds: [],
    createdMaterialIds: [],
    createdReservationIds: [],
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
        area: TEST_MARKER,
        addressLine: 'Supplier pickup',
        latitude: 32.22,
        longitude: 35.26,
        visibility: 'ORDER_ONLY',
        isApproximate: false,
        locationType: 'MATERIAL_PICKUP',
      },
      select: { id: true },
    });

    const learner = await createUser({
      displayName: 'learner',
      emailSuffix: 'learner',
      role: 'LEARNER',
    });
    const otherLearner = await createUser({
      displayName: 'other learner',
      emailSuffix: 'other-learner',
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
      driverAvailability: 'AVAILABLE',
    });
    const secondDriver = await createUser({
      displayName: 'second driver',
      emailSuffix: 'second-driver',
      role: 'DRIVER',
      driverAvailability: 'AVAILABLE',
    });

    ctx.categoryId = category.id;
    ctx.locationId = location.id;
    ctx.learnerId = learner.id;
    ctx.otherLearnerId = otherLearner.id;
    ctx.supplierId = supplier.id;
    ctx.driverId = driver.id;
    ctx.secondDriverId = secondDriver.id;
    ctx.createdUserIds.push(
      learner.id,
      otherLearner.id,
      supplier.id,
      driver.id,
      secondDriver.id,
    );
  });

  after(async () => {
    await cleanup(ctx);
    await prisma.$disconnect();
  });

  test('learner can request delivery for own accepted reservation when delivery is allowed', async () => {
    const { reservation } = await createAcceptedReservation(ctx);

    const delivery = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );

    assert.equal(delivery.reservationId, reservation.id);
    assert.equal(delivery.status, 'WAITING_FOR_DRIVER');
    assert.equal(delivery.pickupLocation.city, 'Nablus');
    assert.equal(delivery.dropoffLocation.city, 'Ramallah');
  });

  test('learner cannot request delivery before reservation is accepted', async () => {
    const { reservation } = await createAcceptedReservation(ctx, {
      status: 'PENDING',
    });

    await assert.rejects(
      () =>
        requestDeliveryForReservation(
          ctx.learnerId,
          reservation.id,
          deliveryInput(),
        ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        return true;
      },
    );
  });

  test('learner cannot request delivery for another learner reservation', async () => {
    const { reservation } = await createAcceptedReservation(ctx, {
      learnerId: ctx.otherLearnerId,
    });

    await assert.rejects(
      () =>
        requestDeliveryForReservation(
          ctx.learnerId,
          reservation.id,
          deliveryInput(),
        ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
  });

  test('learner cannot request delivery when material delivery is disabled', async () => {
    const { reservation } = await createAcceptedReservation(ctx, {
      deliveryAllowed: false,
    });

    await assert.rejects(
      () =>
        requestDeliveryForReservation(
          ctx.learnerId,
          reservation.id,
          deliveryInput(),
        ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        return true;
      },
    );
  });

  test('second active delivery for same reservation is rejected', async () => {
    const { reservation } = await createAcceptedReservation(ctx);
    await requestDeliveryForReservation(ctx.learnerId, reservation.id, deliveryInput());

    await assert.rejects(
      () =>
        requestDeliveryForReservation(
          ctx.learnerId,
          reservation.id,
          deliveryInput(),
        ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        return true;
      },
    );
  });

  test('concurrent delivery requests allow only one active delivery', async () => {
    const { reservation } = await createAcceptedReservation(ctx);

    const results = await Promise.allSettled([
      requestDeliveryForReservation(ctx.learnerId, reservation.id, deliveryInput()),
      requestDeliveryForReservation(ctx.learnerId, reservation.id, deliveryInput()),
    ]);

    assert.equal(
      results.filter((result) => result.status === 'fulfilled').length,
      1,
    );

    const rejected = results.find((result) => result.status === 'rejected');
    assert.ok(rejected && rejected.status === 'rejected');
    assert.ok(rejected.reason instanceof AppError);
    assert.equal(rejected.reason.statusCode, 409);

    const activeDeliveryCount = await prisma.delivery.count({
      where: {
        reservationId: reservation.id,
        status: {
          in: [
            'WAITING_FOR_DRIVER',
            'DRIVER_ASSIGNED',
            'ARRIVED_PICKUP',
            'PICKED_UP',
            'ON_THE_WAY',
            'ARRIVED_DROPOFF',
          ],
        },
      },
    });
    assert.equal(activeDeliveryCount, 1);
  });

  test('driver with active available profile can list waiting jobs', async () => {
    const { reservation } = await createAcceptedReservation(ctx);
    const delivery = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );

    const jobs = await listAvailableDeliveries(ctx.driverId);
    assert.ok(jobs.some((job) => job.id === delivery.id));
    const listed = jobs.find((job) => job.id === delivery.id);
    assert.equal(listed?.pickupLocation.city, 'Nablus');
    assert.equal('latitude' in listed!.pickupLocation, false);
  });

  test('non-driver role middleware rejects driver routes', () => {
    const middleware = requireRoles('DRIVER');
    const req = {
      auth: { sub: ctx.learnerId, roles: ['LEARNER'] },
    } as Request;
    const nextCalls: unknown[] = [];

    middleware(req, {} as Response, ((error?: unknown) => {
      nextCalls.push(error);
    }) as NextFunction);

    assert.equal(nextCalls.length, 1);
    assert.ok(nextCalls[0] instanceof AppError);
    assert.equal((nextCalls[0] as AppError).statusCode, 403);
  });

  test('learner delivery route role guard blocks unauthenticated and supplier users', () => {
    const authNextCalls: unknown[] = [];
    authMiddleware(
      { headers: {} } as Request,
      {} as Response,
      ((error?: unknown) => {
        authNextCalls.push(error);
      }) as NextFunction,
    );

    assert.equal(authNextCalls.length, 1);
    assert.ok(authNextCalls[0] instanceof AppError);
    assert.equal((authNextCalls[0] as AppError).statusCode, 401);

    const middleware = requireRoles('LEARNER');
    const unauthenticatedReq = {} as Request;
    const supplierReq = {
      auth: { sub: ctx.supplierId, roles: ['SUPPLIER'] },
    } as Request;
    const nextCalls: unknown[] = [];

    middleware(unauthenticatedReq, {} as Response, ((error?: unknown) => {
      nextCalls.push(error);
    }) as NextFunction);
    middleware(supplierReq, {} as Response, ((error?: unknown) => {
      nextCalls.push(error);
    }) as NextFunction);

    assert.equal(nextCalls.length, 2);
    assert.ok(nextCalls[0] instanceof AppError);
    assert.equal((nextCalls[0] as AppError).statusCode, 401);
    assert.ok(nextCalls[1] instanceof AppError);
    assert.equal((nextCalls[1] as AppError).statusCode, 403);
  });

  test('driver accept is race-safe and second driver receives conflict', async () => {
    const firstDriverId = await createAvailableDriver(ctx, 'race-one');
    const secondDriverId = await createAvailableDriver(ctx, 'race-two');
    const { reservation } = await createAcceptedReservation(ctx);
    const delivery = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );

    const results = await Promise.allSettled([
      acceptDelivery(firstDriverId, delivery.id),
      acceptDelivery(secondDriverId, delivery.id),
    ]);

    assert.equal(
      results.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    const rejected = results.find((result) => result.status === 'rejected');
    assert.ok(rejected && rejected.status === 'rejected');
    assert.ok(rejected.reason instanceof AppError);
    assert.equal(rejected.reason.statusCode, 409);
  });

  test('offline active driver can accept a waiting delivery from driver jobs', async () => {
    const driverId = await createDriver(ctx, 'offline-accept', {
      availability: 'OFFLINE',
    });
    const { reservation } = await createAcceptedReservation(ctx);
    const delivery = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );

    const assigned = await acceptDelivery(driverId, delivery.id);

    assert.equal(assigned.id, delivery.id);
    assert.equal(assigned.status, 'DRIVER_ASSIGNED');

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId: driverId },
      select: { availability: true },
    });
    assert.equal(driverProfile?.availability, 'ON_DELIVERY');
  });

  test('driver with active delivery cannot accept another delivery', async () => {
    const driverId = await createAvailableDriver(ctx, 'busy');
    const first = await createAcceptedReservation(ctx);
    const firstDelivery = await requestDeliveryForReservation(
      ctx.learnerId,
      first.reservation.id,
      deliveryInput(),
    );
    await acceptDelivery(driverId, firstDelivery.id);

    const second = await createAcceptedReservation(ctx);
    const secondDelivery = await requestDeliveryForReservation(
      ctx.learnerId,
      second.reservation.id,
      deliveryInput(),
    );

    await assert.rejects(
      () => acceptDelivery(driverId, secondDelivery.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        return true;
      },
    );
  });

  test('same driver cannot concurrently accept two deliveries', async () => {
    const driverId = await createAvailableDriver(ctx, 'busy-race');
    const first = await createAcceptedReservation(ctx);
    const firstDelivery = await requestDeliveryForReservation(
      ctx.learnerId,
      first.reservation.id,
      deliveryInput(),
    );
    const second = await createAcceptedReservation(ctx);
    const secondDelivery = await requestDeliveryForReservation(
      ctx.learnerId,
      second.reservation.id,
      deliveryInput(),
    );

    const results = await Promise.allSettled([
      acceptDelivery(driverId, firstDelivery.id),
      acceptDelivery(driverId, secondDelivery.id),
    ]);

    assert.equal(
      results.filter((result) => result.status === 'fulfilled').length,
      1,
    );

    const rejected = results.find((result) => result.status === 'rejected');
    assert.ok(rejected && rejected.status === 'rejected');
    assert.ok(rejected.reason instanceof AppError);
    assert.equal(rejected.reason.statusCode, 409);

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId: driverId },
      select: { id: true, availability: true },
    });
    assert.equal(driverProfile?.availability, 'ON_DELIVERY');

    const activeAssignedCount = await prisma.delivery.count({
      where: {
        assignedDriverProfileId: driverProfile?.id,
        status: {
          in: [
            'DRIVER_ASSIGNED',
            'ARRIVED_PICKUP',
            'PICKED_UP',
            'ON_THE_WAY',
            'ARRIVED_DROPOFF',
          ],
        },
      },
    });
    assert.equal(activeAssignedCount, 1);
  });

  test('only assigned driver can update delivery status', async () => {
    const assignedDriverId = await createAvailableDriver(ctx, 'assigned');
    const otherDriverId = await createAvailableDriver(ctx, 'unassigned');
    const { reservation } = await createAcceptedReservation(ctx);
    const delivery = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );
    await acceptDelivery(assignedDriverId, delivery.id);

    await assert.rejects(
      () =>
        updateDriverDeliveryStatus(otherDriverId, delivery.id, {
          status: 'ARRIVED_PICKUP',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
  });

  test('invalid status transitions are rejected', async () => {
    const driverId = await createAvailableDriver(ctx, 'transition');
    const { reservation } = await createAcceptedReservation(ctx);
    const delivery = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );
    await acceptDelivery(driverId, delivery.id);

    await assert.rejects(
      () =>
        updateDriverDeliveryStatus(driverId, delivery.id, {
          status: 'ON_THE_WAY',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        return true;
      },
    );
  });

  test('location pings are stored for assigned active driver', async () => {
    const driverId = await createAvailableDriver(ctx, 'ping');
    const { reservation } = await createAcceptedReservation(ctx);
    const delivery = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );
    await acceptDelivery(driverId, delivery.id);

    const ping = await createDeliveryLocationPing(driverId, delivery.id, {
      latitude: 31.91,
      longitude: 35.21,
      accuracyMeters: 12,
      capturedAt: new Date().toISOString(),
    });

    assert.equal(ping.deliveryId, delivery.id);
    assert.equal(ping.latitude, 31.91);
    assert.equal(typeof ping.latitude, 'number');
    assert.equal(typeof ping.longitude, 'number');
    assert.equal(typeof ping.accuracyMeters, 'number');
  });

  test('owning learner gets latest driver ping coordinates for tracking-eligible delivery only', async () => {
    const driverId = await createAvailableDriver(ctx, 'latest-ping');
    const { reservation } = await createAcceptedReservation(ctx);
    const delivery = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );
    await acceptDelivery(driverId, delivery.id);

    await createDeliveryLocationPing(driverId, delivery.id, {
      latitude: 31.91,
      longitude: 35.21,
      accuracyMeters: 12,
      capturedAt: new Date(Date.now() - 30_000).toISOString(),
    });
    const latest = await createDeliveryLocationPing(driverId, delivery.id, {
      latitude: 31.92,
      longitude: 35.22,
      accuracyMeters: 8,
      capturedAt: new Date().toISOString(),
    });

    const learnerDelivery = await getMyDelivery(ctx.learnerId, delivery.id);
    assert.deepEqual(learnerDelivery.latestDriverPing, {
      latitude: 31.92,
      longitude: 35.22,
      capturedAt: latest.capturedAt,
      accuracyMeters: 8,
    });
    assert.equal('locationPings' in learnerDelivery, false);

    const learnerDeliveries = await listMyDeliveries(ctx.learnerId);
    const listedDelivery = learnerDeliveries.find((item) => item.id === delivery.id);
    assert.ok(listedDelivery?.latestDriverPing);
    assert.equal('latitude' in listedDelivery.latestDriverPing, false);
    assert.equal('longitude' in listedDelivery.latestDriverPing, false);

    await assert.rejects(
      () => getMyDelivery(ctx.otherLearnerId, delivery.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
  });

  test('owning learner gets no latest ping when no driver ping exists', async () => {
    const driverId = await createAvailableDriver(ctx, 'no-ping');
    const { reservation } = await createAcceptedReservation(ctx);
    const delivery = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );
    await acceptDelivery(driverId, delivery.id);

    const learnerDelivery = await getMyDelivery(ctx.learnerId, delivery.id);

    assert.equal(learnerDelivery.latestDriverPing, null);
  });

  test('owning learner gets latest ping summary without coordinates for terminal delivery', async () => {
    const driverId = await createAvailableDriver(ctx, 'terminal-ping');
    const { reservation } = await createAcceptedReservation(ctx);
    const delivery = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );
    await acceptDelivery(driverId, delivery.id);
    const latest = await createDeliveryLocationPing(driverId, delivery.id, {
      latitude: 31.92,
      longitude: 35.22,
      accuracyMeters: 8,
      capturedAt: new Date().toISOString(),
    });
    await progressToDelivered(driverId, delivery.id);

    const learnerDelivery = await getMyDelivery(ctx.learnerId, delivery.id);

    assert.deepEqual(learnerDelivery.latestDriverPing, {
      capturedAt: latest.capturedAt,
      accuracyMeters: 8,
    });
    assert.equal('latitude' in learnerDelivery.latestDriverPing!, false);
    assert.equal('longitude' in learnerDelivery.latestDriverPing!, false);
  });

  test('unassigned driver cannot ping another driver delivery', async () => {
    const assignedDriverId = await createAvailableDriver(ctx, 'ping-assigned');
    const unassignedDriverId = await createAvailableDriver(ctx, 'ping-other');
    const { reservation } = await createAcceptedReservation(ctx);
    const delivery = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );
    await acceptDelivery(assignedDriverId, delivery.id);

    await assert.rejects(
      () =>
        createDeliveryLocationPing(unassignedDriverId, delivery.id, {
          latitude: 31.91,
          longitude: 35.21,
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
  });

  test('non-driver cannot create delivery location ping', async () => {
    const driverId = await createAvailableDriver(ctx, 'ping-driver');
    const { reservation } = await createAcceptedReservation(ctx);
    const delivery = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );
    await acceptDelivery(driverId, delivery.id);

    await assert.rejects(
      () =>
        createDeliveryLocationPing(ctx.learnerId, delivery.id, {
          latitude: 31.91,
          longitude: 35.21,
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 403);
        return true;
      },
    );
  });

  test('inactive driver profile cannot create delivery location ping', async () => {
    const inactiveDriverId = await createDriver(ctx, 'ping-inactive', {
      status: 'SUSPENDED',
    });
    const assignedDriverId = await createAvailableDriver(ctx, 'ping-active');
    const { reservation } = await createAcceptedReservation(ctx);
    const delivery = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );
    await acceptDelivery(assignedDriverId, delivery.id);

    await assert.rejects(
      () =>
        createDeliveryLocationPing(inactiveDriverId, delivery.id, {
          latitude: 31.91,
          longitude: 35.21,
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 403);
        return true;
      },
    );
  });

  test('terminal delivery cannot receive location pings', async () => {
    const driverId = await createAvailableDriver(ctx, 'ping-terminal');
    const { reservation } = await createAcceptedReservation(ctx);
    const delivery = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );
    await acceptDelivery(driverId, delivery.id);
    await progressToDelivered(driverId, delivery.id);

    await assert.rejects(
      () =>
        createDeliveryLocationPing(driverId, delivery.id, {
          latitude: 31.91,
          longitude: 35.21,
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
  });

  test('location ping validation rejects latitude and longitude out of bounds', () => {
    assert.equal(
      createDeliveryLocationPingSchema.safeParse({
        latitude: 91,
        longitude: 35.21,
      }).success,
      false,
    );
    assert.equal(
      createDeliveryLocationPingSchema.safeParse({
        latitude: 31.91,
        longitude: 181,
      }).success,
      false,
    );
  });

  test('delivered transition completes reservation and marks material reused', async () => {
    const driverId = await createAvailableDriver(ctx, 'delivered');
    const { reservation, material } = await createAcceptedReservation(ctx);
    const delivery = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );
    await acceptDelivery(driverId, delivery.id);

    const delivered = await progressToDelivered(driverId, delivery.id);
    assert.equal(delivered.status, 'DELIVERED');

    const updatedReservation = await prisma.reservation.findUnique({
      where: { id: reservation.id },
    });
    assert.equal(updatedReservation?.status, 'COMPLETED');
    assert.ok(updatedReservation?.completedAt);

    const updatedMaterial = await prisma.material.findUnique({
      where: { id: material.id },
    });
    assert.equal(updatedMaterial?.status, 'REUSED');
    assert.ok(updatedMaterial?.reusedAt);
    assert.equal(updatedMaterial?.reusedByReservationId, reservation.id);
  });

  test('supplier complete is blocked for delivery reservation before delivered', async () => {
    const { reservation } = await createAcceptedReservation(ctx);
    await requestDeliveryForReservation(ctx.learnerId, reservation.id, deliveryInput());

    await assert.rejects(
      () => completeSupplierReservation(ctx.supplierId, reservation.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        return true;
      },
    );
  });

  test('supplier complete and delivery request cannot both win concurrently', async () => {
    const { reservation } = await createAcceptedReservation(ctx);

    const results = await Promise.allSettled([
      requestDeliveryForReservation(ctx.learnerId, reservation.id, deliveryInput()),
      completeSupplierReservation(ctx.supplierId, reservation.id),
    ]);

    assert.equal(
      results.filter((result) => result.status === 'fulfilled').length,
      1,
    );

    const updatedReservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
      select: { status: true },
    });
    const activeDeliveryCount = await prisma.delivery.count({
      where: {
        reservationId: reservation.id,
        status: {
          in: [
            'WAITING_FOR_DRIVER',
            'DRIVER_ASSIGNED',
            'ARRIVED_PICKUP',
            'PICKED_UP',
            'ON_THE_WAY',
            'ARRIVED_DROPOFF',
          ],
        },
      },
    });

    assert.ok(
      updatedReservation.status !== 'COMPLETED' || activeDeliveryCount === 0,
    );
  });

  test('pickup-only supplier complete still works', async () => {
    const { reservation, material } = await createAcceptedReservation(ctx, {
      deliveryAllowed: false,
    });

    const completed = await completeSupplierReservation(
      ctx.supplierId,
      reservation.id,
    );
    assert.equal(completed.status, 'COMPLETED');

    const updatedMaterial = await prisma.material.findUnique({
      where: { id: material.id },
      select: { status: true },
    });
    assert.equal(updatedMaterial?.status, 'REUSED');
  });
});
