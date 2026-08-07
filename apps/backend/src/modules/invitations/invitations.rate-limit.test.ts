import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, test } from 'node:test';

import {
  checkRateLimit,
  resetRateLimitersForTests,
} from '../../middlewares/rate-limit.middleware.js';
import { AppError } from '../../utils/app-error.js';
import { hashToken } from '../../utils/token.js';

beforeEach(() => {
  resetRateLimitersForTests();
});

describe('invitation route rate limiting', () => {
  test('validate and accept routes declare rate limit middleware', () => {
    const routesSource = readFileSync(
      fileURLToPath(new URL('./invitations.routes.ts', import.meta.url)),
      'utf8',
    );

    assert.match(
      routesSource,
      /invitationsRouter\.get\([\s\S]*?\/validate[\s\S]*?validateInvitationIpRateLimit[\s\S]*?validateInvitationTokenRateLimit/,
    );
    assert.match(
      routesSource,
      /invitationsRouter\.post\([\s\S]*?\/accept[\s\S]*?acceptInvitationIpRateLimit[\s\S]*?acceptInvitationTokenRateLimit/,
    );
  });

  test('validate rate limit is keyed per IP and hashed token independently', () => {
    const policy = { name: 'test-invitation-validate', windowMs: 60_000, max: 2 };
    const tokenHash = hashToken('invitation-token-value');

    checkRateLimit('ip:127.0.0.1', policy);
    checkRateLimit('ip:127.0.0.1', policy);
    assert.throws(
      () => checkRateLimit('ip:127.0.0.1', policy),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 429 &&
        error.code === 'RATE_LIMITED',
    );

    checkRateLimit(tokenHash, policy);
    checkRateLimit(tokenHash, policy);
    assert.throws(
      () => checkRateLimit(tokenHash, policy),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 429 &&
        error.code === 'RATE_LIMITED',
    );
  });

  test('accept rate limit is keyed per IP and hashed token independently', () => {
    const policy = { name: 'test-invitation-accept', windowMs: 60_000, max: 1 };
    const tokenHash = hashToken('accept-token-value');

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
});
