/**
 * Fail-closed isolation for automated backend tests.
 *
 * Automated tests must use TEST_DATABASE_URL pointing at a dedicated database
 * (impactloop_test or impactloop_ci). The normal development database name
 * `impactloop` is always rejected.
 */

export const FORBIDDEN_DEVELOPMENT_DATABASE = 'impactloop';
export const ALLOWED_TEST_DATABASES = new Set([
  'impactloop_test',
  'impactloop_ci',
  'impactloop_driver_e2e',
]);

export const TEST_DATABASE_REFUSAL_MESSAGE =
  'Refusing to run automated tests against the development database.\n' +
  'Configure TEST_DATABASE_URL with a dedicated test database ' +
  `(allowed names: ${[...ALLOWED_TEST_DATABASES].join(', ')}).`;

/**
 * @param {string} raw
 * @returns {{ hostname: string, port: string, databaseName: string }}
 */
export const parsePostgresUrl = (raw) => {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('DATABASE URL is malformed and cannot be parsed as a URL.');
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Error(
      `DATABASE URL protocol must be postgresql/postgres (got ${parsed.protocol}).`,
    );
  }

  const databaseName = decodeURIComponent(
    parsed.pathname.replace(/^\//, '').split('?')[0] ?? '',
  );
  if (!databaseName) {
    throw new Error('DATABASE URL is missing a database name.');
  }
  if (!parsed.hostname) {
    throw new Error('DATABASE URL is missing a host.');
  }

  return {
    hostname: parsed.hostname,
    port: parsed.port || '5432',
    databaseName,
  };
};

const normalizeConnectionString = (raw) => raw.trim().replace(/\/$/, '');

const sameDatabaseIdentity = (left, right) =>
  left.hostname === right.hostname &&
  left.port === right.port &&
  left.databaseName === right.databaseName;

/**
 * Validate TEST_DATABASE_URL for automated tests.
 *
 * Rules:
 * - NODE_ENV must be "test"
 * - TEST_DATABASE_URL is required (no fallback to DATABASE_URL)
 * - database name must be impactloop_test or impactloop_ci
 * - database name must never be impactloop
 * - if TEST_DATABASE_URL is identical to DATABASE_URL and that target is
 *   impactloop, refuse (covers local misconfiguration)
 *
 * CI may set both URLs to the same impactloop_ci connection string.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{
 *   testDatabaseUrl: string,
 *   databaseName: string,
 *   hostname: string,
 *   port: string,
 * }}
 */
export const assertSafeTestDatabaseUrl = (env = process.env) => {
  if ((env.NODE_ENV ?? '').trim() !== 'test') {
    throw new Error('NODE_ENV must be exactly "test" before validating TEST_DATABASE_URL.');
  }

  const testDatabaseUrl = env.TEST_DATABASE_URL?.trim() ?? '';
  if (!testDatabaseUrl) {
    throw new Error(
      'TEST_DATABASE_URL is required when NODE_ENV=test.\n' +
        TEST_DATABASE_REFUSAL_MESSAGE,
    );
  }

  let parsedTest;
  try {
    parsedTest = parsePostgresUrl(testDatabaseUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`TEST_DATABASE_URL is invalid: ${message}`);
  }

  if (parsedTest.databaseName === FORBIDDEN_DEVELOPMENT_DATABASE) {
    throw new Error(TEST_DATABASE_REFUSAL_MESSAGE);
  }

  if (!ALLOWED_TEST_DATABASES.has(parsedTest.databaseName)) {
    throw new Error(
      `TEST_DATABASE_URL database name must be one of: ${[
        ...ALLOWED_TEST_DATABASES,
      ].join(', ')} (got "${parsedTest.databaseName}").\n` +
        TEST_DATABASE_REFUSAL_MESSAGE,
    );
  }

  const developmentDatabaseUrl = env.DATABASE_URL?.trim() ?? '';
  if (developmentDatabaseUrl) {
    const identical =
      normalizeConnectionString(testDatabaseUrl) ===
      normalizeConnectionString(developmentDatabaseUrl);

    let parsedDev = null;
    try {
      parsedDev = parsePostgresUrl(developmentDatabaseUrl);
    } catch {
      parsedDev = null;
    }

    if (identical && parsedDev?.databaseName === FORBIDDEN_DEVELOPMENT_DATABASE) {
      throw new Error(
        'TEST_DATABASE_URL must not be identical to DATABASE_URL.\n' +
          TEST_DATABASE_REFUSAL_MESSAGE,
      );
    }

    if (
      parsedDev &&
      sameDatabaseIdentity(parsedTest, parsedDev) &&
      parsedDev.databaseName === FORBIDDEN_DEVELOPMENT_DATABASE
    ) {
      throw new Error(
        'TEST_DATABASE_URL must not target the same database as DATABASE_URL ' +
          `when that database is "${FORBIDDEN_DEVELOPMENT_DATABASE}".\n` +
          TEST_DATABASE_REFUSAL_MESSAGE,
      );
    }
  }

  return {
    testDatabaseUrl,
    databaseName: parsedTest.databaseName,
    hostname: parsedTest.hostname,
    port: parsedTest.port,
  };
};
