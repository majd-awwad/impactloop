/**
 * Full local graduation demo recreation:
 *   1. canonical additive dataset (demo:seed)
 *   2. screenshot-state preparation (demo:prepare)
 *
 * Does not run prisma:seed.
 *
 * Usage (from apps/backend):
 *   npm run demo:all
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { formatStageFailure } from './run-demo-stages.mjs';

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

const STAGES = [
  {
    id: 'seed',
    label: 'Canonical additive dataset',
    script: 'demo:seed',
  },
  {
    id: 'prepare',
    label: 'Graduation screenshot-state preparation',
    script: 'demo:prepare',
  },
];

const main = () => {
  console.log(
    JSON.stringify(
      {
        orchestrator: 'demo:all',
        note: 'Runs demo:seed then demo:prepare. Does not run prisma:seed.',
        stages: STAGES.map((stage) => stage.script),
      },
      null,
      2,
    ),
  );

  for (let index = 0; index < STAGES.length; index += 1) {
    const stage = STAGES[index];
    const step = `[demo:all ${index + 1}/${STAGES.length}]`;
    console.log(`${step} Starting: ${stage.label} (${stage.script})`);
    const result = spawnSync('npm', ['run', stage.script], {
      cwd: backendRoot,
      env: process.env,
      encoding: 'utf8',
      shell: true,
      stdio: 'inherit',
    });
    if (result.status !== 0) {
      throw new Error(
        formatStageFailure({
          orchestrator: 'demo:all',
          index,
          total: STAGES.length,
          stage,
          status: result.status,
        }),
      );
    }
    console.log(`${step} OK: ${stage.label}`);
  }

  console.log(
    JSON.stringify(
      {
        orchestrator: 'demo:all',
        status: 'ok',
        completedStages: STAGES.map((stage) => stage.script),
      },
      null,
      2,
    ),
  );
};

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
