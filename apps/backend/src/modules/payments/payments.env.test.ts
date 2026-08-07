import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  PAYMENT_DEV_SECRET_FALLBACKS,
  PAYMENT_TEST_SECRET_DEFAULTS,
  resolvePaymentRuntimeConfig,
} from './payments.env.js';

describe('PAY-01B payment runtime configuration', () => {
  test('rejects unsupported PAYMENT_PROVIDER', () => {
    assert.throws(
      () =>
        resolvePaymentRuntimeConfig({
          NODE_ENV: 'development',
          PAYMENT_PROVIDER: 'stripe',
        }),
      /Invalid PAYMENT_PROVIDER/,
    );
  });

  test('rejects unsupported PAYMENT_PROVIDER_MODE', () => {
    assert.throws(
      () =>
        resolvePaymentRuntimeConfig({
          NODE_ENV: 'development',
          PAYMENT_PROVIDER: 'mock',
          PAYMENT_PROVIDER_MODE: 'LIVE',
        }),
      /Invalid PAYMENT_PROVIDER_MODE/,
    );
  });

  test('rejects Mock in production', () => {
    assert.throws(
      () =>
        resolvePaymentRuntimeConfig({
          NODE_ENV: 'production',
          PAYMENT_PROVIDER: 'mock',
          PAYMENT_PROVIDER_MODE: 'LOCAL',
          PAYMENT_MOCK_WEBHOOK_SECRET: 'prod-grade-webhook-secret-value-001',
          PAYMENT_MOCK_CHECKOUT_TOKEN_SECRET:
            'prod-grade-checkout-secret-value-002',
        }),
      /not allowed when NODE_ENV=production/,
    );
  });

  test('requires explicit provider in production and accepts disabled', () => {
    assert.throws(
      () =>
        resolvePaymentRuntimeConfig({
          NODE_ENV: 'production',
        }),
      /must be set explicitly/,
    );

    const disabled = resolvePaymentRuntimeConfig({
      NODE_ENV: 'production',
      PAYMENT_PROVIDER: 'disabled',
    });
    assert.equal(disabled.paymentProvider, 'disabled');
    assert.equal(disabled.paymentMockRoutesEnabled, false);
    assert.equal(disabled.paymentMockWebhookSecret, null);
  });

  test('rejects placeholder secrets in SANDBOX', () => {
    assert.throws(
      () =>
        resolvePaymentRuntimeConfig({
          NODE_ENV: 'development',
          PAYMENT_PROVIDER: 'mock',
          PAYMENT_PROVIDER_MODE: 'SANDBOX',
          PAYMENT_MOCK_WEBHOOK_SECRET: PAYMENT_DEV_SECRET_FALLBACKS.webhook,
          PAYMENT_MOCK_CHECKOUT_TOKEN_SECRET:
            PAYMENT_DEV_SECRET_FALLBACKS.checkout,
        }),
      /placeholder|example/i,
    );
  });

  test('rejects missing secrets in SANDBOX', () => {
    assert.throws(
      () =>
        resolvePaymentRuntimeConfig({
          NODE_ENV: 'development',
          PAYMENT_PROVIDER: 'mock',
          PAYMENT_PROVIDER_MODE: 'SANDBOX',
        }),
      /PAYMENT_MOCK_WEBHOOK_SECRET is required/,
    );
  });

  test('valid Mock development configuration allows documented fallbacks', () => {
    const config = resolvePaymentRuntimeConfig({
      NODE_ENV: 'development',
      PAYMENT_PROVIDER: 'mock',
      PAYMENT_PROVIDER_MODE: 'LOCAL',
    });
    assert.equal(config.paymentProvider, 'mock');
    assert.equal(config.paymentMockRoutesEnabled, true);
    assert.equal(config.usedDevelopmentSecretFallback, true);
    assert.notEqual(
      config.paymentMockWebhookSecret,
      config.paymentMockCheckoutTokenSecret,
    );
  });

  test('valid deterministic test configuration uses test-only defaults', () => {
    const config = resolvePaymentRuntimeConfig({
      NODE_ENV: 'test',
      NODE_TEST_CONTEXT: '1',
      PAYMENT_PROVIDER: 'mock',
      PAYMENT_PROVIDER_MODE: 'LOCAL',
    });
    assert.equal(
      config.paymentMockWebhookSecret,
      PAYMENT_TEST_SECRET_DEFAULTS.webhook,
    );
    assert.equal(
      config.paymentMockCheckoutTokenSecret,
      PAYMENT_TEST_SECRET_DEFAULTS.checkout,
    );
    assert.equal(config.paymentMockRoutesEnabled, true);
  });

  test('payment-disabled configuration omits mock routes and secrets', () => {
    const config = resolvePaymentRuntimeConfig({
      NODE_ENV: 'development',
      PAYMENT_PROVIDER: 'disabled',
    });
    assert.equal(config.paymentProvider, 'disabled');
    assert.equal(config.paymentProviderMode, null);
    assert.equal(config.paymentMockRoutesEnabled, false);
    assert.equal(config.paymentMockWebhookSecret, null);
  });

  test('rejects identical webhook and checkout secrets', () => {
    const shared = 'shared-payment-secret-value-abcdefghijklmnopqrstuvwxyz';
    assert.throws(
      () =>
        resolvePaymentRuntimeConfig({
          NODE_ENV: 'development',
          PAYMENT_PROVIDER: 'mock',
          PAYMENT_PROVIDER_MODE: 'LOCAL',
          PAYMENT_MOCK_WEBHOOK_SECRET: shared,
          PAYMENT_MOCK_CHECKOUT_TOKEN_SECRET: shared,
        }),
      /must be distinct/,
    );
  });
});
