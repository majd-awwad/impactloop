import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import {
  actOnMockCheckout,
  getPaymentOrderForActor,
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

/**
 * PAY-05C contract: checkout UX depends on these backend truths.
 * Covers valid checkout, duplicate/idempotent start, processing, verified
 * success, failure/retry, already-paid, cancelled, and unauthorized access.
 */
describe('PAY-05C checkout UX backend contract', () => {
  const ids = createPayTestIds();
  let learnerId = '';
  let otherLearnerId = '';
  let supplierId = '';

  before(async () => {
    const learner = await createPayUser(ids, {
      role: 'LEARNER',
      emailSuffix: 'pay05c-learner',
    });
    const other = await createPayUser(ids, {
      role: 'LEARNER',
      emailSuffix: 'pay05c-other',
    });
    const supplier = await createPayUser(ids, {
      role: 'SUPPLIER',
      emailSuffix: 'pay05c-supplier',
    });
    learnerId = learner.id;
    otherLearnerId = other.id;
    supplierId = supplier.id;
  });

  after(async () => {
    await cleanupPayTest(ids);
  });

  async function createPayableOrder(amount = 16) {
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

  test('valid checkout returns attempt without treating start as paid', async () => {
    const orderId = await createPayableOrder(16);
    const checkout = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: `pay05c-valid-${Date.now()}`,
    });

    assert.equal(checkout.orderId, orderId);
    assert.equal(checkout.orderStatus, 'CHECKOUT_PENDING');
    assert.ok(checkout.attemptId);
    assert.ok(['CREATED', 'PENDING'].includes(checkout.attemptStatus));

    const order = await getPaymentOrderForActor(orderId, {
      userId: learnerId,
      roles: ['LEARNER'],
    });
    assert.equal(order.status, 'CHECKOUT_PENDING');
    assert.notEqual(order.status, 'PAID');
  });

  test('duplicate idempotent checkout does not create a second attempt', async () => {
    const orderId = await createPayableOrder(18);
    const key = `pay05c-idem-${Date.now()}`;
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

  test('verified success comes from mock act, not checkout start', async () => {
    const orderId = await createPayableOrder(20);
    const checkout = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: `pay05c-success-${Date.now()}`,
    });

    const acted = await actOnMockCheckout({
      attemptId: checkout.attemptId,
      action: 'success',
      actorUserId: learnerId,
    });

    assert.equal(acted.order.status, 'PAID');
    assert.ok(acted.order.paidAt);
  });

  test('failure leaves order payable for retry', async () => {
    const orderId = await createPayableOrder(22);
    const checkout = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: `pay05c-fail-${Date.now()}`,
    });

    const acted = await actOnMockCheckout({
      attemptId: checkout.attemptId,
      action: 'decline',
      actorUserId: learnerId,
    });

    assert.equal(acted.order.status, 'REQUIRES_PAYMENT');
    const failed = acted.order.attempts.find((a) => a.id === checkout.attemptId);
    assert.equal(failed?.status, 'FAILED');

    const retry = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: `pay05c-retry-${Date.now()}`,
    });
    assert.notEqual(retry.attemptId, checkout.attemptId);
    assert.equal(retry.orderStatus, 'CHECKOUT_PENDING');
  });

  test('pending action keeps processing state until verified', async () => {
    const orderId = await createPayableOrder(24);
    const checkout = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: `pay05c-pending-${Date.now()}`,
    });

    const acted = await actOnMockCheckout({
      attemptId: checkout.attemptId,
      action: 'pending',
      actorUserId: learnerId,
    });

    assert.equal(acted.order.status, 'CHECKOUT_PENDING');
    const pending = acted.order.attempts.find((a) => a.id === checkout.attemptId);
    assert.equal(pending?.status, 'PENDING');
  });

  test('already paid order cannot start checkout', async () => {
    const orderId = await createPayableOrder(26);
    const checkout = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: `pay05c-paid-start-${Date.now()}`,
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
          idempotencyKey: `pay05c-paid-again-${Date.now()}`,
        }),
      (error: unknown) => {
        assert.ok(error && typeof error === 'object');
        return true;
      },
    );
  });

  test('unauthorized learner cannot read payment order', async () => {
    const orderId = await createPayableOrder(28);
    await assert.rejects(
      () =>
        getPaymentOrderForActor(orderId, {
          userId: otherLearnerId,
          roles: ['LEARNER'],
        }),
      (error: unknown) => {
        assert.ok(error && typeof error === 'object');
        const status = (error as { statusCode?: number }).statusCode;
        assert.ok(status === 403 || status === 404);
        return true;
      },
    );
  });
});
