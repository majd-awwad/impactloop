#!/usr/bin/env node
/**
 * Baseline CI test discovery runner.
 *
 * Modes: pure | db
 * - Curated critical-path suites for auth, reservations, payments, delivery, AI, and health
 * - Fails on missing required files or empty suites
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const PURE = [
  'src/modules/auth/jwt-secrets.env.test.ts',
  'src/modules/ai/ai.policy.test.ts',
  'src/modules/ai/safety/ai-hazard-taxonomy.test.ts',
  'src/modules/health/health.ready.test.ts',
  'src/modules/health/database-health.probe.test.ts',
  'src/modules/handover-codes/handover-codes.test.ts',
  'src/modules/payments/payments.env.test.ts',
];

const DB = [
  'src/modules/auth/auth.registration.test.ts',
  'src/modules/auth/auth.login.test.ts',
  'src/modules/auth/auth.refresh.test.ts',
  'src/modules/auth/auth.password-reset.test.ts',
  'src/modules/auth/auth.change-password.test.ts',
  'src/modules/auth/auth.role-switch.test.ts',
  'src/modules/reservations/reservations.partial.test.ts',
  'src/modules/reservations/reservations.learner-confirmation.test.ts',
  'src/modules/reservations/reservations.delivery-batch.test.ts',
  'src/modules/payments/payments.ensure.test.ts',
  'src/modules/payments/payments.pay02t.test.ts',
  'src/modules/payments/payments.pay06-e2e.test.ts',
  'src/modules/payments/payments.pay06-http-auth.test.ts',
  'src/modules/deliveries/deliveries.service.test.ts',
  'src/modules/ai/ai.test.ts',
  'src/modules/ai/ai.http-closure.test.ts',
];

const fail = (message) => {
  console.error(`run-baseline-ci-tests: ${message}`);
  process.exit(1);
};

const assertFilesExist = (paths, suiteName) => {
  for (const relativePath of paths) {
    const absolutePath = path.join(backendRoot, relativePath);
    if (!existsSync(absolutePath)) {
      fail(`Required ${suiteName} test file is missing: ${relativePath}`);
    }
  }
};

const runSuite = (suiteName, paths) => {
  const sorted = [...paths].sort((left, right) => left.localeCompare(right));
  if (sorted.length === 0) {
    fail(`Selected ${suiteName} suite is empty.`);
  }
  assertFilesExist(sorted, suiteName);

  console.log(
    JSON.stringify(
      {
        suite: suiteName,
        count: sorted.length,
        files: sorted,
      },
      null,
      2,
    ),
  );

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', '--test', '--test-concurrency=1', ...sorted],
    {
      cwd: backendRoot,
      stdio: 'inherit',
      env: process.env,
    },
  );

  if (result.error) {
    fail(`Failed to launch node test runner: ${result.error.message}`);
  }
  process.exit(result.status ?? 1);
};

const mode = process.argv[2];
if (mode !== 'pure' && mode !== 'db') {
  fail('Usage: run-baseline-ci-tests.mjs <pure|db>');
}

if (mode === 'pure') {
  runSuite('pure', PURE);
} else {
  runSuite('db', DB);
}
