import assert from 'node:assert/strict';
import { after, afterEach, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import type { DeliveryStatus } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';
import { deriveHandoverCode } from '../../utils/handover-codes.js';
import { HANDOVER_GRACE_MINUTES } from '../../utils/handover-timing.js';
import { hashPassword } from '../../utils/password.js';
import { acceptDelivery, updateDriverDeliveryStatus } from '../driver/driver.service.js';
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
import { activePickupWindowReservationUpdate } from '../../test-utils/handover-test-windows.js';

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
    data: { availability: 'AVAILABLE' },
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

    const input: { status: DeliveryStatus; confirmationCode?: string } = {
      status,
    };

    if (status === 'PICKED_UP') {
      input.confirmationCode = deriveHandoverCode('supplier-handover', deliveryId);
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
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.match(error.message, /not expired/i);
        return true;
      },
    );
  });

  test('driver can mark pickup failed after supplier pickup window + grace', async () => {
    const { reservation, delivery } = await acceptDeliveryReservation(ctx);
    await acceptDelivery(ctx.driverId, delivery.id);
    await setSupplierPickupWindowExpired(reservation.id);

    const mapped = await markDriverPickupFailed(ctx.driverId, delivery.id, {
      reason: 'SUPPLIER_UNAVAILABLE',
    });

    assert.equal(mapped.status, 'FAILED_PICKUP');
  });

  test('pickup failed does not decrement material quantity', async () => {
    const { material, reservation, delivery } =
      await acceptDeliveryReservation(ctx);
    await acceptDelivery(ctx.driverId, delivery.id);
    await setSupplierPickupWindowExpired(reservation.id);

    await markDriverPickupFailed(ctx.driverId, delivery.id, {
      reason: 'MATERIAL_NOT_READY',
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
    });

    const updated = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    assert.equal(updated.status, 'AWAITING_RESOLUTION');
    assert.equal(updated.completedAt, null);
  });

  test('supplier cannot mark driver no-show before supplier pickup window expires', async () => {
    const { delivery } = await acceptDeliveryReservation(ctx);
    await acceptDelivery(ctx.driverId, delivery.id);

    await assert.rejects(
      () => markSupplierDriverNoShow(ctx.supplierId, delivery.id, {}),
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
      {},
    );

    assert.equal(result.status, 'AWAITING_RESOLUTION');

    const updatedDelivery = await prisma.delivery.findUniqueOrThrow({
      where: { id: delivery.id },
    });
    assert.equal(updatedDelivery.status, 'DRIVER_NO_SHOW');
  });

  test('driver cannot mark delivery failed before confirmed delivery window expires', async () => {
    const { reservation, delivery } = await acceptDeliveryReservation(ctx);
    await progressDeliveryTo(ctx, delivery.id, ctx.driverId, 'PICKED_UP');

    await assert.rejects(
      () =>
        markDriverDeliveryFailed(ctx.driverId, delivery.id, {
          reason: 'LEARNER_UNAVAILABLE',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.match(error.message, /not expired/i);
        return true;
      },
    );
  });

  test('driver can mark delivery failed after confirmed delivery window + grace', async () => {
    const { reservation, delivery } = await acceptDeliveryReservation(ctx);
    await progressDeliveryTo(ctx, delivery.id, ctx.driverId, 'PICKED_UP');
    await setDeliveryWindowExpired(reservation.id);

    const mapped = await markDriverDeliveryFailed(ctx.driverId, delivery.id, {
      reason: 'LEARNER_UNAVAILABLE',
    });

    assert.equal(mapped.status, 'LEARNER_NO_SHOW');
  });

  test('delivery failed after driver picked up does not release stock or consume stock', async () => {
    const { material, reservation, delivery } =
      await acceptDeliveryReservation(ctx);
    await progressDeliveryTo(ctx, delivery.id, ctx.driverId, 'PICKED_UP');
    await setDeliveryWindowExpired(reservation.id);

    const heldBefore = await getMaterialQuantityState(prisma, material.id);
    assert.equal(decimalToNumber(heldBefore!.heldQuantity), 1);

    await markDriverDeliveryFailed(ctx.driverId, delivery.id, {
      reason: 'ADDRESS_ISSUE',
    });

    const materialRow = await prisma.material.findUniqueOrThrow({
      where: { id: material.id },
    });
    const heldAfter = await getMaterialQuantityState(prisma, material.id);

    assert.equal(Number(materialRow.quantity), 5);
    assert.equal(decimalToNumber(heldAfter!.heldQuantity), 1);
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
    const start = new Date(Date.now() - 30 * 60_000);
    const end = new Date(Date.now() + 30 * 60_000);
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
      data: {
        pickupWindowStart: start,
        pickupWindowEnd: end,
        ...activePickupWindowReservationUpdate(),
      },
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
