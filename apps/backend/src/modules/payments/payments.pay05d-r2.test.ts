import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';

import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';

import {
  PROVIDER_CHECKOUT_CLAIM_LEASE_MS,
} from './payments.constants.js';
import {
  finalizeSessionCheckoutWithProviderForTests,
  getCheckoutSessionForActor,
  getRelevantCheckoutSessionForReservation,
  reconcileExpiredCheckoutSessions,
  startReservationCheckout,
} from './payments.checkout-session.js';
import { handleReservationPaymentLifecycleTransition } from './payments.lifecycle.js';
import { setElectronicPaymentEnforcementForTests } from './payments.policy.js';
import {
  actOnMockCheckout,
  startPaymentCheckout,
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

describe('PAY-05D-R2 handoff race / legacy double-charge / claim / shared resume', () => {
  const ids = createPayTestIds();
  let learnerId = '';
  let otherLearnerId = '';
  let supplierId = '';

  before(async () => {
    learnerId = (
      await createPayUser(ids, { role: 'LEARNER', emailSuffix: 'pay05dr2-l' })
    ).id;
    otherLearnerId = (
      await createPayUser(ids, {
        role: 'LEARNER',
        emailSuffix: 'pay05dr2-other',
      })
    ).id;
    supplierId = (
      await createPayUser(ids, { role: 'SUPPLIER', emailSuffix: 'pay05dr2-s' })
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

  test('legacy: active PENDING attempt blocks combined checkout', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 33,
    });
    const material = await ensureAndTrackMaterial(reservation.id);
    assert.ok(material);

    const legacy = await startPaymentCheckout({
      orderId: material.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05dr2-leg-block-${Date.now()}`,
    });
    assert.ok(legacy.providerRef || legacy.checkoutUrl);

    await assert.rejects(
      () =>
        startReservationCheckout({
          reservationId: reservation.id,
          payerUserId: learnerId,
          idempotencyKey: `pay05dr2-sess-block-${Date.now()}`,
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'CHECKOUT_IN_PROGRESS');
        return true;
      },
    );
  });

  test('legacy: CREATED without providerRef can be safely superseded', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 34,
    });
    const material = await ensureAndTrackMaterial(reservation.id);
    assert.ok(material);

    const orphan = await prisma.paymentAttempt.create({
      data: {
        paymentOrderId: material.id,
        provider: 'MOCK',
        providerMode: 'LOCAL',
        status: 'CREATED',
        amount: material.amount,
        currency: material.currency,
        amountMinor: 3400,
      },
    });

    const session = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05dr2-supersede-${Date.now()}`,
    });
    assert.ok(session.attemptId);

    const cancelled = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: orphan.id },
    });
    assert.equal(cancelled.status, 'CANCELLED');
    assert.equal(cancelled.failureCode, 'SUPERSEDED_BY_SESSION');
  });

  test('legacy succeeds then session late success → duplicate allocation refunded, no net double charge', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 35,
    });
    const material = await ensureAndTrackMaterial(reservation.id);
    assert.ok(material);

    // Force a race-shaped DB state: order PAID by legacy + session PENDING with provider.
    const legacy = await startPaymentCheckout({
      orderId: material.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05dr2-race-leg-${Date.now()}`,
    });
    await actOnMockCheckout({
      attemptId: legacy.attemptId,
      action: 'success',
      actorUserId: learnerId,
    });
    assert.equal(
      (await prisma.paymentOrder.findUniqueOrThrow({ where: { id: material.id } }))
        .status,
      'PAID',
    );

    // Manually create a session snapshot that still includes the paid order
    // (simulates reservation race that escaped start-time checks).
    const session = await prisma.paymentCheckoutSession.create({
      data: {
        payerUserId: learnerId,
        reservationId: reservation.id,
        status: 'CHECKOUT_PENDING',
        currency: 'NIS',
        totalAmount: new Prisma.Decimal(35),
        totalAmountMinor: 3500,
        items: {
          create: [
            {
              paymentOrderId: material.id,
              purpose: 'MATERIAL_SUBTOTAL',
              amount: new Prisma.Decimal(35),
              amountMinor: 3500,
              currency: 'NIS',
              status: 'PENDING',
            },
          ],
        },
      },
    });
    const sessionAttempt = await prisma.paymentAttempt.create({
      data: {
        checkoutSessionId: session.id,
        paymentOrderId: null,
        provider: 'MOCK',
        providerMode: 'LOCAL',
        status: 'PENDING',
        amount: new Prisma.Decimal(35),
        currency: 'NIS',
        amountMinor: 3500,
        providerRef: `mock_pay_forced_${session.id}`,
        providerMetadata: {
          checkoutUrl: 'https://example.test/mock',
          providerCheckoutClaim: 'finalized',
        },
      },
    });

    // Seed mock ledger for the forced providerRef via createCheckout shape.
    const { getPaymentProvider } = await import(
      './providers/payment-provider.registry.js'
    );
    const { MockPaymentProvider } = await import(
      './providers/mock/mock.provider.js'
    );
    const provider = getPaymentProvider();
    assert.ok(provider instanceof MockPaymentProvider);
    await provider.createCheckout({
      attemptId: sessionAttempt.id,
      paymentOrderId: session.id,
      payerUserId: learnerId,
      amountMinor: 3500,
      currency: 'NIS',
    });
    await prisma.paymentAttempt.update({
      where: { id: sessionAttempt.id },
      data: { providerRef: `mock_pay_${sessionAttempt.id}` },
    });

    await actOnMockCheckout({
      attemptId: sessionAttempt.id,
      action: 'success',
      actorUserId: learnerId,
    });

    const orderAfter = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: material.id },
      include: { refund: true },
    });
    assert.equal(orderAfter.status, 'PAID');
    assert.equal(orderAfter.refund, null);

    const item = await prisma.paymentCheckoutSessionItem.findFirstOrThrow({
      where: { checkoutSessionId: session.id, paymentOrderId: material.id },
    });
    assert.equal(item.status, 'REFUNDED');
    assert.equal(item.refundedAmountMinor, 3500);

    // Duplicate event remains idempotent.
    await actOnMockCheckout({
      attemptId: sessionAttempt.id,
      action: 'success',
      actorUserId: learnerId,
    });
    assert.equal(
      (await prisma.paymentOrder.findUniqueOrThrow({ where: { id: material.id } }))
        .status,
      'PAID',
    );
  });

  test('claim: retry before lease expiry is blocked; after expiry recovers once', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 36,
    });
    await ensureAndTrackMaterial(reservation.id);

    const first = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05dr2-claim-1-${Date.now()}`,
    });

    // Simulate crash after claim, before persistence: CREATED + in_progress lease.
    const future = new Date(Date.now() + PROVIDER_CHECKOUT_CLAIM_LEASE_MS);
    await prisma.paymentAttempt.update({
      where: { id: first.attemptId! },
      data: {
        status: 'CREATED',
        providerRef: null,
        checkoutRef: null,
        expiresAt: future,
        providerMetadata: {
          providerCheckoutClaim: 'in_progress',
          providerCheckoutClaimedAt: new Date().toISOString(),
          providerCheckoutClaimExpiresAt: future.toISOString(),
        },
      },
    });
    await prisma.paymentCheckoutSession.update({
      where: { id: first.checkoutSessionId },
      data: { status: 'CREATED', expiresAt: future },
    });

    await assert.rejects(
      () =>
        startReservationCheckout({
          reservationId: reservation.id,
          payerUserId: learnerId,
          idempotencyKey: `pay05dr2-claim-2-${Date.now()}`,
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'CHECKOUT_IN_PROGRESS');
        return true;
      },
    );

    const past = new Date(Date.now() - 1_000);
    await prisma.paymentAttempt.update({
      where: { id: first.attemptId! },
      data: {
        expiresAt: past,
        providerMetadata: {
          providerCheckoutClaim: 'in_progress',
          providerCheckoutClaimedAt: new Date(
            Date.now() - PROVIDER_CHECKOUT_CLAIM_LEASE_MS - 1_000,
          ).toISOString(),
          providerCheckoutClaimExpiresAt: past.toISOString(),
        },
      },
    });

    const recovered = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05dr2-claim-3-${Date.now()}`,
    });
    assert.equal(recovered.checkoutSessionId, first.checkoutSessionId);
    assert.equal(recovered.attemptId, first.attemptId);
    assert.ok(recovered.checkoutUrl);
    assert.equal(recovered.attemptStatus, 'PENDING');

    const attempts = await prisma.paymentAttempt.count({
      where: {
        checkoutSessionId: first.checkoutSessionId,
        status: { in: ['CREATED', 'PENDING', 'SUCCEEDED'] },
      },
    });
    assert.equal(attempts, 1);
  });

  test('claim: reconcile expires abandoned CREATED attempts without starting second checkout', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 37,
    });
    await ensureAndTrackMaterial(reservation.id);

    const checkout = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05dr2-recon-${Date.now()}`,
    });

    const past = new Date(Date.now() - PROVIDER_CHECKOUT_CLAIM_LEASE_MS * 3);
    await prisma.$executeRaw`
      UPDATE "payment_attempts"
      SET
        "status" = 'CREATED',
        "provider_ref" = NULL,
        "checkout_ref" = NULL,
        "expires_at" = ${past},
        "created_at" = ${past},
        "provider_metadata" = ${JSON.stringify({
          providerCheckoutClaim: 'in_progress',
          providerCheckoutClaimExpiresAt: past.toISOString(),
        })}::jsonb
      WHERE "id" = ${checkout.attemptId!}
    `;
    await prisma.paymentCheckoutSession.update({
      where: { id: checkout.checkoutSessionId },
      data: { status: 'CREATED', expiresAt: past },
    });

    const result = await reconcileExpiredCheckoutSessions({
      reservationId: reservation.id,
    });
    assert.ok(result.expiredSessionCount >= 1);
    assert.equal(
      (
        await prisma.paymentCheckoutSession.findUniqueOrThrow({
          where: { id: checkout.checkoutSessionId },
        })
      ).status,
      'EXPIRED',
    );
  });

  test('handoff: reservation cancel during claim is not resurrected', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 38,
    });
    await ensureAndTrackMaterial(reservation.id);

    const checkout = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05dr2-handoff-${Date.now()}`,
    });

    // Simulate in-flight claim (provider call about to return).
    await prisma.paymentAttempt.update({
      where: { id: checkout.attemptId! },
      data: {
        status: 'CREATED',
        providerRef: null,
        providerMetadata: {
          providerCheckoutClaim: 'in_progress',
          providerCheckoutClaimExpiresAt: new Date(
            Date.now() + 60_000,
          ).toISOString(),
        },
      },
    });
    await prisma.paymentCheckoutSession.update({
      where: { id: checkout.checkoutSessionId },
      data: { status: 'CREATED' },
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
        reason: 'pay05dr2-handoff',
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

    // Provider result arrives late — CAS must not resurrect to PENDING.
    let finalizeError: unknown = null;
    let after = null as Awaited<
      ReturnType<typeof finalizeSessionCheckoutWithProviderForTests>
    > | null;
    try {
      after = await finalizeSessionCheckoutWithProviderForTests({
        sessionId: checkout.checkoutSessionId,
        attemptId: checkout.attemptId!,
        attemptStatus: 'CREATED',
        needsProviderCheckout: true,
        amountMinor: 3800,
        currency: 'NIS',
        checkoutUrl: null,
        providerRef: null,
        expiresAt: null,
        payerUserId: learnerId,
      });
    } catch (error) {
      finalizeError = error;
    }

    const sessionAfter = await prisma.paymentCheckoutSession.findUniqueOrThrow({
      where: { id: checkout.checkoutSessionId },
    });
    const attemptAfter = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: checkout.attemptId! },
    });
    assert.equal(sessionAfter.status, 'CANCELLED');
    assert.notEqual(attemptAfter.status, 'PENDING');
    if (after) {
      assert.equal(after.status, 'CANCELLED');
      assert.notEqual(after.attemptStatus, 'PENDING');
    } else {
      assert.ok(finalizeError instanceof AppError);
    }
  });

  test('shared-group: resume from Reservation B restores same session/attempt', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 14,
    });
    const reservationA = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 40,
      fulfillmentMethod: 'DELIVERY',
      deliveryFee: 14,
      deliveryGroupId: group.id,
    });
    const reservationB = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 22,
      fulfillmentMethod: 'DELIVERY',
      deliveryFee: 0,
      deliveryGroupId: group.id,
    });
    await ensureAndTrackMaterial(reservationA.id);
    await ensureAndTrackMaterial(reservationB.id);
    await ensureAndTrackFee(group.id);

    const fromA = await startReservationCheckout({
      reservationId: reservationA.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05dr2-share-a-${Date.now()}`,
    });
    assert.ok(fromA.items.length >= 3);

    const fromB = await getRelevantCheckoutSessionForReservation(
      reservationB.id,
      { userId: learnerId, roles: ['LEARNER'] },
    );
    assert.ok(fromB);
    assert.equal(fromB!.checkoutSessionId, fromA.checkoutSessionId);
    assert.equal(fromB!.attemptId, fromA.attemptId);

    // Processing restore from B.
    await prisma.paymentAttempt.update({
      where: { id: fromA.attemptId! },
      data: { status: 'PENDING' },
    });
    const processing = await getRelevantCheckoutSessionForReservation(
      reservationB.id,
      { userId: learnerId, roles: ['LEARNER'] },
    );
    assert.ok(processing);
    assert.equal(processing!.attemptStatus, 'PENDING');
    assert.equal(processing!.status, 'CHECKOUT_PENDING');

    // Outside reservation / other payer cannot access the shared session.
    const outsider = await createPayReservationFixture(ids, {
      learnerId: otherLearnerId,
      supplierId,
      materialSubtotal: 10,
    });
    await ensureAndTrackMaterial(outsider.id);

    const otherView = await getRelevantCheckoutSessionForReservation(
      outsider.id,
      { userId: otherLearnerId, roles: ['LEARNER'] },
    );
    assert.ok(
      otherView === null ||
        otherView.checkoutSessionId !== fromA.checkoutSessionId,
    );

    await assert.rejects(
      () =>
        getCheckoutSessionForActor(fromA.checkoutSessionId, {
          userId: otherLearnerId,
          roles: ['LEARNER'],
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'NOT_FOUND');
        return true;
      },
    );
  });
});
