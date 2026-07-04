import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { getMaterialById } from '../materials/materials.service.js';

import {
  isPendingReservationExpired,
  resolvePendingReservationDeadline,
} from './reservation-pending-expiry.js';
import {
  createReservation,
  getMyReservationById,
  listMyReservations,
} from './reservations.service.js';
import { expireStalePendingReservationsByIds } from './reservations.pending-expiry.repository.js';
import { PENDING_RESERVATION_FALLBACK_HOURS } from './reservation-timing-policy.js';
import type { CreateReservationInput } from './reservations.validation.js';

const TEST_MARKER = '[test-reservation-pending-expiry]';

type TestContext = {
  learnerId: string;
  supplierId: string;
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

function pastPreferredWindow(hoursAgoEnd = 1, durationHours = 2) {
  const end = new Date(Date.now() - hoursAgoEnd * 3_600_000);
  const start = new Date(end.getTime() - durationHours * 3_600_000);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function pickupReservationPayload(
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
      description: 'Pending expiry test material',
      materialType: 'Test material',
      quantity,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'AVAILABLE',
      isFree: true,
    },
    select: { id: true },
  });

  ctx.createdMaterialIds.push(material.id);
  return material;
}

async function createDuePendingReservation(
  ctx: TestContext,
  quantityRequested: number,
) {
  const material = await createMaterial(ctx);
  const reservation = await createReservation(
    ctx.learnerId,
    pickupReservationPayload(material.id, quantityRequested),
  );
  ctx.createdReservationIds.push(reservation.id);

  await prisma.reservation.update({
    where: { id: reservation.id },
    data: {
      learnerPreferredPickupWindows: [pastPreferredWindow()],
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

describe('reservation pending expiry', () => {
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

  test('uses latest preferred window end as expiry deadline', () => {
    const createdAt = new Date('2026-01-01T10:00:00.000Z');
    const deadline = resolvePendingReservationDeadline({
      status: 'PENDING',
      fulfillmentMethod: 'PICKUP',
      learnerPreferredPickupWindows: [
        { start: '2026-01-02T08:00:00.000Z', end: '2026-01-02T10:00:00.000Z' },
        { start: '2026-01-03T08:00:00.000Z', end: '2026-01-03T12:00:00.000Z' },
      ],
      learnerPreferredDeliveryWindows: null,
      createdAt,
    });

    assert.equal(deadline.toISOString(), '2026-01-03T12:00:00.000Z');
    assert.equal(
      isPendingReservationExpired(
        {
          status: 'PENDING',
          fulfillmentMethod: 'PICKUP',
          learnerPreferredPickupWindows: [
            { start: '2026-01-02T08:00:00.000Z', end: '2026-01-02T10:00:00.000Z' },
            { start: '2026-01-03T08:00:00.000Z', end: '2026-01-03T12:00:00.000Z' },
          ],
          learnerPreferredDeliveryWindows: null,
          createdAt,
        },
        new Date('2026-01-03T12:00:01.000Z'),
      ),
      true,
    );
  });

  test('falls back to createdAt plus 72 hours when windows are missing', () => {
    const createdAt = new Date('2026-01-01T10:00:00.000Z');
    const deadline = resolvePendingReservationDeadline({
      status: 'PENDING',
      fulfillmentMethod: 'PICKUP',
      learnerPreferredPickupWindows: null,
      learnerPreferredDeliveryWindows: null,
      createdAt,
    });

    assert.equal(
      deadline.getTime(),
      createdAt.getTime() + PENDING_RESERVATION_FALLBACK_HOURS * 60 * 60 * 1000,
    );
  });

  test('expiring stale pending reservation releases hold and updates material availability', async () => {
    const { material, reservation } = await createDuePendingReservation(ctx, 2);

    await expireStalePendingReservationsByIds([reservation.id], ctx.learnerId);

    const row = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    assert.equal(row.status, 'EXPIRED');

    const detail = await getMaterialById(material.id);
    assert.equal(detail.availableQuantity, 5);
  });

  test('listMyReservations auto-expires due pending reservations', async () => {
    const { reservation } = await createDuePendingReservation(ctx, 1);

    const listed = await listMyReservations(ctx.learnerId);
    const item = listed.find((entry) => entry.id === reservation.id);

    assert.ok(item);
    assert.equal(item?.status, 'EXPIRED');
  });

  test('getMyReservationById auto-expires due pending reservation', async () => {
    const { reservation } = await createDuePendingReservation(ctx, 1);

    const loaded = await getMyReservationById(ctx.learnerId, reservation.id);
    assert.equal(loaded.status, 'EXPIRED');
  });

  test('future pending reservation stays pending on read', async () => {
    const material = await createMaterial(ctx);
    const reservation = await createReservation(
      ctx.learnerId,
      pickupReservationPayload(material.id, 1),
    );
    ctx.createdReservationIds.push(reservation.id);

    const loaded = await getMyReservationById(ctx.learnerId, reservation.id);
    assert.equal(loaded.status, 'PENDING');
  });

  test('learner can create a new reservation after previous pending expired', async () => {
    const { material, reservation: expired } = await createDuePendingReservation(
      ctx,
      1,
    );

    await expireStalePendingReservationsByIds([expired.id], ctx.learnerId);

    const replacement = await createReservation(
      ctx.learnerId,
      pickupReservationPayload(material.id, 1),
    );
    ctx.createdReservationIds.push(replacement.id);

    assert.equal(replacement.status, 'PENDING');
  });
});
