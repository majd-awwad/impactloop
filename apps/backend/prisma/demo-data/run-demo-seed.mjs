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
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runSpawnedNpmStages } from './run-demo-stages.mjs';

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

try {
  runSpawnedNpmStages({
    orchestrator: 'demo:seed',
    cwd: backendRoot,
    env: process.env,
    note:
      'Additive graduation/community demo preparation. Does not run prisma:seed (destructive) or seed:ci (CI fixtures).',
    stages: STAGES,
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
