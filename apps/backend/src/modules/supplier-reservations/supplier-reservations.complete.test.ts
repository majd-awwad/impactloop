import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import type { DeliveryStatus } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';

import { completeSupplierReservation } from './supplier-reservations.service.js';
import {
  acceptSupplierReservation,
  declineSupplierReservation,
  listSupplierReservations,
} from './supplier-reservations.service.js';
import { deriveHandoverCode } from '../../utils/handover-codes.js';
import { safeSupplierAcceptPickupWindow } from '../../test-utils/handover-test-windows.js';

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

async function createDelivery(
  ctx: TestContext,
  reservationId: string,
  status: DeliveryStatus,
  requestedAt = new Date(),
) {
  return prisma.delivery.create({
    data: {
      reservationId,
      pickupLocationId: ctx.locationId,
      dropoffLocationId: ctx.locationId,
      requestedByUserId: ctx.learnerId,
      status,
      requestedAt,
    },
  });
}

async function cleanup(ctx: TestContext) {
  if (ctx.createdReservationIds.length) {
    await prisma.paymentOrder.deleteMany({
      where: { reservationId: { in: ctx.createdReservationIds } },
    });
    await prisma.deliveryLocationPing.deleteMany({
      where: { delivery: { reservationId: { in: ctx.createdReservationIds } } },
    });
    await prisma.deliveryStatusHistory.deleteMany({
      where: { delivery: { reservationId: { in: ctx.createdReservationIds } } },
    });
    await prisma.deliveryAssignment.deleteMany({
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
      {
        confirmationCode: deriveHandoverCode('self-pickup', reservation.id),
      },
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

  test('cash pickup requires acknowledgement and settles atomically with collector evidence', async () => {
    const { reservation } = await createReservation(ctx, 'ACCEPTED');
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        paymentMethod: 'CASH',
        materialSubtotal: 35,
        pricingCurrency: 'NIS',
      },
    });
    const order = await prisma.paymentOrder.create({
      data: {
        payerUserId: ctx.learnerId,
        purpose: 'MATERIAL_SUBTOTAL',
        paymentMethod: 'CASH',
        status: 'REQUIRES_PAYMENT',
        currency: 'NIS',
        amount: 35,
        reservationId: reservation.id,
      },
    });
    const confirmationCode = deriveHandoverCode('self-pickup', reservation.id);

    await assert.rejects(
      completeSupplierReservation(ctx.supplierId, reservation.id, {
        confirmationCode,
      }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'CASH_COLLECTION_CONFIRMATION_REQUIRED',
    );
    assert.equal(
      (await prisma.paymentOrder.findUnique({ where: { id: order.id } }))?.status,
      'REQUIRES_PAYMENT',
    );
    assert.equal(
      (await prisma.reservation.findUnique({ where: { id: reservation.id } }))
        ?.status,
      'ACCEPTED',
    );

    const completed = await completeSupplierReservation(
      ctx.supplierId,
      reservation.id,
      { confirmationCode, cashReceivedConfirmed: true },
    );
    assert.equal(completed.status, 'COMPLETED');
    const settled = await prisma.paymentOrder.findUnique({
      where: { id: order.id },
    });
    assert.equal(settled?.status, 'PAID');
    assert.ok(settled?.paidAt);
    assert.equal(settled?.cashCollectedByUserId, ctx.supplierId);
    assert.equal(settled?.paymentMethod, 'CASH');
    assert.equal(settled?.amount.toFixed(2), '35.00');
    assert.equal(settled?.currency, 'NIS');
  });

  test('supplier reservation list marks accepted self-pickup as completable', async () => {
    const { reservation } = await createReservation(ctx, 'ACCEPTED');

    const reservations = await listSupplierReservations(ctx.supplierId, {
      status: 'accepted',
    });
    const listed = reservations.find((item) => item.id === reservation.id);

    assert.ok(listed);
    assert.equal(listed.fulfillmentMethod, 'PICKUP');
    assert.equal(listed.activeDelivery, null);
    assert.equal(listed.canSupplierComplete, true);
  });

  test('supplier reservation list exposes delivery summary and blocks supplier complete action', async () => {
    const { reservation } = await createReservation(ctx, 'ACCEPTED');

    const delivery = await createDelivery(
      ctx,
      reservation.id,
      'WAITING_FOR_DRIVER',
    );

    const reservations = await listSupplierReservations(ctx.supplierId, {
      status: 'accepted',
    });
    const listed = reservations.find((item) => item.id === reservation.id);

    assert.ok(listed);
    assert.equal(listed.fulfillmentLabel, 'Delivery requested');
    assert.deepEqual(listed.activeDelivery, {
      id: delivery.id,
      status: 'WAITING_FOR_DRIVER',
    });
    assert.equal(listed.canSupplierComplete, false);
  });

  test('pickup reservation with active delivery row is not supplier completable', async () => {
    const { reservation } = await createReservation(ctx, 'ACCEPTED');

    await createDelivery(
      ctx,
      reservation.id,
      'WAITING_FOR_DRIVER',
    );

    const reservations = await listSupplierReservations(ctx.supplierId, {
      status: 'accepted',
    });
    const listed = reservations.find((item) => item.id === reservation.id);

    assert.ok(listed);
    assert.equal(listed.fulfillmentLabel, 'Delivery requested');
    assert.ok(listed.activeDelivery);
    assert.equal(listed.canSupplierComplete, false);

    await assert.rejects(
      () =>
        completeSupplierReservation(ctx.supplierId, reservation.id, {
          confirmationCode: deriveHandoverCode('self-pickup', reservation.id),
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        return true;
      },
    );
  });

  test('terminal delivery statuses still block supplier completion', async () => {
    for (const status of [
      'CANCELLED',
      'FAILED_PICKUP',
      'FAILED_DELIVERY',
    ] as const) {
      const { reservation } = await createReservation(ctx, 'ACCEPTED');
      await createDelivery(ctx, reservation.id, status);

      const reservations = await listSupplierReservations(ctx.supplierId, {
        status: 'accepted',
      });
      const listed = reservations.find((item) => item.id === reservation.id);

      assert.ok(listed);
      assert.ok(listed.activeDelivery);
      assert.equal(listed.activeDelivery.status, status);
      assert.equal(listed.canSupplierComplete, false);

      await assert.rejects(
        () =>
        completeSupplierReservation(ctx.supplierId, reservation.id, {
          confirmationCode: deriveHandoverCode('self-pickup', reservation.id),
        }),
        (error: unknown) => {
          assert.ok(error instanceof AppError);
          assert.equal(error.statusCode, 409);
          return true;
        },
      );
    }
  });

  test('any delivery row blocks supplier completion even when latest delivery is terminal', async () => {
    const { reservation } = await createReservation(ctx, 'ACCEPTED');
    const older = new Date(Date.now() - 60_000);
    const newer = new Date();

    await createDelivery(ctx, reservation.id, 'WAITING_FOR_DRIVER', older);
    const latestDelivery = await createDelivery(
      ctx,
      reservation.id,
      'CANCELLED',
      newer,
    );

    const reservations = await listSupplierReservations(ctx.supplierId, {
      status: 'accepted',
    });
    const listed = reservations.find((item) => item.id === reservation.id);

    assert.ok(listed);
    assert.deepEqual(listed.activeDelivery, {
      id: latestDelivery.id,
      status: 'CANCELLED',
    });
    assert.equal(listed.canSupplierComplete, false);

    await assert.rejects(
      () =>
        completeSupplierReservation(ctx.supplierId, reservation.id, {
          confirmationCode: deriveHandoverCode('self-pickup', reservation.id),
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        return true;
      },
    );
  });

  test('supplier accept sets material reserved', async () => {
    const { reservation, material } = await createReservation(ctx, 'PENDING');
    const { start, end } = safeSupplierAcceptPickupWindow();

    const result = await acceptSupplierReservation(
      ctx.supplierId,
      reservation.id,
      {
        pickupWindowStart: start.toISOString(),
        pickupWindowEnd: end.toISOString(),
      },
    );

    assert.equal(result.status, 'ACCEPTED');

    const updatedReservation = await prisma.reservation.findUnique({
      where: { id: reservation.id },
      select: { status: true },
    });
    assert.equal(updatedReservation?.status, 'ACCEPTED');

    const updatedMaterial = await prisma.material.findUnique({
      where: { id: material.id },
      select: { status: true },
    });
    assert.equal(updatedMaterial?.status, 'RESERVED');
  });

  test('supplier accept requires pending reservation', async () => {
    const { start, end } = safeSupplierAcceptPickupWindow();

    for (const status of ['ACCEPTED', 'REJECTED', 'COMPLETED'] as const) {
      const { reservation } = await createReservation(ctx, status);

      await assert.rejects(
        () =>
          acceptSupplierReservation(ctx.supplierId, reservation.id, {
            pickupWindowStart: start.toISOString(),
            pickupWindowEnd: end.toISOString(),
          }),
        (error: unknown) => {
          assert.ok(error instanceof AppError);
          assert.equal(error.statusCode, 409);
          return true;
        },
      );
    }
  });

  test('supplier decline returns material to available', async () => {
    const { reservation, material } = await createReservation(ctx, 'PENDING');
    await prisma.material.update({
      where: { id: material.id },
      data: { status: 'PENDING_RESERVATION' },
    });

    const result = await declineSupplierReservation(
      ctx.supplierId,
      reservation.id,
      {
        reason: 'Not available this week',
      },
    );

    assert.equal(result.status, 'REJECTED');

    const updatedReservation = await prisma.reservation.findUnique({
      where: { id: reservation.id },
      select: { status: true },
    });
    assert.equal(updatedReservation?.status, 'REJECTED');

    const updatedMaterial = await prisma.material.findUnique({
      where: { id: material.id },
      select: { status: true },
    });
    assert.equal(updatedMaterial?.status, 'AVAILABLE');
  });

  test('supplier decline requires pending reservation', async () => {
    for (const status of ['ACCEPTED', 'REJECTED', 'COMPLETED'] as const) {
      const { reservation } = await createReservation(ctx, status);

      await assert.rejects(
        () =>
          declineSupplierReservation(ctx.supplierId, reservation.id, {
            reason: 'Cannot fulfill',
          }),
        (error: unknown) => {
          assert.ok(error instanceof AppError);
          assert.equal(error.statusCode, 409);
          return true;
        },
      );
    }
  });

  test('supplier cannot complete another supplier reservation', async () => {
    const { reservation } = await createReservation(
      ctx,
      'ACCEPTED',
      ctx.otherSupplierId,
    );

    await assert.rejects(
      () =>
        completeSupplierReservation(ctx.supplierId, reservation.id, {
          confirmationCode: deriveHandoverCode('self-pickup', reservation.id),
        }),
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
      () =>
        completeSupplierReservation(ctx.supplierId, reservation.id, {
          confirmationCode: deriveHandoverCode('self-pickup', reservation.id),
        }),
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
      () =>
        completeSupplierReservation(ctx.supplierId, reservation.id, {
          confirmationCode: deriveHandoverCode('self-pickup', reservation.id),
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        return true;
      },
    );
  });
});
