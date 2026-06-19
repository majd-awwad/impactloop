import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';

import { completeSupplierReservation } from './supplier-reservations.service.js';

const TEST_MARKER = '[test-complete-pickup]';

type TestContext = {
  supplierId: string;
  otherSupplierId: string;
  learnerId: string;
  categoryId: string;
  locationId: string;
  createdReservationIds: string[];
  createdMaterialIds: string[];
  createdUserIds: string[];
};

async function createReservation(
  ctx: TestContext,
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED',
  ownerId = ctx.supplierId,
) {
  const material = await prisma.material.create({
    data: {
      ownerId,
      categoryId: ctx.categoryId,
      locationId: ctx.locationId,
      title: `${TEST_MARKER} material ${Date.now()}`,
      description: 'Test material for complete pickup',
      materialType: 'Test',
      quantity: 1,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'AVAILABLE',
    },
  });
  ctx.createdMaterialIds.push(material.id);

  const now = new Date();
  const reservation = await prisma.reservation.create({
    data: {
      materialId: material.id,
      requesterId: ctx.learnerId,
      ownerId,
      quantityRequested: 1,
      status,
      message: TEST_MARKER,
      pickupWindowStart:
        status === 'ACCEPTED' || status === 'COMPLETED' ? now : undefined,
      pickupWindowEnd:
        status === 'ACCEPTED' || status === 'COMPLETED'
          ? new Date(now.getTime() + 3_600_000)
          : undefined,
      acceptedAt:
        status === 'ACCEPTED' || status === 'COMPLETED' ? now : undefined,
      completedAt: status === 'COMPLETED' ? now : undefined,
      rejectedAt: status === 'REJECTED' ? now : undefined,
    },
  });
  ctx.createdReservationIds.push(reservation.id);

  return { reservation, material };
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

  if (ctx.createdUserIds.length) {
    await prisma.user.deleteMany({
      where: { id: { in: ctx.createdUserIds } },
    });
  }
}

describe('completeSupplierReservation', () => {
  let ctx: TestContext;

  before(async () => {
    const category = await prisma.category.findFirst({ select: { id: true } });
    const location = await prisma.location.findFirst({ select: { id: true } });
    const learner = await prisma.user.findFirst({
      where: { roles: { some: { role: 'LEARNER' } } },
      select: { id: true },
    });

    assert.ok(category, 'category required for tests');
    assert.ok(location, 'location required for tests');
    assert.ok(learner, 'learner required for tests');

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
            publicName: 'Test Supplier',
            verificationStatus: 'VERIFIED',
          },
        },
      },
      select: { id: true },
    });

    const otherSupplier = await prisma.user.create({
      data: {
        displayName: `${TEST_MARKER} other supplier`,
        email: `${TEST_MARKER}-other-${Date.now()}@impactloop.test`,
        passwordHash,
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        roles: { create: [{ role: 'SUPPLIER', isPrimary: true }] },
        supplierProfile: {
          create: {
            supplierType: 'INDIVIDUAL_SUPPLIER',
            publicName: 'Other Supplier',
            verificationStatus: 'VERIFIED',
          },
        },
      },
      select: { id: true },
    });

    ctx = {
      supplierId: supplier.id,
      otherSupplierId: otherSupplier.id,
      learnerId: learner.id,
      categoryId: category.id,
      locationId: location.id,
      createdReservationIds: [],
      createdMaterialIds: [],
      createdUserIds: [supplier.id, otherSupplier.id],
    };
  });

  after(async () => {
    await cleanup(ctx);
    await prisma.$disconnect();
  });

  test('supplier can complete own accepted reservation', async () => {
    const { reservation, material } = await createReservation(ctx, 'ACCEPTED');

    const result = await completeSupplierReservation(
      ctx.supplierId,
      reservation.id,
    );

    assert.equal(result.status, 'COMPLETED');
    assert.ok(result.completedAt);

    const updatedReservation = await prisma.reservation.findUnique({
      where: { id: reservation.id },
    });
    assert.equal(updatedReservation?.status, 'COMPLETED');
    assert.ok(updatedReservation?.completedAt);

    const updatedMaterial = await prisma.material.findUnique({
      where: { id: material.id },
    });
    assert.equal(updatedMaterial?.status, 'REUSED');
    assert.ok(updatedMaterial?.reusedAt);
    assert.equal(updatedMaterial?.reusedByReservationId, reservation.id);

    const history = await prisma.reservationStatusHistory.findFirst({
      where: {
        reservationId: reservation.id,
        oldStatus: 'ACCEPTED',
        newStatus: 'COMPLETED',
      },
    });
    assert.ok(history);
    assert.equal(history?.changedBy, ctx.supplierId);
  });

  test('supplier cannot complete another supplier reservation', async () => {
    const { reservation } = await createReservation(
      ctx,
      'ACCEPTED',
      ctx.otherSupplierId,
    );

    await assert.rejects(
      () => completeSupplierReservation(ctx.supplierId, reservation.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
  });

  test('cannot complete pending reservation', async () => {
    const { reservation } = await createReservation(ctx, 'PENDING');

    await assert.rejects(
      () => completeSupplierReservation(ctx.supplierId, reservation.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        return true;
      },
    );
  });

  test('cannot complete rejected reservation', async () => {
    const { reservation } = await createReservation(ctx, 'REJECTED');

    await assert.rejects(
      () => completeSupplierReservation(ctx.supplierId, reservation.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        return true;
      },
    );
  });
});
