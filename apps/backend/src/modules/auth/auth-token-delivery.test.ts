import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { Request } from 'express';

import { hashToken } from '../../utils/token.js';

import {
  REFRESH_TOKEN_COOKIE_NAME,
  getRefreshTokenFromRequest,
  getRefreshTokenRateLimitKey,
} from './auth-token-delivery.js';

const asRequest = (value: {
  headers?: Record<string, string | undefined>;
  body?: unknown;
}): Request => value as unknown as Request;

describe('auth token delivery refresh extraction', () => {
  test('reads refresh token from HTTP-only cookie before body', () => {
    const req = asRequest({
      headers: {
        cookie: `${REFRESH_TOKEN_COOKIE_NAME}=cookie-refresh-token`,
      },
      body: { refreshToken: 'body-refresh-token' },
    });

    assert.equal(getRefreshTokenFromRequest(req), 'cookie-refresh-token');
    assert.equal(
      getRefreshTokenRateLimitKey(req),
      hashToken('cookie-refresh-token'),
    );
  });

  test('falls back to body refresh token for mobile clients', () => {
    const req = asRequest({
      headers: {},
      body: { refreshToken: '  mobile-refresh-token  ' },
    });

    assert.equal(getRefreshTokenFromRequest(req), 'mobile-refresh-token');
    assert.equal(
      getRefreshTokenRateLimitKey(req),
      hashToken('mobile-refresh-token'),
    );
  });

  test('rate-limit key is missing when neither cookie nor body provides a token', () => {
    const req = asRequest({
      headers: {},
      body: {},
    });

    assert.equal(getRefreshTokenFromRequest(req), undefined);
    assert.equal(getRefreshTokenRateLimitKey(req), 'missing');
  });

  test('cookie-based and body-based tokens with the same value share one hashed key', () => {
    const token = 'shared-refresh-token';
    const cookieReq = asRequest({
      headers: {
        cookie: `${REFRESH_TOKEN_COOKIE_NAME}=${encodeURIComponent(token)}`,
      },
      body: {},
    });
    const bodyReq = asRequest({
      headers: {},
      body: { refreshToken: token },
    });

    assert.equal(
      getRefreshTokenRateLimitKey(cookieReq),
      getRefreshTokenRateLimitKey(bodyReq),
    );
    assert.equal(getRefreshTokenRateLimitKey(cookieReq), hashToken(token));
  });
});
