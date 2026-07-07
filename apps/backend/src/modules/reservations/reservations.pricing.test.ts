import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import {
  calculateDeliveryPricing,
  classifyDeliveryZone,
} from '../delivery-pricing/delivery-pricing.service.js';
import {
  intersectWindows,
  windowsOverlap,
} from '../delivery-pricing/delivery-window-overlap.js';

import { createReservation, quoteReservation } from './reservations.service.js';
import type { CreateReservationInput } from './reservations.validation.js';

const TEST_MARKER = '[test-reservation-pricing]';

function futurePreferredWindow(hoursFromNow = 24, durationHours = 2) {
  const start = new Date(Date.now() + hoursFromNow * 3_600_000);
  const end = new Date(start.getTime() + durationHours * 3_600_000);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function pickupPayload(
  materialId: string,
  quantityRequested: number,
  overrides: Partial<CreateReservationInput> = {},
): CreateReservationInput {
  return {
    materialId,
    quantityRequested,
    fulfillmentMethod: 'PICKUP',
    learnerPreferredPickupWindows: [futurePreferredWindow()],
    ...overrides,
  };
}

function deliveryPayload(
  materialId: string,
  quantityRequested: number,
  dropoffCity: string,
  overrides: Partial<CreateReservationInput> = {},
): CreateReservationInput {
  return {
    materialId,
    quantityRequested,
    fulfillmentMethod: 'DELIVERY',
    learnerPreferredDeliveryWindows: [futurePreferredWindow()],
    deliveryAddressText: `12 Learner Street, ${dropoffCity}`,
    dropoffCity,
    safeDropoffAllowed: false,
    ...overrides,
  };
}

type TestContext = {
  learnerId: string;
  otherLearnerId: string;
  supplierId: string;
  categoryId: string;
  nablusLocationId: string;
  createdUserIds: string[];
  createdMaterialIds: string[];
  createdReservationIds: string[];
  createdGroupIds: string[];
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
      ...(input.role === 'LEARNER'
        ? {
            learnerProfile: {
              create: {
                learnerType: 'STUDENT',
                skillLevel: 'BEGINNER',
              },
            },
          }
        : {
            supplierProfile: {
              create: {
                supplierType: 'INDIVIDUAL_SUPPLIER',
                publicName: `${TEST_MARKER} supplier`,
                verificationStatus: 'VERIFIED',
              },
            },
          }),
    },
    select: { id: true },
  });
}

async function createMaterial(
  ctx: TestContext,
  options: {
    city?: string;
    isFree?: boolean;
    price?: number;
    quantity?: number;
    deliveryAllowed?: boolean;
  } = {},
) {
  const supplierProfile = await prisma.supplierProfile.findUnique({
    where: { userId: ctx.supplierId },
    select: { id: true },
  });

  const city = options.city ?? 'Nablus';
  const location =
    city === 'Nablus'
      ? { id: ctx.nablusLocationId }
      : await prisma.location.create({
          data: {
            country: city === 'Tel Aviv' ? 'Israel' : 'Palestine',
            city,
            area: TEST_MARKER,
            visibility: 'PUBLIC_APPROXIMATE',
            isApproximate: true,
          },
          select: { id: true },
        });

  const material = await prisma.material.create({
    data: {
      ownerId: ctx.supplierId,
      supplierProfileId: supplierProfile?.id,
      categoryId: ctx.categoryId,
      locationId: location.id,
      title: `${TEST_MARKER} material ${Date.now()}`,
      description: `${TEST_MARKER} material description`,
      materialType: 'Test material',
      quantity: options.quantity ?? 10,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'AVAILABLE',
      isFree: options.isFree ?? false,
      price: options.isFree ? null : (options.price ?? 5),
      deliveryAllowed: options.deliveryAllowed ?? true,
    },
    select: { id: true },
  });

  ctx.createdMaterialIds.push(material.id);
  return material;
}

async function cleanup(ctx: TestContext) {
  if (ctx.createdReservationIds.length) {
    await prisma.reservationStatusHistory.deleteMany({
      where: { reservationId: { in: ctx.createdReservationIds } },
    });
    await prisma.reservation.deleteMany({
      where: { id: { in: ctx.createdReservationIds } },
    });
  }

  if (ctx.createdGroupIds.length) {
    await prisma.deliveryGroup.deleteMany({
      where: { id: { in: ctx.createdGroupIds } },
    });
  }

  if (ctx.createdMaterialIds.length) {
    await prisma.material.deleteMany({
      where: { id: { in: ctx.createdMaterialIds } },
    });
  }

  await prisma.location.deleteMany({
    where: {
      area: TEST_MARKER,
      id: { not: ctx.nablusLocationId },
    },
  });

  if (ctx.nablusLocationId) {
    await prisma.location.deleteMany({ where: { id: ctx.nablusLocationId } });
  }

  if (ctx.createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: ctx.createdUserIds } } });
  }
}

describe('delivery pricing zones', () => {
  test('same city is 10 NIS', () => {
    const result = calculateDeliveryPricing({
      supplierPickupCity: 'Nablus',
      dropoffCity: 'Nablus',
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.zone, 'SAME_CITY');
      assert.equal(result.deliveryFee, 10);
    }
  });

  test('different West Bank city is 20 NIS', () => {
    const result = calculateDeliveryPricing({
      supplierPickupCity: 'Nablus',
      dropoffCity: 'Jenin',
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.zone, 'WEST_BANK');
      assert.equal(result.deliveryFee, 20);
    }
  });

  test('Jerusalem is 40 NIS', () => {
    const result = calculateDeliveryPricing({
      supplierPickupCity: 'Nablus',
      dropoffCity: 'Jerusalem',
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.zone, 'JERUSALEM');
      assert.equal(result.deliveryFee, 40);
    }
  });

  test('inside 48 is 60 NIS', () => {
    const result = calculateDeliveryPricing({
      supplierPickupCity: 'Nablus',
      dropoffCity: 'Tel Aviv',
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.zone, 'INSIDE_48');
      assert.equal(result.deliveryFee, 60);
    }
  });

  test('unknown location returns error', () => {
    const zone = classifyDeliveryZone({
      supplierPickupCity: 'Nablus',
      dropoffCity: 'Unknown City XYZ',
    });
    assert.equal(zone, 'UNKNOWN');
  });

  test('window overlap logic', () => {
    const existing = {
      start: new Date('2026-07-01T08:00:00.000Z'),
      end: new Date('2026-07-01T10:00:00.000Z'),
    };
    const candidate = {
      start: new Date('2026-07-01T09:00:00.000Z'),
      end: new Date('2026-07-01T11:00:00.000Z'),
    };

    assert.equal(windowsOverlap(existing, candidate), true);
    const shared = intersectWindows(existing, candidate);
    assert.ok(shared);
    assert.equal(shared!.start.toISOString(), '2026-07-01T09:00:00.000Z');
    assert.equal(shared!.end.toISOString(), '2026-07-01T10:00:00.000Z');
  });
});

describe('reservation pricing and grouping', () => {
  const ctx: TestContext = {
    learnerId: '',
    otherLearnerId: '',
    supplierId: '',
    categoryId: '',
    nablusLocationId: '',
    createdUserIds: [],
    createdMaterialIds: [],
    createdReservationIds: [],
    createdGroupIds: [],
  };

  before(async () => {
    const category = await prisma.category.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    assert.ok(category);

    const location = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: 'Nablus',
        area: TEST_MARKER,
        visibility: 'PUBLIC_APPROXIMATE',
        isApproximate: true,
      },
      select: { id: true },
    });

    const learner = await createUser({
      displayName: 'learner',
      emailSuffix: 'learner',
      role: 'LEARNER',
    });
    const otherLearner = await createUser({
      displayName: 'other',
      emailSuffix: 'other',
      role: 'LEARNER',
    });
    const supplier = await createUser({
      displayName: 'supplier',
      emailSuffix: 'supplier',
      role: 'SUPPLIER',
    });

    ctx.categoryId = category.id;
    ctx.nablusLocationId = location.id;
    ctx.learnerId = learner.id;
    ctx.otherLearnerId = otherLearner.id;
    ctx.supplierId = supplier.id;
    ctx.createdUserIds.push(learner.id, otherLearner.id, supplier.id);
  });

  after(async () => {
    await cleanup(ctx);
  });

  test('paid material subtotal and pickup has zero delivery fee', async () => {
    const material = await createMaterial(ctx, { isFree: false, price: 5 });
    const quote = await quoteReservation(
      ctx.learnerId,
      {
        materialId: material.id,
        quantity: 3,
        fulfillmentMethod: 'PICKUP',
      },
    );

    assert.equal(quote.unitPrice, 5);
    assert.equal(quote.materialSubtotal, 15);
    assert.equal(quote.deliveryFee, 0);
    assert.equal(quote.totalAmount, 15);

    const reservation = await createReservation(
      ctx.learnerId,
      pickupPayload(material.id, 3),
    );
    ctx.createdReservationIds.push(reservation.id);

    assert.equal(reservation.materialSubtotal, 15);
    assert.equal(reservation.deliveryFee, 0);
    assert.equal(reservation.totalAmount, 15);
  });

  test('free material subtotal is zero', async () => {
    const material = await createMaterial(ctx, { isFree: true });
    const quote = await quoteReservation(ctx.learnerId, {
      materialId: material.id,
      quantity: 2,
      fulfillmentMethod: 'PICKUP',
    });

    assert.equal(quote.unitPrice, 0);
    assert.equal(quote.materialSubtotal, 0);
    assert.equal(quote.totalAmount, 0);
  });

  test('same city delivery quote is 10 NIS', async () => {
    const material = await createMaterial(ctx);
    const quote = await quoteReservation(ctx.learnerId, {
      materialId: material.id,
      quantity: 1,
      fulfillmentMethod: 'DELIVERY',
      dropoffCity: 'Nablus',
      learnerPreferredDeliveryWindows: [futurePreferredWindow()],
    });

    assert.equal(quote.deliveryZone, 'SAME_CITY');
    assert.equal(quote.deliveryFee, 10);
    assert.equal(quote.totalAmount, 15);
  });

  test('different West Bank city delivery is 20 NIS', async () => {
    const material = await createMaterial(ctx);
    const quote = await quoteReservation(ctx.learnerId, {
      materialId: material.id,
      quantity: 1,
      fulfillmentMethod: 'DELIVERY',
      dropoffCity: 'Jenin',
      learnerPreferredDeliveryWindows: [futurePreferredWindow()],
    });

    assert.equal(quote.deliveryZone, 'WEST_BANK');
    assert.equal(quote.deliveryFee, 20);
  });

  test('Jerusalem delivery is 40 NIS', async () => {
    const material = await createMaterial(ctx);
    const quote = await quoteReservation(ctx.learnerId, {
      materialId: material.id,
      quantity: 1,
      fulfillmentMethod: 'DELIVERY',
      dropoffCity: 'Jerusalem',
      learnerPreferredDeliveryWindows: [futurePreferredWindow()],
    });

    assert.equal(quote.deliveryZone, 'JERUSALEM');
    assert.equal(quote.deliveryFee, 40);
  });

  test('inside 48 delivery is 60 NIS', async () => {
    const material = await createMaterial(ctx);
    const quote = await quoteReservation(ctx.learnerId, {
      materialId: material.id,
      quantity: 1,
      fulfillmentMethod: 'DELIVERY',
      dropoffCity: 'Tel Aviv',
      learnerPreferredDeliveryWindows: [futurePreferredWindow()],
    });

    assert.equal(quote.deliveryZone, 'INSIDE_48');
    assert.equal(quote.deliveryFee, 60);
  });

  test('price snapshot does not change after material price update', async () => {
    const material = await createMaterial(ctx, { isFree: false, price: 5 });
    const reservation = await createReservation(
      ctx.learnerId,
      pickupPayload(material.id, 2),
    );
    ctx.createdReservationIds.push(reservation.id);

    await prisma.material.update({
      where: { id: material.id },
      data: { price: 7 },
    });

    const stored = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
      select: { materialSubtotal: true, unitPriceAtReservation: true },
    });

    assert.equal(Number(stored.unitPriceAtReservation), 5);
    assert.equal(Number(stored.materialSubtotal), 10);
  });

  test('decimal quantity calculates correctly', async () => {
    const material = await createMaterial(ctx, {
      isFree: false,
      price: 2.5,
      quantity: 5,
    });

    await prisma.material.update({
      where: { id: material.id },
      data: { unit: 'kg' },
    });

    const quote = await quoteReservation(ctx.learnerId, {
      materialId: material.id,
      quantity: 1.5,
      fulfillmentMethod: 'PICKUP',
    });

    assert.equal(quote.materialSubtotal, 3.75);
  });

  test('grouped delivery charges one delivery fee', async () => {
    const window = futurePreferredWindow(30, 2);
    const materialA = await createMaterial(ctx, { isFree: false, price: 5 });
    const materialB = await createMaterial(ctx, { isFree: false, price: 4 });

    const first = await createReservation(
      ctx.learnerId,
      deliveryPayload(materialA.id, 3, 'Nablus', {
        learnerPreferredDeliveryWindows: [window],
      }),
    );
    ctx.createdReservationIds.push(first.id);
    if (first.deliveryGroupId) {
      ctx.createdGroupIds.push(first.deliveryGroupId);
    }

    assert.equal(first.deliveryFee, 10);
    assert.equal(first.totalAmount, 25);

    const quote = await quoteReservation(ctx.learnerId, {
      materialId: materialB.id,
      quantity: 2,
      fulfillmentMethod: 'DELIVERY',
      dropoffCity: 'Nablus',
      learnerPreferredDeliveryWindows: [
        {
          start: window.start,
          end: new Date(
            new Date(window.end).getTime() + 30 * 60_000,
          ).toISOString(),
        },
      ],
      combineWithDeliveryGroupId: first.deliveryGroupId!,
    });

    assert.equal(quote.groupingApplied, true);
    assert.equal(quote.deliveryFee, 0);
    assert.equal(quote.totalAmount, 8);

    const second = await createReservation(
      ctx.learnerId,
      deliveryPayload(materialB.id, 2, 'Nablus', {
        learnerPreferredDeliveryWindows: quote.deliveryGroupCandidate
          ? [
              {
                start: window.start,
                end: new Date(
                  new Date(window.end).getTime() + 30 * 60_000,
                ).toISOString(),
              },
            ]
          : [window],
        combineWithDeliveryGroupId: first.deliveryGroupId!,
      }),
    );
    ctx.createdReservationIds.push(second.id);

    assert.equal(second.deliveryFee, 0);
    assert.equal(second.groupedDelivery, true);
    assert.equal(second.deliveryGroupId, first.deliveryGroupId);
  });

  test('non-overlapping windows do not offer grouping', async () => {
    const materialA = await createMaterial(ctx);
    const materialB = await createMaterial(ctx);

    const first = await createReservation(
      ctx.learnerId,
      deliveryPayload(materialA.id, 1, 'Nablus', {
        learnerPreferredDeliveryWindows: [futurePreferredWindow(48, 2)],
      }),
    );
    ctx.createdReservationIds.push(first.id);
    if (first.deliveryGroupId) {
      ctx.createdGroupIds.push(first.deliveryGroupId);
    }

    const quote = await quoteReservation(ctx.learnerId, {
      materialId: materialB.id,
      quantity: 1,
      fulfillmentMethod: 'DELIVERY',
      dropoffCity: 'Nablus',
      learnerPreferredDeliveryWindows: [futurePreferredWindow(72, 2)],
    });

    assert.equal(quote.groupingAvailable, false);
    assert.equal(quote.deliveryGroupCandidate, null);
  });

  test('pickup reservations are not grouped', async () => {
    const material = await createMaterial(ctx);
    const reservation = await createReservation(
      ctx.learnerId,
      pickupPayload(material.id, 1),
    );
    ctx.createdReservationIds.push(reservation.id);

    assert.equal(reservation.deliveryGroupId, null);
    assert.equal(reservation.groupedDelivery, false);
  });
});
