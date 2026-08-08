import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import { AppError } from '../utils/app-error.js';
import { resetRateLimitersForTests } from '../middlewares/rate-limit.middleware.js';

import {
  clearReverseGeocodeCache,
  getForwardGeocodeCacheSizeForTests,
  getReverseGeocodeCacheSizeForTests,
  populateForwardGeocodeCacheForTests,
  populateReverseGeocodeCacheForTests,
  reverseGeocodeCoordinates,
  setForwardGeocodeFetcherForTests,
  setGeocodeUserQuotaPolicyForTests,
  setReverseGeocodeFetcherForTests,
} from './reverse-geocoding.service.js';

const sampleReverseResult = {
  country: 'Palestine',
  city: 'Nablus',
  area: 'Rafidia',
  addressLine: 'Main Street',
  displayName: 'Rafidia, Nablus, Palestine',
  provider: 'nominatim' as const,
};

const sampleForwardResult = {
  ...sampleReverseResult,
  latitude: 32.16,
  longitude: 35.28,
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

describe('reverse-geocoding reliability', () => {
  afterEach(() => {
    clearReverseGeocodeCache();
    setReverseGeocodeFetcherForTests(null);
    setForwardGeocodeFetcherForTests(null);
    resetRateLimitersForTests();
  });

  test('evicts oldest cache entries when the reverse cache exceeds its bound', () => {
    populateReverseGeocodeCacheForTests(
      Array.from({ length: 1_001 }, (_, index) => ({
        latitude: 32 + index / 10_000,
        longitude: 35.2,
        value: {
          ...sampleReverseResult,
          city: `City ${index}`,
        },
      })),
    );

    assert.equal(getReverseGeocodeCacheSizeForTests(), 1_000);
  });

  test('evicts oldest cache entries when the forward cache exceeds its bound', () => {
    populateForwardGeocodeCacheForTests(
      Array.from({ length: 1_001 }, (_, index) => ({
        input: { city: `City ${index}` },
        value: {
          ...sampleForwardResult,
          city: `City ${index}`,
        },
      })),
    );

    assert.equal(getForwardGeocodeCacheSizeForTests(), 1_000);
  });

  test('serializes external reverse requests to respect the provider interval', async () => {
    const startedAt: number[] = [];

    setReverseGeocodeFetcherForTests(async (latitude) => {
      startedAt.push(Date.now());
      await sleep(10);
      return {
        ...sampleReverseResult,
        city: `City ${latitude}`,
      };
    });

    await Promise.all([
      reverseGeocodeCoordinates(32.1, 35.1),
      reverseGeocodeCoordinates(32.2, 35.2),
      reverseGeocodeCoordinates(32.3, 35.3),
    ]);

    assert.equal(startedAt.length, 3);
    assert.ok(startedAt[1]! - startedAt[0]! >= 990);
    assert.ok(startedAt[2]! - startedAt[1]! >= 990);
  });

  test('enforces per-user geocode quota', async () => {
    setReverseGeocodeFetcherForTests(async () => sampleReverseResult);
    setGeocodeUserQuotaPolicyForTests({
      name: 'geocode-test',
      windowMs: 60_000,
      max: 2,
    });

    const userId = 'quota-test-user';

    await reverseGeocodeCoordinates(32.1, 35.1, { userId });
    await reverseGeocodeCoordinates(32.2, 35.2, { userId });

    await assert.rejects(
      () => reverseGeocodeCoordinates(32.3, 35.3, { userId }),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 429 &&
        error.code === 'RATE_LIMITED',
    );
  });

  test('does not count cached reverse lookups against per-user quota', async () => {
    setReverseGeocodeFetcherForTests(async () => sampleReverseResult);

    const userId = 'cached-quota-user';

    await reverseGeocodeCoordinates(32.22323, 35.2437, { userId });
    await reverseGeocodeCoordinates(32.22323, 35.2437, { userId });

    assert.equal(getReverseGeocodeCacheSizeForTests(), 1);
  });
});
