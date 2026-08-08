#!/usr/bin/env node
/**
 * Backend module test runner.
 *
 * Suite files share one DATABASE_URL and rely on targeted deleteMany cleanup,
 * so test files run serially (--test-concurrency=1) to avoid cross-file
 * deadlocks, data pollution, and flake. Matches baseline/recommendation CI.
 *
 * Override with BACKEND_TEST_FILE_CONCURRENCY when intentionally isolating DB
 * access per file (e.g. disposable databases).
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modulesRoot = 'src/modules';

const fail = (message) => {
  console.error(`run-backend-tests: ${message}`);
  process.exit(1);
};

const toPosix = (value) => value.replace(/\\/g, '/');

const walkTestFiles = (relativeDir, collected) => {
  const absoluteDir = path.join(backendRoot, relativeDir);
  if (!existsSync(absoluteDir)) {
    return;
  }
  for (const entry of readdirSync(absoluteDir)) {
    const absolutePath = path.join(absoluteDir, entry);
    const relativePath = toPosix(path.join(relativeDir, entry));
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      walkTestFiles(relativePath, collected);
      continue;
    }
    if (stats.isFile() && entry.endsWith('.test.ts')) {
      collected.add(relativePath);
    }
  }
};

const resolveConcurrency = () => {
  const raw = process.env.BACKEND_TEST_FILE_CONCURRENCY?.trim();
  if (!raw) {
    return 1;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    fail('BACKEND_TEST_FILE_CONCURRENCY must be a positive integer.');
  }
  return parsed;
};

const discoverModuleTests = () => {
  const collected = new Set();
  walkTestFiles(modulesRoot, collected);
  return [...collected].sort((left, right) => left.localeCompare(right));
};

const explicitPaths = process.argv.slice(2).map((entry) => toPosix(entry));
const files = explicitPaths.length > 0 ? explicitPaths : discoverModuleTests();

if (files.length === 0) {
  fail(`No test files found under ${modulesRoot}.`);
}

for (const relativePath of files) {
  const absolutePath = path.join(backendRoot, relativePath);
  if (!existsSync(absolutePath)) {
    fail(`Test file not found: ${relativePath}`);
  }
}

const concurrency = resolveConcurrency();

console.log(
  JSON.stringify(
    {
      suite: 'backend-modules',
      count: files.length,
      testFileConcurrency: concurrency,
      files,
    },
    null,
    2,
  ),
);

const result = spawnSync(
  process.execPath,
  [
    '--import',
    'tsx',
    '--test',
    `--test-concurrency=${concurrency}`,
    ...files,
  ],
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
