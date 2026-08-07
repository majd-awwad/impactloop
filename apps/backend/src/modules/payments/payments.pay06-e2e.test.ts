import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { deriveHandoverCode } from '../../utils/handover-codes.js';

import { requestDeliveryForReservation } from '../deliveries/deliveries.service.js';
import {
  getMyReservationById,
  listMyReservations,
} from '../reservations/reservations.service.js';
import { completeSupplierReservation } from '../supplier-reservations/supplier-reservations.service.js';

import { ensurePaymentObligationsForAcceptedReservation } from './payments.acceptance.js';
import {
  getRelevantCheckoutSessionForReservation,
  startReservationCheckout,
} from './payments.checkout-session.js';
import {
  ensureDeliveryFeePaymentOrder,
  ensureMaterialPaymentOrder,
} from './payments.ensure.js';
import { handleReservationPaymentLifecycleTransition } from './payments.lifecycle.js';
import { setElectronicPaymentEnforcementForTests } from './payments.policy.js';
import { getReservationPaymentRequirement } from './payments.requirement.js';
import {
  actOnMockCheckout,
  completeMockRefundViaEvent,
  requestFullRefundForPaidOrder,
} from './payments.service.js';
import {
  cleanupPayTest,
  createPayDeliveryGroupFixture,
  createPayReservationFixture,
  createPayTestIds,
  createPayUser,
  trackOrder,
} from './payments.test-helpers.js';

/**
 * PAY-06 — Final end-to-end payment acceptance (enforcement ON, Mock provider).
 *
 * Continuous learner journeys with DB evidence. Reuses PAY-01…PAY-05F helpers;
 * adds missing continuous assertions (handover, Request Delivery totals,
 * pending restore, concurrency, stale notify, late-success, refund surfaces).
 */
describe('PAY-06 final E2E payment acceptance (enforcement ON)', () => {
  const ids = createPayTestIds();
  let learnerId = '';
  let otherLearnerId = '';
  let supplierId = '';

  const dropoff = {
    country: 'Palestine',
    city: 'Nablus',
    area: 'Old City',
    addressLine: 'Street 1',
    isApproximate: true,
    visibility: 'PRIVATE' as const,
  };

  before(async () => {
    learnerId = (
      await createPayUser(ids, { role: 'LEARNER', emailSuffix: 'pay06-l' })
    ).id;
    otherLearnerId = (
      await createPayUser(ids, {
        role: 'LEARNER',
        emailSuffix: 'pay06-other',
      })
    ).id;
    supplierId = (
      await createPayUser(ids, { role: 'SUPPLIER', emailSuffix: 'pay06-s' })
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

  async function enableDeliveryOnReservation(reservationId: string) {
    const row = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservationId },
      select: { materialId: true },
    });
    await prisma.material.update({
      where: { id: row.materialId },
      data: { deliveryAllowed: true },
    });
  }

  async function payReservation(
    reservationId: string,
    action: 'success' | 'decline' | 'cancel' | 'pending' | 'timeout' = 'success',
    keySuffix = '',
  ) {
    const session = await startReservationCheckout({
      reservationId,
      payerUserId: learnerId,
      idempotencyKey: `pay06-${reservationId}-${action}-${keySuffix}-${Date.now()}-${Math.random()}`,
    });
    assert.ok(session.attemptId);
    const act = await actOnMockCheckout({
      attemptId: session.attemptId!,
      action,
      actorUserId: learnerId,
    });
    return { session, act };
  }

  async function countSucceededAttempts(reservationId: string) {
    return prisma.paymentAttempt.count({
      where: {
        status: 'SUCCEEDED',
        OR: [
          { checkoutSession: { reservationId } },
          { paymentOrder: { reservationId } },
        ],
      },
    });
  }

  test('E2E-01 paid pickup → code window → supplier complete; no duplicate charge', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 45,
      pickupWindowStart: new Date(Date.now() + 2 * 3_600_000),
      pickupWindowEnd: new Date(Date.now() + 5 * 3_600_000),
    });
    const material = await ensureAndTrackMaterial(reservation.id);
    assert.ok(material);

    const beforeWindow = await getMyReservationById(learnerId, reservation.id);
    assert.equal(beforeWindow.paymentSummary?.overallStatus, 'REQUIRES_PAYMENT');
    assert.equal(beforeWindow.selfPickupCode, null);

    const checkout = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay06-01-${Date.now()}`,
    });
    assert.equal(checkout.items.length, 1);
    assert.equal(checkout.totalAmountMinor, 4500);
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

    assert.equal(
      (await prisma.paymentOrder.findUniqueOrThrow({ where: { id: material.id } }))
        .status,
      'PAID',
    );
    assert.equal(
      await prisma.delivery.count({ where: { reservationId: reservation.id } }),
      0,
    );
    assert.equal(await countSucceededAttempts(reservation.id), 1);

    const paidNotifs = await prisma.notification.count({
      where: {
        userId: learnerId,
        relatedEntityId: reservation.id,
        notificationType: { in: ['PAYMENT_COMPLETED', 'PAYMENT_FULFILLMENT_READY'] },
      },
    });
    assert.ok(paidNotifs >= 1);

    const outside = await getMyReservationById(learnerId, reservation.id);
    assert.equal(outside.paymentSummary?.overallStatus, 'PAID');
    assert.equal(outside.paymentSummary?.pickupCodeAvailable, false);
    assert.equal(outside.selfPickupCode, null);

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        pickupWindowStart: new Date(Date.now() - 30 * 60_000),
        pickupWindowEnd: new Date(Date.now() + 3_600_000),
      },
    });

    const inside = await getMyReservationById(learnerId, reservation.id);
    assert.equal(inside.paymentSummary?.pickupCodeAvailable, true);
    assert.equal(
      inside.selfPickupCode,
      deriveHandoverCode('self-pickup', reservation.id),
    );

    const listed = await listMyReservations(learnerId);
    const listRow = listed.find((r) => r.id === reservation.id);
    assert.equal(listRow?.paymentSummary?.pickupCodeAvailable, true);
    assert.equal(listRow?.paymentSummary?.overallStatus, 'PAID');

    await completeSupplierReservation(supplierId, reservation.id, {
      confirmationCode: deriveHandoverCode('self-pickup', reservation.id),
    });
    const completed = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    assert.equal(completed.status, 'COMPLETED');

    // No second charge on reopen.
    await assert.rejects(
      () =>
        startReservationCheckout({
          reservationId: reservation.id,
          payerUserId: learnerId,
          idempotencyKey: `pay06-01-reopen-${Date.now()}`,
        }),
      (error: unknown) =>
        error instanceof AppError &&
        (error.code === 'NOTHING_TO_PAY' ||
          error.code === 'RESERVATION_NOT_ACCEPTED'),
    );
  });

  test('E2E-02 free pickup — no order, no Pay CTA, fulfillable', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 0,
      pickupWindowStart: new Date(Date.now() - 30 * 60_000),
      pickupWindowEnd: new Date(Date.now() + 3_600_000),
    });
    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    assert.equal(ensured.outcome, 'NOT_REQUIRED');
    assert.equal(
      await prisma.paymentOrder.count({ where: { reservationId: reservation.id } }),
      0,
    );

    const detail = await getMyReservationById(learnerId, reservation.id);
    assert.equal(detail.paymentSummary?.overallStatus, 'NOT_REQUIRED');
    assert.equal(detail.paymentSummary?.checkoutableOrderId, null);
    assert.equal(detail.paymentSummary?.fulfillmentReady, true);
  });

  test('E2E-03 delivery before payment — 220 session; Delivery+driver notify only after', async () => {
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
    assert.ok(material && fee);

    const listed = await listMyReservations(learnerId);
    const before = listed.find((r) => r.id === reservation.id);
    assert.equal(before?.paymentSummary?.outstandingAmount, '220.00');
    assert.equal(before?.paymentSummary?.outstandingOrderCount, 2);

    assert.equal(
      await prisma.delivery.count({ where: { reservationId: reservation.id } }),
      0,
    );
    assert.equal(
      await prisma.notification.count({
        where: {
          relatedEntityId: reservation.id,
          notificationType: 'DRIVER_NEW_JOB',
        },
      }),
      0,
    );

    const checkout = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay06-03-${Date.now()}`,
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

    const driverJobs = await prisma.notification.count({
      where: {
        notificationType: 'DRIVER_NEW_JOB',
        OR: [
          { relatedEntityId: deliveries[0]!.id },
          { relatedEntityId: reservation.id },
          { relatedEntityId: group.id },
        ],
      },
    });
    assert.ok(
      driverJobs >= 1,
      'expected DRIVER_NEW_JOB after settlement',
    );

    const detail = await getMyReservationById(learnerId, reservation.id);
    assert.equal(detail.paymentSummary?.overallStatus, 'PAID');
    assert.equal(detail.paymentSummary?.pickupCodeAvailable, false);
  });

  test('E2E-04 paid pickup then Request Delivery — fee-only; material not recharged', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 50,
    });
    await enableDeliveryOnReservation(reservation.id);
    const material = await ensureAndTrackMaterial(reservation.id);
    assert.ok(material);

    const first = await payReservation(reservation.id, 'success', 'mat');
    assert.equal(first.session.totalAmountMinor, 5000);

    let feeOrderId = '';
    let feeAmount = '';
    await assert.rejects(
      () =>
        requestDeliveryForReservation(learnerId, reservation.id, {
          dropoffLocation: dropoff,
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'DELIVERY_FEE_REQUIRED');
        const details = error.details as {
          paymentOrderId?: string;
          amount?: string;
          deliveryGroupId?: string;
        };
        assert.ok(details.paymentOrderId);
        assert.ok(details.deliveryGroupId);
        feeOrderId = details.paymentOrderId!;
        feeAmount = details.amount!;
        trackOrder(ids, feeOrderId);
        ids.groups.push(details.deliveryGroupId!);
        return true;
      },
    );

    assert.equal(
      await prisma.delivery.count({ where: { reservationId: reservation.id } }),
      0,
    );
    assert.equal(
      (await prisma.paymentOrder.findUniqueOrThrow({ where: { id: material.id } }))
        .status,
      'PAID',
    );

    const feeCheckout = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay06-04-fee-${Date.now()}`,
    });
    assert.equal(feeCheckout.items.length, 1);
    assert.equal(feeCheckout.items[0]!.purpose, 'DELIVERY_FEE');
    assert.equal(
      feeCheckout.totalAmountMinor,
      Math.round(Number(feeAmount) * 100),
    );

    await actOnMockCheckout({
      attemptId: feeCheckout.attemptId!,
      action: 'success',
      actorUserId: learnerId,
    });

    assert.equal(
      (await prisma.paymentOrder.findUniqueOrThrow({ where: { id: feeOrderId } }))
        .status,
      'PAID',
    );
    assert.equal(
      await prisma.paymentOrder.count({
        where: {
          reservationId: reservation.id,
          purpose: 'MATERIAL_SUBTOTAL',
          status: 'PAID',
        },
      }),
      1,
    );
    assert.equal(
      await prisma.delivery.count({ where: { reservationId: reservation.id } }),
      1,
    );

    const capturedMinor =
      5000 + Math.round(Number(feeAmount) * 100);
    const succeeded = await prisma.paymentAttempt.findMany({
      where: {
        status: 'SUCCEEDED',
        OR: [
          { checkoutSession: { reservationId: reservation.id } },
          { paymentOrderId: { in: [material.id, feeOrderId] } },
        ],
      },
      select: { amountMinor: true },
    });
    const sumCaptured = succeeded.reduce((acc, row) => acc + row.amountMinor, 0);
    assert.equal(sumCaptured, capturedMinor);
  });

  test('E2E-05/06 zero-fee delivery and free-material + paid fee', async () => {
    const zeroGroup = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 0,
    });
    const zeroRes = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 30,
      fulfillmentMethod: 'DELIVERY',
      deliveryFee: 0,
      deliveryGroupId: zeroGroup.id,
    });
    const material = await ensureAndTrackMaterial(zeroRes.id);
    assert.ok(material);
    await prisma.paymentOrder.update({
      where: { id: material.id },
      data: { status: 'PAID', paidAt: new Date() },
    });
    assert.equal(
      (await ensureDeliveryFeePaymentOrder(zeroGroup.id)).outcome,
      'NOT_REQUIRED',
    );
    const zeroDetail = await getMyReservationById(learnerId, zeroRes.id);
    assert.equal(zeroDetail.paymentSummary?.hasDeliveryFeeOutstanding, false);

    const paidFeeGroup = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 22,
    });
    const freeMat = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 0,
      fulfillmentMethod: 'DELIVERY',
      deliveryFee: 22,
      deliveryGroupId: paidFeeGroup.id,
    });
    assert.equal(
      (await ensureMaterialPaymentOrder(freeMat.id)).outcome,
      'NOT_REQUIRED',
    );
    const fee = await ensureAndTrackFee(paidFeeGroup.id);
    assert.ok(fee);

    assert.equal(
      await prisma.delivery.count({ where: { reservationId: freeMat.id } }),
      0,
    );
    const checkout = await startReservationCheckout({
      reservationId: freeMat.id,
      payerUserId: learnerId,
      idempotencyKey: `pay06-06-${Date.now()}`,
    });
    assert.equal(checkout.items.length, 1);
    assert.equal(checkout.totalAmountMinor, 2200);
    await actOnMockCheckout({
      attemptId: checkout.attemptId!,
      action: 'success',
      actorUserId: learnerId,
    });
    assert.equal(
      await prisma.delivery.count({ where: { reservationId: freeMat.id } }),
      1,
    );
  });

  test('E2E-07 flexible delivery — group attached before checkout; no GET repair', async () => {
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
    assert.ok(material && fee);

    const beforeGet = refreshed.deliveryGroupId;
    await getReservationPaymentRequirement(reservation.id, {
      userId: learnerId,
      roles: ['LEARNER'],
    });
    const afterGet = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
      select: { deliveryGroupId: true },
    });
    assert.equal(afterGet.deliveryGroupId, beforeGet);

    const checkout = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay06-07-${Date.now()}`,
    });
    assert.equal(checkout.items.length, 2);
    assert.equal(checkout.totalAmountMinor, 11500);
  });

  test('E2E-08 shared DeliveryGroup — fee once; resume from B', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 12,
    });
    const a = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 10,
      fulfillmentMethod: 'DELIVERY',
      deliveryFee: 12,
      deliveryGroupId: group.id,
    });
    const b = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 10,
      fulfillmentMethod: 'DELIVERY',
      deliveryFee: 0,
      deliveryGroupId: group.id,
    });
    const ma = await ensureAndTrackMaterial(a.id);
    const mb = await ensureAndTrackMaterial(b.id);
    const fee = await ensureAndTrackFee(group.id);
    assert.ok(ma && mb && fee);

    const fromA = await startReservationCheckout({
      reservationId: a.id,
      payerUserId: learnerId,
      idempotencyKey: `pay06-08-a-${Date.now()}`,
    });
    // Shared-group checkout discloses every current material line + the fee once.
    assert.equal(fromA.items.filter((i) => i.purpose === 'DELIVERY_FEE').length, 1);
    assert.equal(
      fromA.items.filter((i) => i.purpose === 'MATERIAL_SUBTOTAL').length,
      2,
    );
    assert.equal(fromA.totalAmountMinor, 3200);
    const sumItems = fromA.items.reduce((acc, item) => acc + item.amountMinor, 0);
    assert.equal(sumItems, fromA.totalAmountMinor);

    const fromB = await startReservationCheckout({
      reservationId: b.id,
      payerUserId: learnerId,
      idempotencyKey: `pay06-08-b-${Date.now()}`,
    });
    assert.equal(fromB.checkoutSessionId, fromA.checkoutSessionId);
    assert.equal(fromB.attemptId, fromA.attemptId);

    await actOnMockCheckout({
      attemptId: fromA.attemptId!,
      action: 'success',
      actorUserId: learnerId,
    });

    assert.equal(
      await prisma.paymentOrder.count({
        where: { deliveryGroupId: group.id, purpose: 'DELIVERY_FEE' },
      }),
      1,
    );
    assert.equal(
      (await prisma.paymentOrder.findUniqueOrThrow({ where: { id: fee.id } }))
        .status,
      'PAID',
    );
    assert.equal(
      (await prisma.paymentOrder.findUniqueOrThrow({ where: { id: ma.id } }))
        .status,
      'PAID',
    );
    assert.equal(
      (await prisma.paymentOrder.findUniqueOrThrow({ where: { id: mb.id } }))
        .status,
      'PAID',
    );
  });

  test('E2E-09 decline then retry — one effective success', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 33,
    });
    const material = await ensureAndTrackMaterial(reservation.id);
    assert.ok(material);

    await payReservation(reservation.id, 'decline', 'd1');
    assert.notEqual(
      (await prisma.paymentOrder.findUniqueOrThrow({ where: { id: material.id } }))
        .status,
      'PAID',
    );
    assert.equal(
      await prisma.delivery.count({ where: { reservationId: reservation.id } }),
      0,
    );

    await payReservation(reservation.id, 'success', 'ok');
    assert.equal(
      (await prisma.paymentOrder.findUniqueOrThrow({ where: { id: material.id } }))
        .status,
      'PAID',
    );
    assert.equal(await countSucceededAttempts(reservation.id), 1);

    const detail = await getMyReservationById(learnerId, reservation.id);
    assert.equal(detail.paymentSummary?.overallStatus, 'PAID');
  });

  test('E2E-10 pending + restore session + later success; no new charge', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 28,
    });
    const material = await ensureAndTrackMaterial(reservation.id);
    assert.ok(material);

    const started = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay06-10-start-${Date.now()}`,
    });
    assert.ok(started.attemptId);

    // Browser refresh / resume before provider settles.
    const restoredBefore = await getRelevantCheckoutSessionForReservation(
      reservation.id,
      { userId: learnerId, roles: ['LEARNER'] },
    );
    assert.ok(restoredBefore);
    assert.equal(restoredBefore!.checkoutSessionId, started.checkoutSessionId);

    await actOnMockCheckout({
      attemptId: started.attemptId!,
      action: 'pending',
      actorUserId: learnerId,
    });

    const sessionRow = await prisma.paymentCheckoutSession.findUniqueOrThrow({
      where: { id: started.checkoutSessionId },
    });
    assert.equal(sessionRow.status, 'CHECKOUT_PENDING');

    const restoredPending = await getRelevantCheckoutSessionForReservation(
      reservation.id,
      { userId: learnerId, roles: ['LEARNER'] },
    );
    assert.ok(restoredPending);
    assert.equal(restoredPending!.checkoutSessionId, started.checkoutSessionId);
    assert.equal(restoredPending!.attemptId, started.attemptId);

    const again = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay06-10-resume-${Date.now()}`,
    });
    assert.equal(again.checkoutSessionId, started.checkoutSessionId);
    assert.equal(again.attemptId, started.attemptId);

    await actOnMockCheckout({
      attemptId: started.attemptId!,
      action: 'success',
      actorUserId: learnerId,
    });
    assert.equal(
      (await prisma.paymentOrder.findUniqueOrThrow({ where: { id: material.id } }))
        .status,
      'PAID',
    );
    assert.equal(await countSucceededAttempts(reservation.id), 1);
  });

  test('E2E-11 concurrent startReservationCheckout — one effective session/attempt', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 19,
    });
    await ensureAndTrackMaterial(reservation.id);

    const results = await Promise.allSettled([
      startReservationCheckout({
        reservationId: reservation.id,
        payerUserId: learnerId,
        idempotencyKey: `pay06-11-a-${Date.now()}`,
      }),
      startReservationCheckout({
        reservationId: reservation.id,
        payerUserId: learnerId,
        idempotencyKey: `pay06-11-b-${Date.now()}`,
      }),
    ]);

    const fulfilled = results
      .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof startReservationCheckout>>> =>
        r.status === 'fulfilled',
      )
      .map((r) => r.value);
    assert.ok(fulfilled.length >= 1);

    const sessionIds = new Set(fulfilled.map((s) => s.checkoutSessionId));
    assert.equal(sessionIds.size, 1);

    const sessions = await prisma.paymentCheckoutSession.count({
      where: {
        reservationId: reservation.id,
        status: { in: ['CREATED', 'CHECKOUT_PENDING'] },
      },
    });
    assert.equal(sessions, 1);

    const activeAttempts = await prisma.paymentAttempt.count({
      where: {
        checkoutSession: { reservationId: reservation.id },
        status: { in: ['CREATED', 'PENDING'] },
      },
    });
    assert.equal(activeAttempts, 1);

    const session = fulfilled[0]!;
    await actOnMockCheckout({
      attemptId: session.attemptId!,
      action: 'success',
      actorUserId: learnerId,
    });
    assert.equal(await countSucceededAttempts(reservation.id), 1);
  });

  test('E2E-12 stale PAYMENT_REQUIRED after pay — NOTHING_TO_PAY; list PAID', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 24,
    });
    const material = await ensureAndTrackMaterial(reservation.id);
    assert.ok(material);

    await prisma.notification.create({
      data: {
        userId: learnerId,
        notificationType: 'PAYMENT_REQUIRED',
        title: 'Pay now',
        body: 'Stale',
        relatedEntityType: 'RESERVATION',
        relatedEntityId: reservation.id,
        actionType: 'OPEN_RESERVATION',
        metadata: {
          paymentOrderId: material.id,
          paymentStatus: 'REQUIRES_PAYMENT',
          reservationId: reservation.id,
        },
      },
    });

    await payReservation(reservation.id, 'success', 'stale');

    await assert.rejects(
      () =>
        startReservationCheckout({
          reservationId: reservation.id,
          payerUserId: learnerId,
          idempotencyKey: `pay06-12-${Date.now()}`,
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === 'NOTHING_TO_PAY',
    );

    const detail = await getMyReservationById(learnerId, reservation.id);
    assert.equal(detail.paymentSummary?.overallStatus, 'PAID');
    assert.equal(detail.paymentSummary?.checkoutableOrderId, null);

    const stale = await prisma.notification.findFirst({
      where: {
        userId: learnerId,
        relatedEntityId: reservation.id,
        notificationType: 'PAYMENT_REQUIRED',
      },
    });
    assert.ok(stale);
    // Frozen metadata may still say REQUIRES_PAYMENT — server truth wins.
    assert.equal(
      (stale.metadata as { paymentStatus?: string } | null)?.paymentStatus,
      'REQUIRES_PAYMENT',
    );
  });

  test('E2E-13 cancel before payment — terminal surfaces, no Delivery/code', async () => {
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
      idempotencyKey: `pay06-13-${Date.now()}`,
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
        reason: 'pay06-13',
      });
    });

    const session = await prisma.paymentCheckoutSession.findUniqueOrThrow({
      where: { id: checkout.checkoutSessionId },
    });
    assert.equal(session.status, 'CANCELLED');
    assert.equal(
      (await prisma.paymentOrder.findUniqueOrThrow({ where: { id: material.id } }))
        .status,
      'CANCELLED',
    );
    assert.equal(
      await prisma.delivery.count({ where: { reservationId: reservation.id } }),
      0,
    );

    const detail = await getMyReservationById(learnerId, reservation.id);
    assert.equal(detail.selfPickupCode, null);
    assert.equal(detail.paymentSummary?.checkoutableOrderId, null);
    assert.equal(detail.paymentSummary?.fulfillmentReady, false);
  });

  test('E2E-14 cancel while checkout active + late success → refund, no fulfillment', async () => {
    // Mirrors PAY-05D-R scenario 5 on a reservation-scoped session: cancel remains
    // authoritative; verified late success is allocation-aware and must not fulfill.
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
      idempotencyKey: `pay06-14-${Date.now()}`,
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
        reason: 'pay06-14',
      });
    });

    await actOnMockCheckout({
      attemptId: checkout.attemptId!,
      action: 'success',
      actorUserId: learnerId,
    });

    const materialAfter = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: material.id },
      include: { refund: true, attempts: true },
    });
    assert.ok(
      materialAfter.status === 'REFUND_PENDING' ||
        materialAfter.status === 'REFUNDED',
      `expected late-success refund path, got ${materialAfter.status}`,
    );
    assert.ok(materialAfter.refund);
    assert.equal(
      materialAfter.refund!.reason,
      'LATE_SUCCESS_AFTER_SOURCE_TERMINAL',
    );
    // Provider money is represented either as a SUCCEEDED attempt and/or a
    // pending/completed late-success refund allocation.
    assert.ok(
      materialAfter.attempts.some((a) => a.status === 'SUCCEEDED') ||
        materialAfter.refund != null,
    );
    assert.equal(Number(materialAfter.amount), 85);
    assert.equal(
      await prisma.delivery.count({ where: { reservationId: reservation.id } }),
      0,
    );
  });

  test('E2E-15/16 allocated material and fee refunds; list/details agree', async () => {
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
    await payReservation(reservation.id, 'success', 'refund');

    await requestFullRefundForPaidOrder({
      orderId: material.id,
      actorUserId: 'pay06-test',
      reason: 'MATERIAL_ONLY',
    });
    const materialRefund = await prisma.paymentRefund.findUniqueOrThrow({
      where: { paymentOrderId: material.id },
    });
    assert.equal(Number(materialRefund.amount), 80);

    let listed = await listMyReservations(learnerId);
    let listRow = listed.find((r) => r.id === reservation.id);
    let detail = await getMyReservationById(learnerId, reservation.id);
    assert.equal(listRow?.paymentSummary?.overallStatus, 'REFUND_PENDING');
    assert.equal(detail.paymentSummary?.overallStatus, 'REFUND_PENDING');
    assert.equal(listRow?.paymentSummary?.checkoutableOrderId, null);

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

    await requestFullRefundForPaidOrder({
      orderId: fee.id,
      actorUserId: 'pay06-test',
      reason: 'FEE_ONLY',
    });
    const feeRefund = await prisma.paymentRefund.findUniqueOrThrow({
      where: { paymentOrderId: fee.id },
    });
    assert.equal(Number(feeRefund.amount), 20);
    await completeMockRefundViaEvent({
      orderId: fee.id,
      outcome: 'succeeded',
    });
    assert.equal(
      (await prisma.paymentOrder.findUniqueOrThrow({ where: { id: fee.id } }))
        .status,
      'REFUNDED',
    );

    listed = await listMyReservations(learnerId);
    listRow = listed.find((r) => r.id === reservation.id);
    detail = await getMyReservationById(learnerId, reservation.id);
    assert.equal(
      listRow?.paymentSummary?.overallStatus,
      detail.paymentSummary?.overallStatus,
    );
    // Refunded obligations must not keep a Pay CTA unless a legitimate new cycle
    // was opened by product rules.
    const status = detail.paymentSummary?.overallStatus;
    assert.ok(
      status === 'REFUNDED' ||
        status === 'REQUIRES_PAYMENT' ||
        status === 'NEW_PAYMENT_CYCLE_REQUIRED',
      `unexpected post-refund status ${status}`,
    );
    if (status === 'REFUNDED') {
      assert.equal(detail.paymentSummary?.checkoutableOrderId, null);
    }
  });

  test('E2E-17 refund failure — order stays PAID; no Pay CTA; no false fulfilled', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 36,
    });
    const material = await ensureAndTrackMaterial(reservation.id);
    assert.ok(material);
    await payReservation(reservation.id, 'success', 'fail-refund');

    await requestFullRefundForPaidOrder({
      orderId: material.id,
      actorUserId: 'pay06-test',
      reason: 'FAIL_PATH',
    });
    await completeMockRefundViaEvent({
      orderId: material.id,
      outcome: 'failed',
    });

    const order = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: material.id },
      include: { refund: true },
    });
    assert.equal(order.status, 'PAID');
    assert.ok(order.refund);
    assert.notEqual(order.refund.status, 'SUCCEEDED');

    const detail = await getMyReservationById(learnerId, reservation.id);
    assert.notEqual(detail.paymentSummary?.overallStatus, 'REQUIRES_PAYMENT');
    // Checkout must not open a new charge cycle solely because refund failed.
    assert.equal(detail.paymentSummary?.checkoutableOrderId, null);
  });

  test('E2E-18 service authorization (learner B blocked)', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 14,
    });
    await ensureAndTrackMaterial(reservation.id);

    await assert.rejects(
      () =>
        startReservationCheckout({
          reservationId: reservation.id,
          payerUserId: otherLearnerId,
          idempotencyKey: `pay06-18-${Date.now()}`,
        }),
      (error: unknown) => error instanceof AppError,
    );
    await assert.rejects(
      () => getMyReservationById(otherLearnerId, reservation.id),
      (error: unknown) => error instanceof AppError,
    );
    await assert.rejects(
      () =>
        getReservationPaymentRequirement(reservation.id, {
          userId: otherLearnerId,
          roles: ['LEARNER'],
        }),
      (error: unknown) => error instanceof AppError,
    );
  });
});
