import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import {
  buildForwardGeocodeCacheKey,
  buildForwardGeocodeQuery,
  buildReverseGeocodeCacheKey,
  clearReverseGeocodeCache,
  forwardGeocodeLocation,
  parseNominatimResponse,
  pickCity,
  reverseGeocodeCoordinates,
  setForwardGeocodeFetcherForTests,
  setReverseGeocodeFetcherForTests,
} from '../../services/reverse-geocoding.service.js';
import { hashPassword } from '../../utils/password.js';

import {
  createUserSavedLocation,
  deleteUserSavedLocation,
  listUserSavedLocations,
  resolveSavedLocationCoordinates,
  updateUserSavedLocation,
} from './locations.service.js';
import {
  forwardGeocodeSchema,
  reverseGeocodeSchema,
  savedLocationSchema,
} from './locations.validation.js';

const TEST_MARKER = '[test-locations]';

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

describe('forwardGeocodeSchema', () => {
  test('rejects missing city', () => {
    const result = forwardGeocodeSchema.safeParse({
      area: 'Awarta',
      addressLine: 'Main Street',
    });

    assert.equal(result.success, false);
  });

  test('accepts typed city area and street', () => {
    const result = forwardGeocodeSchema.safeParse({
      country: 'Palestine',
      city: 'Nablus',
      area: 'Awarta',
      addressLine: 'Main Street',
    });

    assert.equal(result.success, true);
    assert.equal(result.data.area, 'Awarta');
  });
});

describe('savedLocationSchema', () => {
  test('rejects partial coordinate pairs', () => {
    const result = savedLocationSchema.safeParse({
      label: 'Campus',
      city: 'Nablus',
      latitude: 32.2,
    });

    assert.equal(result.success, false);
  });

  test('accepts private address and exact coordinates', () => {
    const result = savedLocationSchema.safeParse({
      label: 'Workshop',
      city: 'Nablus',
      area: 'Industrial',
      addressLine: 'Private workshop door',
      latitude: 32.2211,
      longitude: 35.2544,
      isDefault: true,
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
    setForwardGeocodeFetcherForTests(null);
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

  test('builds and caches forward geocode query from typed address', async () => {
    let calls = 0;

    assert.equal(
      buildForwardGeocodeQuery({
        country: 'Palestine',
        city: 'Nablus',
        area: 'Awarta',
        addressLine: 'Main Street',
      }),
      'Main Street, Awarta, Nablus, Palestine',
    );
    assert.equal(
      buildForwardGeocodeCacheKey({
        country: ' Palestine ',
        city: ' Nablus ',
        area: 'Awarta',
        addressLine: 'Main Street',
      }),
      'main street, awarta, nablus, palestine',
    );

    setForwardGeocodeFetcherForTests(async () => {
      calls += 1;
      return {
        country: 'Palestine',
        city: 'Nablus',
        area: 'Awarta',
        addressLine: 'Main Street',
        displayName: 'Main Street, Awarta, Nablus',
        latitude: 32.16,
        longitude: 35.28,
        provider: 'nominatim',
      };
    });

    const first = await forwardGeocodeLocation({
      country: 'Palestine',
      city: 'Nablus',
      area: 'Awarta',
      addressLine: 'Main Street',
    });
    const second = await forwardGeocodeLocation({
      country: ' Palestine ',
      city: ' Nablus ',
      area: 'Awarta',
      addressLine: 'Main Street',
    });

    assert.equal(calls, 1);
    assert.deepEqual(second, first);
  });
});

describe('user saved locations', () => {
  test('creates, lists, updates, resolves, and deletes private saved locations', async () => {
    const passwordHash = await hashPassword('TestPassword123!');
    const suffix = Date.now();
    const user = await prisma.user.create({
      data: {
        displayName: `${TEST_MARKER} learner ${suffix}`,
        email: `${TEST_MARKER}-learner-${suffix}@impactloop.test`,
        passwordHash,
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        roles: {
          create: [{ role: 'LEARNER', isPrimary: true }],
        },
        learnerProfile: {
          create: { learnerType: 'STUDENT', skillLevel: 'BEGINNER' },
        },
      },
      select: { id: true },
    });

    try {
      const first = await createUserSavedLocation(user.id, {
        label: 'Campus',
        country: 'Palestine',
        city: `${TEST_MARKER}-Nablus`,
        area: 'Rafidia',
        addressLine: 'Private campus entrance',
        latitude: 32.2211,
        longitude: 35.2544,
        isDefault: false,
      });
      const second = await createUserSavedLocation(user.id, {
        label: 'Workshop',
        country: 'Palestine',
        city: `${TEST_MARKER}-Ramallah`,
        area: 'Downtown',
        addressLine: 'Private workshop door',
        latitude: 31.9038,
        longitude: 35.2034,
        isDefault: true,
      });

      assert.equal(first.isDefault, true);
      assert.equal(second.isDefault, true);
      assert.equal(second.addressLine, 'Private workshop door');
      assert.equal(second.latitude, 31.9038);
      assert.equal(second.longitude, 35.2034);

      const listedAfterCreate = await listUserSavedLocations(user.id);
      assert.equal(listedAfterCreate.length, 2);
      assert.equal(listedAfterCreate.filter((item) => item.isDefault).length, 1);
      assert.equal(listedAfterCreate[0]?.id, second.id);

      const updated = await updateUserSavedLocation(user.id, first.id, {
        label: 'Main campus',
        city: `${TEST_MARKER}-Nablus updated`,
        isDefault: true,
      });

      assert.equal(updated.label, 'Main campus');
      assert.equal(updated.city, `${TEST_MARKER}-Nablus updated`);
      assert.equal(updated.isDefault, true);

      const coordinates = await resolveSavedLocationCoordinates(user.id, first.id);
      assert.equal(coordinates.latitude, 32.2211);
      assert.equal(coordinates.longitude, 35.2544);

      await deleteUserSavedLocation(user.id, first.id);
      const listedAfterDelete = await listUserSavedLocations(user.id);
      assert.equal(listedAfterDelete.length, 1);
      assert.equal(listedAfterDelete[0]?.id, second.id);
      assert.equal(listedAfterDelete[0]?.isDefault, true);
    } finally {
      await prisma.user.deleteMany({ where: { id: user.id } });
      await prisma.location.deleteMany({
        where: {
          city: {
            startsWith: TEST_MARKER,
          },
        },
      });
    }
  });
});
