import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  allowedHandoverEnd,
  allowedHandoverStart,
  evaluateHandoverWindow,
  HANDOVER_EARLY_MINUTES,
  HANDOVER_GRACE_MINUTES,
  isAfterAllowedEnd,
  pickupWindowNotStartedMessage,
  pickupWindowPassedMessage,
  resolvePickupHandoverPhase,
} from './handover-timing.js';

describe('handover timing', () => {
  test('central constants are 30 minutes each', () => {
    assert.equal(HANDOVER_EARLY_MINUTES, 30);
    assert.equal(HANDOVER_GRACE_MINUTES, 30);
  });

  test('rejects 31 minutes before pickup window start', () => {
    const start = new Date('2026-06-01T12:00:00.000Z');
    const end = new Date('2026-06-01T13:00:00.000Z');
    const now = new Date('2026-06-01T11:29:00.000Z');

    assert.deepEqual(evaluateHandoverWindow(now, start, end), {
      ok: false,
      reason: 'NOT_STARTED',
    });
    assert.equal(resolvePickupHandoverPhase(now, start, end), 'BEFORE_ALLOWED');
    assert.equal(pickupWindowNotStartedMessage(), 'Pickup window has not started yet.');
  });

  test('accepts exactly 30 minutes before pickup window start', () => {
    const start = new Date('2026-06-01T12:00:00.000Z');
    const end = new Date('2026-06-01T13:00:00.000Z');
    const now = new Date('2026-06-01T11:30:00.000Z');

    assert.deepEqual(evaluateHandoverWindow(now, start, end), { ok: true });
    assert.equal(resolvePickupHandoverPhase(now, start, end), 'DURING_ALLOWED');
    assert.equal(
      now.getTime(),
      allowedHandoverStart(start).getTime(),
    );
  });

  test('accepts during window', () => {
    const start = new Date('2026-06-01T12:00:00.000Z');
    const end = new Date('2026-06-01T13:00:00.000Z');
    const now = new Date('2026-06-01T12:30:00.000Z');

    assert.deepEqual(evaluateHandoverWindow(now, start, end), { ok: true });
    assert.equal(resolvePickupHandoverPhase(now, start, end), 'DURING_ALLOWED');
  });

  test('accepts exactly 30 minutes after pickup window end', () => {
    const start = new Date('2026-06-01T12:00:00.000Z');
    const end = new Date('2026-06-01T13:00:00.000Z');
    const now = new Date('2026-06-01T13:30:00.000Z');

    assert.deepEqual(evaluateHandoverWindow(now, start, end), { ok: true });
    assert.equal(resolvePickupHandoverPhase(now, start, end), 'DURING_ALLOWED');
    assert.equal(now.getTime(), allowedHandoverEnd(end).getTime());
  });

  test('rejects 31 minutes after pickup window end', () => {
    const start = new Date('2026-06-01T12:00:00.000Z');
    const end = new Date('2026-06-01T13:00:00.000Z');
    const now = new Date('2026-06-01T13:31:00.000Z');

    assert.deepEqual(evaluateHandoverWindow(now, start, end), {
      ok: false,
      reason: 'EXPIRED',
    });
    assert.equal(resolvePickupHandoverPhase(now, start, end), 'AFTER_ALLOWED');
    assert.equal(pickupWindowPassedMessage(), 'Pickup window has passed.');
  });

  test('isAfterAllowedEnd is false before grace ends', () => {
    const end = new Date('2026-06-01T13:00:00.000Z');
    const now = new Date('2026-06-01T13:29:00.000Z');

    assert.equal(isAfterAllowedEnd(now, end), false);
  });

  test('isAfterAllowedEnd is true after grace ends', () => {
    const end = new Date('2026-06-01T13:00:00.000Z');
    const now = new Date('2026-06-01T13:31:00.000Z');

    assert.equal(isAfterAllowedEnd(now, end), true);
  });
});
