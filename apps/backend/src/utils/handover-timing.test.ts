import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  evaluateHandoverWindow,
  HANDOVER_GRACE_MINUTES,
  pickupWindowExpiredMessage,
  pickupWindowNotStartedMessage,
} from './handover-timing.js';

describe('handover timing', () => {
  test('HANDOVER_GRACE_MINUTES is 30', () => {
    assert.equal(HANDOVER_GRACE_MINUTES, 30);
  });

  test('rejects before window start', () => {
    const start = new Date('2026-06-01T12:00:00.000Z');
    const end = new Date('2026-06-01T13:00:00.000Z');
    const now = new Date('2026-06-01T11:59:00.000Z');

    assert.deepEqual(evaluateHandoverWindow(now, start, end), {
      ok: false,
      reason: 'NOT_STARTED',
    });
    assert.equal(pickupWindowNotStartedMessage(), 'Pickup window has not started yet.');
  });

  test('accepts during window', () => {
    const start = new Date('2026-06-01T12:00:00.000Z');
    const end = new Date('2026-06-01T13:00:00.000Z');
    const now = new Date('2026-06-01T12:30:00.000Z');

    assert.deepEqual(evaluateHandoverWindow(now, start, end), { ok: true });
  });

  test('accepts within grace after window end', () => {
    const start = new Date('2026-06-01T12:00:00.000Z');
    const end = new Date('2026-06-01T13:00:00.000Z');
    const now = new Date('2026-06-01T13:29:00.000Z');

    assert.deepEqual(evaluateHandoverWindow(now, start, end), { ok: true });
  });

  test('rejects after grace period', () => {
    const start = new Date('2026-06-01T12:00:00.000Z');
    const end = new Date('2026-06-01T13:00:00.000Z');
    const now = new Date('2026-06-01T13:31:00.000Z');

    assert.deepEqual(evaluateHandoverWindow(now, start, end), {
      ok: false,
      reason: 'EXPIRED',
    });
    assert.equal(pickupWindowExpiredMessage(), 'Pickup window has expired.');
  });
});
