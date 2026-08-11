#!/usr/bin/env node
/**
 * RP-00.3 CI database isolation guard.
 *
 * Fail-closed checks before migrate/DB recommendation tests.
 * Usage: recommendation-ci-guard.mjs database
 *
 * Validates both DATABASE_URL (Prisma migrate/seed) and TEST_DATABASE_URL
 * (automated tests via env.ts) against the isolated CI database.
 */

import {
  assertSafeTestDatabaseUrl,
  FORBIDDEN_DEVELOPMENT_DATABASE,
  parsePostgresUrl,
} from '../lib/test-database-guard.mjs';

const ALLOWED_HOSTS = new Set(['127.0.0.1', 'localhost']);
const ALLOWED_DATABASE = 'impactloop_ci';

const fail = (message) => {
  console.error(`recommendation-ci-guard: ${message}`);
  process.exit(1);
};

const parseArgs = (argv) => {
  const mode = argv[0];
  if (mode !== 'database') {
    fail('Usage: recommendation-ci-guard.mjs database');
  }
  return { mode };
};

const sanitizeCiUrl = (raw, label) => {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    fail(`${label} is malformed and cannot be parsed as a URL.`);
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    fail(`${label} protocol must be postgresql/postgres (got ${parsed.protocol}).`);
  }

  let identity;
  try {
    identity = parsePostgresUrl(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`${label} is invalid: ${message}`);
  }

  if (!parsed.username) {
    fail(`${label} is missing credentials (username).`);
  }
  if (!parsed.password) {
    fail(`${label} is missing credentials (password).`);
  }

  return identity;
};

const assertCiDatabaseUrl = (raw, label) => {
  if (!raw || !raw.trim()) {
    fail(`${label} is missing.`);
  }

  const { hostname, port, databaseName } = sanitizeCiUrl(raw.trim(), label);

  if (databaseName === FORBIDDEN_DEVELOPMENT_DATABASE) {
    fail(
      `${label} database name "${FORBIDDEN_DEVELOPMENT_DATABASE}" is forbidden (developer default).`,
    );
  }
  if (databaseName !== ALLOWED_DATABASE) {
    fail(
      `${label} database name must be exactly "${ALLOWED_DATABASE}" (got "${databaseName}").`,
    );
  }

  if (!ALLOWED_HOSTS.has(hostname)) {
    fail(
      `${label} host must be exactly one of ${[...ALLOWED_HOSTS].join(', ')} (got "${hostname}").`,
    );
  }

  return { hostname, port, databaseName };
};

const assertDatabaseMode = () => {
  if (process.env.NODE_ENV !== 'test') {
    fail('NODE_ENV must be exactly "test" for recommendation CI database access.');
  }
  if (process.env.IMPACTLOOP_CI_DATABASE !== '1') {
    fail('IMPACTLOOP_CI_DATABASE must be exactly "1" to authorize CI database mutations/tests.');
  }

  const database = assertCiDatabaseUrl(process.env.DATABASE_URL, 'DATABASE_URL');
  const testDatabase = assertCiDatabaseUrl(
    process.env.TEST_DATABASE_URL,
    'TEST_DATABASE_URL',
  );

  try {
    assertSafeTestDatabaseUrl(process.env);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(message);
  }

  console.log(
    JSON.stringify(
      {
        guard: 'recommendation-ci-database',
        status: 'ok',
        host: database.hostname,
        port: database.port,
        database: database.databaseName,
        testDatabase: testDatabase.databaseName,
      },
      null,
      2,
    ),
  );
};

parseArgs(process.argv.slice(2));
assertDatabaseMode();
