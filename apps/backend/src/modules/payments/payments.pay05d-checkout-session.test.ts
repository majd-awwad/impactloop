import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';

import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';

import {
  ensureDeliveryGroupAttachedForAcceptedReservation,
  ensurePaymentObligationsForAcceptedReservation,
} from './payments.acceptance.js';
import {
  startReservationCheckout,
} from './payments.checkout-session.js';
import { resolvePaymentSummariesByReservations } from './payments.list-summary.js';
import { setElectronicPaymentEnforcementForTests } from './payments.policy.js';
import {
  actOnMockCheckout,
  completeMockRefundViaEvent,
  requestFullRefundForPaidOrder,
} from './payments.service.js';
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
 * PAY-05D enforcement-ON end-to-end matrix (scenarios A–R).
 * Default test env leaves enforcement OFF; this suite forces ON.
 */
describe('PAY-05D reservation checkout orchestration (enforcement ON)', () => {
  const ids = createPayTestIds();
  let learnerId = '';
  let otherLearnerId = '';
  let supplierId = '';

  before(async () => {
    learnerId = (
      await createPayUser(ids, { role: 'LEARNER', emailSuffix: 'pay05d-l' })
    ).id;
    otherLearnerId = (
      await createPayUser(ids, { role: 'LEARNER', emailSuffix: 'pay05d-other' })
    ).id;
    supplierId = (
      await createPayUser(ids, { role: 'SUPPLIER', emailSuffix: 'pay05d-s' })
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

  async function paySession(reservationId: string, action: 'success' | 'decline' | 'cancel' | 'pending' | 'timeout' = 'success') {
    const session = await startReservationCheckout({
      reservationId,
      payerUserId: learnerId,
      idempotencyKey: `pay05d-${reservationId}-${action}-${Date.now()}-${Math.random()}`,
    });
    assert.ok(session.attemptId);
    const act = await actOnMockCheckout({
      attemptId: session.attemptId!,
      action,
      actorUserId: learnerId,
    });
    return { session, act };
  }

  test('A: paid pickup — one material order, one session, one attempt, success', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 200,
    });
    const material = await ensureAndTrackMaterial(reservation.id);
    assert.ok(material);

    const before = await prisma.paymentOrder.count({
      where: { reservationId: reservation.id },
    });
    assert.equal(before, 1);

    const key = `pay05d-A-${Date.now()}`;
    const checkout = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: key,
    });
    assert.equal(checkout.items.length, 1);
    assert.equal(checkout.items[0]!.purpose, 'MATERIAL_SUBTOTAL');
    assert.equal(checkout.totalAmountMinor, 20000);
    assert.ok(checkout.attemptId);

    const attempts = await prisma.paymentAttempt.count({
      where: { checkoutSessionId: checkout.checkoutSessionId },
    });
    assert.equal(attempts, 1);

    await actOnMockCheckout({
      attemptId: checkout.attemptId!,
      action: 'success',
      actorUserId: learnerId,
    });

    const paid = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: material.id },
    });
    assert.equal(paid.status, 'PAID');

    const deliveries = await prisma.delivery.count({
      where: { reservationId: reservation.id },
    });
    assert.equal(deliveries, 0);

    const summary = await resolvePaymentSummariesByReservations([
      {
        id: reservation.id,
        status: 'ACCEPTED',
        fulfillmentMethod: 'PICKUP',
        materialSubtotal: 200,
        deliveryFee: 0,
        pricingCurrency: 'NIS',
        deliveryGroupId: null,
        deliveryStatus: null,
        assignedDriverProfileId: null,
        pickupWindowStart: new Date(Date.now() - 30 * 60_000),
        pickupWindowEnd: new Date(Date.now() + 3_600_000),
      },
    ]);
    assert.equal(summary.get(reservation.id)?.pickupCodeAvailable, true);
    assert.equal(summary.get(reservation.id)?.fulfillmentReady, true);
  });

  test('B: delivery before payment — two orders, one session, atomic PAID, Delivery once', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 20,
    });
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 200,
      fulfillmentMethod: 'DELIVERY',
      deliveryFee: 20,
      deliveryGroupId: group.id,
    });
    const material = await ensureAndTrackMaterial(reservation.id);
    const fee = await ensureAndTrackFee(group.id);
    assert.ok(material);
    assert.ok(fee);

    const checkout = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05d-B-${Date.now()}`,
    });
    assert.equal(checkout.items.length, 2);
    assert.equal(checkout.totalAmountMinor, 22000);
    assert.equal(
      await prisma.paymentAttempt.count({
        where: { checkoutSessionId: checkout.checkoutSessionId },
      }),
      1,
    );

    await actOnMockCheckout({
      attemptId: checkout.attemptId!,
      action: 'success',
      actorUserId: learnerId,
    });

    const [m, f] = await Promise.all([
      prisma.paymentOrder.findUniqueOrThrow({ where: { id: material.id } }),
      prisma.paymentOrder.findUniqueOrThrow({ where: { id: fee.id } }),
    ]);
    assert.equal(m.status, 'PAID');
    assert.equal(f.status, 'PAID');

    const deliveries = await prisma.delivery.findMany({
      where: { reservationId: reservation.id },
    });
    assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0]!.status, 'WAITING_FOR_DRIVER');
  });

  test('C: flexible delivery — group attach before checkout, one charge', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 100,
      fulfillmentMethod: 'DELIVERY',
      deliveryFee: 15,
      deliveryGroupId: undefined,
    });
    assert.equal(reservation.deliveryGroupId ?? null, null);

    await prisma.$transaction((tx) =>
      ensurePaymentObligationsForAcceptedReservation(tx, reservation.id),
    );

    const refreshed = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    assert.ok(refreshed.deliveryGroupId);
    ids.groups.push(refreshed.deliveryGroupId);

    const material = await ensureAndTrackMaterial(reservation.id);
    const fee = await ensureAndTrackFee(refreshed.deliveryGroupId);
    assert.ok(material);
    assert.ok(fee);

    const { session } = await paySession(reservation.id, 'success');
    assert.equal(session.items.length, 2);

    const deliveries = await prisma.delivery.count({
      where: { reservationId: reservation.id },
    });
    assert.equal(deliveries, 1);
  });

  test('D: paid pickup then fee-only checkout (Request Delivery shape)', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 50,
    });
    const material = await ensureAndTrackMaterial(reservation.id);
    assert.ok(material);
    await paySession(reservation.id, 'success');

    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 12,
    });
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        fulfillmentMethod: 'DELIVERY',
        deliveryFee: new Prisma.Decimal(12),
        deliveryGroupId: group.id,
        deliveryAddressText: 'Later delivery addr',
        dropoffCity: 'Ramallah',
        deliveryZone: 'SAME_CITY',
        confirmedDeliveryWindowStart: new Date(Date.now() + 48 * 3_600_000),
        confirmedDeliveryWindowEnd: new Date(Date.now() + 50 * 3_600_000),
      },
    });
    const fee = await ensureAndTrackFee(group.id);
    assert.ok(fee);

    const checkout = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05d-D-${Date.now()}`,
    });
    assert.equal(checkout.items.length, 1);
    assert.equal(checkout.items[0]!.purpose, 'DELIVERY_FEE');
    assert.equal(checkout.totalAmountMinor, 1200);

    await actOnMockCheckout({
      attemptId: checkout.attemptId!,
      action: 'success',
      actorUserId: learnerId,
    });

    const materialAfter = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: material.id },
    });
    assert.equal(materialAfter.status, 'PAID');
    assert.equal(
      (await prisma.paymentOrder.findUniqueOrThrow({ where: { id: fee.id } }))
        .status,
      'PAID',
    );
  });

  test('E: zero delivery fee — material only, Delivery after material', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 0,
    });
    // Group fixture always creates positive fee via Decimal — override.
    await prisma.deliveryGroup.update({
      where: { id: group.id },
      data: { deliveryFee: new Prisma.Decimal(0) },
    });
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 40,
      fulfillmentMethod: 'DELIVERY',
      deliveryFee: 0,
      deliveryGroupId: group.id,
    });
    await ensureAndTrackMaterial(reservation.id);
    const fee = await ensureDeliveryFeePaymentOrder(group.id);
    assert.equal(fee.outcome, 'NOT_REQUIRED');

    const checkout = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05d-E-${Date.now()}`,
    });
    assert.equal(checkout.items.length, 1);
    assert.equal(checkout.items[0]!.purpose, 'MATERIAL_SUBTOTAL');

    await actOnMockCheckout({
      attemptId: checkout.attemptId!,
      action: 'success',
      actorUserId: learnerId,
    });
    assert.equal(
      await prisma.delivery.count({ where: { reservationId: reservation.id } }),
      1,
    );
  });

  test('F: free material + positive delivery fee — fee only', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 18,
    });
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 0,
      fulfillmentMethod: 'DELIVERY',
      deliveryFee: 18,
      deliveryGroupId: group.id,
    });
    const material = await ensureMaterialPaymentOrder(reservation.id);
    assert.equal(material.outcome, 'NOT_REQUIRED');
    const fee = await ensureAndTrackFee(group.id);
    assert.ok(fee);

    const checkout = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05d-F-${Date.now()}`,
    });
    assert.equal(checkout.items.length, 1);
    assert.equal(checkout.items[0]!.purpose, 'DELIVERY_FEE');
  });

  test('G: shared DeliveryGroup — fee once across materials', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 25,
    });
    const r1 = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 30,
      fulfillmentMethod: 'DELIVERY',
      deliveryFee: 25,
      deliveryGroupId: group.id,
    });
    const r2 = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 40,
      fulfillmentMethod: 'DELIVERY',
      deliveryFee: 0,
      deliveryGroupId: group.id,
    });
    await ensureAndTrackMaterial(r1.id);
    await ensureAndTrackMaterial(r2.id);
    await ensureAndTrackFee(group.id);

    const checkout = await startReservationCheckout({
      reservationId: r1.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05d-G-${Date.now()}`,
    });
    const feeItems = checkout.items.filter((i) => i.purpose === 'DELIVERY_FEE');
    assert.equal(feeItems.length, 1);
    assert.ok(checkout.items.length >= 2);

    const dup = await startReservationCheckout({
      reservationId: r1.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05d-G-${Date.now()}`,
    });
    assert.equal(dup.checkoutSessionId, checkout.checkoutSessionId);
  });

  test('H: duplicate Idempotency-Key returns same session; different key blocked while active', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 22,
    });
    await ensureAndTrackMaterial(reservation.id);
    const key = `pay05d-H-${Date.now()}`;
    const first = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: key,
    });
    const second = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: key,
    });
    assert.equal(first.checkoutSessionId, second.checkoutSessionId);
    assert.equal(first.attemptId, second.attemptId);

    // Different key must not create a second active charge — reuses the active session.
    const third = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `${key}-other`,
    });
    assert.equal(third.checkoutSessionId, first.checkoutSessionId);
    assert.equal(third.attemptId, first.attemptId);
    assert.equal(
      await prisma.paymentAttempt.count({
        where: {
          checkoutSession: { reservationId: reservation.id },
          status: { in: ['CREATED', 'PENDING'] },
        },
      }),
      1,
    );
  });

  test('I: provider decline — no PAID, no Delivery, retry possible', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 33,
    });
    const material = await ensureAndTrackMaterial(reservation.id);
    assert.ok(material);
    await paySession(reservation.id, 'decline');

    const after = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: material.id },
    });
    assert.equal(after.status, 'REQUIRES_PAYMENT');
    assert.equal(
      await prisma.delivery.count({ where: { reservationId: reservation.id } }),
      0,
    );

    await paySession(reservation.id, 'success');
    assert.equal(
      (await prisma.paymentOrder.findUniqueOrThrow({ where: { id: material.id } }))
        .status,
      'PAID',
    );
  });

  test('J: provider pending — unpaid / processing, no fulfillment', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 10,
    });
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 10,
      fulfillmentMethod: 'DELIVERY',
      deliveryFee: 10,
      deliveryGroupId: group.id,
    });
    await ensureAndTrackMaterial(reservation.id);
    await ensureAndTrackFee(group.id);
    const { session } = await paySession(reservation.id, 'pending');
    assert.equal(session.status, 'CHECKOUT_PENDING');
    assert.equal(
      await prisma.delivery.count({ where: { reservationId: reservation.id } }),
      0,
    );
  });

  test('K: duplicate verified success event — no duplicate Delivery', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 8,
    });
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 12,
      fulfillmentMethod: 'DELIVERY',
      deliveryFee: 8,
      deliveryGroupId: group.id,
    });
    await ensureAndTrackMaterial(reservation.id);
    await ensureAndTrackFee(group.id);
    const checkout = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05d-K-${Date.now()}`,
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
      await prisma.delivery.count({ where: { reservationId: reservation.id } }),
      1,
    );
  });

  test('L: reservation lifecycle cancel while session pending — attempt cancelled, retry safe', async () => {
    const { handleReservationPaymentLifecycleTransition } = await import(
      './payments.lifecycle.js'
    );
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 17,
    });
    const material = await ensureAndTrackMaterial(reservation.id);
    assert.ok(material);
    const checkout = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05d-L-${Date.now()}`,
    });
    assert.ok(checkout.attemptId);

    await prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
      await handleReservationPaymentLifecycleTransition(tx, {
        reservationId: reservation.id,
        newStatus: 'CANCELLED',
        actorUserId: learnerId,
        reason: 'pay05d-L-lifecycle-cancel',
      });
    });

    const session = await prisma.paymentCheckoutSession.findUniqueOrThrow({
      where: { id: checkout.checkoutSessionId },
    });
    assert.equal(session.status, 'CANCELLED');
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: checkout.attemptId! },
    });
    assert.equal(attempt.status, 'CANCELLED');
    assert.equal(
      (await prisma.paymentOrder.findUniqueOrThrow({ where: { id: material.id } }))
        .status,
      'CANCELLED',
    );
  });

  test('M/N: material-only and fee-only allocated refunds after combined charge', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 20,
    });
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 80,
      fulfillmentMethod: 'DELIVERY',
      deliveryFee: 20,
      deliveryGroupId: group.id,
    });
    const material = await ensureAndTrackMaterial(reservation.id);
    const fee = await ensureAndTrackFee(group.id);
    assert.ok(material && fee);
    await paySession(reservation.id, 'success');

    const materialRefund = await requestFullRefundForPaidOrder({
      orderId: material.id,
      actorUserId: 'pay05d-test',
      reason: 'MATERIAL_ONLY',
    });
    assert.equal(materialRefund.kind, 'CREATED');
    const materialRefundRow = await prisma.paymentRefund.findUniqueOrThrow({
      where: { paymentOrderId: material.id },
    });
    assert.equal(Number(materialRefundRow.amount), 80);
    await completeMockRefundViaEvent({
      orderId: material.id,
      outcome: 'succeeded',
    });
    assert.equal(
      (await prisma.paymentOrder.findUniqueOrThrow({ where: { id: material.id } }))
        .status,
      'REFUNDED',
    );
    assert.equal(
      (await prisma.paymentOrder.findUniqueOrThrow({ where: { id: fee.id } }))
        .status,
      'PAID',
    );

    const feeRefund = await requestFullRefundForPaidOrder({
      orderId: fee.id,
      actorUserId: 'pay05d-test',
      reason: 'FEE_ONLY',
    });
    assert.equal(feeRefund.kind, 'CREATED');
    const feeRefundRow = await prisma.paymentRefund.findUniqueOrThrow({
      where: { paymentOrderId: fee.id },
    });
    assert.equal(Number(feeRefundRow.amount), 20);
    await completeMockRefundViaEvent({
      orderId: fee.id,
      outcome: 'succeeded',
    });
    assert.equal(
      (await prisma.paymentOrder.findUniqueOrThrow({ where: { id: fee.id } }))
        .status,
      'REFUNDED',
    );
  });

  test('P: missing DeliveryGroup data fails closed; GET does not fabricate', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 55,
      fulfillmentMethod: 'DELIVERY',
      deliveryFee: 9,
    });
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        deliveryAddressText: null,
        confirmedDeliveryWindowStart: null,
        confirmedDeliveryWindowEnd: null,
      },
    });

    // Mid-transition rows stay ungrouped (soft-null) so recovery writers can
    // continue; reads must still fail closed without fabricating a group.
    const attached = await prisma.$transaction((tx) =>
      ensureDeliveryGroupAttachedForAcceptedReservation(tx, reservation.id),
    );
    assert.equal(attached, null);

    const summaries = await resolvePaymentSummariesByReservations([
      {
        id: reservation.id,
        status: 'ACCEPTED',
        fulfillmentMethod: 'DELIVERY',
        materialSubtotal: 55,
        deliveryFee: 9,
        pricingCurrency: 'NIS',
        deliveryGroupId: null,
        deliveryStatus: null,
        assignedDriverProfileId: null,
      },
    ]);
    assert.equal(
      summaries.get(reservation.id)?.overallStatus,
      'INVARIANT_VIOLATION',
    );
    assert.equal(
      await prisma.deliveryGroup.count({
        where: {
          learnerId,
          deliveryFee: new Prisma.Decimal(9),
        },
      }),
      0,
    );
  });

  test('Q: enforcement disabled — separate legacy path (no session required)', async () => {
    setElectronicPaymentEnforcementForTests(false);
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 11,
    });
    await assert.rejects(
      () =>
        startReservationCheckout({
          reservationId: reservation.id,
          payerUserId: learnerId,
          idempotencyKey: `pay05d-Q-${Date.now()}`,
        }),
      (err: unknown) =>
        err instanceof AppError && err.code === 'PAYMENT_ENFORCEMENT_DISABLED',
    );
  });

  test('R: another learner cannot start/act on session', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 19,
    });
    await ensureAndTrackMaterial(reservation.id);
    await assert.rejects(
      () =>
        startReservationCheckout({
          reservationId: reservation.id,
          payerUserId: otherLearnerId,
          idempotencyKey: `pay05d-R-${Date.now()}`,
        }),
      (err: unknown) => err instanceof AppError && err.statusCode === 404,
    );

    const checkout = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05d-R-ok-${Date.now()}`,
    });
    await assert.rejects(
      () =>
        actOnMockCheckout({
          attemptId: checkout.attemptId!,
          action: 'success',
          actorUserId: otherLearnerId,
        }),
      (err: unknown) => err instanceof AppError && err.statusCode === 403,
    );
  });
});
