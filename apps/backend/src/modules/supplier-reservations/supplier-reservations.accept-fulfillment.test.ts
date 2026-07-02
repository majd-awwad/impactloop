import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { createReservation } from '../reservations/reservations.service.js';
import { getMaterialQuantityState } from '../reservations/reservations.quantity.js';
import type { CreateReservationInput } from '../reservations/reservations.validation.js';
import {
  acceptSupplierReservation,
  declineSupplierReservation,
} from './supplier-reservations.service.js';

const TEST_MARKER = '[test-supplier-accept-fulfillment]';

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

describe('supplier accept fulfillment', () => {
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

    ctx = {
      supplierId: supplier.id,
      learnerId: learner.id,
      categoryId: category.id,
      locationId: location.id,
      createdUserIds: [supplier.id, learner.id],
      createdMaterialIds: [],
      createdReservationIds: [],
      createdLocationIds: [],
    };
  });

  after(async () => {
    await cleanup(ctx);
  });

  test('supplier accepts PICKUP using selected learner preferred window index -> ACCEPTED', async () => {
    const material = await createMaterial(ctx);
    const preferred = futurePreferredWindow();
    const reservation = await createReservation(
      ctx.learnerId,
      pickupReservationPayload(material.id, {
        learnerPreferredPickupWindows: [preferred],
      }),
    );
    ctx.createdReservationIds.push(reservation.id);

    const mismatchedStart = new Date(Date.now() + 48 * 3_600_000).toISOString();
    const mismatchedEnd = new Date(Date.now() + 50 * 3_600_000).toISOString();

    const accepted = await acceptSupplierReservation(ctx.supplierId, reservation.id, {
      pickupWindowStart: mismatchedStart,
      pickupWindowEnd: mismatchedEnd,
      selectedPreferredWindowIndex: 0,
    });

    assert.equal(accepted.status, 'ACCEPTED');
    assert.equal(accepted.pickupWindowStart, preferred.start);
    assert.equal(accepted.pickupWindowEnd, preferred.end);
  });

  test('supplier accepts PICKUP using learner preferred window -> ACCEPTED', async () => {
    const material = await createMaterial(ctx);
    const preferred = futurePreferredWindow();
    const reservation = await createReservation(
      ctx.learnerId,
      pickupReservationPayload(material.id, {
        learnerPreferredPickupWindows: [preferred],
      }),
    );
    ctx.createdReservationIds.push(reservation.id);

    const accepted = await acceptSupplierReservation(ctx.supplierId, reservation.id, {
      pickupWindowStart: preferred.start,
      pickupWindowEnd: preferred.end,
    });

    assert.equal(accepted.status, 'ACCEPTED');
    assert.equal(accepted.pickupWindowStart, preferred.start);
    assert.equal(accepted.pickupWindowEnd, preferred.end);
  });

  test('supplier proposes PICKUP outside learner windows -> AWAITING_LEARNER_CONFIRMATION', async () => {
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

    const accepted = await acceptSupplierReservation(ctx.supplierId, reservation.id, {
      pickupWindowStart: proposed.start,
      pickupWindowEnd: proposed.end,
    });

    assert.equal(accepted.status, 'AWAITING_LEARNER_CONFIRMATION');
    assert.equal(accepted.supplierProposedPickupWindowStart, proposed.start);
    assert.equal(accepted.supplierProposedPickupWindowEnd, proposed.end);
    assert.equal(accepted.pickupWindowStart, null);
  });

  test('old PICKUP reservation with null preferred windows still accepts normally', async () => {
    const material = await createMaterial(ctx);
    const reservation = await prisma.reservation.create({
      data: {
        materialId: material.id,
        requesterId: ctx.learnerId,
        ownerId: ctx.supplierId,
        quantityRequested: 1,
        status: 'PENDING',
        fulfillmentMethod: 'PICKUP',
        learnerPreferredPickupWindows: null,
      },
    });
    ctx.createdReservationIds.push(reservation.id);

    const proposed = futurePreferredWindow(24);
    const accepted = await acceptSupplierReservation(ctx.supplierId, reservation.id, {
      pickupWindowStart: proposed.start,
      pickupWindowEnd: proposed.end,
    });

    assert.equal(accepted.status, 'ACCEPTED');
    assert.equal(accepted.pickupWindowStart, proposed.start);
  });

  test('AWAITING_LEARNER_CONFIRMATION counts as active hold', async () => {
    const material = await createMaterial(ctx, { quantity: 2 });
    const preferred = futurePreferredWindow(48);
    const proposed = futurePreferredWindow(72);

    const reservation = await createReservation(
      ctx.learnerId,
      pickupReservationPayload(material.id, {
        quantityRequested: 1,
        learnerPreferredPickupWindows: [preferred],
      }),
    );
    ctx.createdReservationIds.push(reservation.id);

    await acceptSupplierReservation(ctx.supplierId, reservation.id, {
      pickupWindowStart: proposed.start,
      pickupWindowEnd: proposed.end,
    });

    const state = await getMaterialQuantityState(prisma, material.id);
    assert.equal(Number(state.heldQuantity), 1);
    assert.equal(Number(state.availableQuantity), 1);
  });

  test('supplier accepts DELIVERY with feasible learner delivery window -> ACCEPTED + confirmed delivery window', async () => {
    const material = await createMaterial(ctx, { deliveryAllowed: true });
    const supplierPickupStart = new Date(Date.now() + 24 * 3_600_000);
    const supplierPickupEnd = new Date(supplierPickupStart.getTime() + 2 * 3_600_000);
    const earliestDelivery = new Date(supplierPickupEnd.getTime() + 60 * 60_000);
    const learnerDeliveryStart = new Date(earliestDelivery.getTime() - 30 * 60_000);
    const learnerDeliveryEnd = new Date(earliestDelivery.getTime() + 3 * 3_600_000);

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

    const accepted = await acceptSupplierReservation(ctx.supplierId, reservation.id, {
      pickupWindowStart: supplierPickupStart.toISOString(),
      pickupWindowEnd: supplierPickupEnd.toISOString(),
    });

    assert.equal(accepted.status, 'ACCEPTED');
    assert.equal(accepted.supplierPickupWindowStart, supplierPickupStart.toISOString());
    assert.equal(accepted.confirmedDeliveryWindowStart, earliestDelivery.toISOString());
    assert.equal(accepted.confirmedDeliveryWindowEnd, learnerDeliveryEnd.toISOString());
    assert.equal(accepted.deliveryRequested, true);
    assert.ok(accepted.activeDelivery);
    assert.equal(accepted.activeDelivery?.status, 'WAITING_FOR_DRIVER');

    const deliveryCount = await prisma.delivery.count({
      where: { reservationId: reservation.id },
    });
    assert.equal(deliveryCount, 1);
  });

  test('supplier accepts DELIVERY with partial overlap -> trimmed confirmed delivery window', async () => {
    const material = await createMaterial(ctx, { deliveryAllowed: true });
    const supplierPickupStart = new Date(Date.now() + 24 * 3_600_000);
    const supplierPickupEnd = new Date(supplierPickupStart.getTime() + 2 * 3_600_000);
    const earliestDelivery = new Date(supplierPickupEnd.getTime() + 60 * 60_000);
    const learnerDeliveryStart = new Date(earliestDelivery.getTime() - 60 * 60_000);
    const learnerDeliveryEnd = new Date(earliestDelivery.getTime() + 3 * 3_600_000);

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

    const accepted = await acceptSupplierReservation(ctx.supplierId, reservation.id, {
      pickupWindowStart: supplierPickupStart.toISOString(),
      pickupWindowEnd: supplierPickupEnd.toISOString(),
    });

    assert.equal(accepted.status, 'ACCEPTED');
    assert.equal(accepted.confirmedDeliveryWindowStart, earliestDelivery.toISOString());
    assert.equal(accepted.confirmedDeliveryWindowEnd, learnerDeliveryEnd.toISOString());
  });

  test('supplier accepts DELIVERY with no feasible delivery window -> AWAITING_LEARNER_CONFIRMATION', async () => {
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

    const accepted = await acceptSupplierReservation(ctx.supplierId, reservation.id, {
      pickupWindowStart: supplierPickupStart.toISOString(),
      pickupWindowEnd: supplierPickupEnd.toISOString(),
    });

    assert.equal(accepted.status, 'AWAITING_LEARNER_CONFIRMATION');
    assert.ok(accepted.schedulingConflictReason);
    assert.equal(accepted.confirmedDeliveryWindowStart, null);

    const deliveryCount = await prisma.delivery.count({
      where: { reservationId: reservation.id },
    });
    assert.equal(deliveryCount, 0);
  });

  test('supplier reject still releases hold', async () => {
    const material = await createMaterial(ctx, { quantity: 2 });
    const reservation = await createReservation(
      ctx.learnerId,
      pickupReservationPayload(material.id, { quantityRequested: 1 }),
    );
    ctx.createdReservationIds.push(reservation.id);

    const beforeDecline = await getMaterialQuantityState(prisma, material.id);
    assert.equal(Number(beforeDecline.heldQuantity), 1);

    await declineSupplierReservation(ctx.supplierId, reservation.id, {
      reason: 'Unavailable',
    });

    const afterDecline = await getMaterialQuantityState(prisma, material.id);
    assert.equal(Number(afterDecline.heldQuantity), 0);
    assert.equal(Number(afterDecline.availableQuantity), 2);
  });
});
