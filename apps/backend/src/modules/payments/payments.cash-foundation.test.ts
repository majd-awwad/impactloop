import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { findCompatibleDeliveryGroupCandidate } from '../delivery-groups/delivery-groups.repository.js';
import { createReservation } from '../reservations/reservations.service.js';
import { createReservationSchema } from '../reservations/reservations.validation.js';

import { ensureMaterialPaymentOrder } from './payments.ensure.js';
import { afterFinalAcceptanceInTransaction } from './payments.acceptance.js';
import { cancelUnpaidPaymentOrder } from './payments.lifecycle.js';
import { evaluatePickupPaymentReadiness } from './payments.readiness.js';
import { getReservationPaymentRequirement } from './payments.requirement.js';
import { startPaymentCheckout } from './payments.service.js';
import {
  cleanupPayTest,
  createPayDeliveryGroupFixture,
  createPayReservationFixture,
  createPayTestIds,
  createPayUser,
  trackOrder,
} from './payments.test-helpers.js';

describe('cash payment foundation', () => {
  const ids = createPayTestIds();
  let learnerId = '';
  let supplierId = '';

  before(async () => {
    learnerId = (await createPayUser(ids, {
      role: 'LEARNER',
      emailSuffix: 'cash-foundation-learner',
    })).id;
    supplierId = (await createPayUser(ids, {
      role: 'SUPPLIER',
      emailSuffix: 'cash-foundation-supplier',
    })).id;
  });

  after(async () => {
    await cleanupPayTest(ids);
  });

  test('cash stays due financially but is fulfillment-ready and never starts checkout', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 24,
      paymentMethod: 'CASH',
    });
    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    if (ensured.outcome !== 'CREATED' && ensured.outcome !== 'EXISTING') {
      assert.fail(`expected payment order, got ${ensured.outcome}`);
    }
    trackOrder(ids, ensured.order.id);

    const readiness = await evaluatePickupPaymentReadiness(reservation.id);
    assert.equal(readiness.status, 'REQUIRES_PAYMENT');
    assert.equal(readiness.ready, false);
    assert.equal(readiness.fulfillmentReady, true);
    assert.equal(readiness.dueAtHandover, true);

    const requirement = await getReservationPaymentRequirement(
      reservation.id,
      { userId: learnerId, roles: ['LEARNER'] },
    );
    assert.equal(requirement.paymentMethod, 'CASH');
    assert.equal(requirement.paymentReady, false);
    assert.equal(requirement.fulfillmentReady, true);
    assert.equal(requirement.dueAtHandover, true);
    assert.equal(requirement.material.canStartCheckout, false);
    assert.equal(requirement.orders[0]?.canStartCheckout, false);

    await assert.rejects(
      startPaymentCheckout({
        orderId: ensured.order.id,
        payerUserId: learnerId,
        idempotencyKey: `cash-${Date.now()}`,
      }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'CASH_PAYMENT_NOT_CHECKOUTABLE',
    );
    assert.equal(
      await prisma.paymentAttempt.count({ where: { paymentOrderId: ensured.order.id } }),
      0,
    );
    assert.equal(
      await prisma.paymentCheckoutSessionItem.count({
        where: { paymentOrderId: ensured.order.id },
      }),
      0,
    );
  });

  test('reservation creation persists cash and free legacy input defaults to card', async () => {
    const paidSeed = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 9,
    });
    const paidMaterialId = (await prisma.reservation.findUniqueOrThrow({
      where: { id: paidSeed.id },
      select: { materialId: true },
    })).materialId;
    await prisma.reservation.delete({ where: { id: paidSeed.id } });

    const cash = await createReservation(learnerId, {
      materialId: paidMaterialId,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
      paymentMethod: 'CASH',
    });
    ids.reservations.push(cash.id);
    assert.equal(cash.paymentMethod, 'CASH');
    assert.equal(
      (await prisma.reservation.findUniqueOrThrow({ where: { id: cash.id } }))
        .paymentMethod,
      'CASH',
    );

    const freeSeed = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 0,
    });
    const freeMaterialId = (await prisma.reservation.findUniqueOrThrow({
      where: { id: freeSeed.id },
      select: { materialId: true },
    })).materialId;
    await prisma.reservation.delete({ where: { id: freeSeed.id } });

    const freeInput = createReservationSchema.parse({
      materialId: freeMaterialId,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
    });
    const free = await createReservation(learnerId, freeInput);
    ids.reservations.push(free.id);
    assert.equal(free.paymentMethod, 'CARD');
    assert.equal(free.totalAmount, 0);
  });

  test('uncollected cash cancellation creates no refund/provider work', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 11,
      paymentMethod: 'CASH',
    });
    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    if (ensured.outcome !== 'CREATED' && ensured.outcome !== 'EXISTING') {
      assert.fail(`expected payment order, got ${ensured.outcome}`);
    }
    trackOrder(ids, ensured.order.id);

    const action = await prisma.$transaction((tx) =>
      cancelUnpaidPaymentOrder(tx, {
        orderId: ensured.order.id,
        reason: 'reservation cancelled before cash collection',
      }),
    );
    assert.equal(action.kind, 'CANCELLED_UNPAID');
    assert.equal(
      await prisma.paymentRefund.count({ where: { paymentOrderId: ensured.order.id } }),
      0,
    );
    assert.equal(
      await prisma.paymentAttempt.count({ where: { paymentOrderId: ensured.order.id } }),
      0,
    );
  });

  test('accepted cash delivery creates cash obligations and enters driver queue', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 30,
      deliveryFee: 12,
      fulfillmentMethod: 'DELIVERY',
      paymentMethod: 'CASH',
    });
    const source = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
      include: { material: { include: { location: true } } },
    });

    await prisma.$transaction((tx) =>
      afterFinalAcceptanceInTransaction(tx, {
        reservationId: source.id,
        ensureDelivery: {
          reservation: {
            id: source.id,
            requesterId: source.requesterId,
            deliveryGroupId: source.deliveryGroupId,
            deliveryAddressText: source.deliveryAddressText,
            dropoffCity: source.dropoffCity,
            dropoffArea: source.dropoffArea,
            deliveryNote: source.deliveryNote,
            material: { location: source.material.location },
          },
          changedByUserId: supplierId,
          statusHistoryNote: 'cash foundation acceptance test',
        },
      }),
    );

    const fresh = await prisma.reservation.findUniqueOrThrow({
      where: { id: source.id },
      select: { deliveryGroupId: true },
    });
    assert.ok(fresh.deliveryGroupId);
    ids.groups.push(fresh.deliveryGroupId);

    const group = await prisma.deliveryGroup.findUniqueOrThrow({
      where: { id: fresh.deliveryGroupId },
    });
    assert.equal(group.paymentMethod, 'CASH');

    const orders = await prisma.paymentOrder.findMany({
      where: {
        OR: [
          { reservationId: source.id },
          { deliveryGroupId: fresh.deliveryGroupId },
        ],
      },
    });
    for (const order of orders) trackOrder(ids, order.id);
    assert.equal(orders.length, 2);
    assert.ok(orders.every((order) =>
      order.paymentMethod === 'CASH' && order.status === 'REQUIRES_PAYMENT'));

    const delivery = await prisma.delivery.findFirst({
      where: { deliveryGroupId: fresh.deliveryGroupId },
    });
    assert.equal(delivery?.status, 'WAITING_FOR_DRIVER');
  });

  test('delivery grouping excludes a different payment method', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 12,
      paymentMethod: 'CARD',
    });
    await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 5,
      deliveryFee: 0,
      fulfillmentMethod: 'DELIVERY',
      deliveryGroupId: group.id,
      paymentMethod: 'CARD',
    });
    const stored = await prisma.deliveryGroup.findUniqueOrThrow({
      where: { id: group.id },
      select: {
        supplierProfileId: true,
        windowStart: true,
        windowEnd: true,
      },
    });
    const input = {
      learnerId,
      supplierProfileId: stored.supplierProfileId,
      dropoffCity: 'Ramallah',
      preferredDeliveryWindows: [{
        start: stored.windowStart.toISOString(),
        end: stored.windowEnd.toISOString(),
      }],
      deliveryZone: 'SAME_CITY',
    };

    assert.equal(
      await findCompatibleDeliveryGroupCandidate({
        ...input,
        paymentMethod: 'CASH',
      }),
      null,
    );
    assert.equal(
      (await findCompatibleDeliveryGroupCandidate({
        ...input,
        paymentMethod: 'CARD',
      }))?.id,
      group.id,
    );
  });
});
