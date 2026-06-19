import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { calculateMaxAllowedPrice } from './materials.service.js';

describe('calculateMaxAllowedPrice', () => {
  test('returns max allowed unit price without multiplying quantity', () => {
    const max = calculateMaxAllowedPrice({
      maxAllowedUnitPriceNis: 20,
      maxAllowedTotalPriceNis: 80,
      quantity: 4,
      condition: 'NEW',
    });

    assert.equal(max, 20);
  });

  test('derives unit cap from total only when unit cap is missing', () => {
    const max = calculateMaxAllowedPrice({
      maxAllowedUnitPriceNis: null,
      maxAllowedTotalPriceNis: 80,
      quantity: 4,
      condition: 'NEW',
    });

    assert.equal(max, 20);
  });
});
