import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { deriveHandoverCode } from '../../utils/handover-codes.js';
import { hashPassword } from '../../utils/password.js';
import { aggregateSupplierReviews } from '../supplier/supplier.repository.js';
import {
  acceptSupplierReservation,
  completeSupplierReservation,
} from '../supplier-reservations/supplier-reservations.service.js';

import {
  deleteReservationReviewForLearner,
  upsertReservationReviewForLearner,
} from './reservation-reviews.service.js';
import { createReservation, getMyReservationById } from './reservations.service.js';
import type { CreateReservationInput } from './reservations.validation.js';

const TEST_MARKER = '[test-reservation-reviews]';

function futurePreferredWindow(hoursFromNow = 24, durationHours = 2) {
  const start = new Date(Date.now() + hoursFromNow * 3_600_000);
  const end = new Date(start.getTime() + durationHours * 3_600_000);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

type TestContext = {
  learnerId: string;
  supplierId: string;
  categoryId: string;
  locationId: string;
  createdUserIds: string[];
  createdMaterialIds: string[];
  createdReservationIds: string[];
};

async function createCompletedPickupReservation(ctx: TestContext) {
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
      quantity: 3,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'AVAILABLE',
      isFree: true,
      deliveryAllowed: false,
    },
    select: { id: true },
  });
  ctx.createdMaterialIds.push(material.id);

  const reservation = await createReservation(ctx.learnerId, {
    materialId: material.id,
    quantityRequested: 1,
    fulfillmentMethod: 'PICKUP',
    learnerPreferredPickupWindows: [futurePreferredWindow()],
  } satisfies CreateReservationInput);
  ctx.createdReservationIds.push(reservation.id);

  const window = reservation.learnerPreferredPickupWindows[0];
  assert.ok(window);

  await acceptSupplierReservation(ctx.supplierId, reservation.id, {
    pickupWindowStart: window.start,
    pickupWindowEnd: window.end,
    selectedPreferredWindowIndex: 0,
  });

  await prisma.reservation.update({
    where: { id: reservation.id },
    data: {
      pickupWindowStart: new Date(Date.now() - 15 * 60_000),
      pickupWindowEnd: new Date(Date.now() + 60 * 60_000),
    },
  });

  await completeSupplierReservation(ctx.supplierId, reservation.id, {
    confirmationCode: deriveHandoverCode('self-pickup', reservation.id),
  });

  return reservation;
}

async function cleanup(ctx: TestContext) {
  if (ctx.createdReservationIds.length) {
    await prisma.review.deleteMany({
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

describe('reservation reviews', () => {
  let ctx: TestContext;

  before(async () => {
    const category = await prisma.category.findFirst({ select: { id: true } });
    const location = await prisma.location.findFirst({ select: { id: true } });
    assert.ok(category);
    assert.ok(location);

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
        learnerProfile: { create: {} },
      },
      select: { id: true },
    });

    ctx = {
      learnerId: learner.id,
      supplierId: supplier.id,
      categoryId: category.id,
      locationId: location.id,
      createdUserIds: [learner.id, supplier.id],
      createdMaterialIds: [],
      createdReservationIds: [],
    };
  });

  after(async () => {
    await cleanup(ctx);
  });

  test('learner can review supplier after completed pickup reservation', async () => {
    const reservation = await createCompletedPickupReservation(ctx);

    const beforeAggregate = await aggregateSupplierReviews(ctx.supplierId);
    assert.equal(beforeAggregate._count._all, 0);

    const saved = await upsertReservationReviewForLearner(
      ctx.learnerId,
      reservation.id,
      {
        targetType: 'SUPPLIER',
        rating: 5,
        comment: 'Great pickup experience.',
      },
    );

    assert.equal(saved.review.targetType, 'SUPPLIER');
    assert.equal(saved.review.rating, 5);
    assert.equal(saved.reviews.supplier.review?.rating, 5);

    const detail = await getMyReservationById(ctx.learnerId, reservation.id);
    assert.equal(detail.reviews?.supplier.review?.rating, 5);

    const aggregate = await aggregateSupplierReviews(ctx.supplierId);
    assert.equal(aggregate._count._all, 1);
    assert.equal(aggregate._avg.rating, 5);

    await deleteReservationReviewForLearner(
      ctx.learnerId,
      reservation.id,
      'SUPPLIER',
    );

    const afterDelete = await getMyReservationById(ctx.learnerId, reservation.id);
    assert.equal(afterDelete.reviews?.supplier.review, null);
  });

  test('review is rejected before reservation completion', async () => {
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
        title: `${TEST_MARKER} pending material ${Date.now()}`,
        description: `${TEST_MARKER} pending material`,
        materialType: 'Test material',
        quantity: 2,
        unit: 'piece',
        condition: 'GOOD',
        sourceType: 'WORKSHOP_SURPLUS',
        status: 'AVAILABLE',
        isFree: true,
      },
      select: { id: true },
    });
    ctx.createdMaterialIds.push(material.id);

    const reservation = await createReservation(ctx.learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
      learnerPreferredPickupWindows: [futurePreferredWindow()],
    } satisfies CreateReservationInput);
    ctx.createdReservationIds.push(reservation.id);

    await assert.rejects(
      () =>
        upsertReservationReviewForLearner(ctx.learnerId, reservation.id, {
          targetType: 'SUPPLIER',
          rating: 4,
          comment: null,
        }),
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes('Only completed reservations can be reviewed.'),
    );
  });
});
