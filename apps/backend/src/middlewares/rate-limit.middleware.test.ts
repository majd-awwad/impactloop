import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';

import { parseTrustProxy } from '../config/env.js';
import {
  checkRateLimit,
  createRateLimitStoreForTests,
  resetRateLimitersForTests,
  type RateLimitPolicy,
} from './rate-limit.middleware.js';
import { AppError } from '../utils/app-error.js';

const testPolicy = (
  name: string,
  windowMs = 60_000,
  max = 2,
): RateLimitPolicy => ({
  name,
  windowMs,
  max,
});

beforeEach(() => {
  resetRateLimitersForTests();
});

describe('parseTrustProxy', () => {
  test('defaults to false when unset', () => {
    assert.equal(parseTrustProxy(undefined), false);
    assert.equal(parseTrustProxy(''), false);
  });

  test('maps true to a single trusted hop', () => {
    assert.equal(parseTrustProxy('true'), 1);
    assert.equal(parseTrustProxy('TRUE'), 1);
  });

  test('accepts explicit hop counts and subnet expressions', () => {
    assert.equal(parseTrustProxy('2'), 2);
    assert.equal(parseTrustProxy('loopback'), 'loopback');
    assert.equal(parseTrustProxy('127.0.0.1'), '127.0.0.1');
  });
});

describe('bounded rate limit store', () => {
  test('expires buckets after the window elapses', () => {
    const policy = testPolicy('expire-test', 1_000, 1);
    const store = createRateLimitStoreForTests({
      maxEntries: 10,
      sweepIntervalMs: 60_000,
    });

    store.check('client-a', policy);
    assert.throws(
      () => store.check('client-a', policy),
      (error: unknown) =>
        error instanceof AppError && error.statusCode === 429,
    );

    const future = Date.now() + 1_500;
    const originalDateNow = Date.now;
    Date.now = () => future;

    try {
      store.check('client-a', policy);
      assert.equal(store.size(), 1);
    } finally {
      Date.now = originalDateNow;
    }
  });

  test('sweep removes expired buckets', () => {
    const policy = testPolicy('sweep-test', 500, 5);
    const store = createRateLimitStoreForTests({
      maxEntries: 10,
      sweepIntervalMs: 60_000,
    });

    store.check('client-a', policy);
    store.check('client-b', policy);
    assert.equal(store.size(), 2);

    const future = Date.now() + 600;
    const originalDateNow = Date.now;
    Date.now = () => future;

    try {
      assert.equal(store.sweepExpired(), 2);
      assert.equal(store.size(), 0);
    } finally {
      Date.now = originalDateNow;
    }
  });

  test('evicts least-recently-used bucket when max entries is reached', () => {
    const policy = testPolicy('lru-test', 60_000, 100);
    const store = createRateLimitStoreForTests({
      maxEntries: 2,
      sweepIntervalMs: 60_000,
    });

    store.check('first', policy);
    store.check('second', policy);
    assert.equal(store.size(), 2);

    store.check('first', policy);
    store.check('third', policy);

    assert.equal(store.size(), 2);
    store.check('second', policy);
    assert.equal(store.size(), 2);
    store.check('third', policy);
  });
});

describe('checkRateLimit', () => {
  test('limits requests per key within the active window', () => {
    const policy = testPolicy('shared-default-store');

    checkRateLimit('ip:127.0.0.1', policy);
    checkRateLimit('ip:127.0.0.1', policy);
    assert.throws(
      () => checkRateLimit('ip:127.0.0.1', policy),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 429 &&
        error.code === 'RATE_LIMITED',
    );
  });
});
