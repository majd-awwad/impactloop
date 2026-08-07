import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  HANDOVER_DEV_CODE_SECRET_FALLBACK,
  resolveHandoverCodeSecretConfig,
} from './handover-code-secret.env.js';
import {
  JWT_DEV_ACCESS_FALLBACK,
  JWT_DEV_REFRESH_FALLBACK,
} from './jwt-secrets.env.js';

const strongHandoverSecret = 'prod-grade-handover-code-secret-value-01';
const strongAccessSecret = 'prod-grade-jwt-access-secret-value-01';
const strongRefreshSecret = 'prod-grade-jwt-refresh-secret-value-02';

describe('handover code secret configuration', () => {
  test('rejects missing HANDOVER_CODE_SECRET in production', () => {
    assert.throws(
      () =>
        resolveHandoverCodeSecretConfig({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: strongAccessSecret,
          JWT_REFRESH_SECRET: strongRefreshSecret,
        }),
      /HANDOVER_CODE_SECRET is required in production/,
    );
  });

  test('rejects documented development fallback in production', () => {
    assert.throws(
      () =>
        resolveHandoverCodeSecretConfig({
          NODE_ENV: 'production',
          HANDOVER_CODE_SECRET: HANDOVER_DEV_CODE_SECRET_FALLBACK,
          JWT_ACCESS_SECRET: strongAccessSecret,
          JWT_REFRESH_SECRET: strongRefreshSecret,
        }),
      /placeholder|example/i,
    );
  });

  test('rejects env.example placeholders in production', () => {
    assert.throws(
      () =>
        resolveHandoverCodeSecretConfig({
          NODE_ENV: 'production',
          HANDOVER_CODE_SECRET: 'change-me-handover-code-secret',
          JWT_ACCESS_SECRET: strongAccessSecret,
          JWT_REFRESH_SECRET: strongRefreshSecret,
        }),
      /placeholder|example/i,
    );
  });

  test('rejects short secrets in production', () => {
    assert.throws(
      () =>
        resolveHandoverCodeSecretConfig({
          NODE_ENV: 'production',
          HANDOVER_CODE_SECRET: 'short-handover-secret',
          JWT_ACCESS_SECRET: strongAccessSecret,
          JWT_REFRESH_SECRET: strongRefreshSecret,
        }),
      /at least 24 characters/i,
    );
  });

  test('rejects reuse of JWT access secret', () => {
    assert.throws(
      () =>
        resolveHandoverCodeSecretConfig({
          NODE_ENV: 'production',
          HANDOVER_CODE_SECRET: strongAccessSecret,
          JWT_ACCESS_SECRET: strongAccessSecret,
          JWT_REFRESH_SECRET: strongRefreshSecret,
        }),
      /distinct from JWT_ACCESS_SECRET/i,
    );
  });

  test('rejects reuse of JWT refresh secret', () => {
    assert.throws(
      () =>
        resolveHandoverCodeSecretConfig({
          NODE_ENV: 'production',
          HANDOVER_CODE_SECRET: strongRefreshSecret,
          JWT_ACCESS_SECRET: strongAccessSecret,
          JWT_REFRESH_SECRET: strongRefreshSecret,
        }),
      /distinct from JWT_REFRESH_SECRET/i,
    );
  });

  test('accepts strong dedicated secret in production', () => {
    const config = resolveHandoverCodeSecretConfig({
      NODE_ENV: 'production',
      HANDOVER_CODE_SECRET: strongHandoverSecret,
      JWT_ACCESS_SECRET: strongAccessSecret,
      JWT_REFRESH_SECRET: strongRefreshSecret,
    });

    assert.equal(config.handoverCodeSecret, strongHandoverSecret);
  });

  test('allows documented development fallback when unset', () => {
    const config = resolveHandoverCodeSecretConfig({
      NODE_ENV: 'development',
      JWT_ACCESS_SECRET: JWT_DEV_ACCESS_FALLBACK,
      JWT_REFRESH_SECRET: JWT_DEV_REFRESH_FALLBACK,
    });

    assert.equal(config.handoverCodeSecret, HANDOVER_DEV_CODE_SECRET_FALLBACK);
  });

  test('rejects explicit placeholder secrets in development', () => {
    assert.throws(
      () =>
        resolveHandoverCodeSecretConfig({
          NODE_ENV: 'development',
          HANDOVER_CODE_SECRET: 'change-me-handover-code-secret',
          JWT_ACCESS_SECRET: strongAccessSecret,
          JWT_REFRESH_SECRET: strongRefreshSecret,
        }),
      /placeholder|example/i,
    );
  });
});
