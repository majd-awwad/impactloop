import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  ALLOWED_TEST_DATABASES,
  assertSafeTestDatabaseUrl,
  FORBIDDEN_DEVELOPMENT_DATABASE,
  TEST_DATABASE_REFUSAL_MESSAGE,
} from './lib/test-database-guard.mjs';

const DEV_URL =
  'postgresql://postgres:password@127.0.0.1:5432/impactloop?schema=public';
const TEST_URL =
  'postgresql://postgres:password@127.0.0.1:5432/impactloop_test?schema=public';
const CI_URL =
  'postgresql://impactloop:impactloop@127.0.0.1:5432/impactloop_ci?schema=public';

describe('test-database-guard', () => {
  test('A: refuses when TEST_DATABASE_URL is missing', () => {
    assert.throws(
      () =>
        assertSafeTestDatabaseUrl({
          NODE_ENV: 'test',
          DATABASE_URL: DEV_URL,
        }),
      /TEST_DATABASE_URL is required/,
    );
  });

  test('B: refuses when TEST_DATABASE_URL points at /impactloop', () => {
    assert.throws(
      () =>
        assertSafeTestDatabaseUrl({
          NODE_ENV: 'test',
          DATABASE_URL: DEV_URL,
          TEST_DATABASE_URL: DEV_URL,
        }),
      (error) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /Refusing to run automated tests/);
        assert.equal(error.message.includes(TEST_DATABASE_REFUSAL_MESSAGE), true);
        return true;
      },
    );
  });

  test('C: refuses when TEST_DATABASE_URL === DATABASE_URL for development DB', () => {
    assert.throws(
      () =>
        assertSafeTestDatabaseUrl({
          NODE_ENV: 'test',
          DATABASE_URL: DEV_URL,
          TEST_DATABASE_URL: DEV_URL,
        }),
      /identical to DATABASE_URL|Refusing to run automated tests|impactloop/,
    );
  });

  test('D: accepts TEST_DATABASE_URL pointing at /impactloop_test', () => {
    const result = assertSafeTestDatabaseUrl({
      NODE_ENV: 'test',
      DATABASE_URL: DEV_URL,
      TEST_DATABASE_URL: TEST_URL,
    });
    assert.equal(result.databaseName, 'impactloop_test');
    assert.equal(result.testDatabaseUrl, TEST_URL);
  });

  test('accepts impactloop_ci for CI and allows identical CI URLs', () => {
    const result = assertSafeTestDatabaseUrl({
      NODE_ENV: 'test',
      DATABASE_URL: CI_URL,
      TEST_DATABASE_URL: CI_URL,
    });
    assert.equal(result.databaseName, 'impactloop_ci');
  });

  test('refuses NODE_ENV other than test', () => {
    assert.throws(
      () =>
        assertSafeTestDatabaseUrl({
          NODE_ENV: 'development',
          TEST_DATABASE_URL: TEST_URL,
        }),
      /NODE_ENV must be exactly "test"/,
    );
  });

  test('allowed database names exclude the development database', () => {
    assert.equal(ALLOWED_TEST_DATABASES.has(FORBIDDEN_DEVELOPMENT_DATABASE), false);
    assert.equal(ALLOWED_TEST_DATABASES.has('impactloop_test'), true);
    assert.equal(ALLOWED_TEST_DATABASES.has('impactloop_ci'), true);
  });
});
