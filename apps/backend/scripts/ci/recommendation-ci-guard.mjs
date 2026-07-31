#!/usr/bin/env node
/**
 * RP-00.3 CI database isolation guard.
 *
 * Fail-closed checks before migrate/DB recommendation tests.
 * Usage: recommendation-ci-guard.mjs database
 */

const ALLOWED_HOSTS = new Set(['127.0.0.1', 'localhost']);
const ALLOWED_DATABASE = 'impactloop_ci';
const FORBIDDEN_DATABASE = 'impactloop';

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

const sanitizeUrl = (raw) => {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    fail('DATABASE_URL is malformed and cannot be parsed as a URL.');
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    fail(`DATABASE_URL protocol must be postgresql/postgres (got ${parsed.protocol}).`);
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, '').split('?')[0] ?? '');
  if (!databaseName) {
    fail('DATABASE_URL is missing a database name.');
  }
  if (!parsed.hostname) {
    fail('DATABASE_URL is missing a host.');
  }
  if (!parsed.username) {
    fail('DATABASE_URL is missing credentials (username).');
  }
  // URL.password is '' when omitted; require a non-empty password.
  if (!parsed.password) {
    fail('DATABASE_URL is missing credentials (password).');
  }

  return {
    hostname: parsed.hostname,
    port: parsed.port || '5432',
    databaseName,
  };
};

const assertDatabaseMode = () => {
  if (process.env.NODE_ENV !== 'test') {
    fail('NODE_ENV must be exactly "test" for recommendation CI database access.');
  }
  if (process.env.IMPACTLOOP_CI_DATABASE !== '1') {
    fail('IMPACTLOOP_CI_DATABASE must be exactly "1" to authorize CI database mutations/tests.');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !databaseUrl.trim()) {
    fail('DATABASE_URL is missing.');
  }

  const { hostname, port, databaseName } = sanitizeUrl(databaseUrl.trim());

  if (databaseName === FORBIDDEN_DATABASE) {
    fail(`DATABASE_URL database name "${FORBIDDEN_DATABASE}" is forbidden (developer default).`);
  }
  if (databaseName !== ALLOWED_DATABASE) {
    fail(
      `DATABASE_URL database name must be exactly "${ALLOWED_DATABASE}" (got "${databaseName}").`,
    );
  }

  if (!ALLOWED_HOSTS.has(hostname)) {
    fail(
      `DATABASE_URL host must be exactly one of ${[...ALLOWED_HOSTS].join(', ')} (got "${hostname}").`,
    );
  }

  console.log(
    JSON.stringify(
      {
        guard: 'recommendation-ci-database',
        status: 'ok',
        host: hostname,
        port,
        database: databaseName,
      },
      null,
      2,
    ),
  );
};

parseArgs(process.argv.slice(2));
assertDatabaseMode();
