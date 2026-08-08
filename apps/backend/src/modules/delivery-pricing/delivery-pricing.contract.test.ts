import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  calculateDeliveryPricing,
  classifyDeliveryZone,
  DELIVERY_FEE_BY_ZONE,
  DELIVERY_PRICING_CURRENCY,
  DELIVERY_ZONE_UNKNOWN_MESSAGE,
  formatNormalizedDropoffCity,
} from './delivery-pricing.service.js';
import {
  citiesMatch,
  isInside48City,
  isJerusalemCity,
  isWestBankCity,
  normalizeCityName,
} from './delivery-zone-cities.js';
import {
  findBestOverlappingWindow,
  intersectWindows,
  unionWindowBounds,
  windowsOverlap,
} from './delivery-window-overlap.js';

describe('delivery zone classification contract', () => {
  test('fee table matches zone constants', () => {
    assert.equal(DELIVERY_FEE_BY_ZONE.SAME_CITY, 10);
    assert.equal(DELIVERY_FEE_BY_ZONE.WEST_BANK, 20);
    assert.equal(DELIVERY_FEE_BY_ZONE.JERUSALEM, 40);
    assert.equal(DELIVERY_FEE_BY_ZONE.INSIDE_48, 60);
    assert.equal(DELIVERY_PRICING_CURRENCY, 'NIS');
  });

  test('empty cities classify as UNKNOWN', () => {
    assert.equal(
      classifyDeliveryZone({ supplierPickupCity: '', dropoffCity: 'Nablus' }),
      'UNKNOWN',
    );
    assert.equal(
      classifyDeliveryZone({ supplierPickupCity: 'Nablus', dropoffCity: '' }),
      'UNKNOWN',
    );
  });

  test('unknown dropoff returns structured failure', () => {
    const result = calculateDeliveryPricing({
      supplierPickupCity: 'Nablus',
      dropoffCity: 'Unknown City XYZ',
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.zone, 'UNKNOWN');
      assert.equal(result.message, DELIVERY_ZONE_UNKNOWN_MESSAGE);
    }
  });

  test('city normalization helpers are case-insensitive', () => {
    assert.equal(normalizeCityName('  Tel   Aviv  '), 'tel aviv');
    assert.equal(isInside48City('Tel Aviv'), true);
    assert.equal(isJerusalemCity('Al Quds'), true);
    assert.equal(isWestBankCity('Ramallah'), true);
    assert.equal(citiesMatch('Nablus', 'nablus'), true);
    assert.equal(formatNormalizedDropoffCity('  Jenin  '), 'jenin');
  });
});

describe('delivery window overlap contract', () => {
  const windowA = {
    start: new Date('2026-07-01T08:00:00.000Z'),
    end: new Date('2026-07-01T10:00:00.000Z'),
  };
  const windowB = {
    start: new Date('2026-07-01T09:00:00.000Z'),
    end: new Date('2026-07-01T11:00:00.000Z'),
  };
  const windowC = {
    start: new Date('2026-07-01T12:00:00.000Z'),
    end: new Date('2026-07-01T13:00:00.000Z'),
  };

  test('windowsOverlap and intersectWindows share the overlapping segment', () => {
    assert.equal(windowsOverlap(windowA, windowB), true);
    assert.equal(windowsOverlap(windowA, windowC), false);

    const overlap = intersectWindows(windowA, windowB);
    assert.ok(overlap);
    assert.equal(overlap!.start.toISOString(), '2026-07-01T09:00:00.000Z');
    assert.equal(overlap!.end.toISOString(), '2026-07-01T10:00:00.000Z');
    assert.equal(intersectWindows(windowA, windowC), null);
  });

  test('findBestOverlappingWindow picks the longest overlap', () => {
    const shortOverlap = {
      start: new Date('2026-07-01T08:30:00.000Z'),
      end: new Date('2026-07-01T09:00:00.000Z'),
    };
    const best = findBestOverlappingWindow([shortOverlap, windowB], windowA);
    assert.ok(best);
    assert.equal(best!.start.toISOString(), '2026-07-01T09:00:00.000Z');
    assert.equal(best!.end.toISOString(), '2026-07-01T10:00:00.000Z');
  });

  test('unionWindowBounds spans all windows and rejects empty input', () => {
    assert.equal(unionWindowBounds([]), null);

    const union = unionWindowBounds([windowA, windowC]);
    assert.ok(union);
    assert.equal(union!.start.toISOString(), windowA.start.toISOString());
    assert.equal(union!.end.toISOString(), windowC.end.toISOString());
  });
});
