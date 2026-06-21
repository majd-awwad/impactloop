import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import {
  buildReverseGeocodeCacheKey,
  clearReverseGeocodeCache,
  parseNominatimResponse,
  pickCity,
  reverseGeocodeCoordinates,
  setReverseGeocodeFetcherForTests,
} from '../../services/reverse-geocoding.service.js';

import { reverseGeocodeSchema } from './locations.validation.js';

describe('reverseGeocodeSchema', () => {
  test('rejects invalid latitude', () => {
    const result = reverseGeocodeSchema.safeParse({
      latitude: 91,
      longitude: 35.2,
    });

    assert.equal(result.success, false);
  });

  test('rejects invalid longitude', () => {
    const result = reverseGeocodeSchema.safeParse({
      latitude: 32.2,
      longitude: 181,
    });

    assert.equal(result.success, false);
  });

  test('accepts valid coordinates', () => {
    const result = reverseGeocodeSchema.safeParse({
      latitude: 32.22323,
      longitude: 35.2437,
    });

    assert.equal(result.success, true);
  });
});

describe('parseNominatimResponse', () => {
  test('parses city/town/village fallback fields', () => {
    assert.equal(
      pickCity({ town: 'Nablus', village: 'Rafidia' }),
      'Nablus',
    );

    const villageOnly = parseNominatimResponse({
      display_name: 'Rafidia, Nablus, Palestine',
      address: {
        country: 'Palestine',
        village: 'Rafidia',
        suburb: 'Rafidia',
        road: 'Main Street',
      },
    });

    assert.equal(villageOnly.country, 'Palestine');
    assert.equal(villageOnly.city, 'Rafidia');
    assert.equal(villageOnly.area, 'Rafidia');
    assert.equal(villageOnly.addressLine, 'Main Street');
    assert.equal(villageOnly.provider, 'nominatim');
  });

  test('returns null city when no city-like field exists', () => {
    const parsed = parseNominatimResponse({
      display_name: 'Some place, Palestine',
      address: {
        country: 'Palestine',
        suburb: 'Old City',
      },
    });

    assert.equal(parsed.city, null);
    assert.equal(parsed.area, 'Old City');
  });
});

describe('reverseGeocodeCoordinates cache', () => {
  afterEach(() => {
    clearReverseGeocodeCache();
    setReverseGeocodeFetcherForTests(null);
  });

  test('uses rounded coordinate cache key', () => {
    assert.equal(
      buildReverseGeocodeCacheKey(32.223234, 35.243701),
      '32.22323,35.2437',
    );
  });

  test('returns cached result without second provider call', async () => {
    let calls = 0;

    setReverseGeocodeFetcherForTests(async () => {
      calls += 1;
      return {
        country: 'Palestine',
        city: 'Nablus',
        area: 'Rafidia',
        addressLine: 'Main Street',
        displayName: 'Rafidia, Nablus, Palestine',
        provider: 'nominatim',
      };
    });

    const first = await reverseGeocodeCoordinates(32.22323, 35.2437);
    const second = await reverseGeocodeCoordinates(32.223234, 35.243701);

    assert.equal(calls, 1);
    assert.deepEqual(second, first);
  });
});
