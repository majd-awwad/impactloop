import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { AppError } from '../../utils/app-error.js';
import {
  PICKUP_ERROR_CODES,
  assertValidPickupWindow,
  validatePickupWindow,
} from './pickup-window-validation.js';
import {
  LEARNER_PICKUP_WINDOW_TOO_CLOSE_MESSAGE,
  PROPOSED_PICKUP_START_TOO_SOON_MESSAGE,
} from './reservation-timing-policy.js';

const minutesFromNow = (minutes: number) => Date.now() + minutes * 60_000;

describe('pickup window validation', () => {
  test('rejects end before start for learner preferred window', () => {
    const start = new Date(minutesFromNow(120));
    const end = new Date(minutesFromNow(60));

    const failure = validatePickupWindow(
      { start, end },
      'learner_preferred',
    );

    assert.equal(failure?.code, PICKUP_ERROR_CODES.END_BEFORE_START);
  });

  test('rejects zero-length pickup window', () => {
    const start = new Date(minutesFromNow(120));

    const failure = validatePickupWindow(
      { start, end: new Date(start.getTime()) },
      'supplier_custom_proposal',
    );

    assert.equal(failure?.code, PICKUP_ERROR_CODES.END_BEFORE_START);
  });

  test('rejects start in the past for learner preferred window', () => {
    const start = new Date(minutesFromNow(-10));
    const end = new Date(minutesFromNow(120));

    const failure = validatePickupWindow(
      { start, end },
      'learner_preferred',
    );

    assert.equal(failure?.code, PICKUP_ERROR_CODES.START_IN_PAST);
  });

  test('rejects end in the past', () => {
    const start = new Date(minutesFromNow(-120));
    const end = new Date(minutesFromNow(-30));

    const failure = validatePickupWindow(
      { start, end },
      'supplier_selected_preferred',
    );

    assert.equal(failure?.code, PICKUP_ERROR_CODES.END_IN_PAST);
  });

  test('rejects learner window ending too soon', () => {
    const start = new Date(minutesFromNow(10));
    const end = new Date(minutesFromNow(20));

    const failure = validatePickupWindow(
      { start, end },
      'learner_preferred',
    );

    assert.equal(
      failure?.code,
      PICKUP_ERROR_CODES.WINDOW_TOO_CLOSE_TO_ENDING,
    );
    assert.equal(failure?.message, LEARNER_PICKUP_WINDOW_TOO_CLOSE_MESSAGE);
  });

  test('rejects learner window starting too soon', () => {
    const start = new Date(minutesFromNow(10));
    const end = new Date(minutesFromNow(120));

    const failure = validatePickupWindow(
      { start, end },
      'learner_preferred',
    );

    assert.equal(failure?.code, PICKUP_ERROR_CODES.START_TOO_SOON);
  });

  test('allows supplier selected preferred window that already started', () => {
    const start = new Date(minutesFromNow(-10));
    const end = new Date(minutesFromNow(120));

    const failure = validatePickupWindow(
      { start, end },
      'supplier_selected_preferred',
    );

    assert.equal(failure, null);
  });

  test('rejects supplier selected preferred window with insufficient remaining time', () => {
    const start = new Date(minutesFromNow(-60));
    const end = new Date(minutesFromNow(20));

    const failure = validatePickupWindow(
      { start, end },
      'supplier_selected_preferred',
    );

    assert.equal(
      failure?.code,
      PICKUP_ERROR_CODES.WINDOW_TOO_CLOSE_TO_ENDING,
    );
  });

  test('rejects supplier custom proposal starting too soon', () => {
    const start = new Date(minutesFromNow(10));
    const end = new Date(minutesFromNow(120));

    const failure = validatePickupWindow(
      { start, end },
      'supplier_custom_proposal',
    );

    assert.equal(failure?.code, PICKUP_ERROR_CODES.START_TOO_SOON);
    assert.equal(failure?.message, PROPOSED_PICKUP_START_TOO_SOON_MESSAGE);
  });

  test('assertValidPickupWindow throws AppError with pickup code', () => {
    const start = new Date(minutesFromNow(10));
    const end = new Date(minutesFromNow(120));

    assert.throws(
      () =>
        assertValidPickupWindow(
          { start, end },
          'supplier_custom_proposal',
        ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, PICKUP_ERROR_CODES.START_TOO_SOON);
        assert.equal(error.statusCode, 400);
        return true;
      },
    );
  });
});
