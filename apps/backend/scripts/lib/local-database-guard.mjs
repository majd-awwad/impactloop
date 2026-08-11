/**
 * Fail-closed local-database guards for destructive seed / demo-data tooling.
 *
 * Reuses parsePostgresUrl from the test-database guard. Intended for local
 * developer machines (localhost / 127.0.0.1 / ::1), not Docker Compose
 * production-style stacks (those run NODE_ENV=production against host `db`).
 */

import {
  FORBIDDEN_DEVELOPMENT_DATABASE,
  parsePostgresUrl,
} from './test-database-guard.mjs';

export { parsePostgresUrl };

export const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/** Databases that must never receive a full destructive Prisma seed reset. */
export const FORBIDDEN_DESTRUCTIVE_SEED_DATABASES = new Set([
  'impactloop_test',
  'impactloop_ci',
  'impactloop_driver_e2e',
  'impactloop_dr04_bench',
  'postgres',
  'template0',
  'template1',
]);

const PRODUCTION_LIKE_NAME = /prod|production|staging/i;

/**
 * @param {string} hostname
 * @returns {boolean}
 */
export const isLocalDatabaseHost = (hostname) =>
  LOCAL_DATABASE_HOSTS.has(String(hostname ?? '').toLowerCase());

/**
 * Localhost-only guard used by additive demo-data scripts.
 *
 * @param {string | undefined} databaseUrl
 * @param {string} purpose
 * @returns {{ hostname: string, port: string, databaseName: string }}
 */
export const assertLocalDemoDatabaseUrl = (
  databaseUrl,
  purpose = 'demo-data operation',
) => {
  if (!databaseUrl?.trim()) {
    throw new Error(`DATABASE_URL is required for ${purpose}.`);
  }

  let parsed;
  try {
    parsed = parsePostgresUrl(databaseUrl.trim());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`DATABASE_URL is invalid for ${purpose}: ${message}`);
  }

  if (!isLocalDatabaseHost(parsed.hostname)) {
    throw new Error(
      `Refusing ${purpose} on non-local database host "${parsed.hostname}". ` +
        `Allowed hosts: ${[...LOCAL_DATABASE_HOSTS].join(', ')}.`,
    );
  }

  if (PRODUCTION_LIKE_NAME.test(parsed.databaseName)) {
    throw new Error(
      `Refusing ${purpose} against production-like database name "${parsed.databaseName}".`,
    );
  }

  return parsed;
};

/**
 * Fail-closed guard before destructive Prisma seed reset (TRUNCATE).
 *
 * Allows the normal developer database (`impactloop`) on local hosts.
 * Rejects CI/test/E2E/bench reserved names, non-local hosts, and
 * production-like targets. NODE_ENV=production is refused as an extra signal
 * but is never the sole check.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ hostname: string, port: string, databaseName: string, databaseUrl: string }}
 */
export const assertSafeDestructiveSeedTarget = (env = process.env) => {
  const nodeEnv = (env.NODE_ENV ?? '').trim().toLowerCase();
  if (nodeEnv === 'production') {
    throw new Error(
      'Refusing destructive Prisma seed because NODE_ENV is "production".',
    );
  }

  const databaseUrl = env.DATABASE_URL?.trim() ?? '';
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is required before destructive Prisma seed reset.',
    );
  }

  let parsed;
  try {
    parsed = parsePostgresUrl(databaseUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Refusing destructive Prisma seed: DATABASE_URL is invalid (${message}).`,
    );
  }

  if (!isLocalDatabaseHost(parsed.hostname)) {
    throw new Error(
      `Refusing destructive Prisma seed on non-local database host "${parsed.hostname}". ` +
        `Allowed hosts: ${[...LOCAL_DATABASE_HOSTS].join(', ')}. ` +
        'Use a local PostgreSQL instance reachable via localhost.',
    );
  }

  const databaseName = parsed.databaseName;
  if (FORBIDDEN_DESTRUCTIVE_SEED_DATABASES.has(databaseName.toLowerCase())) {
    throw new Error(
      `Refusing destructive Prisma seed against reserved database "${databaseName}". ` +
        `This command only targets a local development database (typically "${FORBIDDEN_DEVELOPMENT_DATABASE}"), ` +
        'never CI/test/E2E/benchmark databases.',
    );
  }

  if (PRODUCTION_LIKE_NAME.test(databaseName)) {
    throw new Error(
      `Refusing destructive Prisma seed against production-like database name "${databaseName}".`,
    );
  }

  return {
    ...parsed,
    databaseUrl,
  };
};

/**
 * Source DATABASE_URL validation for the DR-04 disposable query-scale benchmark.
 *
 * @param {string | undefined} sourceUrl
 * @param {string} benchDatabaseName
 * @returns {{
 *   hostname: string,
 *   port: string,
 *   sourceDatabaseName: string,
 *   benchDatabaseName: string,
 * }}
 */
export const assertSafeDriverBenchmarkSource = (
  sourceUrl,
  benchDatabaseName = 'impactloop_dr04_bench',
) => {
  if (!sourceUrl?.trim()) {
    throw new Error('DATABASE_URL is required for driver query-scale benchmark.');
  }

  let parsed;
  try {
    parsed = parsePostgresUrl(sourceUrl.trim());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `DATABASE_URL is invalid for driver query-scale benchmark: ${message}`,
    );
  }

  if (!isLocalDatabaseHost(parsed.hostname)) {
    throw new Error(
      `Refusing driver query-scale benchmark on non-local database host "${parsed.hostname}". ` +
        `Allowed hosts: ${[...LOCAL_DATABASE_HOSTS].join(', ')}.`,
    );
  }

  if (PRODUCTION_LIKE_NAME.test(parsed.databaseName)) {
    throw new Error(
      `Refusing driver query-scale benchmark against production-like source database "${parsed.databaseName}".`,
    );
  }

  const reservedSource = new Set([
    'impactloop_ci',
    'impactloop_test',
    'impactloop_driver_e2e',
    benchDatabaseName.toLowerCase(),
    'postgres',
    'template0',
    'template1',
  ]);
  if (reservedSource.has(parsed.databaseName.toLowerCase())) {
    throw new Error(
      `Refusing driver query-scale benchmark: source database "${parsed.databaseName}" is reserved. ` +
        `Clone from the local developer database (typically "${FORBIDDEN_DEVELOPMENT_DATABASE}").`,
    );
  }

  const normalizedBench = String(benchDatabaseName ?? '').trim().toLowerCase();
  if (normalizedBench !== 'impactloop_dr04_bench') {
    throw new Error(
      `Refusing driver query-scale benchmark database name "${benchDatabaseName}". ` +
        'Expected exactly "impactloop_dr04_bench".',
    );
  }

  return {
    hostname: parsed.hostname,
    port: parsed.port,
    sourceDatabaseName: parsed.databaseName,
    benchDatabaseName: normalizedBench,
  };
};

/**
 * Fail-closed: only the disposable benchmark database may be terminated/dropped.
 *
 * @param {string} databaseName
 * @param {string} [expectedBenchName]
 */
export const assertBenchmarkDatabaseNameForDestructiveOps = (
  databaseName,
  expectedBenchName = 'impactloop_dr04_bench',
) => {
  const normalized = String(databaseName ?? '').trim().toLowerCase();
  const expected = String(expectedBenchName ?? '').trim().toLowerCase();
  if (!normalized || normalized !== expected) {
    throw new Error(
      `Refusing destructive benchmark operation on database "${databaseName}". ` +
        `Only "${expected}" may be terminated or dropped by this tool.`,
    );
  }
};
