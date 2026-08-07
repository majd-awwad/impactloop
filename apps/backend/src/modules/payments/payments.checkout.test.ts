import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createServer, type Server } from 'node:http';

import { app } from '../../app.js';
import { prisma } from '../../database/prisma.js';
import { signAccessToken } from '../../utils/jwt.js';

import {
  actOnMockCheckout,
  cancelPaymentAttempt,
  completeMockRefundViaEvent,
  getPaymentOrderForActor,
  requestFullRefundForPaidOrder,
  startPaymentCheckout,
} from './payments.service.js';
import { ensureMaterialPaymentOrder } from './payments.ensure.js';
import {
  cleanupPayTest,
  createPayReservationFixture,
  createPayTestIds,
  createPayUser,
  trackOrder,
} from './payments.test-helpers.js';
import { getPaymentProvider } from './providers/payment-provider.registry.js';
import { MockPaymentProvider } from './providers/mock/mock.provider.js';
import { signMockPayload } from './providers/mock/mock.hmac.js';
import { processVerifiedProviderEvent } from './payments.event-processor.js';

describe('PAY-01 checkout idempotency and events', () => {
  const ids = createPayTestIds();
  let learnerId = '';
  let otherLearnerId = '';
  let supplierId = '';
  let adminId = '';
  let server: Server;
  let baseUrl = '';

  before(async () => {
    const learner = await createPayUser(ids, {
      role: 'LEARNER',
      emailSuffix: 'checkout-learner',
    });
    const other = await createPayUser(ids, {
      role: 'LEARNER',
      emailSuffix: 'checkout-other',
    });
    const supplier = await createPayUser(ids, {
      role: 'SUPPLIER',
      emailSuffix: 'checkout-supplier',
    });
    const admin = await createPayUser(ids, {
      role: 'ADMIN',
      emailSuffix: 'checkout-admin',
    });
    learnerId = learner.id;
    otherLearnerId = other.id;
    supplierId = supplier.id;
    adminId = admin.id;

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
    await cleanupPayTest(ids);
  });

  async function createPayableOrder(amount = 25) {
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

  test('checkout creates attempt for payable order', async () => {
    const orderId = await createPayableOrder(30);
    const checkout = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: `pay-checkout-key-001-${Date.now()}`,
    });

    assert.ok(checkout.attemptId);
    assert.equal(checkout.orderStatus, 'CHECKOUT_PENDING');
    assert.ok(checkout.checkoutUrl.includes(checkout.attemptId));
  });

  test('retry after failed attempt creates another attempt on same order', async () => {
    const orderId = await createPayableOrder(31);
    const first = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: `pay-checkout-key-002a-${Date.now()}`,
    });

    await actOnMockCheckout({
      attemptId: first.attemptId,
      action: 'decline',
      actorUserId: learnerId,
    });

    const second = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: `pay-checkout-key-002b-${Date.now()}`,
    });

    assert.notEqual(first.attemptId, second.attemptId);
    const attempts = await prisma.paymentAttempt.count({
      where: { paymentOrderId: orderId },
    });
    assert.ok(attempts >= 2);
  });

  test('same Idempotency-Key returns same checkout result', async () => {
    const orderId = await createPayableOrder(32);
    const key = `pay-checkout-key-003-${Date.now()}abcdefgh`;
    const first = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: key,
    });
    const second = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: key,
    });
    assert.equal(first.attemptId, second.attemptId);
    assert.equal(first.checkoutUrl, second.checkoutUrl);
  });

  test('another learner cannot access or checkout the order', async () => {
    const orderId = await createPayableOrder(33);

    await assert.rejects(
      () =>
        getPaymentOrderForActor(orderId, {
          userId: otherLearnerId,
          roles: ['LEARNER'],
        }),
      (error: unknown) =>
        error instanceof Error && (error as { code?: string }).code === 'NOT_FOUND',
    );

    await assert.rejects(
      () =>
        startPaymentCheckout({
          orderId,
          payerUserId: otherLearnerId,
          idempotencyKey: `pay-checkout-key-004-${Date.now()}abcdefgh`,
        }),
    );
  });

  test('admin can read payment order', async () => {
    const orderId = await createPayableOrder(34);
    const dto = await getPaymentOrderForActor(orderId, {
      userId: adminId,
      roles: ['ADMIN'],
    });
    assert.equal(dto.id, orderId);
    assert.ok(!('providerMetadata' in dto));
  });

  test('paid order cannot start checkout', async () => {
    const orderId = await createPayableOrder(35);
    const checkout = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: `pay-checkout-key-005-${Date.now()}abcdefgh`,
    });
    await actOnMockCheckout({
      attemptId: checkout.attemptId,
      action: 'success',
      actorUserId: learnerId,
    });

    await assert.rejects(
      () =>
        startPaymentCheckout({
          orderId,
          payerUserId: learnerId,
          idempotencyKey: `pay-checkout-key-005b-${Date.now()}abcdefgh`,
        }),
      (error: unknown) =>
        error instanceof Error &&
        (error as { code?: string }).code === 'PAYMENT_ALREADY_PAID',
    );
  });

  test('valid success marks attempt succeeded and order paid', async () => {
    const orderId = await createPayableOrder(36);
    const checkout = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: `pay-checkout-key-006-${Date.now()}abcdefgh`,
    });
    const result = await actOnMockCheckout({
      attemptId: checkout.attemptId,
      action: 'success',
      actorUserId: learnerId,
    });
    assert.equal(result.order.status, 'PAID');
    assert.ok(result.order.paidAt);
  });

  test('decline makes order retryable', async () => {
    const orderId = await createPayableOrder(37);
    const checkout = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: `pay-checkout-key-007-${Date.now()}abcdefgh`,
    });
    const result = await actOnMockCheckout({
      attemptId: checkout.attemptId,
      action: 'decline',
      actorUserId: learnerId,
    });
    assert.equal(result.order.status, 'REQUIRES_PAYMENT');
  });

  test('duplicate provider event is a no-op', async () => {
    const orderId = await createPayableOrder(38);
    const checkout = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: `pay-checkout-key-008-${Date.now()}abcdefgh`,
    });

    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: checkout.attemptId },
    });
    const provider = getPaymentProvider();
    assert.ok(provider instanceof MockPaymentProvider);
    const built = provider.buildActionEvent({
      action: 'success',
      attemptId: attempt.id,
      providerRef: attempt.providerRef!,
      amountMinor: attempt.amountMinor,
      currency: attempt.currency,
      providerEventId: `dup-evt-${Date.now()}`,
    });

    const rawBody = Buffer.from(JSON.stringify(built.body), 'utf8');
    const ts = Math.floor(Date.now() / 1000);
    const headers = {
      'x-impactloop-mock-signature': signMockPayload(ts, rawBody),
      'x-impactloop-mock-timestamp': String(ts),
    };
    const verified = await provider.verifyAndNormalizeEvent({ rawBody, headers });
    assert.equal(verified.ok, true);
    if (!verified.ok) {
      assert.fail('expected verified');
    }

    const first = await processVerifiedProviderEvent(
      verified.event,
      verified.signatureValid,
    );
    const second = await processVerifiedProviderEvent(
      verified.event,
      verified.signatureValid,
    );
    assert.equal(first.processingStatus, 'PROCESSED');
    assert.equal(second.processingStatus, 'IGNORED_DUPLICATE');

    const order = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: orderId },
    });
    assert.equal(order.status, 'PAID');
  });

  test('invalid signature is rejected', async () => {
    const orderId = await createPayableOrder(39);
    const checkout = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: `pay-checkout-key-009-${Date.now()}abcdefgh`,
    });
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: checkout.attemptId },
    });
    const provider = getPaymentProvider();
    assert.ok(provider instanceof MockPaymentProvider);
    const built = provider.buildActionEvent({
      action: 'success',
      attemptId: attempt.id,
      providerRef: attempt.providerRef!,
      amountMinor: attempt.amountMinor,
      currency: attempt.currency,
    });
    const rawBody = Buffer.from(JSON.stringify(built.body), 'utf8');
    const verified = await provider.verifyAndNormalizeEvent({
      rawBody,
      headers: {
        'x-impactloop-mock-signature': 'deadbeef',
        'x-impactloop-mock-timestamp': String(Math.floor(Date.now() / 1000)),
      },
    });
    assert.equal(verified.ok, false);
  });

  test('amount mismatch is rejected', async () => {
    const orderId = await createPayableOrder(40);
    const checkout = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: `pay-checkout-key-010-${Date.now()}abcdefgh`,
    });
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: checkout.attemptId },
    });
    const provider = getPaymentProvider();
    assert.ok(provider instanceof MockPaymentProvider);
    const built = provider.buildActionEvent({
      action: 'success',
      attemptId: attempt.id,
      providerRef: attempt.providerRef!,
      amountMinor: attempt.amountMinor + 1,
      currency: attempt.currency,
    });
    const rawBody = Buffer.from(JSON.stringify(built.body), 'utf8');
    const ts = Math.floor(Date.now() / 1000);
    const verified = await provider.verifyAndNormalizeEvent({
      rawBody,
      headers: {
        'x-impactloop-mock-signature': signMockPayload(ts, rawBody),
        'x-impactloop-mock-timestamp': String(ts),
      },
    });
    assert.ok(verified.ok);
    if (!verified.ok) {
      assert.fail('signature should pass');
    }
    const processed = await processVerifiedProviderEvent(
      verified.event,
      verified.signatureValid,
    );
    assert.equal(processed.processingStatus, 'REJECTED');
    assert.equal(processed.reason, 'AMOUNT_MISMATCH');

    const order = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: orderId },
    });
    assert.notEqual(order.status, 'PAID');
  });

  test('late failure does not downgrade paid', async () => {
    const orderId = await createPayableOrder(41);
    const checkout = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: `pay-checkout-key-011-${Date.now()}abcdefgh`,
    });
    await actOnMockCheckout({
      attemptId: checkout.attemptId,
      action: 'success',
      actorUserId: learnerId,
    });

    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: checkout.attemptId },
    });
    const provider = getPaymentProvider();
    assert.ok(provider instanceof MockPaymentProvider);
    const built = provider.buildActionEvent({
      action: 'decline',
      attemptId: attempt.id,
      providerRef: attempt.providerRef!,
      amountMinor: attempt.amountMinor,
      currency: attempt.currency,
    });
    const rawBody = Buffer.from(JSON.stringify(built.body), 'utf8');
    const ts = Math.floor(Date.now() / 1000);
    const verified = await provider.verifyAndNormalizeEvent({
      rawBody,
      headers: {
        'x-impactloop-mock-signature': signMockPayload(ts, rawBody),
        'x-impactloop-mock-timestamp': String(ts),
      },
    });
    assert.ok(verified.ok);
    if (!verified.ok) {
      assert.fail('expected verified');
    }
    const processed = await processVerifiedProviderEvent(
      verified.event,
      verified.signatureValid,
    );
    assert.equal(processed.reason, 'LATE_FAILURE_IGNORED');

    const order = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: orderId },
    });
    assert.equal(order.status, 'PAID');
  });

  test('cancel unpaid attempt is retry-safe', async () => {
    const orderId = await createPayableOrder(42);
    const checkout = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: `pay-checkout-key-012-${Date.now()}abcdefgh`,
    });

    const first = await cancelPaymentAttempt({
      orderId,
      attemptId: checkout.attemptId,
      payerUserId: learnerId,
    });
    const second = await cancelPaymentAttempt({
      orderId,
      attemptId: checkout.attemptId,
      payerUserId: learnerId,
    });
    assert.equal(first.attemptStatus, 'CANCELLED');
    assert.equal(second.attemptStatus, 'CANCELLED');
    assert.equal(first.orderStatus, 'REQUIRES_PAYMENT');
  });

  test('full refund lifecycle succeeds and cannot reopen', async () => {
    const orderId = await createPayableOrder(43);
    const checkout = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: `pay-checkout-key-013-${Date.now()}abcdefgh`,
    });
    await actOnMockCheckout({
      attemptId: checkout.attemptId,
      action: 'success',
      actorUserId: learnerId,
    });

    const refund = await requestFullRefundForPaidOrder({
      orderId,
      actorUserId: learnerId,
      reason: 'test refund',
    });
    assert.ok(refund.refundId);

    const completed = await completeMockRefundViaEvent({
      orderId,
      outcome: 'succeeded',
    });
    assert.equal(completed.processingStatus, 'PROCESSED');

    const order = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { refund: true, attempts: true },
    });
    assert.equal(order.status, 'REFUNDED');
    assert.equal(order.refund?.status, 'SUCCEEDED');
    assert.ok(order.attempts.some((row) => row.status === 'SUCCEEDED'));

    const again = await requestFullRefundForPaidOrder({
      orderId,
      actorUserId: learnerId,
    });
    assert.equal(again.refundId, refund.refundId);

    await assert.rejects(
      () =>
        startPaymentCheckout({
          orderId,
          payerUserId: learnerId,
          idempotencyKey: `pay-checkout-key-013b-${Date.now()}abcdefgh`,
        }),
    );
  });

  test('mock refund failure does not mark order refunded', async () => {
    const orderId = await createPayableOrder(44);
    const checkout = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: `pay-checkout-key-014-${Date.now()}abcdefgh`,
    });
    await actOnMockCheckout({
      attemptId: checkout.attemptId,
      action: 'success',
      actorUserId: learnerId,
    });
    await requestFullRefundForPaidOrder({
      orderId,
      actorUserId: learnerId,
    });
    await completeMockRefundViaEvent({
      orderId,
      outcome: 'failed',
      failureCode: 'MOCK_REFUND_FAILED',
      failureMessage: 'simulated',
    });

    const order = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { refund: true },
    });
    assert.equal(order.status, 'PAID');
    assert.equal(order.refund?.status, 'FAILED');
  });

  test('HTTP checkout and webhook paths', async () => {
    const orderId = await createPayableOrder(45);
    const learnerToken = signAccessToken({
      sub: learnerId,
      roles: ['LEARNER'],
    });

    const checkoutResponse = await fetch(
      `${baseUrl}/api/payments/orders/${orderId}/checkout`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${learnerToken}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `pay-http-checkout-${Date.now()}abcdefgh`,
        },
        body: JSON.stringify({}),
      },
    );
    assert.equal(checkoutResponse.status, 200);
    const checkoutJson = (await checkoutResponse.json()) as {
      data: { attemptId: string };
    };

    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: checkoutJson.data.attemptId },
    });
    const provider = getPaymentProvider();
    assert.ok(provider instanceof MockPaymentProvider);
    const built = provider.buildActionEvent({
      action: 'success',
      attemptId: attempt.id,
      providerRef: attempt.providerRef!,
      amountMinor: attempt.amountMinor,
      currency: attempt.currency,
    });
    const rawBody = Buffer.from(JSON.stringify(built.body), 'utf8');
    const ts = Math.floor(Date.now() / 1000);
    const webhookResponse = await fetch(
      `${baseUrl}/api/payments/webhooks/mock`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-impactloop-mock-signature': signMockPayload(ts, rawBody),
          'x-impactloop-mock-timestamp': String(ts),
        },
        body: rawBody,
      },
    );
    assert.equal(webhookResponse.status, 200);

    const getResponse = await fetch(`${baseUrl}/api/payments/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${learnerToken}` },
    });
    assert.equal(getResponse.status, 200);
    const getJson = (await getResponse.json()) as {
      data: { status: string; amount: string };
    };
    assert.equal(getJson.data.status, 'PAID');
    assert.equal(getJson.data.amount, '45.00');
  });
});
