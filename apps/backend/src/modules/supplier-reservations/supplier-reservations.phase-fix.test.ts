import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import type { DeliveryStatus } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';
import { deriveHandoverCode } from '../../utils/handover-codes.js';
import { hashPassword } from '../../utils/password.js';
import { acceptDelivery, updateDriverDeliveryStatus } from '../driver/driver.service.js';
import { createReservation } from '../reservations/reservations.service.js';
import { getMaterialQuantityState } from '../reservations/reservations.quantity.js';
import type { CreateReservationInput } from '../reservations/reservations.validation.js';
import {
  acceptSupplierReservation,
  completeSupplierReservation,
  declineSupplierReservation,
  listSupplierReservations,
} from './supplier-reservations.service.js';

const TEST_MARKER = '[test-supplier-phase-fix]';

function futurePreferredWindow(hoursFromNow = 24, durationHours = 2) {
  const start = new Date(Date.now() + hoursFromNow * 3_600_000);
  const end = new Date(start.getTime() + durationHours * 3_600_000);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

type TestContext = {
  supplierId: string;
  driverId: string;
  learnerId: string;
  categoryId: string;
  locationId: string;
  createdUserIds: string[];
  createdMaterialIds: string[];
  createdReservationIds: string[];
};

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

async function acceptPickupReservation(
  ctx: TestContext,
  pickupWindowStart: Date,
  pickupWindowEnd: Date,
) {
  const material = await createMaterial(ctx);
  const preferred = {
    start: pickupWindowStart.toISOString(),
    end: pickupWindowEnd.toISOString(),
  };
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

  const startIndex = transitions.indexOf(delivery.status);
  const targetIndex = transitions.indexOf(targetStatus);
  assert.ok(startIndex >= 0 && targetIndex >= 0);

  if (delivery.status === 'WAITING_FOR_DRIVER') {
    await acceptDelivery(driverId, deliveryId);
  }

  for (const status of transitions.slice(1, targetIndex + 1)) {
    const input: {
      status: DeliveryStatus;
      confirmationCode?: string;
    } = { status };

    if (status === 'PICKED_UP') {
      input.confirmationCode = deriveHandoverCode('supplier-handover', deliveryId);
    }

    if (status === 'DELIVERED') {
      input.confirmationCode = deriveHandoverCode('learner-delivery', deliveryId);
    }

    await updateDriverDeliveryStatus(driverId, deliveryId, input);
  }
}

describe('supplier reservations phase fix', () => {
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

    ctx = {
      supplierId: supplier.id,
      driverId: driver.id,
      learnerId: learner.id,
      categoryId: category.id,
      locationId: location.id,
      createdUserIds: [supplier.id, learner.id, driver.id],
      createdMaterialIds: [],
      createdReservationIds: [],
    };
  });

  after(async () => {
    await cleanup(ctx);
  });

  test('pickup complete before window with correct code is rejected', async () => {
    const start = new Date(Date.now() + 2 * 3_600_000);
    const end = new Date(start.getTime() + 3_600_000);
    const { reservation } = await acceptPickupReservation(ctx, start, end);

    await assert.rejects(
      () =>
        completeSupplierReservation(ctx.supplierId, reservation.id, {
          confirmationCode: deriveHandoverCode('self-pickup', reservation.id),
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        assert.equal(error.message, 'Pickup window has not started yet.');
        return true;
      },
    );
  });

  test('pickup complete during window with correct code succeeds', async () => {
    const start = new Date(Date.now() - 30 * 60_000);
    const end = new Date(Date.now() + 30 * 60_000);
    const { reservation } = await acceptPickupReservation(ctx, start, end);

    const completed = await completeSupplierReservation(
      ctx.supplierId,
      reservation.id,
      {
        confirmationCode: deriveHandoverCode('self-pickup', reservation.id),
      },
    );

    assert.equal(completed.status, 'COMPLETED');
  });

  test('pickup complete after grace with correct code is rejected', async () => {
    const start = new Date(Date.now() + 2 * 3_600_000);
    const end = new Date(start.getTime() + 3_600_000);
    const { reservation } = await acceptPickupReservation(ctx, start, end);

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        pickupWindowStart: new Date(Date.now() - 3 * 3_600_000),
        pickupWindowEnd: new Date(Date.now() - 2 * 3_600_000),
      },
    });

    await assert.rejects(
      () =>
        completeSupplierReservation(ctx.supplierId, reservation.id, {
          confirmationCode: deriveHandoverCode('self-pickup', reservation.id),
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.message, 'Pickup window has expired.');
        return true;
      },
    );
  });

  test('wrong pickup code is rejected regardless of time', async () => {
    const start = new Date(Date.now() - 15 * 60_000);
    const end = new Date(Date.now() + 45 * 60_000);
    const { reservation } = await acceptPickupReservation(ctx, start, end);

    await assert.rejects(
      () =>
        completeSupplierReservation(ctx.supplierId, reservation.id, {
          confirmationCode: '000000',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.match(error.message, /incorrect/i);
        return true;
      },
    );
  });

  test('PENDING holds quantity and CANCELLED/DECLINED release hold', async () => {
    const material = await createMaterial(ctx, { quantity: 10 });
    const reservation = await createReservation(ctx.learnerId, {
      materialId: material.id,
      quantityRequested: 3,
      fulfillmentMethod: 'PICKUP',
      learnerPreferredPickupWindows: [futurePreferredWindow()],
    } satisfies CreateReservationInput);
    ctx.createdReservationIds.push(reservation.id);

    const pendingState = await getMaterialQuantityState(prisma, material.id);
    assert.equal(Number(pendingState.heldQuantity), 3);
    assert.equal(Number(pendingState.availableQuantity), 7);

    await declineSupplierReservation(ctx.supplierId, reservation.id, {
      reason: 'Unavailable',
    });

    const declinedState = await getMaterialQuantityState(prisma, material.id);
    assert.equal(Number(declinedState.heldQuantity), 0);
    assert.equal(Number(declinedState.availableQuantity), 10);
  });

  test('COMPLETED consumes stock once', async () => {
    const start = new Date(Date.now() - 15 * 60_000);
    const end = new Date(Date.now() + 45 * 60_000);
    const { material, reservation } = await acceptPickupReservation(
      ctx,
      start,
      end,
    );

    await completeSupplierReservation(ctx.supplierId, reservation.id, {
      confirmationCode: deriveHandoverCode('self-pickup', reservation.id),
    });

    const updatedMaterial = await prisma.material.findUnique({
      where: { id: material.id },
    });
    assert.equal(Number(updatedMaterial?.quantity), 4);
  });

  test('delivery accept with selected feasible learner window -> ACCEPTED + WAITING_FOR_DRIVER', async () => {
    const material = await createMaterial(ctx, { deliveryAllowed: true });
    const supplierPickupStart = new Date(Date.now() + 24 * 3_600_000);
    const supplierPickupEnd = new Date(supplierPickupStart.getTime() + 2 * 3_600_000);
    const earliestDelivery = new Date(supplierPickupEnd.getTime() + 60 * 60_000);
    const learnerDeliveryStart = new Date(earliestDelivery.getTime() - 30 * 60_000);
    const learnerDeliveryEnd = new Date(earliestDelivery.getTime() + 3 * 3_600_000);

    const reservation = await createReservation(ctx.learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'DELIVERY',
      learnerPreferredDeliveryWindows: [
        {
          start: learnerDeliveryStart.toISOString(),
          end: learnerDeliveryEnd.toISOString(),
        },
      ],
      deliveryAddressText: '12 Learner Street',
      safeDropoffAllowed: false,
    } satisfies CreateReservationInput);
    ctx.createdReservationIds.push(reservation.id);

    const accepted = await acceptSupplierReservation(ctx.supplierId, reservation.id, {
      pickupWindowStart: supplierPickupStart.toISOString(),
      pickupWindowEnd: supplierPickupEnd.toISOString(),
      selectedPreferredWindowIndex: 0,
    });

    assert.equal(accepted.status, 'ACCEPTED');
    assert.equal(accepted.activeDelivery?.status, 'WAITING_FOR_DRIVER');
    assert.equal(
      await prisma.delivery.count({ where: { reservationId: reservation.id } }),
      1,
    );
  });

  test('delivery accept with custom proposed window -> AWAITING_LEARNER_CONFIRMATION', async () => {
    const material = await createMaterial(ctx, { deliveryAllowed: true });
    const supplierPickupStart = new Date(Date.now() + 24 * 3_600_000);
    const supplierPickupEnd = new Date(supplierPickupStart.getTime() + 2 * 3_600_000);
    const proposedStart = new Date(Date.now() + 96 * 3_600_000);
    const proposedEnd = new Date(proposedStart.getTime() + 2 * 3_600_000);

    const reservation = await createReservation(ctx.learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'DELIVERY',
      learnerPreferredDeliveryWindows: [futurePreferredWindow(48)],
      deliveryAddressText: '12 Learner Street',
      safeDropoffAllowed: false,
    } satisfies CreateReservationInput);
    ctx.createdReservationIds.push(reservation.id);

    const accepted = await acceptSupplierReservation(ctx.supplierId, reservation.id, {
      pickupWindowStart: supplierPickupStart.toISOString(),
      pickupWindowEnd: supplierPickupEnd.toISOString(),
      proposedDeliveryWindowStart: proposedStart.toISOString(),
      proposedDeliveryWindowEnd: proposedEnd.toISOString(),
    });

    assert.equal(accepted.status, 'AWAITING_LEARNER_CONFIRMATION');
    assert.equal(accepted.confirmedDeliveryWindowStart, proposedStart.toISOString());
    assert.equal(
      await prisma.delivery.count({ where: { reservationId: reservation.id } }),
      0,
    );
  });

  test('accepted supplier filter excludes awaiting learner confirmation', async () => {
    const material = await createMaterial(ctx);
    const reservation = await createReservation(ctx.learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
      learnerPreferredPickupWindows: [futurePreferredWindow(48)],
    } satisfies CreateReservationInput);
    ctx.createdReservationIds.push(reservation.id);

    const proposed = futurePreferredWindow(72);
    await acceptSupplierReservation(ctx.supplierId, reservation.id, {
      pickupWindowStart: proposed.start,
      pickupWindowEnd: proposed.end,
    });

    const acceptedTab = await listSupplierReservations(ctx.supplierId, {
      status: 'accepted',
    });
    const needsLearnerTab = await listSupplierReservations(ctx.supplierId, {
      status: 'needs_learner',
    });

    assert.equal(
      acceptedTab.some((item) => item.id === reservation.id),
      false,
    );
    assert.equal(
      needsLearnerTab.some((item) => item.id === reservation.id),
      true,
    );
  });

  test('driver PICKED_UP before supplier pickup window with correct code is rejected', async () => {
    const material = await createMaterial(ctx, { deliveryAllowed: true });
    const supplierPickupStart = new Date(Date.now() + 2 * 3_600_000);
    const supplierPickupEnd = new Date(supplierPickupStart.getTime() + 3_600_000);
    const earliestDelivery = new Date(supplierPickupEnd.getTime() + 60 * 60_000);
    const learnerDeliveryEnd = new Date(earliestDelivery.getTime() + 3 * 3_600_000);

    const reservation = await createReservation(ctx.learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'DELIVERY',
      learnerPreferredDeliveryWindows: [
        {
          start: earliestDelivery.toISOString(),
          end: learnerDeliveryEnd.toISOString(),
        },
      ],
      deliveryAddressText: '12 Learner Street',
      safeDropoffAllowed: false,
    } satisfies CreateReservationInput);
    ctx.createdReservationIds.push(reservation.id);

    await acceptSupplierReservation(ctx.supplierId, reservation.id, {
      pickupWindowStart: supplierPickupStart.toISOString(),
      pickupWindowEnd: supplierPickupEnd.toISOString(),
      selectedPreferredWindowIndex: 0,
    });

    const delivery = await prisma.delivery.findFirstOrThrow({
      where: { reservationId: reservation.id },
    });

    await acceptDelivery(ctx.driverId, delivery.id);
    await updateDriverDeliveryStatus(ctx.driverId, delivery.id, {
      status: 'ARRIVED_PICKUP',
    });

    await assert.rejects(
      () =>
        updateDriverDeliveryStatus(ctx.driverId, delivery.id, {
          status: 'PICKED_UP',
          confirmationCode: deriveHandoverCode('supplier-handover', delivery.id),
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.message, 'Supplier pickup window has not started yet.');
        return true;
      },
    );
  });

  test('driver PICKED_UP during supplier pickup window with correct code succeeds', async () => {
    const passwordHash = await hashPassword('TestPassword123!');
    const extraDriver = await prisma.user.create({
      data: {
        displayName: `${TEST_MARKER} driver-2`,
        email: `${TEST_MARKER}-driver-2-${Date.now()}@impactloop.test`,
        passwordHash,
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        roles: { create: [{ role: 'DRIVER', isPrimary: true }] },
        driverProfile: {
          create: {
            displayName: `${TEST_MARKER} driver-2`,
            phone: `+97059${Date.now().toString().slice(-6)}`,
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
    ctx.createdUserIds.push(extraDriver.id);

    const material = await createMaterial(ctx, { deliveryAllowed: true });
    const supplierPickupStart = new Date(Date.now() - 15 * 60_000);
    const supplierPickupEnd = new Date(Date.now() + 45 * 60_000);
    const earliestDelivery = new Date(supplierPickupEnd.getTime() + 60 * 60_000);
    const learnerDeliveryEnd = new Date(earliestDelivery.getTime() + 3 * 3_600_000);

    const reservation = await createReservation(ctx.learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'DELIVERY',
      learnerPreferredDeliveryWindows: [
        {
          start: earliestDelivery.toISOString(),
          end: learnerDeliveryEnd.toISOString(),
        },
      ],
      deliveryAddressText: '12 Learner Street',
      safeDropoffAllowed: false,
    } satisfies CreateReservationInput);
    ctx.createdReservationIds.push(reservation.id);

    await acceptSupplierReservation(ctx.supplierId, reservation.id, {
      pickupWindowStart: supplierPickupStart.toISOString(),
      pickupWindowEnd: supplierPickupEnd.toISOString(),
      selectedPreferredWindowIndex: 0,
    });

    const delivery = await prisma.delivery.findFirstOrThrow({
      where: { reservationId: reservation.id },
    });

    await acceptDelivery(extraDriver.id, delivery.id);
    await updateDriverDeliveryStatus(extraDriver.id, delivery.id, {
      status: 'ARRIVED_PICKUP',
    });

    const updated = await updateDriverDeliveryStatus(extraDriver.id, delivery.id, {
      status: 'PICKED_UP',
      confirmationCode: deriveHandoverCode('supplier-handover', delivery.id),
    });

    assert.equal(updated.status, 'PICKED_UP');
  });
});
