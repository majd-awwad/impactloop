import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  assertAllowedAutomatedTestDatabaseUrl,
  isAutomatedTestRuntime,
  resolveDatabaseUrl,
  shouldOverrideProcessEnvFromLocalFiles,
} from './env.js';

describe('resolveDatabaseUrl', () => {
  test('development requires DATABASE_URL and ignores TEST_DATABASE_URL', () => {
    const url = resolveDatabaseUrl({
      NODE_ENV: 'development',
      DATABASE_URL:
        'postgresql://postgres:password@127.0.0.1:5432/impactloop?schema=public',
      TEST_DATABASE_URL:
        'postgresql://postgres:password@127.0.0.1:5432/impactloop_test?schema=public',
    });
    assert.match(url, /\/impactloop(\?|$)/);
  });

  test('test mode requires TEST_DATABASE_URL with no DATABASE_URL fallback', () => {
    assert.throws(
      () =>
        resolveDatabaseUrl({
          NODE_ENV: 'test',
          DATABASE_URL:
            'postgresql://postgres:password@127.0.0.1:5432/impactloop?schema=public',
        }),
      /TEST_DATABASE_URL/,
    );
  });

  test('test mode uses TEST_DATABASE_URL and overwrites DATABASE_URL', () => {
    const env = {
      NODE_ENV: 'test',
      DATABASE_URL:
        'postgresql://postgres:password@127.0.0.1:5432/impactloop?schema=public',
      TEST_DATABASE_URL:
        'postgresql://postgres:password@127.0.0.1:5432/impactloop_test?schema=public',
    };
    const url = resolveDatabaseUrl(env);
    assert.match(url, /\/impactloop_test(\?|$)/);
    assert.equal(env.DATABASE_URL, env.TEST_DATABASE_URL);
  });

  test('NODE_TEST_CONTEXT alone requires TEST_DATABASE_URL and forces NODE_ENV=test', () => {
    const env: NodeJS.ProcessEnv = {
      NODE_TEST_CONTEXT: 'child-v8',
      DATABASE_URL:
        'postgresql://postgres:password@127.0.0.1:5432/impactloop?schema=public',
      TEST_DATABASE_URL:
        'postgresql://postgres:password@127.0.0.1:5432/impactloop_test?schema=public',
    };
    const url = resolveDatabaseUrl(env);
    assert.match(url, /\/impactloop_test(\?|$)/);
    assert.equal(env.NODE_ENV, 'test');
    assert.equal(env.DATABASE_URL, env.TEST_DATABASE_URL);
  });

  test('test mode refuses TEST_DATABASE_URL pointing at impactloop', () => {
    assert.throws(
      () =>
        resolveDatabaseUrl({
          NODE_ENV: 'test',
          TEST_DATABASE_URL:
            'postgresql://postgres:password@127.0.0.1:5432/impactloop?schema=public',
        }),
      /development database/,
    );
  });
});

describe('automated test env bootstrap guards', () => {
  test('isAutomatedTestRuntime detects NODE_ENV=test and NODE_TEST_CONTEXT', () => {
    assert.equal(isAutomatedTestRuntime({ NODE_ENV: 'test' }), true);
    assert.equal(isAutomatedTestRuntime({ NODE_TEST_CONTEXT: 'child-v8' }), true);
    assert.equal(isAutomatedTestRuntime({ NODE_ENV: 'development' }), false);
  });

  test('shouldOverrideProcessEnvFromLocalFiles is false under test runtimes', () => {
    assert.equal(
      shouldOverrideProcessEnvFromLocalFiles({ NODE_ENV: 'development' }),
      true,
    );
    assert.equal(
      shouldOverrideProcessEnvFromLocalFiles({ NODE_ENV: 'production' }),
      false,
    );
    assert.equal(
      shouldOverrideProcessEnvFromLocalFiles({ NODE_ENV: 'test' }),
      false,
    );
    assert.equal(
      shouldOverrideProcessEnvFromLocalFiles({
        NODE_ENV: 'development',
        NODE_TEST_CONTEXT: 'child-v8',
      }),
      false,
    );
  });

  test('assertAllowedAutomatedTestDatabaseUrl rejects impactloop', () => {
    assert.throws(
      () =>
        assertAllowedAutomatedTestDatabaseUrl(
          'postgresql://postgres:password@127.0.0.1:5432/impactloop?schema=public',
        ),
      /development database/,
    );
    assert.doesNotThrow(() =>
      assertAllowedAutomatedTestDatabaseUrl(
        'postgresql://postgres:password@127.0.0.1:5432/impactloop_test?schema=public',
      ),
    );
  });
});
