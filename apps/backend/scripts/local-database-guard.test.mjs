import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { FORBIDDEN_DEVELOPMENT_DATABASE } from './lib/test-database-guard.mjs';
import {
  assertBenchmarkDatabaseNameForDestructiveOps,
  assertLocalDemoDatabaseUrl,
  assertSafeDestructiveSeedTarget,
  assertSafeDriverBenchmarkSource,
  FORBIDDEN_DESTRUCTIVE_SEED_DATABASES,
  LOCAL_DATABASE_HOSTS,
} from './lib/local-database-guard.mjs';

const DEV_URL =
  'postgresql://postgres:password@127.0.0.1:5432/impactloop?schema=public';
const CI_URL =
  'postgresql://impactloop:impactloop@127.0.0.1:5432/impactloop_ci?schema=public';
const TEST_URL =
  'postgresql://postgres:password@127.0.0.1:5432/impactloop_test?schema=public';
const REMOTE_URL =
  'postgresql://postgres:password@db.example.com:5432/impactloop?schema=public';
const PROD_NAME_URL =
  'postgresql://postgres:password@127.0.0.1:5432/impactloop_production?schema=public';

describe('local-database-guard — destructive seed', () => {
  test('allows local development database', () => {
    const result = assertSafeDestructiveSeedTarget({
      NODE_ENV: 'development',
      DATABASE_URL: DEV_URL,
    });
    assert.equal(result.databaseName, FORBIDDEN_DEVELOPMENT_DATABASE);
    assert.equal(result.hostname, '127.0.0.1');
  });

  test('refuses NODE_ENV=production even on localhost', () => {
    assert.throws(
      () =>
        assertSafeDestructiveSeedTarget({
          NODE_ENV: 'production',
          DATABASE_URL: DEV_URL,
        }),
      /NODE_ENV is "production"/,
    );
  });

  test('refuses missing DATABASE_URL', () => {
    assert.throws(
      () => assertSafeDestructiveSeedTarget({ NODE_ENV: 'development' }),
      /DATABASE_URL is required/,
    );
  });

  test('refuses non-local hosts', () => {
    assert.throws(
      () =>
        assertSafeDestructiveSeedTarget({
          NODE_ENV: 'development',
          DATABASE_URL: REMOTE_URL,
        }),
      /non-local database host/,
    );
  });

  test('refuses CI / test / E2E / bench reserved databases', () => {
    for (const url of [
      CI_URL,
      TEST_URL,
      'postgresql://postgres:password@127.0.0.1:5432/impactloop_driver_e2e',
      'postgresql://postgres:password@127.0.0.1:5432/impactloop_dr04_bench',
    ]) {
      assert.throws(
        () =>
          assertSafeDestructiveSeedTarget({
            NODE_ENV: 'development',
            DATABASE_URL: url,
          }),
        /reserved database/,
      );
    }
  });

  test('refuses production-like database names on localhost', () => {
    assert.throws(
      () =>
        assertSafeDestructiveSeedTarget({
          NODE_ENV: 'development',
          DATABASE_URL: PROD_NAME_URL,
        }),
      /production-like database name/,
    );
  });

  test('forbidden set excludes the developer database', () => {
    assert.equal(
      FORBIDDEN_DESTRUCTIVE_SEED_DATABASES.has(FORBIDDEN_DEVELOPMENT_DATABASE),
      false,
    );
    assert.equal(LOCAL_DATABASE_HOSTS.has('127.0.0.1'), true);
  });
});

describe('local-database-guard — demo host', () => {
  test('allows localhost demo targets', () => {
    const result = assertLocalDemoDatabaseUrl(DEV_URL, 'learning project sync');
    assert.equal(result.databaseName, 'impactloop');
  });

  test('refuses remote demo targets', () => {
    assert.throws(
      () => assertLocalDemoDatabaseUrl(REMOTE_URL, 'learning project sync'),
      /non-local database host/,
    );
  });

  test('refuses remote hosts for screenshot and audit demo prep purposes', () => {
    for (const purpose of [
      'demo:prepare orchestration',
      'admin audit demo prep',
      'local CASH handover demo prep',
      'local driver ON_THE_WAY demo prep',
    ]) {
      assert.throws(
        () => assertLocalDemoDatabaseUrl(REMOTE_URL, purpose),
        /non-local database host/,
      );
    }
  });
});

describe('local-database-guard — driver benchmark', () => {
  test('allows local developer source with canonical bench name', () => {
    const result = assertSafeDriverBenchmarkSource(DEV_URL, 'impactloop_dr04_bench');
    assert.equal(result.sourceDatabaseName, 'impactloop');
    assert.equal(result.benchDatabaseName, 'impactloop_dr04_bench');
  });

  test('refuses CI/test sources and non-canonical bench names', () => {
    assert.throws(
      () => assertSafeDriverBenchmarkSource(CI_URL, 'impactloop_dr04_bench'),
      /reserved/,
    );
    assert.throws(
      () => assertSafeDriverBenchmarkSource(DEV_URL, 'impactloop_other_bench'),
      /Expected exactly "impactloop_dr04_bench"/,
    );
  });

  test('only the bench database may be terminated or dropped', () => {
    assert.doesNotThrow(() =>
      assertBenchmarkDatabaseNameForDestructiveOps('impactloop_dr04_bench'),
    );
    assert.throws(
      () => assertBenchmarkDatabaseNameForDestructiveOps('impactloop'),
      /Only "impactloop_dr04_bench"/,
    );
  });
});
