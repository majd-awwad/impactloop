#!/usr/bin/env node
/**
 * Migrate ONLY the dedicated test database (TEST_DATABASE_URL).
 *
 * Does not touch the development DATABASE_URL database.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import {
  assertSafeTestDatabaseUrl,
} from './lib/test-database-guard.mjs';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const fail = (message) => {
  console.error(`migrate-test-database: ${message}`);
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
      action: 'prisma-migrate-deploy',
      target: 'TEST_DATABASE_URL',
      host: validated.hostname,
      port: validated.port,
      database: validated.databaseName,
    },
    null,
    2,
  ),
);

const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  cwd: backendRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: validated.testDatabaseUrl,
    TEST_DATABASE_URL: validated.testDatabaseUrl,
  },
  shell: true,
});

if (result.error) {
  fail(`Failed to launch prisma migrate deploy: ${result.error.message}`);
}
process.exit(result.status ?? 1);
