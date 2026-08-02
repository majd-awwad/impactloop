import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  isValidLatLng,
  kmToMeters,
  metersToKm,
  roundPresentationDistanceKm,
} from './driver-available-jobs-distance.js';
import { driverAvailableListSelect } from './driver-available-jobs.query.js';

describe('available jobs distance helpers', () => {
  test('converts km and meters without using them as ordering keys', () => {
    assert.equal(kmToMeters(1.5), 1500);
    assert.equal(metersToKm(2500), 2.5);
    assert.equal(metersToKm(null), null);
  });

  test('presentation rounding keeps API labels stable', () => {
    assert.equal(roundPresentationDistanceKm(1.24), 1.2);
    assert.equal(roundPresentationDistanceKm(1.25), 1.3);
    assert.equal(roundPresentationDistanceKm(12.4), 12);
    assert.equal(roundPresentationDistanceKm(null), null);
  });

  test('validates latitude/longitude ranges', () => {
    assert.equal(isValidLatLng(32.22, 35.26), true);
    assert.equal(isValidLatLng(91, 0), false);
    assert.equal(isValidLatLng(0, 181), false);
  });
});

describe('available jobs list projection', () => {
  test('omits detail-only relations from the available list select', () => {
    const select = driverAvailableListSelect as Record<string, unknown>;

    assert.equal('assignedDriverProfile' in select, false);
    assert.equal('statusHistory' in select, false);
    assert.equal('locationPings' in select, false);
    assert.equal('assignments' in select, false);
    assert.equal('pickupItems' in select, false);
    assert.equal('incidentReports' in select, false);

    const reservation = select.reservation as {
      select: Record<string, unknown>;
    };
    assert.equal('requester' in reservation.select, false);
    const owner = reservation.select.owner as {
      select: Record<string, unknown>;
    };
    assert.equal('phone' in owner.select, false);
    assert.equal('id' in owner.select, false);

    const pickup = select.pickupLocation as { select: Record<string, unknown> };
    assert.equal('addressLine' in pickup.select, false);
    assert.equal('latitude' in pickup.select, false);
    assert.equal('longitude' in pickup.select, false);
  });
});
