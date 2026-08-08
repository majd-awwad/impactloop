import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { createNoShowReportOnce } from './no-show-report.create.js';

const TEST_MARKER = '[test-no-show-report-concurrency]';

type TestContext = {
  supplierId: string;
  learnerId: string;
  categoryId: string;
  locationId: string;
  createdReservationIds: string[];
  createdMaterialIds: string[];
  createdUserIds: string[];
};

async function createAcceptedPickupReservation(ctx: TestContext) {
  const pickupWindowEnd = new Date(Date.now() - (31 * 60 + 5) * 1000);
  const material = await prisma.material.create({
    data: {
      ownerId: ctx.supplierId,
      categoryId: ctx.categoryId,
      locationId: ctx.locationId,
      title: `${TEST_MARKER} material ${Date.now()}`,
      description: 'No-show concurrency test material',
      materialType: 'Test',
      quantity: 3,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'RESERVED',
    },
  });
  ctx.createdMaterialIds.push(material.id);

  const start = new Date(pickupWindowEnd.getTime() - 3_600_000);
  const reservation = await prisma.reservation.create({
    data: {
      materialId: material.id,
      requesterId: ctx.learnerId,
      ownerId: ctx.supplierId,
      quantityRequested: 1,
      status: 'ACCEPTED',
      fulfillmentMethod: 'PICKUP',
      pickupWindowStart: start,
      pickupWindowEnd,
      acceptedAt: start,
    },
  });
  ctx.createdReservationIds.push(reservation.id);

  return reservation;
}

async function cleanup(ctx: TestContext) {
  if (ctx.createdReservationIds.length) {
    await prisma.noShowReport.deleteMany({
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

const createIncidentReport = (input: {
  reservationId: string;
  reporterUserId: string;
  targetUserId: string;
  pickupWindowStart: Date;
  pickupWindowEnd: Date;
}) =>
  prisma.$transaction((tx) =>
    createNoShowReportOnce(tx, {
      key: {
        reservationId: input.reservationId,
        deliveryId: null,
        targetRole: 'LEARNER',
        targetUserId: input.targetUserId,
        reasonCode: 'LEARNER_DID_NOT_ARRIVE',
      },
      data: {
        reservationId: input.reservationId,
        reporterUserId: input.reporterUserId,
        targetUserId: input.targetUserId,
        targetRole: 'LEARNER',
        reasonCode: 'LEARNER_DID_NOT_ARRIVE',
        note: 'Concurrent no-show report',
        pickupWindowStart: input.pickupWindowStart,
        pickupWindowEnd: input.pickupWindowEnd,
      },
    }),
  );

describe('no-show report create concurrency', () => {
  let ctx: TestContext;

  before(async () => {
    process.env.NODE_ENV = 'test';
    await prisma.$connect();

    const category = await prisma.category.findFirst({
      where: { categoryType: { in: ['MATERIAL', 'BOTH'] } },
      select: { id: true },
    });
    assert.ok(category);

    const location = await prisma.location.create({
      data: {
        country: 'PS',
        city: 'Ramallah',
        area: `${TEST_MARKER} area`,
      },
    });

    const passwordHash = await hashPassword('TestPassword123!');
    const supplier = await prisma.user.create({
      data: {
        displayName: `${TEST_MARKER} supplier`,
        email: `${TEST_MARKER}-supplier-${Date.now()}@impactloop.test`,
        passwordHash,
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        activeRole: 'SUPPLIER',
        roles: { create: [{ role: 'SUPPLIER', isPrimary: true }] },
        supplierProfile: {
          create: {
            businessName: `${TEST_MARKER} supplier`,
            verificationStatus: 'VERIFIED',
          },
        },
      },
    });
    const learner = await prisma.user.create({
      data: {
        displayName: `${TEST_MARKER} learner`,
        email: `${TEST_MARKER}-learner-${Date.now()}@impactloop.test`,
        passwordHash,
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        activeRole: 'LEARNER',
        roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
        learnerProfile: {
          create: { learnerType: 'STUDENT', skillLevel: 'BEGINNER' },
        },
      },
    });

    ctx = {
      supplierId: supplier.id,
      learnerId: learner.id,
      categoryId: category.id,
      locationId: location.id,
      createdReservationIds: [],
      createdMaterialIds: [],
      createdUserIds: [supplier.id, learner.id],
    };
  });

  after(async () => {
    await cleanup(ctx);
    await prisma.$disconnect();
  });

  test('incidentKey uniqueness prevents duplicate no-show reports under concurrency', async () => {
    const reservation = await createAcceptedPickupReservation(ctx);

    const [first, second] = await Promise.all([
      createIncidentReport({
        reservationId: reservation.id,
        reporterUserId: ctx.supplierId,
        targetUserId: ctx.learnerId,
        pickupWindowStart: reservation.pickupWindowStart!,
        pickupWindowEnd: reservation.pickupWindowEnd!,
      }),
      createIncidentReport({
        reservationId: reservation.id,
        reporterUserId: ctx.supplierId,
        targetUserId: ctx.learnerId,
        pickupWindowStart: reservation.pickupWindowStart!,
        pickupWindowEnd: reservation.pickupWindowEnd!,
      }),
    ]);

    const createdCount = [first, second].filter((result) => result.created).length;
    const duplicateCount = [first, second].filter((result) => !result.created).length;

    assert.equal(createdCount, 1);
    assert.equal(duplicateCount, 1);
    assert.equal(first.report.id, second.report.id);

    const reportCount = await prisma.noShowReport.count({
      where: { reservationId: reservation.id },
    });
    assert.equal(reportCount, 1);
  });
});
