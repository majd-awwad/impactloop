import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

import {
  DERIVED_DELIVERY_WINDOW_DURATION_HOURS,
  DERIVED_DELIVERY_WINDOW_FALLBACK_DELAY_HOURS,
  DERIVED_DELIVERY_WINDOW_LEAD_MINUTES,
  DRIVER_RECENT_LOCATION_PING_MAX_AGE_MS,
  LIVE_DRIVER_LOCATION_STALE_AFTER_MS,
  MAX_ACTIVE_DRIVER_DELIVERIES,
  deriveUnconfirmedDeliveryWindow,
  isLiveDriverLocationStale,
} from './delivery-configuration.js';

describe('delivery configuration', () => {
  test('exposes the operational delivery values', () => {
    assert.equal(DERIVED_DELIVERY_WINDOW_LEAD_MINUTES, 60);
    assert.equal(DERIVED_DELIVERY_WINDOW_FALLBACK_DELAY_HOURS, 24);
    assert.equal(DERIVED_DELIVERY_WINDOW_DURATION_HOURS, 2);
    assert.equal(LIVE_DRIVER_LOCATION_STALE_AFTER_MS, 90_000);
    assert.equal(DRIVER_RECENT_LOCATION_PING_MAX_AGE_MS, 24 * 60 * 60 * 1000);
    assert.equal(MAX_ACTIVE_DRIVER_DELIVERIES, 3);
  });

  test('keeps equal-looking timings as separate policies', () => {
    assert.equal(
      DERIVED_DELIVERY_WINDOW_FALLBACK_DELAY_HOURS * 60 * 60 * 1000,
      DRIVER_RECENT_LOCATION_PING_MAX_AGE_MS,
    );
    assert.notEqual(
      LIVE_DRIVER_LOCATION_STALE_AFTER_MS,
      DRIVER_RECENT_LOCATION_PING_MAX_AGE_MS,
    );
  });

  test('derives delivery windows from lead, fallback, and duration config', () => {
    const nowMs = Date.parse('2026-08-10T12:00:00.000Z');

    const afterPickupEnd = deriveUnconfirmedDeliveryWindow(
      new Date('2026-08-10T10:00:00.000Z'),
      nowMs,
    );
    assert.equal(
      afterPickupEnd.start.toISOString(),
      new Date(nowMs + DERIVED_DELIVERY_WINDOW_LEAD_MINUTES * 60 * 1000).toISOString(),
    );
    assert.equal(
      afterPickupEnd.end.toISOString(),
      new Date(
        afterPickupEnd.start.getTime() +
          DERIVED_DELIVERY_WINDOW_DURATION_HOURS * 60 * 60 * 1000,
      ).toISOString(),
    );

    const laterPickupEnd = deriveUnconfirmedDeliveryWindow(
      new Date('2026-08-10T18:00:00.000Z'),
      nowMs,
    );
    assert.equal(
      laterPickupEnd.start.toISOString(),
      '2026-08-10T18:00:00.000Z',
    );

    const fallback = deriveUnconfirmedDeliveryWindow(null, nowMs);
    assert.equal(
      fallback.start.toISOString(),
      new Date(
        nowMs + DERIVED_DELIVERY_WINDOW_FALLBACK_DELAY_HOURS * 60 * 60 * 1000,
      ).toISOString(),
    );
  });

  test('live driver location staleness uses the tracking threshold', () => {
    const nowMs = Date.parse('2026-08-10T12:00:00.000Z');
    const fresh = new Date(nowMs - LIVE_DRIVER_LOCATION_STALE_AFTER_MS);
    const stale = new Date(nowMs - LIVE_DRIVER_LOCATION_STALE_AFTER_MS - 1);

    assert.equal(isLiveDriverLocationStale(fresh, nowMs), false);
    assert.equal(isLiveDriverLocationStale(stale, nowMs), true);
  });

  test('delivery and driver modules consume the shared configuration', () => {
    const deliveriesSource = readFileSync(
      fileURLToPath(new URL('./deliveries.service.ts', import.meta.url)),
      'utf8',
    );
    const availabilitySource = readFileSync(
      fileURLToPath(new URL('../driver/driver-availability.ts', import.meta.url)),
      'utf8',
    );
    const locationSource = readFileSync(
      fileURLToPath(new URL('../driver/driver-location.ts', import.meta.url)),
      'utf8',
    );

    assert.match(
      deliveriesSource,
      /from '\.\/delivery-configuration\.js'/,
    );
    assert.match(deliveriesSource, /deriveUnconfirmedDeliveryWindow/);
    assert.match(deliveriesSource, /isLiveDriverLocationStale/);
    assert.doesNotMatch(deliveriesSource, /now \+ 60 \* 60 \* 1000/);
    assert.doesNotMatch(deliveriesSource, /> 90_000/);

    assert.match(
      availabilitySource,
      /from '\.\.\/deliveries\/delivery-configuration\.js'/,
    );
    assert.match(availabilitySource, /MAX_ACTIVE_DRIVER_DELIVERIES/);
    assert.doesNotMatch(
      availabilitySource,
      /export const MAX_ACTIVE_DRIVER_DELIVERIES = 3/,
    );

    assert.match(
      locationSource,
      /from '\.\.\/deliveries\/delivery-configuration\.js'/,
    );
    assert.match(locationSource, /DRIVER_RECENT_LOCATION_PING_MAX_AGE_MS/);
    assert.doesNotMatch(
      locationSource,
      /export const DRIVER_RECENT_LOCATION_PING_MAX_AGE_MS = /,
    );
  });
});
