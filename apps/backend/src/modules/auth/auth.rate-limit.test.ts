import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, test } from 'node:test';

import type { Request } from 'express';

import {
  checkRateLimit,
  resetRateLimitersForTests,
} from '../../middlewares/rate-limit.middleware.js';
import { AppError } from '../../utils/app-error.js';
import { hashToken } from '../../utils/token.js';

import { getRefreshTokenRateLimitKey } from './auth-token-delivery.js';

beforeEach(() => {
  resetRateLimitersForTests();
});

describe('auth route rate limiting', () => {
  test('register, login, and refresh routes declare rate limit middleware', () => {
    const routesSource = readFileSync(
      fileURLToPath(new URL('./auth.routes.ts', import.meta.url)),
      'utf8',
    );

    assert.match(
      routesSource,
      /authRouter\.post\([\s\S]*?\/register[\s\S]*?registerIpRateLimit[\s\S]*?registerEmailRateLimit/,
    );
    assert.match(
      routesSource,
      /authRouter\.post\([\s\S]*?\/login[\s\S]*?loginIpRateLimit[\s\S]*?loginEmailRateLimit/,
    );
    assert.match(
      routesSource,
      /authRouter\.post\([\s\S]*?\/refresh[\s\S]*?refreshIpRateLimit[\s\S]*?refreshTokenRateLimit/,
    );
    assert.match(routesSource, /keyGenerator:\s*getRefreshTokenRateLimitKey/);
  });

  test('login rate limit is keyed per IP and email independently', () => {
    const policy = { name: 'test-login', windowMs: 60_000, max: 2 };

    checkRateLimit('ip:127.0.0.1', policy);
    checkRateLimit('ip:127.0.0.1', policy);
    assert.throws(
      () => checkRateLimit('ip:127.0.0.1', policy),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 429 &&
        error.code === 'RATE_LIMITED',
    );

    checkRateLimit('email:user@example.com', policy);
    checkRateLimit('email:user@example.com', policy);
    assert.throws(
      () => checkRateLimit('email:user@example.com', policy),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 429 &&
        error.code === 'RATE_LIMITED',
    );
  });

  test('refresh rate limit is keyed per IP and hashed refresh token', () => {
    const policy = { name: 'test-refresh', windowMs: 60_000, max: 1 };
    const tokenHash = hashToken('refresh-token-value');

    checkRateLimit('ip:127.0.0.1', policy);
    assert.throws(
      () => checkRateLimit('ip:127.0.0.1', policy),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 429 &&
        error.code === 'RATE_LIMITED',
    );

    checkRateLimit(tokenHash, policy);
    assert.throws(
      () => checkRateLimit(tokenHash, policy),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 429 &&
        error.code === 'RATE_LIMITED',
    );
  });

  test('refresh token rate-limit keys distinguish cookie tokens from missing body', () => {
    const policy = { name: 'test-refresh-cookie', windowMs: 60_000, max: 1 };
    const cookieReq = {
      headers: { cookie: 'refreshToken=cookie-only-refresh' },
      body: {},
    } as unknown as Request;
    const missingBodyReq = {
      headers: {},
      body: {},
    } as unknown as Request;

    const cookieKey = getRefreshTokenRateLimitKey(cookieReq);
    const missingKey = getRefreshTokenRateLimitKey(missingBodyReq);

    assert.equal(cookieKey, hashToken('cookie-only-refresh'));
    assert.equal(missingKey, 'missing');
    assert.notEqual(cookieKey, missingKey);

    checkRateLimit(cookieKey, policy);
    assert.throws(
      () => checkRateLimit(cookieKey, policy),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 429 &&
        error.code === 'RATE_LIMITED',
    );

    checkRateLimit(missingKey, policy);
  });
});
