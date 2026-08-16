import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createServer, type Server } from 'node:http';
import type { Express } from 'express';
import { randomUUID } from 'node:crypto';

import { prisma } from '../../database/prisma.js';
import { signAccessToken } from '../../utils/jwt.js';

import {
  actOnMockCheckout,
  cancelPaymentAttempt,
  completeMockRefundViaEvent,
  requestFullRefundForPaidOrder,
  startPaymentCheckout,
} from './payments.service.js';
import { ensureMaterialPaymentOrder } from './payments.ensure.js';
import { processVerifiedProviderEvent } from './payments.event-processor.js';
import {
  cleanupPayTest,
  createPayReservationFixture,
  createPayTestIds,
  createPayUser,
  createPaymentsCheckoutTestApp,
  trackOrder,
} from './payments.test-helpers.js';
import { getPaymentProvider } from './providers/payment-provider.registry.js';
import { MockPaymentProvider } from './providers/mock/mock.provider.js';
import { signMockPayload } from './providers/mock/mock.hmac.js';
import { PROVIDER_EVENT_TYPES } from './payments.constants.js';

describe('PAY-01A hardening', () => {
  const ids = createPayTestIds();
  let learnerId = '';
  let supplierId = '';
  let app: Express;
  let server: Server;
  let baseUrl = '';

  before(async () => {
    const learner = await createPayUser(ids, {
      role: 'LEARNER',
      emailSuffix: 'pay01a-learner',
    });
    const supplier = await createPayUser(ids, {
      role: 'SUPPLIER',
      emailSuffix: 'pay01a-supplier',
    });
    learnerId = learner.id;
    supplierId = supplier.id;

    app = await createPaymentsCheckoutTestApp();
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to bind test server');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await prisma.paymentProviderEvent.deleteMany({
      where: { providerEventId: { startsWith: 'pay01a_' } },
    });
    await cleanupPayTest(ids);
  });

  async function createPayableOrder(amount = 55) {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: amount,
    });
    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    if (ensured.outcome !== 'CREATED' && ensured.outcome !== 'EXISTING') {
      assert.fail(`expected order, got ${ensured.outcome}`);
    }
    trackOrder(ids, ensured.order.id);
    return ensured.order.id;
  }

  async function payOrder(orderId: string) {
    const checkout = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: `pay01a-pay-${randomUUID()}`,
    });
    await actOnMockCheckout({
      attemptId: checkout.attemptId,
      action: 'success',
      actorUserId: learnerId,
    });
    return checkout;
  }

  async function postSignedWebhook(body: Record<string, unknown>, ts?: number) {
    const rawBody = Buffer.from(JSON.stringify(body), 'utf8');
    const timestampSeconds = ts ?? Math.floor(Date.now() / 1000);
    return fetch(`${baseUrl}/api/payments/webhooks/mock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-impactloop-mock-signature': signMockPayload(timestampSeconds, rawBody),
        'x-impactloop-mock-timestamp': String(timestampSeconds),
      },
      body: rawBody,
    });
  }

  test('unknown attempt signed webhook is REJECTED without 500', async () => {
    const unknownAttemptId = `clunknown${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const body = {
      id: `pay01a_unknown_${randomUUID()}`,
      type: PROVIDER_EVENT_TYPES.PAYMENT_SUCCEEDED,
      data: {
        attemptId: unknownAttemptId,
        providerRef: 'mock_pay_missing',
        amountMinor: 1000,
        currency: 'NIS',
      },
      createdAt: new Date().toISOString(),
    };

    const response = await postSignedWebhook(body);
    assert.equal(response.status, 200);
    const json = (await response.json()) as {
      data: { processingStatus: string; reason: string | null };
    };
    assert.equal(json.data.processingStatus, 'REJECTED');
    assert.equal(json.data.reason, 'ATTEMPT_NOT_FOUND');

    const stored = await prisma.paymentProviderEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: 'MOCK',
          providerEventId: body.id,
        },
      },
    });
    assert.ok(stored);
    assert.equal(stored.processingStatus, 'REJECTED');
    assert.equal(stored.paymentAttemptId, null);
    assert.equal(stored.processingError, 'ATTEMPT_NOT_FOUND');
  });

  test('success missing amount/currency/providerRef is REJECTED', async () => {
    const orderId = await createPayableOrder(56);
    const checkout = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: `pay01a-miss-${randomUUID()}`,
    });
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: checkout.attemptId },
    });

    for (const [field, data] of [
      [
        'amount',
        {
          attemptId: attempt.id,
          providerRef: attempt.providerRef,
          currency: attempt.currency,
        },
      ],
      [
        'currency',
        {
          attemptId: attempt.id,
          providerRef: attempt.providerRef,
          amountMinor: attempt.amountMinor,
        },
      ],
      [
        'providerRef',
        {
          attemptId: attempt.id,
          amountMinor: attempt.amountMinor,
          currency: attempt.currency,
        },
      ],
    ] as const) {
      const body = {
        id: `pay01a_missing_${field}_${randomUUID()}`,
        type: PROVIDER_EVENT_TYPES.PAYMENT_SUCCEEDED,
        data,
        createdAt: new Date().toISOString(),
      };
      const response = await postSignedWebhook(body);
      assert.equal(response.status, 200);
      const json = (await response.json()) as {
        data: { processingStatus: string; reason: string | null };
      };
      assert.equal(json.data.processingStatus, 'REJECTED');
      assert.ok(
        json.data.reason === 'MISSING_AMOUNT' ||
          json.data.reason === 'MISSING_CURRENCY' ||
          json.data.reason === 'MISSING_PROVIDER_REF',
        `field ${field}: ${json.data.reason}`,
      );
    }

    const order = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: orderId },
    });
    assert.notEqual(order.status, 'PAID');
  });

  test('currency and amount mismatch reject success', async () => {
    const orderId = await createPayableOrder(57);
    const checkout = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: `pay01a-mm-${randomUUID()}`,
    });
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: checkout.attemptId },
    });

    const currencyBody = {
      id: `pay01a_cur_${randomUUID()}`,
      type: PROVIDER_EVENT_TYPES.PAYMENT_SUCCEEDED,
      data: {
        attemptId: attempt.id,
        providerRef: attempt.providerRef,
        amountMinor: attempt.amountMinor,
        currency: 'USD',
      },
      createdAt: new Date().toISOString(),
    };
    const currencyResponse = await postSignedWebhook(currencyBody);
    assert.equal(currencyResponse.status, 200);
    const currencyJson = (await currencyResponse.json()) as {
      data: { reason: string | null };
    };
    assert.equal(currencyJson.data.reason, 'CURRENCY_MISMATCH');

    const amountBody = {
      id: `pay01a_amt_${randomUUID()}`,
      type: PROVIDER_EVENT_TYPES.PAYMENT_SUCCEEDED,
      data: {
        attemptId: attempt.id,
        providerRef: attempt.providerRef,
        amountMinor: attempt.amountMinor + 1,
        currency: attempt.currency,
      },
      createdAt: new Date().toISOString(),
    };
    const amountResponse = await postSignedWebhook(amountBody);
    assert.equal(amountResponse.status, 200);
    const amountJson = (await amountResponse.json()) as {
      data: { reason: string | null };
    };
    assert.equal(amountJson.data.reason, 'AMOUNT_MISMATCH');
  });

  test('provider ref mismatch rejects success', async () => {
    const orderId = await createPayableOrder(58);
    const checkout = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: `pay01a-pref-${randomUUID()}`,
    });
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: checkout.attemptId },
    });

    const body = {
      id: `pay01a_pref_${randomUUID()}`,
      type: PROVIDER_EVENT_TYPES.PAYMENT_SUCCEEDED,
      data: {
        attemptId: attempt.id,
        providerRef: 'wrong_ref',
        amountMinor: attempt.amountMinor,
        currency: attempt.currency,
      },
      createdAt: new Date().toISOString(),
    };
    const response = await postSignedWebhook(body);
    assert.equal(response.status, 200);
    const json = (await response.json()) as {
      data: { reason: string | null };
    };
    assert.equal(json.data.reason, 'PROVIDER_REF_MISMATCH');
  });

  test('expired webhook timestamp is rejected at verification', async () => {
    const body = {
      id: `pay01a_replay_${randomUUID()}`,
      type: PROVIDER_EVENT_TYPES.PAYMENT_SUCCEEDED,
      data: {
        attemptId: 'any',
        providerRef: 'x',
        amountMinor: 1,
        currency: 'NIS',
      },
      createdAt: new Date().toISOString(),
    };
    const oldTs = Math.floor(Date.now() / 1000) - 60 * 60;
    const response = await postSignedWebhook(body, oldTs);
    assert.equal(response.status, 401);
  });

  test('two different idempotency keys concurrently create one active attempt', async () => {
    const orderId = await createPayableOrder(59);
    const keyA = `pay01a-conc-a-${randomUUID()}`;
    const keyB = `pay01a-conc-b-${randomUUID()}`;

    const [resultA, resultB] = await Promise.allSettled([
      startPaymentCheckout({
        orderId,
        payerUserId: learnerId,
        idempotencyKey: keyA,
      }),
      startPaymentCheckout({
        orderId,
        payerUserId: learnerId,
        idempotencyKey: keyB,
      }),
    ]);

    const successes = [resultA, resultB].filter(
      (row) => row.status === 'fulfilled',
    ) as PromiseFulfilledResult<{ attemptId: string }>[];
    const failures = [resultA, resultB].filter(
      (row) => row.status === 'rejected',
    );

    assert.ok(successes.length >= 1);

    if (successes.length === 2) {
      assert.equal(successes[0].value.attemptId, successes[1].value.attemptId);
    } else {
      assert.equal(failures.length, 1);
      const err = failures[0] as PromiseRejectedResult;
      const message =
        err.reason instanceof Error ? err.reason.message : String(err.reason);
      assert.ok(
        message.includes('in progress') ||
          message.includes('already being processed') ||
          message.includes('Checkout'),
      );
    }

    const active = await prisma.paymentAttempt.findMany({
      where: {
        paymentOrderId: orderId,
        status: { in: ['CREATED', 'PENDING'] },
      },
    });
    assert.equal(active.length, 1);

    const providerRefs = await prisma.paymentAttempt.findMany({
      where: { paymentOrderId: orderId, providerRef: { not: null } },
    });
    assert.ok(providerRefs.length <= 1);
  });

  test('late success for prior attempt after another paid preserves anomaly', async () => {
    const orderId = await createPayableOrder(60);
    const first = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: `pay01a-late-a-${randomUUID()}`,
    });
    await cancelPaymentAttempt({
      orderId,
      attemptId: first.attemptId,
      payerUserId: learnerId,
    });

    const second = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: `pay01a-late-b-${randomUUID()}`,
    });
    await actOnMockCheckout({
      attemptId: second.attemptId,
      action: 'success',
      actorUserId: learnerId,
    });

    const attemptA = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: first.attemptId },
    });

    const body = {
      id: `pay01a_late_${randomUUID()}`,
      type: PROVIDER_EVENT_TYPES.PAYMENT_SUCCEEDED,
      data: {
        attemptId: attemptA.id,
        providerRef: attemptA.providerRef,
        amountMinor: attemptA.amountMinor,
        currency: attemptA.currency,
      },
      createdAt: new Date().toISOString(),
    };
    const response = await postSignedWebhook(body);
    assert.equal(response.status, 200);
    const json = (await response.json()) as {
      data: { reason: string | null; processingStatus: string };
    };
    assert.equal(json.data.processingStatus, 'PROCESSED');
    assert.equal(json.data.reason, 'DUPLICATE_SUCCESS_DIFFERENT_ATTEMPT');

    const order = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { attempts: true },
    });
    assert.equal(order.status, 'PAID');
    assert.equal(order.attempts.filter((row) => row.status === 'SUCCEEDED').length, 2);

    const event = await prisma.paymentProviderEvent.findUniqueOrThrow({
      where: {
        provider_providerEventId: {
          provider: 'MOCK',
          providerEventId: body.id,
        },
      },
    });
    assert.equal(event.processingError, 'DUPLICATE_SUCCESS_DIFFERENT_ATTEMPT');
  });

  test('terminal payment and refund facts are protected', async () => {
    const orderId = await createPayableOrder(61);
    const checkout = await payOrder(orderId);
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: checkout.attemptId },
    });

    const decline = await processVerifiedProviderEvent(
      {
        provider: 'MOCK',
        providerEventId: `pay01a_term_dec_${randomUUID()}`,
        eventType: PROVIDER_EVENT_TYPES.PAYMENT_DECLINED,
        paymentAttemptId: attempt.id,
        providerRef: attempt.providerRef,
        amountMinor: attempt.amountMinor,
        currency: attempt.currency,
        occurredAt: new Date(),
        payload: {},
      },
      true,
    );
    assert.equal(decline.reason, 'LATE_FAILURE_IGNORED');

    const pending = await processVerifiedProviderEvent(
      {
        provider: 'MOCK',
        providerEventId: `pay01a_term_pen_${randomUUID()}`,
        eventType: PROVIDER_EVENT_TYPES.PAYMENT_PENDING,
        paymentAttemptId: attempt.id,
        providerRef: attempt.providerRef,
        amountMinor: attempt.amountMinor,
        currency: attempt.currency,
        occurredAt: new Date(),
        payload: {},
      },
      true,
    );
    assert.equal(pending.reason, 'LATE_PENDING_SUCCEEDED_ATTEMPT');

    await requestFullRefundForPaidOrder({
      orderId,
      actorUserId: learnerId,
    });
    await completeMockRefundViaEvent({ orderId, outcome: 'succeeded' });

    const latePending = await processVerifiedProviderEvent(
      {
        provider: 'MOCK',
        providerEventId: `pay01a_rfnd_pen_${randomUUID()}`,
        eventType: PROVIDER_EVENT_TYPES.REFUND_PENDING,
        paymentAttemptId: attempt.id,
        providerRef: attempt.providerRef,
        amountMinor: attempt.amountMinor,
        currency: attempt.currency,
        occurredAt: new Date(),
        payload: { providerRefundRef: `mock_rfnd_${orderId}` },
      },
      true,
    );
    assert.equal(latePending.reason, 'LATE_REFUND_PENDING_IGNORED');

    const lateFailed = await processVerifiedProviderEvent(
      {
        provider: 'MOCK',
        providerEventId: `pay01a_rfnd_fail_${randomUUID()}`,
        eventType: PROVIDER_EVENT_TYPES.REFUND_FAILED,
        paymentAttemptId: attempt.id,
        providerRef: attempt.providerRef,
        amountMinor: attempt.amountMinor,
        currency: attempt.currency,
        occurredAt: new Date(),
        payload: {
          providerRefundRef: `mock_rfnd_${orderId}`,
          failureCode: 'X',
        },
      },
      true,
    );
    assert.equal(lateFailed.reason, 'LATE_REFUND_FAILED_IGNORED');

    const order = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { refund: true, attempts: true },
    });
    assert.equal(order.status, 'REFUNDED');
    assert.equal(order.refund?.status, 'SUCCEEDED');
    assert.equal(
      order.attempts.find((row) => row.id === attempt.id)?.status,
      'SUCCEEDED',
    );
  });

  test('refund provider exception and FAILED restore PAID and allow retry reuse', async () => {
    const orderId = await createPayableOrder(62);
    await payOrder(orderId);

    const provider = getPaymentProvider();
    assert.ok(provider instanceof MockPaymentProvider);
    const original = provider.requestRefund.bind(provider);

    provider.requestRefund = async () => {
      throw new Error('simulated provider outage');
    };

    const failed = await requestFullRefundForPaidOrder({
      orderId,
      actorUserId: learnerId,
    });
    assert.equal(failed.kind, 'CREATED');
    assert.equal(failed.status, 'FAILED');

    let order = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { refund: true },
    });
    assert.equal(order.status, 'PAID');
    assert.equal(order.refund?.status, 'FAILED');
    const refundId = order.refund!.id;

    provider.requestRefund = async () => ({
      providerRefundRef: `mock_rfnd_${orderId}`,
      status: 'FAILED',
      failureCode: 'SYNC_FAIL',
      failureMessage: 'provider failed',
    });

    const syncFailed = await requestFullRefundForPaidOrder({
      orderId,
      actorUserId: learnerId,
    });
    assert.equal(syncFailed.refundId, refundId);
    assert.equal(syncFailed.status, 'FAILED');

    provider.requestRefund = original;

    const retried = await requestFullRefundForPaidOrder({
      orderId,
      actorUserId: learnerId,
    });
    assert.equal(retried.refundId, refundId);

    await completeMockRefundViaEvent({ orderId, outcome: 'succeeded' });

    order = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { refund: true },
    });
    assert.equal(order.status, 'REFUNDED');
    assert.equal(order.refund?.id, refundId);

    const refundCount = await prisma.paymentRefund.count({
      where: { paymentOrderId: orderId },
    });
    assert.equal(refundCount, 1);

    provider.requestRefund = original;
  });

  test('learner cannot initiate refund via HTTP', async () => {
    const orderId = await createPayableOrder(63);
    await payOrder(orderId);
    const learnerToken = signAccessToken({
      sub: learnerId,
      roles: ['LEARNER'],
    });

    const response = await fetch(
      `${baseUrl}/api/payments/orders/${orderId}/refund`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${learnerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'please refund' }),
      },
    );
    assert.ok(response.status === 404 || response.status === 405);
  });

  test('active-attempt uniqueness and DB amount/cycle constraints', async () => {
    const orderId = await createPayableOrder(64);
    await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: `pay01a-uniq-${randomUUID()}`,
    });

    const order = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: orderId },
    });

    await assert.rejects(() =>
      prisma.paymentAttempt.create({
        data: {
          paymentOrderId: orderId,
          provider: 'MOCK',
          providerMode: 'LOCAL',
          status: 'PENDING',
          amount: order.amount,
          currency: order.currency,
          amountMinor: Number(order.amount) * 100,
        },
      }),
    );

    await assert.rejects(() =>
      prisma.$executeRaw`
        INSERT INTO payment_orders (
          id, payer_user_id, purpose, cycle_number, status, currency, amount,
          reservation_id, created_at, updated_at
        ) VALUES (
          ${`pay01a_bad_${randomUUID()}`},
          ${learnerId},
          'MATERIAL_SUBTOTAL'::"PaymentPurpose",
          0,
          'REQUIRES_PAYMENT'::"PaymentOrderStatus",
          'NIS',
          10.00,
          ${order.reservationId},
          NOW(),
          NOW()
        )
      `,
    );

    await assert.rejects(() =>
      prisma.$executeRaw`
        INSERT INTO payment_orders (
          id, payer_user_id, purpose, cycle_number, status, currency, amount,
          reservation_id, created_at, updated_at
        ) VALUES (
          ${`pay01a_badamt_${randomUUID()}`},
          ${learnerId},
          'MATERIAL_SUBTOTAL'::"PaymentPurpose",
          99,
          'REQUIRES_PAYMENT'::"PaymentOrderStatus",
          'NIS',
          0,
          ${order.reservationId},
          NOW(),
          NOW()
        )
      `,
    );
  });
});

/**
 * PAY-01 / PAY-01A test summary
 * Implemented: ensure*, checkout idempotency, webhook HMAC, unknown attempt,
 * missing fields, currency/amount/providerRef mismatch, expired timestamp,
 * concurrent different keys, late second-attempt success, terminal payment/refund
 * protection, refund exception/FAILED/retry reuse, learner refund HTTP denial,
 * active-attempt uniqueness, positive amount/cycle DB checks, isolated Category fixtures.
 * Deferred: real provider adapters, reservation/delivery lifecycle refund wiring (PAY-03),
 * dispatch gating (PAY-02), returnUrl allowlist redirects, dispute infrastructure.
 */
