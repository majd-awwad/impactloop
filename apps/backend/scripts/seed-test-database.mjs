#!/usr/bin/env node
/**
 * Seed taxonomy + minimal category fixtures on the dedicated test database.
 *
 * Does not touch the development DATABASE_URL database.
 * Lighter than `prisma db seed` — mirrors CI taxonomy bootstrap only.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import { assertSafeTestDatabaseUrl } from './lib/test-database-guard.mjs';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const fail = (message) => {
  console.error(`seed-test-database: ${message}`);
  process.exit(1);
};

process.env.NODE_ENV = 'test';

const envFilePath = process.env.IMPACTLOOP_BACKEND_ENV_FILE_PATH?.trim()
  ? path.resolve(process.env.IMPACTLOOP_BACKEND_ENV_FILE_PATH)
  : path.join(backendRoot, '.env');
dotenv.config({ path: envFilePath, override: false, quiet: true });

let validated;
try {
  validated = assertSafeTestDatabaseUrl(process.env);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  fail(message);
}

console.log(
  JSON.stringify(
    {
      action: 'seed-test-taxonomy',
      target: 'TEST_DATABASE_URL',
      host: validated.hostname,
      port: validated.port,
      database: validated.databaseName,
    },
    null,
    2,
  ),
);

const result = spawnSync('npx', ['tsx', 'scripts/ci/seed-ci-database.ts'], {
  cwd: backendRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: validated.testDatabaseUrl,
    TEST_DATABASE_URL: validated.testDatabaseUrl,
    IMPACTLOOP_TEST_DATABASE_SEED: '1',
  },
  shell: true,
});

if (result.error) {
  fail(`Failed to launch test taxonomy seed: ${result.error.message}`);
}
process.exit(result.status ?? 1);
