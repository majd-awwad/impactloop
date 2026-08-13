import assert from 'node:assert/strict';
import { after, afterEach, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import type { DeliveryStatus } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';
import { deriveHandoverCode } from '../../utils/handover-codes.js';
import { HANDOVER_GRACE_MINUTES } from '../../utils/handover-timing.js';
import { hashPassword } from '../../utils/password.js';
import { acceptDelivery, updateDriverDeliveryStatus } from '../driver/driver.service.js';
import { setDriverDeliveryWindow } from '../driver/driver-delivery-scheduling.service.js';
import {
  confirmDeliveryHandoverCredential,
  issueDeliveryHandoverCredential,
  verifyDeliveryHandoverCredential,
} from '../delivery-handover-credentials/delivery-handover-credentials.service.js';
import type { UpdateDriverDeliveryStatusInput } from '../driver/driver.validation.js';
import {
  markDriverDeliveryFailed,
  markDriverPickupFailed,
  markSupplierDeliveryPickupExpired,
  markSupplierDriverNoShow,
  markSupplierLearnerNoShow,
} from '../fulfillment-failures/fulfillment-failures.service.js';
import { createReservation } from '../reservations/reservations.service.js';
import { getMaterialQuantityState, decimalToNumber } from '../reservations/reservations.quantity.js';
import type { CreateReservationInput } from '../reservations/reservations.validation.js';
import {
  acceptSupplierReservation,
  completeSupplierReservation,
} from '../supplier-reservations/supplier-reservations.service.js';
import {
  activeConfirmedDeliveryWindowUpdate,
  activePickupWindowReservationUpdate,
} from '../../test-utils/handover-test-windows.js';

const TEST_MARKER = '[test-phase5-failures]';

type TestContext = {
  supplierId: string;
  driverId: string;
  otherDriverId: string;
  learnerId: string;
  categoryId: string;
  locationId: string;
  createdUserIds: string[];
  createdMaterialIds: string[];
  createdReservationIds: string[];
};

function futurePreferredWindow(hoursFromNow = 24, durationHours = 2) {
  const start = new Date(Date.now() + hoursFromNow * 3_600_000);
  const end = new Date(start.getTime() + durationHours * 3_600_000);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

async function createMaterial(
  ctx: TestContext,
  options: { deliveryAllowed?: boolean; quantity?: number } = {},
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
      description: `${TEST_MARKER} material description`,
      materialType: 'Test material',
      quantity: options.quantity ?? 5,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'AVAILABLE',
      isFree: true,
      deliveryAllowed: options.deliveryAllowed ?? false,
    },
    select: { id: true },
  });

  ctx.createdMaterialIds.push(material.id);
  return material;
}

async function cleanup(ctx: TestContext) {
  if (ctx.createdReservationIds.length) {
    await prisma.noShowReport.deleteMany({
      where: { reservationId: { in: ctx.createdReservationIds } },
    });
    await prisma.deliveryAssignment.deleteMany({
      where: { delivery: { reservationId: { in: ctx.createdReservationIds } } },
    });
    await prisma.deliveryStatusHistory.deleteMany({
      where: { delivery: { reservationId: { in: ctx.createdReservationIds } } },
    });
    await prisma.delivery.deleteMany({
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

async function acceptPickupReservation(ctx: TestContext) {
  const material = await createMaterial(ctx);
  const preferred = futurePreferredWindow();
  const reservation = await createReservation(ctx.learnerId, {
    materialId: material.id,
    quantityRequested: 1,
    fulfillmentMethod: 'PICKUP',
    learnerPreferredPickupWindows: [preferred],
  } satisfies CreateReservationInput);
  ctx.createdReservationIds.push(reservation.id);

  await acceptSupplierReservation(ctx.supplierId, reservation.id, {
    pickupWindowStart: preferred.start,
    pickupWindowEnd: preferred.end,
  });

  return { material, reservation };
}

async function acceptDeliveryReservation(ctx: TestContext) {
  const material = await createMaterial(ctx, { deliveryAllowed: true });
  const pickupPreferred = futurePreferredWindow(24, 2);
  const deliveryPreferred = futurePreferredWindow(48, 2);

  const reservation = await createReservation(ctx.learnerId, {
    materialId: material.id,
    quantityRequested: 1,
    fulfillmentMethod: 'DELIVERY',
    learnerPreferredPickupWindows: [pickupPreferred],
    learnerPreferredDeliveryWindows: [deliveryPreferred],
    deliveryAddressText: `${TEST_MARKER} delivery address`,
    dropoffCity: 'Nablus',
    safeDropoffAllowed: false,
  } satisfies CreateReservationInput);
  ctx.createdReservationIds.push(reservation.id);

  await acceptSupplierReservation(ctx.supplierId, reservation.id, {
    pickupWindowStart: pickupPreferred.start,
    pickupWindowEnd: pickupPreferred.end,
    proposedDeliveryWindowStart: deliveryPreferred.start,
    proposedDeliveryWindowEnd: deliveryPreferred.end,
  });

  const delivery = await prisma.delivery.findFirstOrThrow({
    where: { reservationId: reservation.id },
  });

  return { material, reservation, delivery };
}

async function resetDriverState(ctx: TestContext) {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId: ctx.driverId },
    select: { id: true },
  });

  if (!profile) {
    return;
  }

  await prisma.deliveryAssignment.updateMany({
    where: {
      driverProfileId: profile.id,
      status: 'ACTIVE',
    },
    data: {
      status: 'RELEASED',
      releasedAt: new Date(),
      releaseReason: 'test cleanup',
    },
  });

  await prisma.delivery.updateMany({
    where: {
      assignedDriverProfileId: profile.id,
      status: {
        in: [
          'DRIVER_ASSIGNED',
          'ARRIVED_PICKUP',
          'PICKED_UP',
          'ON_THE_WAY',
          'ARRIVED_DROPOFF',
          'REDELIVERY_PENDING',
          'REDELIVERY_SCHEDULED',
        ],
      },
    },
    data: {
      status: 'CANCELLED',
      assignedDriverProfileId: null,
    },
  });

  await prisma.driverProfile.update({
    where: { id: profile.id },
    data: { availability: 'AVAILABLE', acceptingNewJobs: true },
  });
}

function expiredWindowDates() {
  const end = new Date(
    Date.now() - (HANDOVER_GRACE_MINUTES + 5) * 60_000,
  );
  const start = new Date(end.getTime() - 60 * 60_000);
  return { start, end };
}

async function setPickupWindowExpired(reservationId: string) {
  const { start, end } = expiredWindowDates();
  await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      pickupWindowStart: start,
      pickupWindowEnd: end,
    },
  });
}

async function setSupplierPickupWindowExpired(reservationId: string) {
  const { start, end } = expiredWindowDates();
  await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      supplierPickupWindowStart: start,
      supplierPickupWindowEnd: end,
      pickupWindowStart: start,
      pickupWindowEnd: end,
    },
  });
}

async function setDeliveryWindowExpired(reservationId: string) {
  const { start, end } = expiredWindowDates();
  await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      confirmedDeliveryWindowStart: start,
      confirmedDeliveryWindowEnd: end,
    },
  });
}

async function progressDeliveryTo(
  ctx: TestContext,
  deliveryId: string,
  driverId: string,
  targetStatus: DeliveryStatus,
) {
  const transitions: DeliveryStatus[] = [
    'DRIVER_ASSIGNED',
    'ARRIVED_PICKUP',
    'PICKED_UP',
    'ON_THE_WAY',
    'ARRIVED_DROPOFF',
    'DELIVERED',
  ];

  const delivery = await prisma.delivery.findUniqueOrThrow({
    where: { id: deliveryId },
    include: { reservation: true },
  });

  if (delivery.status === 'WAITING_FOR_DRIVER') {
    await acceptDelivery(driverId, deliveryId);
  }

  const current = await prisma.delivery.findUniqueOrThrow({
    where: { id: deliveryId },
  });
  const startIndex = transitions.indexOf(current.status);
  const targetIndex = transitions.indexOf(targetStatus);
  assert.ok(startIndex >= 0 && targetIndex >= 0);

  for (const status of transitions.slice(startIndex + 1, targetIndex + 1)) {
    if (status === 'PICKED_UP') {
      const start = new Date(Date.now() - 15 * 60_000);
      const end = new Date(Date.now() + 45 * 60_000);
      await prisma.reservation.update({
        where: { id: delivery.reservationId },
        data: {
          supplierPickupWindowStart: start,
          supplierPickupWindowEnd: end,
        },
      });
    }

    const input: UpdateDriverDeliveryStatusInput = {
      status: status as UpdateDriverDeliveryStatusInput['status'],
    };

    if (status === 'PICKED_UP') {
      input.confirmationCode = deriveHandoverCode('supplier-handover', deliveryId);
    }

    if (status === 'ON_THE_WAY') {
      const start = new Date(Date.now() + 15 * 60_000);
      const end = new Date(Date.now() + 75 * 60_000);
      await prisma.reservation.update({
        where: { id: delivery.reservationId },
        data: {
          confirmedDeliveryWindowStart: start,
          confirmedDeliveryWindowEnd: end,
        },
      });
    }

    if (status === 'DELIVERED') {
      input.confirmationCode = deriveHandoverCode('learner-delivery', deliveryId);
    }

    await updateDriverDeliveryStatus(driverId, deliveryId, input);
  }
}

describe('fulfillment failures phase 5', () => {
  let ctx: TestContext;

  before(async () => {
    const category = await prisma.category.findFirst({ select: { id: true } });
    const location = await prisma.location.findFirst({ select: { id: true } });
    assert.ok(category && location);

    const passwordHash = await hashPassword('TestPassword123!');

    const supplier = await prisma.user.create({
      data: {
        displayName: `${TEST_MARKER} supplier`,
        email: `${TEST_MARKER}-supplier-${Date.now()}@impactloop.test`,
        passwordHash,
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        roles: { create: [{ role: 'SUPPLIER', isPrimary: true }] },
        supplierProfile: {
          create: {
            supplierType: 'INDIVIDUAL_SUPPLIER',
            publicName: `${TEST_MARKER} supplier`,
            verificationStatus: 'VERIFIED',
          },
        },
      },
      select: { id: true },
    });

    const learner = await prisma.user.create({
      data: {
        displayName: `${TEST_MARKER} learner`,
        email: `${TEST_MARKER}-learner-${Date.now()}@impactloop.test`,
        passwordHash,
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
        learnerProfile: {
          create: { learnerType: 'STUDENT', skillLevel: 'BEGINNER' },
        },
      },
      select: { id: true },
    });

    const driver = await prisma.user.create({
      data: {
        displayName: `${TEST_MARKER} driver`,
        email: `${TEST_MARKER}-driver-${Date.now()}@impactloop.test`,
        passwordHash,
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        roles: { create: [{ role: 'DRIVER', isPrimary: true }] },
        driverProfile: {
          create: {
            displayName: `${TEST_MARKER} driver`,
            phone: `+97059${Date.now().toString().slice(-7)}`,
            city: 'Ramallah',
            area: TEST_MARKER,
            transportationType: 'BICYCLE',
            vehicleType: 'BICYCLE',
            status: 'ACTIVE',
            acceptingNewJobs: true,
          },
        },
      },
      select: { id: true },
    });

    const otherDriver = await prisma.user.create({
      data: {
        displayName: `${TEST_MARKER} other driver`,
        email: `${TEST_MARKER}-other-driver-${Date.now()}@impactloop.test`,
        passwordHash,
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        roles: { create: [{ role: 'DRIVER', isPrimary: true }] },
        driverProfile: {
          create: {
            displayName: `${TEST_MARKER} other driver`,
            phone: `+97058${Date.now().toString().slice(-7)}`,
            city: 'Ramallah',
            area: TEST_MARKER,
            transportationType: 'BICYCLE',
            vehicleType: 'BICYCLE',
            status: 'ACTIVE',
            acceptingNewJobs: true,
          },
        },
      },
      select: { id: true },
    });

    ctx = {
      supplierId: supplier.id,
      driverId: driver.id,
      otherDriverId: otherDriver.id,
      learnerId: learner.id,
      categoryId: category.id,
      locationId: location.id,
      createdUserIds: [supplier.id, learner.id, driver.id, otherDriver.id],
      createdMaterialIds: [],
      createdReservationIds: [],
    };
  });

  after(async () => {
    await cleanup(ctx);
  });

  afterEach(async () => {
    await resetDriverState(ctx);
  });

  test('supplier cannot mark learner no-show before pickup window expires', async () => {
    const { reservation } = await acceptPickupReservation(ctx);

    await assert.rejects(
      () =>
        markSupplierLearnerNoShow(ctx.supplierId, reservation.id, {
          reason: 'LEARNER_DID_NOT_ARRIVE',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.match(error.message, /not expired/i);
        return true;
      },
    );
  });

  test('supplier can mark learner no-show after pickup window + grace', async () => {
    const { reservation } = await acceptPickupReservation(ctx);
    await setPickupWindowExpired(reservation.id);

    const result = await markSupplierLearnerNoShow(
      ctx.supplierId,
      reservation.id,
      { reason: 'LEARNER_DID_NOT_ARRIVE' },
    );

    assert.equal(result.status, 'NO_SHOW');
  });

  test('learner no-show releases hold and does not decrement material quantity', async () => {
    const material = await createMaterial(ctx, { quantity: 10 });
    const preferred = futurePreferredWindow();
    const reservation = await createReservation(ctx.learnerId, {
      materialId: material.id,
      quantityRequested: 2,
      fulfillmentMethod: 'PICKUP',
      learnerPreferredPickupWindows: [preferred],
    } satisfies CreateReservationInput);
    ctx.createdReservationIds.push(reservation.id);

    await acceptSupplierReservation(ctx.supplierId, reservation.id, {
      pickupWindowStart: preferred.start,
      pickupWindowEnd: preferred.end,
    });

    const heldBefore = await getMaterialQuantityState(prisma, material.id);
    assert.equal(decimalToNumber(heldBefore!.heldQuantity), 2);

    await setPickupWindowExpired(reservation.id);
    await markSupplierLearnerNoShow(ctx.supplierId, reservation.id, {
      reason: 'LEARNER_DID_NOT_ARRIVE',
    });

    const materialRow = await prisma.material.findUniqueOrThrow({
      where: { id: material.id },
    });
    const heldAfter = await getMaterialQuantityState(prisma, material.id);

    assert.equal(Number(materialRow.quantity), 10);
    assert.equal(decimalToNumber(heldAfter!.heldQuantity), 0);
  });

  test('driver cannot mark pickup failed before supplier pickup window expires', async () => {
    const { delivery } = await acceptDeliveryReservation(ctx);
    await acceptDelivery(ctx.driverId, delivery.id);

    await assert.rejects(
      () =>
        markDriverPickupFailed(ctx.driverId, delivery.id, {
          reason: 'SUPPLIER_UNAVAILABLE',
          note: 'Supplier was not available at pickup.',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.match(error.message, /not expired/i);
        return true;
      },
    );
  });

  test('pickup failure restores offline when the driver stopped accepting new jobs', async () => {
    const { reservation, delivery } = await acceptDeliveryReservation(ctx);
    await acceptDelivery(ctx.driverId, delivery.id);
    await prisma.driverProfile.update({
      where: { userId: ctx.driverId },
      data: { acceptingNewJobs: false },
    });
    await setSupplierPickupWindowExpired(reservation.id);

    const mapped = await markDriverPickupFailed(ctx.driverId, delivery.id, {
      reason: 'SUPPLIER_UNAVAILABLE',
      note: 'Supplier was not available at pickup.',
    });

    assert.equal(mapped.status, 'FAILED_PICKUP');
    const profile = await prisma.driverProfile.findUniqueOrThrow({
      where: { userId: ctx.driverId },
      select: { availability: true, acceptingNewJobs: true },
    });
    assert.equal(profile.acceptingNewJobs, false);
    assert.equal(profile.availability, 'OFFLINE');
  });

  test('pickup failed does not decrement material quantity', async () => {
    const { material, reservation, delivery } =
      await acceptDeliveryReservation(ctx);
    await acceptDelivery(ctx.driverId, delivery.id);
    await setSupplierPickupWindowExpired(reservation.id);

    await markDriverPickupFailed(ctx.driverId, delivery.id, {
      reason: 'MATERIAL_NOT_READY',
      note: 'Material was not ready for pickup.',
    });

    const materialRow = await prisma.material.findUniqueOrThrow({
      where: { id: material.id },
    });
    assert.equal(Number(materialRow.quantity), 5);
  });

  test('pickup failed does not mark reservation completed', async () => {
    const { reservation, delivery } = await acceptDeliveryReservation(ctx);
    await acceptDelivery(ctx.driverId, delivery.id);
    await setSupplierPickupWindowExpired(reservation.id);

    await markDriverPickupFailed(ctx.driverId, delivery.id, {
      reason: 'OTHER',
      note: 'Pickup could not be completed.',
    });

    const updated = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    assert.equal(updated.status, 'AWAITING_RESOLUTION');
    assert.equal(updated.completedAt, null);
  });

  test('releasing one failed delivery preserves ON_DELIVERY for another active delivery', async () => {
    const first = await acceptDeliveryReservation(ctx);
    const second = await acceptDeliveryReservation(ctx);
    await acceptDelivery(ctx.driverId, first.delivery.id);
    await acceptDelivery(ctx.driverId, second.delivery.id);
    await setSupplierPickupWindowExpired(first.reservation.id);

    await markDriverPickupFailed(ctx.driverId, first.delivery.id, {
      reason: 'OTHER',
      note: 'First pickup could not be completed.',
    });

    const profile = await prisma.driverProfile.findUniqueOrThrow({
      where: { userId: ctx.driverId },
      select: { availability: true },
    });
    const stillActive = await prisma.delivery.findUniqueOrThrow({
      where: { id: second.delivery.id },
    });

    assert.equal(profile.availability, 'ON_DELIVERY');
    assert.equal(stillActive.status, 'DRIVER_ASSIGNED');
  });

  test('supplier cannot mark driver no-show before supplier pickup window expires', async () => {
    const { delivery } = await acceptDeliveryReservation(ctx);
    await acceptDelivery(ctx.driverId, delivery.id);

    await assert.rejects(
      () =>
        markSupplierDriverNoShow(ctx.supplierId, delivery.id, {
          note: 'Driver did not arrive for pickup.',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.match(error.message, /not expired/i);
        return true;
      },
    );
  });

  test('supplier can mark driver no-show after supplier pickup window + grace', async () => {
    const { reservation, delivery } = await acceptDeliveryReservation(ctx);
    await acceptDelivery(ctx.driverId, delivery.id);
    await setSupplierPickupWindowExpired(reservation.id);

    const result = await markSupplierDriverNoShow(
      ctx.supplierId,
      delivery.id,
      { note: 'Driver did not arrive for pickup.' },
    );

    assert.equal(result.status, 'AWAITING_RESOLUTION');

    const updatedDelivery = await prisma.delivery.findUniqueOrThrow({
      where: { id: delivery.id },
    });
    assert.equal(updatedDelivery.status, 'DRIVER_NO_SHOW');
  });

  test('driver cannot mark delivery failed before arriving at dropoff', async () => {
    const { reservation, delivery } = await acceptDeliveryReservation(ctx);
    await progressDeliveryTo(ctx, delivery.id, ctx.driverId, 'PICKED_UP');

    await assert.rejects(
      () =>
        markDriverDeliveryFailed(ctx.driverId, delivery.id, {
          reason: 'LEARNER_UNAVAILABLE',
          note: 'Learner was unavailable at drop-off.',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'DRIVER_DELIVERY_FAILURE_NOT_ALLOWED');
        return true;
      },
    );
  });

  test('first failed dropoff creates a non-terminal retry attempt', async () => {
    const { delivery } = await acceptDeliveryReservation(ctx);
    await progressDeliveryTo(ctx, delivery.id, ctx.driverId, 'ARRIVED_DROPOFF');

    const mapped = await markDriverDeliveryFailed(ctx.driverId, delivery.id, {
      reason: 'LEARNER_UNAVAILABLE',
      note: 'Learner was unavailable at drop-off.',
    });

    assert.equal(mapped.status, 'REDELIVERY_PENDING');
    assert.equal(
      await prisma.deliveryAttempt.count({ where: { deliveryId: delivery.id } }),
      1,
    );
    assert.equal(
      await prisma.noShowReport.count({ where: { deliveryId: delivery.id } }),
      0,
    );
  });

  test('delivery failed after driver picked up does not release stock or consume stock', async () => {
    const { material, delivery } =
      await acceptDeliveryReservation(ctx);
    await progressDeliveryTo(ctx, delivery.id, ctx.driverId, 'ARRIVED_DROPOFF');

    const heldBefore = await getMaterialQuantityState(prisma, material.id);
    assert.equal(decimalToNumber(heldBefore!.heldQuantity), 1);

    await markDriverDeliveryFailed(ctx.driverId, delivery.id, {
      reason: 'ADDRESS_ISSUE',
      note: 'Drop-off address could not be reached.',
    });

    const materialRow = await prisma.material.findUniqueOrThrow({
      where: { id: material.id },
    });
    const heldAfter = await getMaterialQuantityState(prisma, material.id);

    assert.equal(Number(materialRow.quantity), 5);
    assert.equal(decimalToNumber(heldAfter!.heldQuantity), 1);
  });

  test('same assigned driver schedules retry and old QR is revoked', async () => {
    const { reservation, delivery } = await acceptDeliveryReservation(ctx);
    await progressDeliveryTo(ctx, delivery.id, ctx.driverId, 'ARRIVED_DROPOFF');
    await prisma.delivery.update({
      where: { id: delivery.id },
      data: {
        learnerDeliveryHandoverTokenHash: 'old-window-token',
        learnerDeliveryHandoverTokenIssuedAt: new Date(),
        learnerDeliveryHandoverTokenExpiresAt: new Date(Date.now() + 60 * 60_000),
      },
    });

    await markDriverDeliveryFailed(ctx.driverId, delivery.id, {
      reason: 'LEARNER_UNAVAILABLE',
      learnerContactAttempted: true,
      note: 'Called twice; arranging another attempt.',
    });

    const start = new Date(Date.now() + 60 * 60_000);
    const end = new Date(start.getTime() + 60 * 60_000);
    await assert.rejects(
      () =>
        setDriverDeliveryWindow(ctx.otherDriverId, delivery.id, {
          start: start.toISOString(),
          end: end.toISOString(),
        }),
      (error: unknown) => error instanceof AppError && error.code === 'NOT_FOUND',
    );

    const scheduled = await setDriverDeliveryWindow(ctx.driverId, delivery.id, {
      start: start.toISOString(),
      end: end.toISOString(),
    });
    assert.equal(scheduled.status, 'REDELIVERY_SCHEDULED');

    const stored = await prisma.delivery.findUniqueOrThrow({
      where: { id: delivery.id },
      include: { attempts: true, assignments: true },
    });
    assert.equal(stored.learnerDeliveryHandoverTokenHash, null);
    assert.equal(stored.scheduleOccurrence, 1);
    assert.equal(stored.assignments.filter((row) => row.status === 'ACTIVE').length, 1);
    assert.equal(stored.attempts[0]?.retryWindowStart?.toISOString(), start.toISOString());

    const represented = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    assert.equal(represented.status, 'ACCEPTED');
    assert.equal(represented.confirmedDeliveryWindowStart?.toISOString(), start.toISOString());
  });

  test('second learner-unreachable failure records attempt two then uses final no-show path', async () => {
    const { delivery } = await acceptDeliveryReservation(ctx);
    await progressDeliveryTo(ctx, delivery.id, ctx.driverId, 'ARRIVED_DROPOFF');
    const retryStart = new Date(Date.now() + 60 * 60_000);
    const retryEnd = new Date(retryStart.getTime() + 60 * 60_000);
    await markDriverDeliveryFailed(ctx.driverId, delivery.id, {
      reason: 'LEARNER_UNAVAILABLE',
      learnerContactAttempted: true,
      retryWindowStart: retryStart.toISOString(),
      retryWindowEnd: retryEnd.toISOString(),
    });
    await updateDriverDeliveryStatus(ctx.driverId, delivery.id, {
      status: 'ON_THE_WAY',
    });
    await updateDriverDeliveryStatus(ctx.driverId, delivery.id, {
      status: 'ARRIVED_DROPOFF',
    });

    const result = await markDriverDeliveryFailed(ctx.driverId, delivery.id, {
      reason: 'LEARNER_UNAVAILABLE',
      learnerContactAttempted: true,
      note: 'Final attempt also unreachable.',
    });
    assert.equal(result.status, 'LEARNER_NO_SHOW');
    assert.equal(
      await prisma.deliveryAttempt.count({ where: { deliveryId: delivery.id } }),
      2,
    );
    assert.equal(
      await prisma.noShowReport.count({ where: { deliveryId: delivery.id } }),
      1,
    );
  });

  test('assigned driver sets the initial operational window before ON_THE_WAY', async () => {
    const { reservation, delivery } = await acceptDeliveryReservation(ctx);
    await progressDeliveryTo(ctx, delivery.id, ctx.driverId, 'PICKED_UP');
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        confirmedDeliveryWindowStart: null,
        confirmedDeliveryWindowEnd: null,
      },
    });
    await assert.rejects(
      () =>
        updateDriverDeliveryStatus(ctx.driverId, delivery.id, {
          status: 'ON_THE_WAY',
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === 'DELIVERY_WINDOW_REQUIRED',
    );

    const start = new Date(Date.now() + 30 * 60_000);
    const end = new Date(start.getTime() + 60 * 60_000);
    await assert.rejects(
      () =>
        setDriverDeliveryWindow(ctx.otherDriverId, delivery.id, {
          start: start.toISOString(),
          end: end.toISOString(),
        }),
      (error: unknown) => error instanceof AppError && error.code === 'NOT_FOUND',
    );
    const scheduled = await setDriverDeliveryWindow(ctx.driverId, delivery.id, {
      start: start.toISOString(),
      end: end.toISOString(),
    });
    assert.equal(scheduled.status, 'PICKED_UP');
    assert.equal(scheduled.scheduleOccurrence, 1);
    const stored = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    assert.equal(stored.confirmedDeliveryWindowStart?.toISOString(), start.toISOString());
    assert.equal(stored.confirmedDeliveryWindowEnd?.toISOString(), end.toISOString());

    const onTheWay = await updateDriverDeliveryStatus(
      ctx.driverId,
      delivery.id,
      { status: 'ON_THE_WAY' },
    );
    assert.equal(onTheWay.status, 'ON_THE_WAY');
  });

  test('concurrent first-failure requests create exactly one attempt', async () => {
    const { delivery } = await acceptDeliveryReservation(ctx);
    await progressDeliveryTo(ctx, delivery.id, ctx.driverId, 'ARRIVED_DROPOFF');
    const results = await Promise.allSettled([
      markDriverDeliveryFailed(ctx.driverId, delivery.id, {
        reason: 'LEARNER_UNAVAILABLE',
        learnerContactAttempted: true,
      }),
      markDriverDeliveryFailed(ctx.driverId, delivery.id, {
        reason: 'LEARNER_UNAVAILABLE',
        learnerContactAttempted: true,
      }),
    ]);

    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(
      await prisma.deliveryAttempt.count({ where: { deliveryId: delivery.id } }),
      1,
    );
    assert.equal(
      (await prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } }))
        .status,
      'REDELIVERY_PENDING',
    );
  });

  test('the same numeric code is governed by the replacement current window', async () => {
    const { reservation, delivery } = await acceptDeliveryReservation(ctx);
    await progressDeliveryTo(ctx, delivery.id, ctx.driverId, 'ARRIVED_DROPOFF');
    const retryStart = new Date(Date.now() + 60 * 60_000);
    const retryEnd = new Date(retryStart.getTime() + 60 * 60_000);
    await markDriverDeliveryFailed(ctx.driverId, delivery.id, {
      reason: 'LEARNER_REQUESTED_RESCHEDULE',
      learnerContactAttempted: true,
      retryWindowStart: retryStart.toISOString(),
      retryWindowEnd: retryEnd.toISOString(),
    });
    await updateDriverDeliveryStatus(ctx.driverId, delivery.id, {
      status: 'ON_THE_WAY',
    });
    await updateDriverDeliveryStatus(ctx.driverId, delivery.id, {
      status: 'ARRIVED_DROPOFF',
    });
    const code = deriveHandoverCode('learner-delivery', delivery.id);
    await assert.rejects(
      () =>
        updateDriverDeliveryStatus(ctx.driverId, delivery.id, {
          status: 'DELIVERED',
          confirmationCode: code,
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === 'HANDOVER_WINDOW_NOT_STARTED',
    );

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: activeConfirmedDeliveryWindowUpdate(),
    });
    const completed = await updateDriverDeliveryStatus(
      ctx.driverId,
      delivery.id,
      { status: 'DELIVERED', confirmationCode: code },
    );
    assert.equal(completed.status, 'DELIVERED');
    assert.equal(
      (await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } }))
        .status,
      'COMPLETED',
    );
  });

  test('retry scheduling revokes old QR and a new QR completes only in the new window', async () => {
    const { reservation, delivery } = await acceptDeliveryReservation(ctx);
    await progressDeliveryTo(ctx, delivery.id, ctx.driverId, 'ARRIVED_DROPOFF');
    const oldCredential = await issueDeliveryHandoverCredential(
      ctx.learnerId,
      delivery.id,
    );
    await markDriverDeliveryFailed(ctx.driverId, delivery.id, {
      reason: 'LEARNER_UNAVAILABLE',
      learnerContactAttempted: true,
    });
    const retryStart = new Date(Date.now() + 60 * 60_000);
    const retryEnd = new Date(retryStart.getTime() + 60 * 60_000);
    await setDriverDeliveryWindow(ctx.driverId, delivery.id, {
      start: retryStart.toISOString(),
      end: retryEnd.toISOString(),
    });
    await assert.rejects(
      () => verifyDeliveryHandoverCredential(ctx.driverId, oldCredential.handoverToken),
      (error: unknown) =>
        error instanceof AppError && error.code === 'HANDOVER_CREDENTIAL_INVALID',
    );

    const newCredential = await issueDeliveryHandoverCredential(
      ctx.learnerId,
      delivery.id,
    );
    await updateDriverDeliveryStatus(ctx.driverId, delivery.id, {
      status: 'ON_THE_WAY',
    });
    await updateDriverDeliveryStatus(ctx.driverId, delivery.id, {
      status: 'ARRIVED_DROPOFF',
    });
    await assert.rejects(
      () => verifyDeliveryHandoverCredential(ctx.driverId, newCredential.handoverToken),
      (error: unknown) =>
        error instanceof AppError && error.code === 'VALIDATION_ERROR',
    );
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: activeConfirmedDeliveryWindowUpdate(),
    });
    await verifyDeliveryHandoverCredential(ctx.driverId, newCredential.handoverToken);
    const completed = await confirmDeliveryHandoverCredential(
      ctx.driverId,
      newCredential.handoverToken,
    );
    assert.equal(completed.status, 'DELIVERED');
    const replayed = await confirmDeliveryHandoverCredential(
      ctx.driverId,
      newCredential.handoverToken,
    );
    assert.equal(replayed.status, 'DELIVERED');
  });

  test('unauthorized users cannot mark no-show/failure', async () => {
    const { reservation } = await acceptPickupReservation(ctx);
    await setPickupWindowExpired(reservation.id);

    await assert.rejects(
      () =>
        markSupplierLearnerNoShow(ctx.learnerId, reservation.id, {
          reason: 'LEARNER_DID_NOT_ARRIVE',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
  });

  test('completed reservations cannot be marked failed/no-show', async () => {
    const material = await createMaterial(ctx);
    const preferred = futurePreferredWindow();
    const reservation = await createReservation(ctx.learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
      learnerPreferredPickupWindows: [preferred],
    } satisfies CreateReservationInput);
    ctx.createdReservationIds.push(reservation.id);

    await acceptSupplierReservation(ctx.supplierId, reservation.id, {
      pickupWindowStart: preferred.start,
      pickupWindowEnd: preferred.end,
    });

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: activePickupWindowReservationUpdate(),
    });

    await completeSupplierReservation(ctx.supplierId, reservation.id, {
      confirmationCode: deriveHandoverCode('self-pickup', reservation.id),
    });

    await setPickupWindowExpired(reservation.id);

    await assert.rejects(
      () =>
        markSupplierLearnerNoShow(ctx.supplierId, reservation.id, {
          reason: 'LEARNER_DID_NOT_ARRIVE',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        return true;
      },
    );
  });

  test('wrong status transitions are rejected for delivery pickup expired', async () => {
    const { reservation } = await acceptPickupReservation(ctx);
    await setPickupWindowExpired(reservation.id);

    await assert.rejects(
      () => markSupplierDeliveryPickupExpired(ctx.supplierId, reservation.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
  });
});
