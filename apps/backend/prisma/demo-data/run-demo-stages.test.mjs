import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  formatStageFailure,
  runInProcessStage,
  runSpawnedNpmStages,
} from './run-demo-stages.mjs';

describe('run-demo-stages', () => {
  test('formatStageFailure identifies the failing stage and command', () => {
    const message = formatStageFailure({
      orchestrator: 'demo:seed',
      index: 5,
      total: 6,
      stage: {
        id: 'behavior:journeys',
        label: 'Behavior journeys',
        script: 'demo:seed:behavior:journeys',
      },
      status: 1,
    });
    assert.match(message, /demo:seed 6\/6/);
    assert.match(message, /Behavior journeys/);
    assert.match(message, /demo:seed:behavior:journeys/);
    assert.match(message, /exited with code 1/);
  });

  test('spawned orchestrator stops at the first failing stage', () => {
    const calls = [];
    const spawn = (command, args) => {
      calls.push({ command, args });
      const script = args[1];
      return { status: script === 'demo:seed:projects' ? 1 : 0 };
    };

    assert.throws(
      () =>
        runSpawnedNpmStages({
          orchestrator: 'demo:seed',
          cwd: '.',
          env: process.env,
          spawn,
          note: 'test',
          stages: [
            { id: 'people', label: 'People', script: 'demo:seed:people' },
            { id: 'projects', label: 'Projects', script: 'demo:seed:projects' },
            { id: 'behavior', label: 'Behavior', script: 'demo:seed:behavior' },
          ],
        }),
      /\[demo:seed 2\/3\] FAILED: Projects \(demo:seed:projects\)/,
    );
    assert.equal(calls.length, 2);
  });

  test('in-process stage failure is non-zero-shaped and names the stage', async () => {
    await assert.rejects(
      () =>
        runInProcessStage({
          orchestrator: 'demo:prepare',
          index: 2,
          total: 7,
          stage: {
            id: 'cash-handover',
            label: 'CASH handover',
            run: async () => {
              throw new Error('reservation conflict');
            },
          },
        }),
      /\[demo:prepare 3\/7\] FAILED: CASH handover \(cash-handover\).*reservation conflict/,
    );
  });
});
