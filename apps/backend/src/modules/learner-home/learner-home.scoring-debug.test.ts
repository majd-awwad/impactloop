import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { getSlowestActionableLearnerHomeStep } from './learner-home.scoring-debug.js';

describe('learner-home profiler', () => {
  test('excludes aggregate timers when selecting the slowest actionable step', () => {
    const slowest = getSlowestActionableLearnerHomeStep(
      new Map([
        ['loadLearnerHomeContext', 640],
        ['loadLearnerBehaviorContext', 410],
        ['totalGetLearnerHome', 890],
      ]),
    );

    assert.deepEqual(slowest, ['loadLearnerHomeContext', 640]);
  });
});
