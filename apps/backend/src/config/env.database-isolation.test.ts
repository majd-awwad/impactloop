import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

const DEV_URL =
  'postgresql://postgres:password@127.0.0.1:5433/impactloop?schema=public';
const TEST_URL =
  'postgresql://postgres:password@127.0.0.1:5433/impactloop_test?schema=public';

const runDatabaseIsolationHarness = (input: {
  nodeEnv?: string | null;
  nodeTestContext?: string | null;
  processDatabaseUrl: string;
  processTestDatabaseUrl?: string | null;
  fileContents: string;
}) => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'impactloop-db-isolation-'));
  const envFilePath = path.join(tempDir, '.env');
  writeFileSync(envFilePath, input.fileContents, 'utf8');

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    IMPACTLOOP_BACKEND_ENV_FILE_PATH: envFilePath,
    DATABASE_URL: input.processDatabaseUrl,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-xxxxxxxx',
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-xxxxxxx',
    HANDOVER_CODE_SECRET:
      process.env.HANDOVER_CODE_SECRET ?? 'test-handover-secret-xxxxxxxx',
  };

  if (input.nodeEnv === null) {
    delete env.NODE_ENV;
  } else if (input.nodeEnv !== undefined) {
    env.NODE_ENV = input.nodeEnv;
  }

  if (input.nodeTestContext) {
    env.NODE_TEST_CONTEXT = input.nodeTestContext;
  } else {
    delete env.NODE_TEST_CONTEXT;
  }

  if (input.processTestDatabaseUrl) {
    env.TEST_DATABASE_URL = input.processTestDatabaseUrl;
  } else {
    delete env.TEST_DATABASE_URL;
  }

  const result = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      path.join(backendRoot, 'src/config/env.database-isolation.harness.ts'),
    ],
    {
      cwd: backendRoot,
      env,
      encoding: 'utf8',
    },
  );

  rmSync(tempDir, { recursive: true, force: true });

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
};

describe('database isolation vs local .env override', () => {
  test('NODE_ENV=test keeps TEST_DATABASE_URL even when .env sets development/impactloop', () => {
    const result = runDatabaseIsolationHarness({
      nodeEnv: 'test',
      processDatabaseUrl: TEST_URL,
      processTestDatabaseUrl: TEST_URL,
      fileContents: [
        'NODE_ENV=development',
        `DATABASE_URL=${DEV_URL}`,
        `TEST_DATABASE_URL=${TEST_URL}`,
      ].join('\n'),
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = JSON.parse(result.stdout.trim()) as {
      nodeEnv: string;
      databaseName: string;
      hitsDevelopmentImpactloop: boolean;
    };
    assert.equal(payload.nodeEnv, 'test');
    assert.equal(payload.databaseName, 'impactloop_test');
    assert.equal(payload.hitsDevelopmentImpactloop, false);
  });

  test('NODE_TEST_CONTEXT alone refuses missing TEST_DATABASE_URL (no silent impactloop)', () => {
    const result = runDatabaseIsolationHarness({
      nodeEnv: null,
      nodeTestContext: 'child-v8',
      processDatabaseUrl: DEV_URL,
      processTestDatabaseUrl: null,
      fileContents: [
        'NODE_ENV=development',
        `DATABASE_URL=${DEV_URL}`,
      ].join('\n'),
    });

    assert.notEqual(result.status, 0);
    assert.match(`${result.stderr}\n${result.stdout}`, /TEST_DATABASE_URL/);
  });

  test('development still allows local .env to override inherited DATABASE_URL', () => {
    const result = runDatabaseIsolationHarness({
      nodeEnv: 'development',
      processDatabaseUrl: TEST_URL,
      processTestDatabaseUrl: TEST_URL,
      fileContents: [
        'NODE_ENV=development',
        `DATABASE_URL=${DEV_URL}`,
        `TEST_DATABASE_URL=${TEST_URL}`,
      ].join('\n'),
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = JSON.parse(result.stdout.trim()) as {
      nodeEnv: string;
      databaseName: string;
      hitsDevelopmentImpactloop: boolean;
    };
    assert.equal(payload.nodeEnv, 'development');
    assert.equal(payload.databaseName, 'impactloop');
    assert.equal(payload.hitsDevelopmentImpactloop, true);
  });
});
