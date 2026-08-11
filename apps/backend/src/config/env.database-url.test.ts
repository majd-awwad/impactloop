import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { resolveDatabaseUrl } from './env.js';

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
});
