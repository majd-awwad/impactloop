import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { after, before, describe, test } from 'node:test';

import { app } from '../../app.js';
import { AppError } from '../../utils/app-error.js';
import {
  assertCardPaymentAcceptedForNewReservation,
  isCardCheckoutProductEnabled,
} from './payments.product-policy.js';

describe('CASH-only product: dormant checkout routes not mounted', () => {
  let server: Server;
  let baseUrl = '';

  before(async () => {
    assert.equal(
      isCardCheckoutProductEnabled(),
      false,
      'expected card checkout product policy off in current runtime',
    );

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
  });

  test('reservation checkout POST is not registered', async () => {
    const response = await fetch(
      `${baseUrl}/api/payments/reservations/res-1/checkout`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      },
    );
    assert.equal(response.status, 404);
  });

  test('checkout session GET is not registered', async () => {
    const response = await fetch(
      `${baseUrl}/api/payments/reservations/res-1/checkout-session`,
    );
    assert.equal(response.status, 404);
  });

  test('legacy order checkout POST is not registered', async () => {
    const response = await fetch(`${baseUrl}/api/payments/orders/ord-1/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(response.status, 404);
  });

  test('mock provider act route is not registered', async () => {
    const response = await fetch(
      `${baseUrl}/api/payments/mock/checkout/attempt-1/act`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'success' }),
      },
    );
    assert.equal(response.status, 404);
  });

  test('mock webhook route is not registered', async () => {
    const response = await fetch(`${baseUrl}/api/payments/webhooks/mock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(response.status, 404);
  });

  test('payment read/requirement route remains registered (auth required)', async () => {
    const response = await fetch(
      `${baseUrl}/api/payments/reservations/res-1/requirement`,
    );
    assert.equal(response.status, 401);
  });

  test('explicit CARD on new reservation is rejected with CARD_PAYMENT_DISABLED', () => {
    assert.throws(
      () => assertCardPaymentAcceptedForNewReservation('CARD'),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'CARD_PAYMENT_DISABLED');
        return true;
      },
    );
  });
});
