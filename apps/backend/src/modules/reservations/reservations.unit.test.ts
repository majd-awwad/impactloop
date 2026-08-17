import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  isValidReservationQuantityForUnit,
  reservationQuantityUnitErrorMessage,
} from './reservations.unit.js';

describe('reservation quantity unit rules', () => {
  test('piece-like units reject fractional quantities', () => {
    for (const unit of ['piece', 'pcs', 'قطعة', 'قطعة pcs', 'bag']) {
      assert.equal(isValidReservationQuantityForUnit(1, unit), true);
      assert.equal(isValidReservationQuantityForUnit(2, unit), true);
      assert.equal(isValidReservationQuantityForUnit(1.1, unit), false);
      assert.equal(isValidReservationQuantityForUnit(0.1, unit), false);
    }
  });

  test('measurable units allow 0.1 increments only', () => {
    assert.equal(isValidReservationQuantityForUnit(0.1, 'kg'), true);
    assert.equal(isValidReservationQuantityForUnit(1.1, 'kg'), true);
    assert.equal(isValidReservationQuantityForUnit(1.11, 'kg'), false);
    assert.equal(isValidReservationQuantityForUnit(1.1, 'كيلو'), true);
    assert.equal(isValidReservationQuantityForUnit(0.1, 'liter'), true);
  });

  test('explains whole-number rule for count-like materials', () => {
    assert.match(
      reservationQuantityUnitErrorMessage('قطعة'),
      /whole numbers/i,
    );
  });
});
