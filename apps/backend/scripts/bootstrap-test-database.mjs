#!/usr/bin/env node
/**
 * Migrate + seed taxonomy on the dedicated test database.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const run = (args) => {
  const result = spawnSync(npmCmd, args, {
    cwd: backendRoot,
    stdio: 'inherit',
    shell: true,
  });
  if (result.error) {
    console.error(`bootstrap-test-database: ${result.error.message}`);
    process.exit(1);
  }
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
};

run(['run', 'test:db:migrate']);
run(['run', 'test:db:seed']);
