import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { createReservation } from './reservations.service.js';
import { getMaterialQuantityState } from './reservations.quantity.js';
import { resolveLearnerConfirmation } from './reservations.service.js';
import type { CreateReservationInput } from './reservations.validation.js';
import { acceptSupplierReservation } from '../supplier-reservations/supplier-reservations.service.js';

const TEST_MARKER = '[test-learner-confirmation]';

function futurePreferredWindow(hoursFromNow = 24, durationHours = 2) {
  const start = new Date(Date.now() + hoursFromNow * 3_600_000);
  const end = new Date(start.getTime() + durationHours * 3_600_000);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function pickupReservationPayload(
  materialId: string,
  overrides: Partial<CreateReservationInput> = {},
): CreateReservationInput {
  return {
    materialId,
    quantityRequested: 1,
    fulfillmentMethod: 'PICKUP',
    learnerPreferredPickupWindows: [futurePreferredWindow()],
    ...overrides,
  };
}

function deliveryReservationPayload(
  materialId: string,
  overrides: Partial<CreateReservationInput> = {},
): CreateReservationInput {
  return {
    materialId,
    quantityRequested: 1,
    fulfillmentMethod: 'DELIVERY',
    learnerPreferredDeliveryWindows: [futurePreferredWindow()],
    deliveryAddressText: '12 Learner Street, Nablus',
    safeDropoffAllowed: false,
    ...overrides,
  };
}

type TestContext = {
  supplierId: string;
  learnerId: string;
  otherLearnerId: string;
  categoryId: string;
  locationId: string;
  createdUserIds: string[];
  createdMaterialIds: string[];
  createdReservationIds: string[];
  createdLocationIds: string[];
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
      quantity: options.quantity ?? 3,
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

async function createAwaitingPickupReservation(ctx: TestContext) {
  const material = await createMaterial(ctx);
  const preferred = futurePreferredWindow(48);
  const proposed = futurePreferredWindow(72);
  const reservation = await createReservation(
    ctx.learnerId,
    pickupReservationPayload(material.id, {
      learnerPreferredPickupWindows: [preferred],
    }),
  );
  ctx.createdReservationIds.push(reservation.id);

  await acceptSupplierReservation(ctx.supplierId, reservation.id, {
    pickupWindowStart: proposed.start,
    pickupWindowEnd: proposed.end,
  });

  return { material, proposed, reservation };
}

async function createAwaitingDeliveryReservation(ctx: TestContext) {
  const material = await createMaterial(ctx, { deliveryAllowed: true });
  const supplierPickupStart = new Date(Date.now() + 24 * 3_600_000);
  const supplierPickupEnd = new Date(supplierPickupStart.getTime() + 2 * 3_600_000);
  const earliestDelivery = new Date(supplierPickupEnd.getTime() + 60 * 60_000);
  const learnerDeliveryStart = new Date(earliestDelivery.getTime() - 3 * 3_600_000);
  const learnerDeliveryEnd = new Date(earliestDelivery.getTime() - 30 * 60_000);

  const reservation = await createReservation(
    ctx.learnerId,
    deliveryReservationPayload(material.id, {
      learnerPreferredDeliveryWindows: [
        {
          start: learnerDeliveryStart.toISOString(),
          end: learnerDeliveryEnd.toISOString(),
        },
      ],
    }),
  );
  ctx.createdReservationIds.push(reservation.id);

  await acceptSupplierReservation(ctx.supplierId, reservation.id, {
    pickupWindowStart: supplierPickupStart.toISOString(),
    pickupWindowEnd: supplierPickupEnd.toISOString(),
  });

  return {
    material,
    supplierPickupStart,
    supplierPickupEnd,
    earliestDelivery,
    reservation,
  };
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

  if (ctx.createdLocationIds.length) {
    await prisma.location.deleteMany({
      where: { id: { in: ctx.createdLocationIds } },
    });
  }

  if (ctx.createdUserIds.length) {
    await prisma.user.deleteMany({
      where: { id: { in: ctx.createdUserIds } },
    });
  }
}

describe('learner confirmation', () => {
  let ctx: TestContext;

  before(async () => {
    const category = await prisma.category.findFirst({ select: { id: true } });
    const location = await prisma.location.findFirst({ select: { id: true } });
    assert.ok(category, 'category required for tests');
    assert.ok(location, 'location required for tests');

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
          create: {
            learnerType: 'STUDENT',
            skillLevel: 'BEGINNER',
          },
        },
      },
      select: { id: true },
    });

    const otherLearner = await prisma.user.create({
      data: {
        displayName: `${TEST_MARKER} other learner`,
        email: `${TEST_MARKER}-other-${Date.now()}@impactloop.test`,
        passwordHash,
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
        learnerProfile: {
          create: {
            learnerType: 'STUDENT',
            skillLevel: 'BEGINNER',
          },
        },
      },
      select: { id: true },
    });

    ctx = {
      supplierId: supplier.id,
      learnerId: learner.id,
      otherLearnerId: otherLearner.id,
      categoryId: category.id,
      locationId: location.id,
      createdUserIds: [supplier.id, learner.id, otherLearner.id],
      createdMaterialIds: [],
      createdReservationIds: [],
      createdLocationIds: [],
    };
  });

  after(async () => {
    await cleanup(ctx);
  });

  test('learner accepts proposed PICKUP -> ACCEPTED and pickupWindowStart/End set', async () => {
    const { proposed, reservation } = await createAwaitingPickupReservation(ctx);

    const updated = await resolveLearnerConfirmation(
      ctx.learnerId,
      reservation.id,
      { action: 'ACCEPT_PROPOSED_PICKUP' },
    );

    assert.equal(updated.status, 'ACCEPTED');
    assert.equal(updated.pickupWindowStart, proposed.start);
    assert.equal(updated.pickupWindowEnd, proposed.end);
    assert.equal(updated.supplierProposedPickupWindowStart, null);
    assert.equal(updated.supplierProposedPickupWindowEnd, null);
  });

  test('learner cancels awaiting PICKUP -> CANCELLED and hold released', async () => {
    const { material, reservation } = await createAwaitingPickupReservation(ctx);

    const before = await getMaterialQuantityState(prisma, material.id);
    assert.ok(before);
    assert.equal(Number(before.heldQuantity), 1);

    const updated = await resolveLearnerConfirmation(ctx.learnerId, reservation.id, {
      action: 'CANCEL',
    });

    assert.equal(updated.status, 'CANCELLED');

    const after = await getMaterialQuantityState(prisma, material.id);
    assert.ok(after);
    assert.equal(Number(after.heldQuantity), 0);
  });

  test('non-owner learner cannot confirm', async () => {
    const { reservation } = await createAwaitingPickupReservation(ctx);

    await assert.rejects(
      () =>
        resolveLearnerConfirmation(ctx.otherLearnerId, reservation.id, {
          action: 'ACCEPT_PROPOSED_PICKUP',
        }),
      (error: Error & { statusCode?: number }) => {
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
  });

  test('cannot confirm reservation not in AWAITING_LEARNER_CONFIRMATION', async () => {
    const material = await createMaterial(ctx);
    const preferred = futurePreferredWindow();
    const reservation = await createReservation(
      ctx.learnerId,
      pickupReservationPayload(material.id, {
        learnerPreferredPickupWindows: [preferred],
      }),
    );
    ctx.createdReservationIds.push(reservation.id);

    await acceptSupplierReservation(ctx.supplierId, reservation.id, {
      pickupWindowStart: preferred.start,
      pickupWindowEnd: preferred.end,
    });

    await assert.rejects(
      () =>
        resolveLearnerConfirmation(ctx.learnerId, reservation.id, {
          action: 'ACCEPT_PROPOSED_PICKUP',
        }),
      (error: Error & { statusCode?: number }) => {
        assert.equal(error.statusCode, 409);
        return true;
      },
    );
  });

  test('learner submits feasible DELIVERY window -> ACCEPTED + Delivery WAITING_FOR_DRIVER', async () => {
    const { earliestDelivery, reservation } =
      await createAwaitingDeliveryReservation(ctx);
    const deliveryStart = new Date(earliestDelivery.getTime() + 30 * 60_000);
    const deliveryEnd = new Date(deliveryStart.getTime() + 3 * 3_600_000);

    const updated = await resolveLearnerConfirmation(
      ctx.learnerId,
      reservation.id,
      {
        action: 'SUBMIT_DELIVERY_WINDOW',
        deliveryWindow: {
          start: deliveryStart.toISOString(),
          end: deliveryEnd.toISOString(),
        },
      },
    );

    assert.equal(updated.status, 'ACCEPTED');
    assert.equal(updated.confirmedDeliveryWindowStart, deliveryStart.toISOString());
    assert.equal(updated.confirmedDeliveryWindowEnd, deliveryEnd.toISOString());
    assert.equal(updated.deliveryRequested, true);
    assert.ok(updated.activeDelivery);
    assert.equal(updated.activeDelivery?.status, 'WAITING_FOR_DRIVER');

    const deliveryCount = await prisma.delivery.count({
      where: { reservationId: reservation.id },
    });
    assert.equal(deliveryCount, 1);
  });

  test('learner submits partial overlap DELIVERY window -> accepted with trimmed confirmed window', async () => {
    const { earliestDelivery, reservation } =
      await createAwaitingDeliveryReservation(ctx);
    const deliveryStart = new Date(earliestDelivery.getTime() - 60 * 60_000);
    const deliveryEnd = new Date(earliestDelivery.getTime() + 3 * 3_600_000);

    const updated = await resolveLearnerConfirmation(
      ctx.learnerId,
      reservation.id,
      {
        action: 'SUBMIT_DELIVERY_WINDOW',
        deliveryWindow: {
          start: deliveryStart.toISOString(),
          end: deliveryEnd.toISOString(),
        },
      },
    );

    assert.equal(updated.status, 'ACCEPTED');
    assert.equal(
      updated.confirmedDeliveryWindowStart,
      earliestDelivery.toISOString(),
    );
    assert.equal(updated.confirmedDeliveryWindowEnd, deliveryEnd.toISOString());
  });

  test('learner submits infeasible DELIVERY window -> remains AWAITING, no Delivery row', async () => {
    const { earliestDelivery, reservation } =
      await createAwaitingDeliveryReservation(ctx);
    const deliveryStart = new Date(earliestDelivery.getTime() - 3 * 3_600_000);
    const deliveryEnd = new Date(earliestDelivery.getTime() - 30 * 60_000);

    await assert.rejects(
      () =>
        resolveLearnerConfirmation(ctx.learnerId, reservation.id, {
          action: 'SUBMIT_DELIVERY_WINDOW',
          deliveryWindow: {
            start: deliveryStart.toISOString(),
            end: deliveryEnd.toISOString(),
          },
        }),
      (error: Error & { statusCode?: number }) => {
        assert.equal(error.statusCode, 422);
        return true;
      },
    );

    const stored = await prisma.reservation.findUnique({
      where: { id: reservation.id },
      select: { status: true },
    });
    assert.equal(stored?.status, 'AWAITING_LEARNER_CONFIRMATION');

    const deliveryCount = await prisma.delivery.count({
      where: { reservationId: reservation.id },
    });
    assert.equal(deliveryCount, 0);
  });

  test('cancel awaiting DELIVERY releases hold', async () => {
    const { material, reservation } = await createAwaitingDeliveryReservation(ctx);

    const before = await getMaterialQuantityState(prisma, material.id);
    assert.ok(before);
    assert.equal(Number(before.heldQuantity), 1);

    const updated = await resolveLearnerConfirmation(ctx.learnerId, reservation.id, {
      action: 'CANCEL',
    });

    assert.equal(updated.status, 'CANCELLED');

    const after = await getMaterialQuantityState(prisma, material.id);
    assert.ok(after);
    assert.equal(Number(after.heldQuantity), 0);

    const deliveryCount = await prisma.delivery.count({
      where: { reservationId: reservation.id },
    });
    assert.equal(deliveryCount, 0);
  });

  test('duplicate Delivery row prevention', async () => {
    const { earliestDelivery, reservation } =
      await createAwaitingDeliveryReservation(ctx);
    const deliveryStart = new Date(earliestDelivery.getTime() + 30 * 60_000);
    const deliveryEnd = new Date(deliveryStart.getTime() + 3 * 3_600_000);

    await resolveLearnerConfirmation(ctx.learnerId, reservation.id, {
      action: 'SUBMIT_DELIVERY_WINDOW',
      deliveryWindow: {
        start: deliveryStart.toISOString(),
        end: deliveryEnd.toISOString(),
      },
    });

    await assert.rejects(
      () =>
        resolveLearnerConfirmation(ctx.learnerId, reservation.id, {
          action: 'SUBMIT_DELIVERY_WINDOW',
          deliveryWindow: {
            start: deliveryStart.toISOString(),
            end: deliveryEnd.toISOString(),
          },
        }),
      (error: Error & { statusCode?: number }) => {
        assert.equal(error.statusCode, 409);
        return true;
      },
    );

    const deliveryCount = await prisma.delivery.count({
      where: { reservationId: reservation.id },
    });
    assert.equal(deliveryCount, 1);
  });
});
