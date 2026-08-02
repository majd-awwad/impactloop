import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { NextFunction, Request, Response } from 'express';

import { prisma } from '../../database/prisma.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';
import { deriveHandoverCode } from '../../utils/handover-codes.js';
import {
  acceptDelivery,
  createDeliveryLocationPing,
  getDriverDeliveryDetail,
  getDriverProfile,
  listAvailableDeliveries,
  listActiveDriverDeliveries,
  updateDriverAvailability,
  updateDriverDeliveryStatus,
  updateDriverProfile,
} from '../driver/driver.service.js';
import {
  buildAvailableJobsCursorFilters,
  buildNextAvailableJobsCursor,
} from '../driver/driver-available-jobs-cursor.js';
import {
  fetchAvailableJobPageNewest,
  loadAvailableListDeliveriesByIds,
  paginateHydratedAvailableJobs,
} from '../driver/driver-available-jobs.query.js';
import { MAX_ACTIVE_DRIVER_DELIVERIES } from '../deliveries/deliveries.service.js';
import {
  createDeliveryLocationPingSchema,
  updateDriverAvailabilitySchema,
  updateDriverProfileSchema,
} from '../driver/driver.validation.js';
import { completeSupplierReservation } from '../supplier-reservations/supplier-reservations.service.js';
import {
  activeConfirmedDeliveryWindowUpdate,
  activePickupWindowReservationUpdate,
} from '../../test-utils/handover-test-windows.js';

import {
  getLearnerDeliveryTracking,
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
  acceptingNewJobs?: boolean;
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
                acceptingNewJobs:
                  input.acceptingNewJobs ??
                  input.driverAvailability !== 'OFFLINE',
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
  const activePickup = activePickupWindowReservationUpdate();
  const activeDelivery = activeConfirmedDeliveryWindowUpdate();
  const reservation = await prisma.reservation.create({
    data: {
      materialId: material.id,
      requesterId: input.learnerId ?? ctx.learnerId,
      ownerId: ctx.supplierId,
      quantityRequested: 1,
      status: input.status ?? 'ACCEPTED',
      pickupWindowStart:
        input.status === 'PENDING' ? undefined : activePickup.pickupWindowStart,
      pickupWindowEnd:
        input.status === 'PENDING' ? undefined : activePickup.pickupWindowEnd,
      supplierPickupWindowStart:
        input.status === 'PENDING'
          ? undefined
          : activePickup.supplierPickupWindowStart,
      supplierPickupWindowEnd:
        input.status === 'PENDING'
          ? undefined
          : activePickup.supplierPickupWindowEnd,
      confirmedDeliveryWindowStart:
        input.status === 'PENDING'
          ? undefined
          : activeDelivery.confirmedDeliveryWindowStart,
      confirmedDeliveryWindowEnd:
        input.status === 'PENDING'
          ? undefined
          : activeDelivery.confirmedDeliveryWindowEnd,
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
    acceptingNewJobs?: boolean;
  } = {},
) {
  const driver = await createUser({
    displayName: `driver ${suffix}`,
    emailSuffix: `driver-${suffix}`,
    role: 'DRIVER',
    driverStatus: input.status,
    driverAvailability: input.availability ?? 'AVAILABLE',
    acceptingNewJobs: input.acceptingNewJobs,
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

async function progressToPickedUp(driverId: string, deliveryId: string) {
  await updateDriverDeliveryStatus(driverId, deliveryId, {
    status: 'ARRIVED_PICKUP',
  });
  return updateDriverDeliveryStatus(driverId, deliveryId, {
    status: 'PICKED_UP',
    confirmationCode: deriveHandoverCode('supplier-handover', deliveryId),
  });
}

async function progressToDelivered(driverId: string, deliveryId: string) {
  await updateDriverDeliveryStatus(driverId, deliveryId, {
    status: 'ARRIVED_PICKUP',
  });
  await updateDriverDeliveryStatus(driverId, deliveryId, {
    status: 'PICKED_UP',
    confirmationCode: deriveHandoverCode('supplier-handover', deliveryId),
  });
  await updateDriverDeliveryStatus(driverId, deliveryId, {
    status: 'ON_THE_WAY',
  });
  await updateDriverDeliveryStatus(driverId, deliveryId, {
    status: 'ARRIVED_DROPOFF',
  });
  return updateDriverDeliveryStatus(driverId, deliveryId, {
    status: 'DELIVERED',
    confirmationCode: deriveHandoverCode('learner-delivery', deliveryId),
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

    const deliveryCount = await prisma.delivery.count({
      where: { reservationId: reservation.id },
    });
    assert.equal(deliveryCount, 1);
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
    assert.ok(jobs.deliveries.some((job) => job.id === delivery.id));
    const listed = jobs.deliveries.find((job) => job.id === delivery.id);
    assert.equal(listed?.pickupLocation.city, 'Nablus');
    assert.equal('latitude' in listed!.pickupLocation, false);
    assert.equal(listed?.distanceKm, null);
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

  test('offline active driver cannot browse or accept waiting deliveries', async () => {
    const driverId = await createDriver(ctx, 'offline-accept', {
      availability: 'OFFLINE',
    });
    const { reservation } = await createAcceptedReservation(ctx);
    const delivery = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );

    const available = await listAvailableDeliveries(driverId, {});
    assert.equal(available.deliveries.length, 0);
    assert.equal(available.totalAvailableCount, 0);
    assert.equal(available.canBrowseAvailableJobs, false);
    assert.equal(available.acceptingNewJobs, false);

    await assert.rejects(
      () => acceptDelivery(driverId, delivery.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        assert.equal(error.code, 'DRIVER_NOT_ACCEPTING_NEW_JOBS');
        return true;
      },
    );

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId: driverId },
      select: { availability: true },
    });
    assert.equal(driverProfile?.availability, 'OFFLINE');
  });

  test('driver profile exposes administrative state read-only and updates operational fields', async () => {
    const driverId = await createAvailableDriver(ctx, 'profile-update');

    const parsedInput = updateDriverProfileSchema.parse({
      city: '  Nablus  ',
      area: '  Rafidia  ',
      transportationType: 'MOTORCYCLE',
      vehicleLabel: '  Blue delivery bike  ',
      vehiclePlate: '   ',
      capacityNotes: '  Small boxed materials only  ',
    });

    const updated = await updateDriverProfile(driverId, parsedInput);

    assert.equal(updated.city, 'Nablus');
    assert.equal(updated.area, 'Rafidia');
    assert.equal(updated.transportationType, 'MOTORCYCLE');
    assert.equal(updated.vehiclePlate, null);

    const stored = await prisma.driverProfile.findUniqueOrThrow({
      where: { userId: driverId },
      select: { transportationType: true, vehicleType: true },
    });
    assert.equal(stored.transportationType, 'MOTORCYCLE');
    assert.equal(stored.vehicleType, 'MOTORCYCLE');

    assert.equal(
      updateDriverProfileSchema.safeParse({ status: 'SUSPENDED' }).success,
      false,
    );
    assert.equal(
      updateDriverAvailabilitySchema.safeParse({ availability: 'AVAILABLE' })
        .success,
      false,
    );
  });

  test('non-active driver can read profile state but cannot mutate it', async () => {
    const driverId = await createDriver(ctx, 'inactive-profile', {
      status: 'INACTIVE',
      availability: 'OFFLINE',
      acceptingNewJobs: false,
    });

    const profile = await getDriverProfile(driverId);
    assert.equal(profile.status, 'INACTIVE');
    assert.equal(profile.acceptingNewJobs, false);

    await assert.rejects(
      () => updateDriverAvailability(driverId, { acceptingNewJobs: true }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 403);
        return true;
      },
    );
  });

  test('turning off new jobs preserves active work and restores offline after final delivery', async () => {
    const driverId = await createAvailableDriver(ctx, 'preference-preserved');
    const { reservation } = await createAcceptedReservation(ctx);
    const delivery = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );
    await acceptDelivery(driverId, delivery.id);

    const paused = await updateDriverAvailability(driverId, {
      acceptingNewJobs: false,
    });
    assert.equal(paused.acceptingNewJobs, false);
    assert.equal(paused.availability, 'ON_DELIVERY');

    const active = await listActiveDriverDeliveries(driverId);
    assert.equal(active.deliveries.length, 1);

    await progressToDelivered(driverId, delivery.id);

    const finalProfile = await getDriverProfile(driverId);
    assert.equal(finalProfile.activeDeliveryCount, 0);
    assert.equal(finalProfile.acceptingNewJobs, false);
    assert.equal(finalProfile.availability, 'OFFLINE');
  });

  test('delivery responses use canonical User identity after account edits', async () => {
    const driverId = await createAvailableDriver(ctx, 'canonical-identity');
    const { reservation } = await createAcceptedReservation(ctx);
    const delivery = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );
    await acceptDelivery(driverId, delivery.id);

    const canonicalName = `${TEST_MARKER} Updated Driver Name`;
    const canonicalPhone = `+97056${Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, '0')}`;
    await prisma.user.update({
      where: { id: driverId },
      data: { displayName: canonicalName, phone: canonicalPhone },
    });

    const learnerDelivery = await getMyDelivery(ctx.learnerId, delivery.id);
    assert.equal(learnerDelivery.driver?.displayName, canonicalName);
    assert.equal(learnerDelivery.driver?.phone, canonicalPhone);
  });

  test('driver can accept up to three active deliveries', async () => {
    const driverId = await createAvailableDriver(ctx, 'queue');
    const deliveryIds: string[] = [];

    for (let index = 0; index < MAX_ACTIVE_DRIVER_DELIVERIES; index += 1) {
      const { reservation } = await createAcceptedReservation(ctx, {
        learnerId: index % 2 === 0 ? ctx.learnerId : ctx.otherLearnerId,
      });
      const delivery = await requestDeliveryForReservation(
        index % 2 === 0 ? ctx.learnerId : ctx.otherLearnerId,
        reservation.id,
        deliveryInput(),
      );
      deliveryIds.push(delivery.id);
      const assigned = await acceptDelivery(driverId, delivery.id);
      assert.equal(assigned.status, 'DRIVER_ASSIGNED');
    }

    const active = await listActiveDriverDeliveries(driverId);
    assert.equal(active.deliveries.length, MAX_ACTIVE_DRIVER_DELIVERIES);
    assert.equal(active.activeDeliveryCount, MAX_ACTIVE_DRIVER_DELIVERIES);
    assert.equal(active.canAcceptMore, false);
  });

  test('driver cannot accept fourth active delivery', async () => {
    const driverId = await createAvailableDriver(ctx, 'queue-limit');
    const deliveryIds: string[] = [];

    for (let index = 0; index < MAX_ACTIVE_DRIVER_DELIVERIES; index += 1) {
      const { reservation } = await createAcceptedReservation(ctx, {
        learnerId: index % 2 === 0 ? ctx.learnerId : ctx.otherLearnerId,
      });
      const delivery = await requestDeliveryForReservation(
        index % 2 === 0 ? ctx.learnerId : ctx.otherLearnerId,
        reservation.id,
        deliveryInput(),
      );
      deliveryIds.push(delivery.id);
      await acceptDelivery(driverId, delivery.id);
    }

    const { reservation } = await createAcceptedReservation(ctx);
    const fourthDelivery = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );

    await assert.rejects(
      () => acceptDelivery(driverId, fourthDelivery.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        assert.match(error.message, /active delivery limit/i);
        return true;
      },
    );
  });

  test('delivered deliveries do not count against active limit', async () => {
    const driverId = await createAvailableDriver(ctx, 'queue-freed');
    const deliveries: string[] = [];

    for (let index = 0; index < MAX_ACTIVE_DRIVER_DELIVERIES; index += 1) {
      const { reservation } = await createAcceptedReservation(ctx, {
        learnerId: index % 2 === 0 ? ctx.learnerId : ctx.otherLearnerId,
      });
      const delivery = await requestDeliveryForReservation(
        index % 2 === 0 ? ctx.learnerId : ctx.otherLearnerId,
        reservation.id,
        deliveryInput(),
      );
      deliveries.push(delivery.id);
      await acceptDelivery(driverId, delivery.id);
    }

    await progressToDelivered(driverId, deliveries[0]!);

    const { reservation } = await createAcceptedReservation(ctx);
    const replacement = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );

    const assigned = await acceptDelivery(driverId, replacement.id);
    assert.equal(assigned.status, 'DRIVER_ASSIGNED');

    const active = await listActiveDriverDeliveries(driverId);
    assert.equal(active.activeDeliveryCount, MAX_ACTIVE_DRIVER_DELIVERIES);
  });

  test('driver with active delivery can accept another delivery', async () => {
    const driverId = await createAvailableDriver(ctx, 'busy');
    const first = await createAcceptedReservation(ctx);
    const firstDelivery = await requestDeliveryForReservation(
      ctx.learnerId,
      first.reservation.id,
      deliveryInput(),
    );
    await acceptDelivery(driverId, firstDelivery.id);

    const second = await createAcceptedReservation(ctx, {
      learnerId: ctx.otherLearnerId,
    });
    const secondDelivery = await requestDeliveryForReservation(
      ctx.otherLearnerId,
      second.reservation.id,
      deliveryInput(),
    );

    const assigned = await acceptDelivery(driverId, secondDelivery.id);
    assert.equal(assigned.status, 'DRIVER_ASSIGNED');

    const active = await listActiveDriverDeliveries(driverId);
    assert.equal(active.deliveries.length, 2);
  });

  test('same driver can concurrently accept two different deliveries', async () => {
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
      2,
    );

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
    assert.equal(activeAssignedCount, 2);
  });

  test('concurrent accepts at count two cannot exceed the active limit', async () => {
    const driverId = await createAvailableDriver(ctx, 'queue-boundary-race');
    const deliveries: string[] = [];

    for (let index = 0; index < 4; index += 1) {
      const learnerId = index % 2 === 0 ? ctx.learnerId : ctx.otherLearnerId;
      const { reservation } = await createAcceptedReservation(ctx, { learnerId });
      const delivery = await requestDeliveryForReservation(
        learnerId,
        reservation.id,
        deliveryInput(),
      );
      deliveries.push(delivery.id);
    }

    await acceptDelivery(driverId, deliveries[0]!);
    await acceptDelivery(driverId, deliveries[1]!);

    const results = await Promise.allSettled([
      acceptDelivery(driverId, deliveries[2]!),
      acceptDelivery(driverId, deliveries[3]!),
    ]);

    assert.equal(
      results.filter((result) => result.status === 'fulfilled').length,
      1,
    );

    const profile = await prisma.driverProfile.findUniqueOrThrow({
      where: { userId: driverId },
      select: { id: true },
    });
    const activeCount = await prisma.delivery.count({
      where: {
        assignedDriverProfileId: profile.id,
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
    assert.equal(activeCount, MAX_ACTIVE_DRIVER_DELIVERIES);
  });

  test('available jobs can filter by city', async () => {
    const { reservation } = await createAcceptedReservation(ctx);
    const delivery = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );

    const nablusJobs = await listAvailableDeliveries(ctx.driverId, {
      city: 'Nablus',
    });
    assert.ok(nablusJobs.deliveries.some((job) => job.id === delivery.id));

    const ramallahJobs = await listAvailableDeliveries(ctx.driverId, {
      city: 'Ramallah',
    });
    assert.equal(
      ramallahJobs.deliveries.some((job) => job.id === delivery.id),
      false,
    );
  });

  test('available jobs can filter by area', async () => {
    const { reservation } = await createAcceptedReservation(ctx);
    const delivery = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );

    const matching = await listAvailableDeliveries(ctx.driverId, {
      area: TEST_MARKER,
    });
    assert.ok(matching.deliveries.some((job) => job.id === delivery.id));
  });

  test('available jobs can filter by maxDistanceKm when coordinates exist', async () => {
    const driverId = await createAvailableDriver(ctx, 'distance-filter');
    const { reservation } = await createAcceptedReservation(ctx);
    const delivery = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );

    const driverProfile = await prisma.driverProfile.findUniqueOrThrow({
      where: { userId: driverId },
      select: { id: true },
    });

    await prisma.deliveryLocationPing.create({
      data: {
        deliveryId: delivery.id,
        driverProfileId: driverProfile.id,
        latitude: 31.9,
        longitude: 35.2,
        capturedAt: new Date(),
      },
    });

    const nearby = await listAvailableDeliveries(driverId, {
      maxDistanceKm: 50,
      sortBy: 'nearest',
    });
    assert.ok(nearby.deliveries.some((job) => job.id === delivery.id));
    const listed = nearby.deliveries.find((job) => job.id === delivery.id);
    assert.ok(listed?.distanceKm != null);
    assert.ok(listed?.distanceLabel?.includes('km'));

    const far = await listAvailableDeliveries(driverId, {
      maxDistanceKm: 1,
      sortBy: 'nearest',
    });
    assert.equal(far.deliveries.some((job) => job.id === delivery.id), false);
  });

  test('available jobs sorted by nearest when requested', async () => {
    const driverId = await createAvailableDriver(ctx, 'nearest-sort');
    const nearLocation = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: 'Nablus',
        area: `${TEST_MARKER}-near`,
        latitude: 32.221,
        longitude: 35.261,
        visibility: 'ORDER_ONLY',
        isApproximate: false,
        locationType: 'DELIVERY_PICKUP',
      },
    });
    const farLocation = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: 'Nablus',
        area: `${TEST_MARKER}-far`,
        latitude: 32.5,
        longitude: 35.5,
        visibility: 'ORDER_ONLY',
        isApproximate: false,
        locationType: 'DELIVERY_PICKUP',
      },
    });

    const createDeliveryAtLocation = async (locationId: string) => {
      const { reservation } = await createAcceptedReservation(ctx);
      const dropoff = await prisma.location.create({
        data: {
          country: 'Palestine',
          city: 'Ramallah',
          area: TEST_MARKER,
          latitude: 31.9,
          longitude: 35.2,
          visibility: 'PRIVATE',
          isApproximate: false,
          locationType: 'DELIVERY_DROPOFF',
        },
      });
      return prisma.delivery.create({
        data: {
          reservationId: reservation.id,
          pickupLocationId: locationId,
          dropoffLocationId: dropoff.id,
          requestedByUserId: ctx.learnerId,
          status: 'WAITING_FOR_DRIVER',
        },
      });
    };

    const nearDelivery = await createDeliveryAtLocation(nearLocation.id);
    const farDelivery = await createDeliveryAtLocation(farLocation.id);

    const driverProfile = await prisma.driverProfile.findUniqueOrThrow({
      where: { userId: driverId },
      select: { id: true },
    });
    await prisma.deliveryLocationPing.create({
      data: {
        deliveryId: nearDelivery.id,
        driverProfileId: driverProfile.id,
        latitude: 32.22,
        longitude: 35.26,
        capturedAt: new Date(),
      },
    });

    const jobs = await listAvailableDeliveries(driverId, { sortBy: 'nearest' });
    const ids = jobs.deliveries.map((job) => job.id);
    assert.ok(ids.includes(nearDelivery.id));
    assert.ok(ids.includes(farDelivery.id));
    assert.ok(
      ids.indexOf(nearDelivery.id) < ids.indexOf(farDelivery.id),
      'Expected nearer delivery to sort before farther delivery',
    );
  });

  test('unknown-distance jobs are excluded from a confirmed radius', async () => {
    const noCoordLocation = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: 'Jenin',
        area: `${TEST_MARKER}-no-coords`,
        visibility: 'ORDER_ONLY',
        isApproximate: true,
        locationType: 'DELIVERY_PICKUP',
      },
    });
    const { reservation } = await createAcceptedReservation(ctx);
    const dropoff = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: 'Ramallah',
        area: TEST_MARKER,
        latitude: 31.9,
        longitude: 35.2,
        visibility: 'PRIVATE',
        isApproximate: false,
        locationType: 'DELIVERY_DROPOFF',
      },
    });
    await prisma.delivery.create({
      data: {
        reservationId: reservation.id,
        pickupLocationId: noCoordLocation.id,
        dropoffLocationId: dropoff.id,
        requestedByUserId: ctx.learnerId,
        status: 'WAITING_FOR_DRIVER',
      },
    });

    const jobs = await listAvailableDeliveries(ctx.driverId, {
      city: 'Jenin',
      maxDistanceKm: 5,
      sortBy: 'nearest',
    });
    assert.equal(jobs.deliveries.length, 0);
    assert.equal(jobs.nearbyAvailableCount, 0);
    assert.ok(jobs.totalAvailableCount >= 1);
  });

  test('newest ordering is descending and available jobs are bounded', async () => {
    const uniqueCity = `NewestCity-${Date.now()}`;
    const location = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: uniqueCity,
        area: TEST_MARKER,
        visibility: 'PUBLIC_APPROXIMATE',
        isApproximate: true,
      },
    });
    const first = await createAcceptedReservation(ctx);
    const older = await requestDeliveryForReservation(
      ctx.learnerId,
      first.reservation.id,
      deliveryInput(),
    );
    const second = await createAcceptedReservation(ctx);
    const newer = await requestDeliveryForReservation(
      ctx.learnerId,
      second.reservation.id,
      deliveryInput(),
    );

    await prisma.delivery.update({
      where: { id: older.id },
      data: {
        requestedAt: new Date(Date.now() - 60_000),
        pickupLocationId: location.id,
      },
    });
    await prisma.delivery.update({
      where: { id: newer.id },
      data: {
        requestedAt: new Date(),
        pickupLocationId: location.id,
      },
    });

    const jobs = await listAvailableDeliveries(ctx.driverId, {
      city: uniqueCity,
      sortBy: 'newest',
      limit: 1,
    });

    assert.equal(jobs.deliveries.length, 1);
    assert.equal(jobs.deliveries[0]?.id, newer.id);
    assert.equal(jobs.pagination.limit, 1);
    assert.equal(jobs.pagination.hasMore, true);
    assert.ok(jobs.pagination.nextCursor);
    assert.notEqual(jobs.pagination.nextCursor, newer.id);

    const page2 = await listAvailableDeliveries(ctx.driverId, {
      city: uniqueCity,
      sortBy: 'newest',
      limit: 1,
      cursor: jobs.pagination.nextCursor!,
    });
    assert.equal(page2.deliveries.length, 1);
    assert.equal(page2.deliveries[0]?.id, older.id);
    assert.notEqual(page2.deliveries[0]?.id, jobs.deliveries[0]?.id);

    await prisma.delivery.updateMany({
      where: { id: { in: [older.id, newer.id] } },
      data: { status: 'CANCELLED', pickupLocationId: ctx.locationId },
    });
    await prisma.location.delete({ where: { id: location.id } });
  });

  test('available jobs reject invalid and incompatible cursors', async () => {
    await assert.rejects(
      () =>
        listAvailableDeliveries(ctx.driverId, {
          city: 'Nablus',
          sortBy: 'newest',
          cursor: 'not-a-valid-cursor',
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'DRIVER_AVAILABLE_JOBS_CURSOR_INVALID',
    );

    const first = await createAcceptedReservation(ctx);
    const older = await requestDeliveryForReservation(
      ctx.learnerId,
      first.reservation.id,
      deliveryInput(),
    );
    const second = await createAcceptedReservation(ctx);
    const newer = await requestDeliveryForReservation(
      ctx.learnerId,
      second.reservation.id,
      deliveryInput(),
    );
    const stamp = new Date();
    await prisma.delivery.update({
      where: { id: older.id },
      data: { requestedAt: new Date(stamp.getTime() - 60_000) },
    });
    await prisma.delivery.update({
      where: { id: newer.id },
      data: { requestedAt: stamp },
    });

    const page1 = await listAvailableDeliveries(ctx.driverId, {
      city: 'Nablus',
      sortBy: 'newest',
      limit: 1,
    });
    assert.ok(page1.pagination.nextCursor);

    await assert.rejects(
      () =>
        listAvailableDeliveries(ctx.driverId, {
          city: 'Nablus',
          sortBy: 'nearest',
          limit: 1,
          cursor: page1.pagination.nextCursor!,
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'DRIVER_AVAILABLE_JOBS_CURSOR_INVALID',
    );

    await prisma.delivery.update({
      where: { id: newer.id },
      data: { requestedAt: new Date(stamp.getTime() + 1) },
    });

    await assert.rejects(
      () =>
        listAvailableDeliveries(ctx.driverId, {
          city: 'Nablus',
          sortBy: 'newest',
          limit: 1,
          cursor: page1.pagination.nextCursor!,
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'DRIVER_AVAILABLE_JOBS_CURSOR_INVALID',
    );

    await prisma.delivery.update({
      where: { id: newer.id },
      data: { requestedAt: stamp },
    });

    await prisma.delivery.update({
      where: { id: newer.id },
      data: { status: 'CANCELLED' },
    });

    await assert.rejects(
      () =>
        listAvailableDeliveries(ctx.driverId, {
          city: 'Nablus',
          sortBy: 'newest',
          limit: 1,
          cursor: page1.pagination.nextCursor!,
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'DRIVER_AVAILABLE_JOBS_CURSOR_INVALID',
    );
  });

  test('available jobs keyset keeps equal timestamps without duplicates', async () => {
    const stamp = new Date();
    const uniqueCity = `EqualStampCity-${Date.now()}`;
    const location = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: uniqueCity,
        area: TEST_MARKER,
        visibility: 'PUBLIC_APPROXIMATE',
        isApproximate: true,
      },
    });
    const createdIds: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      const accepted = await createAcceptedReservation(ctx);
      const delivery = await requestDeliveryForReservation(
        ctx.learnerId,
        accepted.reservation.id,
        deliveryInput(),
      );
      await prisma.delivery.update({
        where: { id: delivery.id },
        data: {
          requestedAt: stamp,
          pickupLocationId: location.id,
        },
      });
      createdIds.push(delivery.id);
    }

    const page1 = await listAvailableDeliveries(ctx.driverId, {
      city: uniqueCity,
      sortBy: 'newest',
      limit: 2,
    });
    assert.equal(page1.deliveries.length, 2);
    assert.ok(page1.pagination.nextCursor);

    const page2 = await listAvailableDeliveries(ctx.driverId, {
      city: uniqueCity,
      sortBy: 'newest',
      limit: 2,
      cursor: page1.pagination.nextCursor!,
    });

    const allIds = [
      ...page1.deliveries.map((delivery) => delivery.id),
      ...page2.deliveries.map((delivery) => delivery.id),
    ];
    assert.equal(new Set(allIds).size, allIds.length);
    assert.equal(allIds.length, createdIds.length);
    for (const id of createdIds) {
      assert.equal(allIds.includes(id), true);
    }

    await prisma.delivery.updateMany({
      where: { id: { in: createdIds } },
      data: { status: 'CANCELLED', pickupLocationId: ctx.locationId },
    });
    await prisma.location.delete({ where: { id: location.id } });
  });

  test('nearest keyset keeps equal distances and timestamps without gaps', async () => {
    const driverId = await createAvailableDriver(ctx, 'nearest-keyset');
    const driverProfile = await prisma.driverProfile.findUniqueOrThrow({
      where: { userId: driverId },
      select: { id: true },
    });
    const stamp = new Date();
    const uniqueCity = `EqualDistanceCity-${Date.now()}`;
    const pickupLocation = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: uniqueCity,
        area: TEST_MARKER,
        latitude: 32.221,
        longitude: 35.261,
        visibility: 'ORDER_ONLY',
        isApproximate: false,
        locationType: 'DELIVERY_PICKUP',
      },
    });
    const createdIds: string[] = [];

    for (let index = 0; index < 3; index += 1) {
      const accepted = await createAcceptedReservation(ctx);
      const delivery = await requestDeliveryForReservation(
        ctx.learnerId,
        accepted.reservation.id,
        deliveryInput(),
      );
      await prisma.delivery.update({
        where: { id: delivery.id },
        data: {
          requestedAt: stamp,
          pickupLocationId: pickupLocation.id,
        },
      });
      createdIds.push(delivery.id);
    }

    await prisma.deliveryLocationPing.create({
      data: {
        deliveryId: createdIds[0]!,
        driverProfileId: driverProfile.id,
        latitude: 32.22,
        longitude: 35.26,
        capturedAt: new Date(),
      },
    });

    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await listAvailableDeliveries(driverId, {
        city: uniqueCity,
        sortBy: 'nearest',
        limit: 1,
        cursor,
      });
      seen.push(...page.deliveries.map((delivery) => delivery.id));
      cursor = page.pagination.nextCursor ?? undefined;
    } while (cursor);

    assert.equal(seen.length, createdIds.length);
    assert.equal(new Set(seen).size, createdIds.length);
    for (const id of createdIds) {
      assert.equal(seen.includes(id), true);
    }

    await prisma.delivery.updateMany({
      where: { id: { in: createdIds } },
      data: { status: 'CANCELLED', pickupLocationId: ctx.locationId },
    });
    await prisma.location.delete({ where: { id: pickupLocation.id } });
  });

  test('nearest without driver coordinates paginates page two via newest fallback', async () => {
    const uniqueCity = `NoRefNearest-${Date.now()}`;
    const location = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: uniqueCity,
        area: TEST_MARKER,
        visibility: 'PUBLIC_APPROXIMATE',
        isApproximate: true,
      },
    });
    const createdIds: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      const accepted = await createAcceptedReservation(ctx);
      const delivery = await requestDeliveryForReservation(
        ctx.learnerId,
        accepted.reservation.id,
        deliveryInput(),
      );
      await prisma.delivery.update({
        where: { id: delivery.id },
        data: {
          requestedAt: new Date(Date.now() - index * 60_000),
          pickupLocationId: location.id,
        },
      });
      createdIds.push(delivery.id);
    }

    const driverId = await createAvailableDriver(ctx, 'no-ref-nearest');
    // No location ping => no usable reference; explicit nearest falls back to newest.
    const page1 = await listAvailableDeliveries(driverId, {
      city: uniqueCity,
      sortBy: 'nearest',
      limit: 2,
    });
    assert.equal(page1.deliveries.length, 2);
    assert.ok(page1.pagination.nextCursor);

    const page2 = await listAvailableDeliveries(driverId, {
      city: uniqueCity,
      sortBy: 'nearest',
      limit: 2,
      cursor: page1.pagination.nextCursor!,
    });
    assert.equal(page2.deliveries.length, 1);
    const allIds = [
      ...page1.deliveries.map((delivery) => delivery.id),
      ...page2.deliveries.map((delivery) => delivery.id),
    ];
    assert.equal(new Set(allIds).size, 3);

    await prisma.delivery.updateMany({
      where: { id: { in: createdIds } },
      data: { status: 'CANCELLED', pickupLocationId: ctx.locationId },
    });
    await prisma.location.delete({ where: { id: location.id } });
  });

  test('available jobs hydration race keeps later rows reachable via nextCursor', async () => {
    const uniqueCity = `HydrationReachable-${Date.now()}`;
    const location = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: uniqueCity,
        area: TEST_MARKER,
        visibility: 'PUBLIC_APPROXIMATE',
        isApproximate: true,
      },
    });
    const createdIds: string[] = [];
    const stamp = Date.now();
    for (let index = 0; index < 5; index += 1) {
      const accepted = await createAcceptedReservation(ctx);
      const delivery = await requestDeliveryForReservation(
        ctx.learnerId,
        accepted.reservation.id,
        deliveryInput(),
      );
      await prisma.delivery.update({
        where: { id: delivery.id },
        data: {
          // Newest first: index 0 is newest.
          requestedAt: new Date(stamp - index * 60_000),
          pickupLocationId: location.id,
        },
      });
      createdIds.push(delivery.id);
    }

    const pageRows = await fetchAvailableJobPageNewest({
      filters: { city: uniqueCity },
      cursor: null,
      limit: 2,
    });
    assert.equal(pageRows.length, 3);
    assert.deepEqual(
      pageRows.map((row) => row.id),
      [createdIds[0], createdIds[1], createdIds[2]],
    );

    const claimant = await prisma.driverProfile.findUniqueOrThrow({
      where: { userId: ctx.secondDriverId },
      select: { id: true },
    });
    // Claim middle raw row B between selection and hydration.
    await prisma.delivery.update({
      where: { id: createdIds[1]! },
      data: {
        status: 'DRIVER_ASSIGNED',
        assignedDriverProfileId: claimant.id,
      },
    });

    const hydrated = await loadAvailableListDeliveriesByIds(
      pageRows.map((row) => row.id),
    );
    const { page, hasMore, needsRetry } = paginateHydratedAvailableJobs(
      pageRows,
      hydrated,
      2,
    );

    assert.equal(needsRetry, false);
    assert.equal(hasMore, true);
    assert.deepEqual(
      page.map((item) => item.row.id),
      [createdIds[0], createdIds[2]],
    );
    assert.equal(
      page.every((item) => item.delivery.status === 'WAITING_FOR_DRIVER'),
      true,
    );

    const nextCursor = buildNextAvailableJobsCursor(
      {
        delivery: {
          id: page[1]!.row.id,
          requestedAt: page[1]!.row.requestedAt,
        },
        distanceMeters: page[1]!.row.distanceMeters,
      },
      buildAvailableJobsCursorFilters(
        { city: uniqueCity, sortBy: 'newest', limit: 2 },
        'newest',
        null,
      ),
    );

    const page2 = await listAvailableDeliveries(ctx.driverId, {
      city: uniqueCity,
      sortBy: 'newest',
      limit: 2,
      cursor: nextCursor,
    });

    const page2Ids = page2.deliveries.map((delivery) => delivery.id);
    assert.ok(page2Ids.includes(createdIds[3]!));
    assert.equal(page2Ids.includes(createdIds[1]!), false);
    assert.equal(
      page2Ids.some((id) => page.map((item) => item.row.id).includes(id)),
      false,
    );

    await prisma.delivery.updateMany({
      where: { id: { in: createdIds } },
      data: {
        status: 'CANCELLED',
        assignedDriverProfileId: null,
        pickupLocationId: ctx.locationId,
      },
    });
    await prisma.location.delete({ where: { id: location.id } });
  });

  test('available jobs nextCursor never anchors a delivery claimed during hydration', async () => {
    const uniqueCity = `HydrationCursor-${Date.now()}`;
    const location = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: uniqueCity,
        area: TEST_MARKER,
        visibility: 'PUBLIC_APPROXIMATE',
        isApproximate: true,
      },
    });
    const createdIds: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      const accepted = await createAcceptedReservation(ctx);
      const delivery = await requestDeliveryForReservation(
        ctx.learnerId,
        accepted.reservation.id,
        deliveryInput(),
      );
      await prisma.delivery.update({
        where: { id: delivery.id },
        data: {
          requestedAt: new Date(Date.now() - index * 60_000),
          pickupLocationId: location.id,
        },
      });
      createdIds.push(delivery.id);
    }

    const page1 = await listAvailableDeliveries(ctx.driverId, {
      city: uniqueCity,
      sortBy: 'newest',
      limit: 2,
    });
    assert.equal(page1.deliveries.length, 2);
    assert.ok(page1.pagination.nextCursor);
    assert.equal(
      page1.deliveries.every((delivery) => delivery.status === 'WAITING_FOR_DRIVER'),
      true,
    );
    assert.equal(
      page1.deliveries.every(
        (delivery) => !('latitude' in (delivery.pickupLocation as object)),
      ),
      true,
    );

    const page2 = await listAvailableDeliveries(ctx.driverId, {
      city: uniqueCity,
      sortBy: 'newest',
      limit: 2,
      cursor: page1.pagination.nextCursor!,
    });
    assert.ok(page2.deliveries.length >= 1);
    assert.equal(
      page2.deliveries.some((delivery) =>
        page1.deliveries.some((first) => first.id === delivery.id),
      ),
      false,
    );

    await prisma.delivery.updateMany({
      where: { id: { in: createdIds } },
      data: { status: 'CANCELLED', pickupLocationId: ctx.locationId },
    });
    await prisma.location.delete({ where: { id: location.id } });
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

  test('driver detail exposes exact operational data only while assignment is active', async () => {
    const driverId = await createAvailableDriver(ctx, 'detail-privacy');
    const { reservation } = await createAcceptedReservation(ctx);
    const delivery = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );
    await acceptDelivery(driverId, delivery.id);

    const active = await getDriverDeliveryDetail(driverId, delivery.id);
    const activePayload = active.delivery as unknown as Record<string, unknown>;
    assert.equal(active.isActive, true);
    assert.equal('learner' in activePayload, true);

    await prisma.$transaction([
      prisma.delivery.update({
        where: { id: delivery.id },
        data: {
          status: 'AWAITING_RESOLUTION',
          assignedDriverProfileId: null,
        },
      }),
      prisma.deliveryAssignment.updateMany({
        where: { deliveryId: delivery.id, status: 'ACTIVE' },
        data: { status: 'RELEASED', releasedAt: new Date() },
      }),
    ]);

    const inactive = await getDriverDeliveryDetail(driverId, delivery.id);
    const safePayload = inactive.delivery as unknown as Record<string, unknown>;
    const safePickup = safePayload.pickupLocation as Record<string, unknown>;
    assert.equal(inactive.isActive, false);
    assert.equal(inactive.inactiveContext?.closureReason, 'MOVED_TO_ADMIN_REVIEW');
    assert.equal('learner' in safePayload, false);
    assert.equal('addressLine' in safePickup, false);
    assert.equal(safePayload.learnerNote, null);
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

  test('location pings are stored for assigned active driver after pickup', async () => {
    const driverId = await createAvailableDriver(ctx, 'ping');
    const { reservation } = await createAcceptedReservation(ctx);
    const delivery = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );
    await acceptDelivery(driverId, delivery.id);
    await progressToPickedUp(driverId, delivery.id);

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

  test('location ping is rejected before PICKED_UP', async () => {
    const driverId = await createAvailableDriver(ctx, 'pre-pickup-ping');
    const { reservation } = await createAcceptedReservation(ctx);
    const delivery = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );
    await acceptDelivery(driverId, delivery.id);

    await assert.rejects(
      () =>
        createDeliveryLocationPing(driverId, delivery.id, {
          latitude: 31.91,
          longitude: 35.21,
          accuracyMeters: 12,
          capturedAt: new Date().toISOString(),
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        assert.equal(error.code, 'DELIVERY_LOCATION_PING_NOT_ALLOWED');
        return true;
      },
    );
  });

  test('owning learner cannot see driver coordinates before pickup', async () => {
    const driverId = await createAvailableDriver(ctx, 'pre-pickup-hidden');
    const { reservation } = await createAcceptedReservation(ctx);
    const delivery = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );
    await acceptDelivery(driverId, delivery.id);

    const learnerDelivery = await getMyDelivery(ctx.learnerId, delivery.id);

    assert.equal(learnerDelivery.status, 'DRIVER_ASSIGNED');
    assert.equal(learnerDelivery.canTrack, false);
    assert.equal(
      learnerDelivery.trackingMessage,
      'Driver is heading to supplier pickup.',
    );
    assert.equal(learnerDelivery.latestDriverPing, null);
  });

  test('owning learner gets latest driver ping coordinates only after pickup', async () => {
    const driverId = await createAvailableDriver(ctx, 'latest-ping');
    const { reservation } = await createAcceptedReservation(ctx);
    const delivery = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );
    await acceptDelivery(driverId, delivery.id);

    const beforePickup = await getMyDelivery(ctx.learnerId, delivery.id);
    assert.equal(beforePickup.latestDriverPing, null);
    assert.equal(beforePickup.canTrack, false);

    await progressToPickedUp(driverId, delivery.id);

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
      coordinatesVisible: true,
      trackingLockedReason: null,
    });
    assert.equal(learnerDelivery.canTrack, true);
    assert.equal('locationPings' in learnerDelivery, false);

    const learnerDeliveries = await listMyDeliveries(ctx.learnerId);
    const listedDelivery = learnerDeliveries.find((item) => item.id === delivery.id);
    assert.equal(listedDelivery?.canTrack, true);
    assert.equal(listedDelivery?.latestDriverPing, null);

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
    await progressToPickedUp(driverId, delivery.id);
    await createDeliveryLocationPing(driverId, delivery.id, {
      latitude: 31.92,
      longitude: 35.22,
      accuracyMeters: 8,
      capturedAt: new Date().toISOString(),
    });
    await updateDriverDeliveryStatus(driverId, delivery.id, {
      status: 'ON_THE_WAY',
    });
    await updateDriverDeliveryStatus(driverId, delivery.id, {
      status: 'ARRIVED_DROPOFF',
    });
    await updateDriverDeliveryStatus(driverId, delivery.id, {
      status: 'DELIVERED',
      confirmationCode: deriveHandoverCode('learner-delivery', delivery.id),
    });

    const learnerDelivery = await getMyDelivery(ctx.learnerId, delivery.id);

    assert.equal(learnerDelivery.latestDriverPing, null);
    assert.equal(learnerDelivery.canTrack, false);
    assert.equal(learnerDelivery.trackingMessage, 'Delivery completed.');
  });

  test('learner tracking endpoint hides coordinates before pickup', async () => {
    const driverId = await createAvailableDriver(ctx, 'tracking-pre-pickup');
    const { reservation } = await createAcceptedReservation(ctx);
    const delivery = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );
    await acceptDelivery(driverId, delivery.id);

    const tracking = await getLearnerDeliveryTracking(
      ctx.learnerId,
      delivery.id,
    );

    assert.equal(tracking.canTrack, false);
    assert.equal(tracking.latestDriverLocation, null);
    assert.equal(
      tracking.trackingMessage,
      'Driver is heading to supplier pickup.',
    );
  });

  test('learner tracking endpoint returns coordinates after pickup', async () => {
    const driverId = await createAvailableDriver(ctx, 'tracking-post-pickup');
    const { reservation } = await createAcceptedReservation(ctx);
    const delivery = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );
    await acceptDelivery(driverId, delivery.id);
    await progressToPickedUp(driverId, delivery.id);

    const latest = await createDeliveryLocationPing(driverId, delivery.id, {
      latitude: 31.92,
      longitude: 35.22,
      accuracyMeters: 8,
      capturedAt: new Date().toISOString(),
    });

    const tracking = await getLearnerDeliveryTracking(
      ctx.learnerId,
      delivery.id,
    );

    assert.equal(tracking.canTrack, true);
    assert.deepEqual(tracking.latestDriverLocation, {
      latitude: 31.92,
      longitude: 35.22,
      capturedAt: latest.capturedAt,
      accuracyMeters: 8,
    });
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
        assert.equal(error.statusCode, 409);
        assert.equal(error.code, 'DELIVERY_LOCATION_PING_NOT_ALLOWED');
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
      () =>
        completeSupplierReservation(ctx.supplierId, reservation.id, {
          confirmationCode: deriveHandoverCode('self-pickup', reservation.id),
        }),
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
      completeSupplierReservation(ctx.supplierId, reservation.id, {
        confirmationCode: deriveHandoverCode('self-pickup', reservation.id),
      }),
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
      {
        confirmationCode: deriveHandoverCode('self-pickup', reservation.id),
      },
    );
    assert.equal(completed.status, 'COMPLETED');

    const updatedMaterial = await prisma.material.findUnique({
      where: { id: material.id },
      select: { status: true },
    });
    assert.equal(updatedMaterial?.status, 'REUSED');
  });
});
