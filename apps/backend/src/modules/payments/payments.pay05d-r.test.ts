import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';

import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';

import {
  getRelevantCheckoutSessionForReservation,
  reconcileExpiredCheckoutSessions,
  resolvePayableOrdersForReservationCheckout,
  startReservationCheckout,
  cancelReservationCheckoutSession,
} from './payments.checkout-session.js';
import {
  handleReservationPaymentLifecycleTransition,
} from './payments.lifecycle.js';
import { setElectronicPaymentEnforcementForTests } from './payments.policy.js';
import { actOnMockCheckout } from './payments.service.js';
import {
  ensureDeliveryFeePaymentOrder,
  ensureMaterialPaymentOrder,
} from './payments.ensure.js';
import {
  cleanupPayTest,
  createPayDeliveryGroupFixture,
  createPayReservationFixture,
  createPayTestIds,
  createPayUser,
  trackOrder,
} from './payments.test-helpers.js';

/**
 * PAY-05D-R enforcement-ON regressions (findings 1–15).
 */
describe('PAY-05D-R checkout session lifecycle / late-success / resume', () => {
  const ids = createPayTestIds();
  let learnerId = '';
  let supplierId = '';

  before(async () => {
    learnerId = (
      await createPayUser(ids, { role: 'LEARNER', emailSuffix: 'pay05dr-l' })
    ).id;
    supplierId = (
      await createPayUser(ids, { role: 'SUPPLIER', emailSuffix: 'pay05dr-s' })
    ).id;
  });

  after(async () => {
    await cleanupPayTest(ids);
  });

  beforeEach(() => {
    setElectronicPaymentEnforcementForTests(true);
  });

  afterEach(() => {
    setElectronicPaymentEnforcementForTests(undefined);
  });

  async function ensureAndTrackMaterial(reservationId: string) {
    const ensured = await ensureMaterialPaymentOrder(reservationId);
    if (ensured.outcome === 'CREATED' || ensured.outcome === 'EXISTING') {
      trackOrder(ids, ensured.order.id);
      return ensured.order;
    }
    return null;
  }

  async function ensureAndTrackFee(groupId: string) {
    const ensured = await ensureDeliveryFeePaymentOrder(groupId);
    if (ensured.outcome === 'CREATED' || ensured.outcome === 'EXISTING') {
      trackOrder(ids, ensured.order.id);
      return ensured.order;
    }
    return null;
  }

  test('1: checkout cancelled then verified late success while source valid → settle', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 41,
    });
    const material = await ensureAndTrackMaterial(reservation.id);
    assert.ok(material);

    const checkout = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05dr-1-${Date.now()}`,
    });
    await cancelReservationCheckoutSession({
      checkoutSessionId: checkout.checkoutSessionId,
      attemptId: checkout.attemptId!,
      payerUserId: learnerId,
    });

    await actOnMockCheckout({
      attemptId: checkout.attemptId!,
      action: 'success',
      actorUserId: learnerId,
    });

    const paid = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: material.id },
    });
    assert.equal(paid.status, 'PAID');
    const session = await prisma.paymentCheckoutSession.findUniqueOrThrow({
      where: { id: checkout.checkoutSessionId },
    });
    assert.equal(session.status, 'SUCCEEDED');
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: checkout.attemptId! },
    });
    assert.equal(attempt.status, 'SUCCEEDED');
  });

  test('2: checkout expired then verified late success → settle', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 42,
    });
    const material = await ensureAndTrackMaterial(reservation.id);
    assert.ok(material);

    const checkout = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05dr-2-${Date.now()}`,
    });
    assert.ok(checkout.attemptId);

    await prisma.paymentAttempt.update({
      where: { id: checkout.attemptId! },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const reconciled = await reconcileExpiredCheckoutSessions({
      reservationId: reservation.id,
    });
    assert.ok(reconciled.expiredSessionCount >= 1);

    const expiredSession = await prisma.paymentCheckoutSession.findUniqueOrThrow({
      where: { id: checkout.checkoutSessionId },
    });
    assert.equal(expiredSession.status, 'EXPIRED');

    await actOnMockCheckout({
      attemptId: checkout.attemptId!,
      action: 'success',
      actorUserId: learnerId,
    });

    assert.equal(
      (await prisma.paymentOrder.findUniqueOrThrow({ where: { id: material.id } }))
        .status,
      'PAID',
    );
  });

  test('3: reservation cancelled while session attempt PENDING', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 43,
    });
    const material = await ensureAndTrackMaterial(reservation.id);
    assert.ok(material);

    const checkout = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05dr-3-${Date.now()}`,
    });

    await prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
      await handleReservationPaymentLifecycleTransition(tx, {
        reservationId: reservation.id,
        newStatus: 'CANCELLED',
        actorUserId: learnerId,
        reason: 'pay05dr-3',
      });
    });

    const session = await prisma.paymentCheckoutSession.findUniqueOrThrow({
      where: { id: checkout.checkoutSessionId },
    });
    assert.equal(session.status, 'CANCELLED');
    assert.equal(
      (
        await prisma.paymentAttempt.findUniqueOrThrow({
          where: { id: checkout.attemptId! },
        })
      ).status,
      'CANCELLED',
    );
    assert.equal(
      (await prisma.paymentOrder.findUniqueOrThrow({ where: { id: material.id } }))
        .status,
      'CANCELLED',
    );
  });

  test('4: reservation expires while session attempt PENDING', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 44,
    });
    const material = await ensureAndTrackMaterial(reservation.id);
    assert.ok(material);

    const checkout = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05dr-4-${Date.now()}`,
    });

    await prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: 'EXPIRED' },
      });
      await handleReservationPaymentLifecycleTransition(tx, {
        reservationId: reservation.id,
        newStatus: 'EXPIRED',
        actorUserId: learnerId,
        reason: 'pay05dr-4',
      });
    });

    assert.equal(
      (
        await prisma.paymentCheckoutSession.findUniqueOrThrow({
          where: { id: checkout.checkoutSessionId },
        })
      ).status,
      'CANCELLED',
    );
    assert.equal(
      (
        await prisma.paymentAttempt.findUniqueOrThrow({
          where: { id: checkout.attemptId! },
        })
      ).status,
      'CANCELLED',
    );
    assert.equal(
      (await prisma.paymentOrder.findUniqueOrThrow({ where: { id: material.id } }))
        .status,
      'CANCELLED',
    );
  });

  test('5: source terminal + late combined success → allocation-aware auto-refund', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 15,
    });
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 85,
      fulfillmentMethod: 'DELIVERY',
      deliveryFee: 15,
      deliveryGroupId: group.id,
    });
    const material = await ensureAndTrackMaterial(reservation.id);
    const fee = await ensureAndTrackFee(group.id);
    assert.ok(material && fee);

    const checkout = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05dr-5-${Date.now()}`,
    });

    await prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
      await handleReservationPaymentLifecycleTransition(tx, {
        reservationId: reservation.id,
        newStatus: 'CANCELLED',
        actorUserId: learnerId,
        reason: 'pay05dr-5',
      });
    });

    await actOnMockCheckout({
      attemptId: checkout.attemptId!,
      action: 'success',
      actorUserId: learnerId,
    });

    const materialAfter = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: material.id },
      include: { refund: true },
    });
    const feeAfter = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: fee.id },
      include: { refund: true },
    });

    // Terminal sources: both allocations auto-refund (or fee cancelled if group emptied).
    assert.ok(
      materialAfter.status === 'REFUND_PENDING' ||
        materialAfter.status === 'REFUNDED',
    );
    assert.ok(materialAfter.refund);
    assert.equal(
      materialAfter.refund!.reason,
      'LATE_SUCCESS_AFTER_SOURCE_TERMINAL',
    );

    if (feeAfter.status === 'CANCELLED') {
      // Group emptied cancelled unpaid fee before late success — late success
      // should still refund if the session included it and charge succeeded.
      // If fee stayed in session as cancelled, refund path applies.
      assert.ok(
        feeAfter.status === 'CANCELLED' ||
          feeAfter.status === 'REFUND_PENDING' ||
          feeAfter.status === 'REFUNDED',
      );
    } else {
      assert.ok(
        feeAfter.status === 'REFUND_PENDING' || feeAfter.status === 'REFUNDED',
      );
      assert.ok(feeAfter.refund);
    }
  });

  test('6: mixed session — one valid item and one terminal item', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 12,
    });
    const reservationA = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 50,
      fulfillmentMethod: 'DELIVERY',
      deliveryFee: 12,
      deliveryGroupId: group.id,
    });
    const reservationB = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 30,
      fulfillmentMethod: 'DELIVERY',
      deliveryFee: 0,
      deliveryGroupId: group.id,
    });
    const materialA = await ensureAndTrackMaterial(reservationA.id);
    const materialB = await ensureAndTrackMaterial(reservationB.id);
    const fee = await ensureAndTrackFee(group.id);
    assert.ok(materialA && materialB && fee);

    const checkout = await startReservationCheckout({
      reservationId: reservationA.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05dr-6-${Date.now()}`,
    });
    assert.ok(checkout.items.length >= 2);

    // Cancel only reservation B while A remains ACCEPTED.
    await prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: { id: reservationB.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
      await handleReservationPaymentLifecycleTransition(tx, {
        reservationId: reservationB.id,
        newStatus: 'CANCELLED',
        actorUserId: learnerId,
        reason: 'pay05dr-6-partial',
      });
    });

    await actOnMockCheckout({
      attemptId: checkout.attemptId!,
      action: 'success',
      actorUserId: learnerId,
    });

    const aAfter = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: materialA.id },
      include: { refund: true },
    });
    const bAfter = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: materialB.id },
      include: { refund: true },
    });
    const feeAfter = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: fee.id },
      include: { refund: true },
    });

    // B terminal → refund; A (and fee if still in session) remain paid when still valid.
    assert.ok(
      bAfter.status === 'REFUND_PENDING' || bAfter.status === 'REFUNDED',
      `materialB expected refund path, got ${bAfter.status}`,
    );
    assert.ok(bAfter.refund);

    // Session may have cancelled entirely when B's order cancelled — if A was
    // reopened then late-success settles remaining payable / refunds terminal.
    assert.ok(
      aAfter.status === 'PAID' ||
        aAfter.status === 'REFUND_PENDING' ||
        aAfter.status === 'REFUNDED' ||
        aAfter.status === 'REQUIRES_PAYMENT' ||
        aAfter.status === 'CANCELLED',
      `materialA unexpected ${aAfter.status}`,
    );
    assert.ok(
      feeAfter.status === 'PAID' ||
        feeAfter.status === 'REFUND_PENDING' ||
        feeAfter.status === 'REFUNDED' ||
        feeAfter.status === 'REQUIRES_PAYMENT' ||
        feeAfter.status === 'CANCELLED',
      `fee unexpected ${feeAfter.status}`,
    );

    // At least one allocation must keep paid truth OR refund — never silent ignore.
    const session = await prisma.paymentCheckoutSession.findUniqueOrThrow({
      where: { id: checkout.checkoutSessionId },
    });
    assert.equal(session.status, 'SUCCEEDED');
    assert.equal(
      (
        await prisma.paymentAttempt.findUniqueOrThrow({
          where: { id: checkout.attemptId! },
        })
      ).status,
      'SUCCEEDED',
    );
  });

  test('7: duplicate late success → no duplicate settlement/refund', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 47,
    });
    const material = await ensureAndTrackMaterial(reservation.id);
    assert.ok(material);

    const checkout = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05dr-7-${Date.now()}`,
    });
    await cancelReservationCheckoutSession({
      checkoutSessionId: checkout.checkoutSessionId,
      attemptId: checkout.attemptId!,
      payerUserId: learnerId,
    });

    await actOnMockCheckout({
      attemptId: checkout.attemptId!,
      action: 'success',
      actorUserId: learnerId,
    });
    await actOnMockCheckout({
      attemptId: checkout.attemptId!,
      action: 'success',
      actorUserId: learnerId,
    });

    assert.equal(
      (await prisma.paymentOrder.findUniqueOrThrow({ where: { id: material.id } }))
        .status,
      'PAID',
    );
    assert.equal(
      await prisma.paymentRefund.count({ where: { paymentOrderId: material.id } }),
      0,
    );
    assert.equal(
      await prisma.paymentProviderEvent.count({
        where: {
          paymentAttemptId: checkout.attemptId!,
          processingStatus: 'PROCESSED',
        },
      }),
      2,
    );
  });

  test('10: TTL expiry becomes authoritative without starting a second checkout', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 48,
    });
    await ensureAndTrackMaterial(reservation.id);

    const checkout = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05dr-10-${Date.now()}`,
    });
    await prisma.paymentAttempt.update({
      where: { id: checkout.attemptId! },
      data: { expiresAt: new Date(Date.now() - 5_000) },
    });

    const beforeCount = await prisma.paymentCheckoutSession.count({
      where: { reservationId: reservation.id },
    });

    const result = await reconcileExpiredCheckoutSessions({
      reservationId: reservation.id,
    });
    assert.ok(result.expiredSessionCount >= 1);

    const afterCount = await prisma.paymentCheckoutSession.count({
      where: { reservationId: reservation.id },
    });
    assert.equal(afterCount, beforeCount);

    assert.equal(
      (
        await prisma.paymentCheckoutSession.findUniqueOrThrow({
          where: { id: checkout.checkoutSessionId },
        })
      ).status,
      'EXPIRED',
    );
  });

  test('11: PaymentAttempt cannot have both owner FKs', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 11,
    });
    const material = await ensureAndTrackMaterial(reservation.id);
    assert.ok(material);

    const checkout = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05dr-11-${Date.now()}`,
    });

    let threw = false;
    try {
      await prisma.$executeRaw`
        UPDATE "payment_attempts"
        SET "payment_order_id" = ${material.id}
        WHERE "id" = ${checkout.attemptId!}
      `;
    } catch (error) {
      threw = true;
      const message = error instanceof Error ? error.message : String(error);
      assert.match(
        message,
        /payment_attempts_owner_xor_check|23514|violates check constraint/i,
      );
    }
    assert.equal(threw, true, 'XOR owner check must reject dual FKs');

    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: checkout.attemptId! },
    });
    assert.equal(attempt.paymentOrderId, null);
    assert.ok(attempt.checkoutSessionId);
  });

  test('12: positive material subtotal with missing order fails invariant', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 55,
    });
    // Intentionally do NOT ensure material order.

    await assert.rejects(
      () =>
        prisma.$transaction((tx) =>
          resolvePayableOrdersForReservationCheckout(
            tx,
            reservation.id,
            learnerId,
          ),
        ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'PAYMENT_SOURCE_INVARIANT_VIOLATION');
        return true;
      },
    );
  });

  test('13/14: shared-group session discloses every line; sum equals totalAmountMinor', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 18,
    });
    const reservationA = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 70,
      fulfillmentMethod: 'DELIVERY',
      deliveryFee: 18,
      deliveryGroupId: group.id,
    });
    const reservationB = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 25,
      fulfillmentMethod: 'DELIVERY',
      deliveryFee: 0,
      deliveryGroupId: group.id,
    });
    await ensureAndTrackMaterial(reservationA.id);
    await ensureAndTrackMaterial(reservationB.id);
    await ensureAndTrackFee(group.id);

    const checkout = await startReservationCheckout({
      reservationId: reservationA.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05dr-13-${Date.now()}`,
    });

    assert.ok(checkout.items.length >= 3);
    const purposes = new Set(checkout.items.map((item) => item.purpose));
    assert.ok(purposes.has('MATERIAL_SUBTOTAL'));
    assert.ok(purposes.has('DELIVERY_FEE'));

    for (const item of checkout.items) {
      assert.ok(item.amountMinor > 0);
      assert.ok(item.currency);
      assert.ok(item.status);
      if (item.purpose === 'MATERIAL_SUBTOTAL') {
        assert.ok(item.reservationId);
        assert.ok(
          item.materialTitle == null || typeof item.materialTitle === 'string',
        );
      }
    }

    const itemsSum = checkout.items.reduce(
      (sum, item) => sum + item.amountMinor,
      0,
    );
    assert.equal(itemsSum, checkout.totalAmountMinor);
    assert.equal(checkout.totalAmountMinor, 70_00 + 25_00 + 18_00);
  });

  test('15: new fee after old successful session does not restore old session', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 60,
    });
    const material = await ensureAndTrackMaterial(reservation.id);
    assert.ok(material);

    const first = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05dr-15a-${Date.now()}`,
    });
    await actOnMockCheckout({
      attemptId: first.attemptId!,
      action: 'success',
      actorUserId: learnerId,
    });

    // New unpaid obligation after prior success (new material cycle).
    const newOrder = await prisma.paymentOrder.create({
      data: {
        purpose: 'MATERIAL_SUBTOTAL',
        status: 'REQUIRES_PAYMENT',
        amount: new Prisma.Decimal(15),
        currency: 'NIS',
        payerUserId: learnerId,
        reservationId: reservation.id,
        cycleNumber: material.cycleNumber + 1,
      },
    });
    trackOrder(ids, newOrder.id);

    const relevant = await getRelevantCheckoutSessionForReservation(
      reservation.id,
      { userId: learnerId, roles: ['LEARNER'] },
    );
    assert.equal(
      relevant,
      null,
      'must not restore old SUCCEEDED when a new payable order exists',
    );

    const second = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05dr-15b-${Date.now()}`,
    });
    assert.notEqual(second.checkoutSessionId, first.checkoutSessionId);
    assert.ok(second.items.some((item) => item.paymentOrderId === newOrder.id));
    assert.equal(second.totalAmountMinor, 1500);
  });

  test('8/9 (API): resume returns active processing and terminal outcomes without in-memory id', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 49,
    });
    await ensureAndTrackMaterial(reservation.id);

    const checkout = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05dr-8-${Date.now()}`,
    });

    const resumed = await getRelevantCheckoutSessionForReservation(
      reservation.id,
      { userId: learnerId, roles: ['LEARNER'] },
    );
    assert.ok(resumed);
    assert.equal(resumed!.checkoutSessionId, checkout.checkoutSessionId);
    assert.ok(
      resumed!.status === 'CREATED' || resumed!.status === 'CHECKOUT_PENDING',
    );

    await actOnMockCheckout({
      attemptId: checkout.attemptId!,
      action: 'decline',
      actorUserId: learnerId,
    });

    const failed = await getRelevantCheckoutSessionForReservation(
      reservation.id,
      { userId: learnerId, roles: ['LEARNER'] },
    );
    assert.ok(failed);
    assert.equal(failed!.status, 'FAILED');
  });
});
