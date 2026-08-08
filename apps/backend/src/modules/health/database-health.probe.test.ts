import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { DatabaseHealthProbe } from './database-health.probe.js';

describe('database health probe', () => {
  test('successful probe marks database ready; repeated failures mark not ready', async () => {
    let now = 1_000;
    let shouldFail = false;
    const probe = new DatabaseHealthProbe({
      now: () => now,
      probe: async () => {
        if (shouldFail) {
          throw new Error('db_down');
        }
      },
    });

    await probe.probeOnce();
    assert.equal(probe.getHealthSnapshot(now).ready, true);

    shouldFail = true;
    await probe.probeOnce();
    await probe.probeOnce();
    await probe.probeOnce();
    assert.equal(probe.getHealthSnapshot(now).ready, false);
    assert.ok(
      probe
        .getHealthSnapshot(now)
        .reasonCodes.includes('CONSECUTIVE_PROBE_FAILURES'),
    );
  });

  test('stale successful probe marks database not ready without issuing a new probe', async () => {
    let now = 10_000;
    const probe = new DatabaseHealthProbe({
      now: () => now,
      probe: async () => undefined,
    });

    await probe.probeOnce();
    now += 16_000;
    const snapshot = probe.getHealthSnapshot(now);
    assert.equal(snapshot.ready, false);
    assert.ok(snapshot.reasonCodes.includes('PROBE_STALE'));
  });
});
