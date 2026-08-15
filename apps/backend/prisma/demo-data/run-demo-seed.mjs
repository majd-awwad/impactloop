/**
 * Canonical graduation/community demo-data orchestrator.
 *
 * Runs additive demo stages in dependency order. Does NOT invoke destructive
 * `prisma:seed` or CI `seed:ci`. Each stage keeps its own localhost/demo guard.
 *
 * Usage (from apps/backend or via workspace):
 *   npm run demo:seed
 *   npm run demo:seed -w apps/backend
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

const STAGES = [
  {
    id: 'people',
    label: 'Community demo people',
    script: 'demo:seed:people',
  },
  {
    id: 'materials',
    label: 'Community demo materials',
    script: 'demo:seed:materials',
  },
  {
    id: 'projects',
    label: 'Learning project identity stamp / archive',
    script: 'demo:seed:projects',
  },
  {
    id: 'projects:najah',
    label: 'An-Najah Arabic learning projects',
    script: 'demo:seed:projects:najah',
  },
  {
    id: 'behavior',
    label: 'Community demo behavior engagement',
    script: 'demo:seed:behavior',
  },
  {
    id: 'behavior:journeys',
    label: 'Behavior journeys (viewsCount + MR journeys)',
    script: 'demo:seed:behavior:journeys',
  },
];

const runStage = (stage, index) => {
  const step = `[demo:seed ${index + 1}/${STAGES.length}]`;
  console.log(`${step} Starting: ${stage.label} (${stage.script})`);

  const result = spawnSync(
    'npm',
    ['run', stage.script],
    {
      cwd: backendRoot,
      env: process.env,
      encoding: 'utf8',
      shell: true,
      stdio: 'inherit',
    },
  );

  if (result.status !== 0) {
    throw new Error(
      `${step} FAILED: ${stage.label} (${stage.script}) exited with code ${result.status ?? 'null'}.`,
    );
  }

  console.log(`${step} OK: ${stage.label}`);
};

const main = () => {
  console.log(
    JSON.stringify(
      {
        orchestrator: 'demo:seed',
        note:
          'Additive graduation/community demo preparation. Does not run prisma:seed (destructive) or seed:ci (CI fixtures).',
        stages: STAGES.map((stage) => stage.script),
      },
      null,
      2,
    ),
  );

  for (let index = 0; index < STAGES.length; index += 1) {
    runStage(STAGES[index], index);
  }

  console.log(
    JSON.stringify(
      {
        orchestrator: 'demo:seed',
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
