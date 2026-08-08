import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { getMaterialById } from '../materials/materials.service.js';
import {
  completeSupplierReservation,
  listSupplierReservations,
} from '../supplier-reservations/supplier-reservations.service.js';

import {
  isAcceptedMissedPickupExpired,
  resolveMissedPickupAutoCloseDeadline,
} from './reservation-missed-pickup-expiry.js';
import {
  MISSED_PICKUP_AUTO_CLOSE_GRACE_HOURS,
  MISSED_PICKUP_EXPIRY_REASON,
} from './reservation-timing-policy.js';
import {
  createReservation,
  getMyReservationById,
  listMyReservations,
} from './reservations.service.js';
import { expireStaleMissedPickupsByIds } from './reservations.missed-pickup-expiry.repository.js';
import type { CreateReservationInput } from './reservations.validation.js';

const TEST_MARKER = '[test-reservation-missed-pickup-expiry]';

type TestContext = {
  learnerId: string;
  supplierId: string;
  categoryId: string;
  locationId: string;
  createdUserIds: string[];
  createdMaterialIds: string[];
  createdReservationIds: string[];
};

function pickupReservationPayload(
  materialId: string,
  quantityRequested: number,
): CreateReservationInput {
  const start = new Date(Date.now() + 24 * 3_600_000);
  const end = new Date(start.getTime() + 2 * 3_600_000);

  return {
    materialId,
    quantityRequested,
    fulfillmentMethod: 'PICKUP',
    learnerPreferredPickupWindows: [
      { start: start.toISOString(), end: end.toISOString() },
    ],
  };
}

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

async function createMaterial(ctx: TestContext, quantity = 5) {
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
      description: 'Missed pickup expiry test material',
      materialType: 'Test material',
      quantity,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'RESERVED',
    },
    select: { id: true },
  });

  ctx.createdMaterialIds.push(material.id);
  return material;
}

async function createStaleAcceptedPickupReservation(
  ctx: TestContext,
  input: { hoursPastGrace: number; quantityRequested?: number },
) {
  const material = await createMaterial(ctx);
  const reservation = await createReservation(
    ctx.learnerId,
    pickupReservationPayload(material.id, input.quantityRequested ?? 1),
  );
  ctx.createdReservationIds.push(reservation.id);

  const pickupWindowEnd = new Date(
    Date.now() -
      (MISSED_PICKUP_AUTO_CLOSE_GRACE_HOURS + input.hoursPastGrace) *
        3_600_000,
  );
  const pickupWindowStart = new Date(
    pickupWindowEnd.getTime() - 2 * 3_600_000,
  );

  await prisma.reservation.update({
    where: { id: reservation.id },
    data: {
      status: 'ACCEPTED',
      pickupWindowStart,
      pickupWindowEnd,
      acceptedAt: pickupWindowStart,
    },
  });

  return { material, reservation };
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

  if (ctx.createdMaterialIds.length) {
    await prisma.material.deleteMany({
      where: { id: { in: ctx.createdMaterialIds } },
    });
  }

  if (ctx.locationId) {
    await prisma.location.deleteMany({ where: { id: ctx.locationId } });
  }

  if (ctx.createdUserIds.length) {
    await prisma.user.deleteMany({
      where: { id: { in: ctx.createdUserIds } },
    });
  }
}

describe('accepted missed pickup expiry', () => {
  const ctx: TestContext = {
    learnerId: '',
    supplierId: '',
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
        area: `${TEST_MARKER}-area`,
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
    const supplier = await createUser({
      displayName: 'supplier',
      emailSuffix: 'supplier',
      role: 'SUPPLIER',
    });

    ctx.categoryId = category.id;
    ctx.locationId = location.id;
    ctx.learnerId = learner.id;
    ctx.supplierId = supplier.id;
    ctx.createdUserIds.push(learner.id, supplier.id);
  });

  after(async () => {
    await cleanup(ctx);
    await prisma.$disconnect();
  });

  test('resolveMissedPickupAutoCloseDeadline adds grace hours after pickup end', () => {
    const pickupWindowEnd = new Date('2026-01-01T10:00:00.000Z');
    const deadline = resolveMissedPickupAutoCloseDeadline(pickupWindowEnd);

    assert.equal(
      deadline.toISOString(),
      new Date('2026-01-04T10:00:00.000Z').toISOString(),
    );
  });

  test('accepted pickup inside grace period is not auto-expired', () => {
    const pickupWindowEnd = new Date(
      Date.now() - (MISSED_PICKUP_AUTO_CLOSE_GRACE_HOURS - 1) * 3_600_000,
    );

    assert.equal(
      isAcceptedMissedPickupExpired({
        status: 'ACCEPTED',
        fulfillmentMethod: 'PICKUP',
        pickupWindowEnd,
        deliveryCount: 0,
      }),
      false,
    );
  });

  test('expiring stale accepted pickup releases hold and stores reason', async () => {
    const { material, reservation } = await createStaleAcceptedPickupReservation(
      ctx,
      { hoursPastGrace: 2, quantityRequested: 2 },
    );

    await expireStaleMissedPickupsByIds([reservation.id], ctx.learnerId);

    const row = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    assert.equal(row.status, 'EXPIRED');
    assert.equal(row.rejectionReason, MISSED_PICKUP_EXPIRY_REASON);

    const detail = await getMaterialById(material.id);
    assert.equal(detail.availableQuantity, 5);
  });

  test('listMyReservations auto-expires missed pickup reservations', async () => {
    const { reservation } = await createStaleAcceptedPickupReservation(ctx, {
      hoursPastGrace: 1,
    });

    const listed = await listMyReservations(ctx.learnerId);
    const item = listed.find((entry) => entry.id === reservation.id);

    assert.ok(item);
    assert.equal(item?.status, 'EXPIRED');
    assert.equal(item?.rejectionReason, MISSED_PICKUP_EXPIRY_REASON);
  });

  test('getMyReservationById auto-expires missed pickup reservation', async () => {
    const { reservation } = await createStaleAcceptedPickupReservation(ctx, {
      hoursPastGrace: 1,
    });

    const loaded = await getMyReservationById(ctx.learnerId, reservation.id);
    assert.equal(loaded.status, 'EXPIRED');
    assert.equal(loaded.rejectionReason, MISSED_PICKUP_EXPIRY_REASON);
  });

  test('supplier cannot complete after missed pickup auto-expiry', async () => {
    const { reservation } = await createStaleAcceptedPickupReservation(ctx, {
      hoursPastGrace: 1,
    });

    await assert.rejects(
      () =>
        completeSupplierReservation(ctx.supplierId, reservation.id, {
          confirmationCode: '123456',
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        return true;
      },
    );

    const row = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    assert.equal(row.status, 'EXPIRED');
  });
});
