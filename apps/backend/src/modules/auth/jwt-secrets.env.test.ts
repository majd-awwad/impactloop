import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  JWT_DEV_ACCESS_FALLBACK,
  JWT_DEV_REFRESH_FALLBACK,
  resolveJwtSecretsConfig,
} from "../../config/jwt-secrets.env.js";

const strongAccessSecret = "prod-grade-jwt-access-secret-value-01";
const strongRefreshSecret = "prod-grade-jwt-refresh-secret-value-02";

describe("JWT signing secret configuration", () => {
  test("rejects missing JWT secrets in production", () => {
    assert.throws(
      () =>
        resolveJwtSecretsConfig({
          NODE_ENV: "production",
        }),
      /JWT_ACCESS_SECRET is required in production/,
    );

    assert.throws(
      () =>
        resolveJwtSecretsConfig({
          NODE_ENV: "production",
          JWT_ACCESS_SECRET: strongAccessSecret,
        }),
      /JWT_REFRESH_SECRET is required in production/,
    );
  });

  test("rejects documented development fallbacks in production", () => {
    assert.throws(
      () =>
        resolveJwtSecretsConfig({
          NODE_ENV: "production",
          JWT_ACCESS_SECRET: JWT_DEV_ACCESS_FALLBACK,
          JWT_REFRESH_SECRET: strongRefreshSecret,
        }),
      /placeholder|example/i,
    );

    assert.throws(
      () =>
        resolveJwtSecretsConfig({
          NODE_ENV: "production",
          JWT_ACCESS_SECRET: strongAccessSecret,
          JWT_REFRESH_SECRET: JWT_DEV_REFRESH_FALLBACK,
        }),
      /placeholder|example/i,
    );
  });

  test("rejects env.example placeholders in production", () => {
    assert.throws(
      () =>
        resolveJwtSecretsConfig({
          NODE_ENV: "production",
          JWT_ACCESS_SECRET: "change-me-access-secret",
          JWT_REFRESH_SECRET: strongRefreshSecret,
        }),
      /placeholder|example/i,
    );
  });

  test("rejects short secrets in production", () => {
    assert.throws(
      () =>
        resolveJwtSecretsConfig({
          NODE_ENV: "production",
          JWT_ACCESS_SECRET: "short-access-secret",
          JWT_REFRESH_SECRET: strongRefreshSecret,
        }),
      /at least 24 characters/i,
    );
  });

  test("rejects identical access and refresh secrets", () => {
    assert.throws(
      () =>
        resolveJwtSecretsConfig({
          NODE_ENV: "production",
          JWT_ACCESS_SECRET: strongAccessSecret,
          JWT_REFRESH_SECRET: strongAccessSecret,
        }),
      /must be distinct/i,
    );
  });

  test("accepts strong distinct secrets in production", () => {
    const config = resolveJwtSecretsConfig({
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: strongAccessSecret,
      JWT_REFRESH_SECRET: strongRefreshSecret,
    });

    assert.equal(config.jwtAccessSecret, strongAccessSecret);
    assert.equal(config.jwtRefreshSecret, strongRefreshSecret);
  });

  test("allows documented development fallbacks when unset", () => {
    const config = resolveJwtSecretsConfig({
      NODE_ENV: "development",
    });

    assert.equal(config.jwtAccessSecret, JWT_DEV_ACCESS_FALLBACK);
    assert.equal(config.jwtRefreshSecret, JWT_DEV_REFRESH_FALLBACK);
  });

  test("rejects explicit placeholder secrets in development", () => {
    assert.throws(
      () =>
        resolveJwtSecretsConfig({
          NODE_ENV: "development",
          JWT_ACCESS_SECRET: "change-me-access-secret",
          JWT_REFRESH_SECRET: strongRefreshSecret,
        }),
      /placeholder|example/i,
    );
  });
});
