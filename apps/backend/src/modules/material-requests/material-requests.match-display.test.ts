import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  deriveMatchReserveEligibility,
  mapMatchForLearner,
  sortLearnerMatches,
} from './material-requests.match-display.js';

describe('material request match display', () => {
  test('SUGGESTED open request with available material can be reserved', () => {
    const result = deriveMatchReserveEligibility({
      matchStatus: 'SUGGESTED',
      requestStatus: 'OPEN',
      materialStatus: 'AVAILABLE',
      reservationId: null,
    });

    assert.equal(result.canReserve, true);
    assert.equal(result.unavailableReason, null);
  });

  test('UNAVAILABLE match cannot be reserved with reason', () => {
    const result = deriveMatchReserveEligibility({
      matchStatus: 'UNAVAILABLE',
      requestStatus: 'OPEN',
      materialStatus: 'AVAILABLE',
      reservationId: null,
    });

    assert.equal(result.canReserve, false);
    assert.equal(result.unavailableReason, 'NO_LONGER_AVAILABLE');
  });

  test('existing reservation disables reserve action', () => {
    const result = deriveMatchReserveEligibility({
      matchStatus: 'SUGGESTED',
      requestStatus: 'OPEN',
      materialStatus: 'AVAILABLE',
      reservationId: 'res-1',
    });

    assert.equal(result.canReserve, false);
    assert.equal(result.unavailableReason, null);
  });

  test('mapMatchForLearner exposes public supplier and material fields only', () => {
    const mapped = mapMatchForLearner(
      {
        id: 'match-1',
        materialRequestId: 'req-1',
        materialId: 'mat-1',
        supplierUserId: 'supplier-1',
        status: 'SUGGESTED',
        matchReasonCode: 'CATEGORY_AND_KEYWORD',
        rankingScore: 180,
        reservationId: null,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        updatedAt: new Date('2026-07-01T00:00:00.000Z'),
        reservation: null,
        material: {
          id: 'mat-1',
          title: 'Arduino Uno',
          status: 'AVAILABLE',
          quantity: 3,
          unit: 'piece',
          condition: 'GOOD',
          isFree: false,
          price: 45,
          currency: 'NIS',
          pickupAllowed: true,
          deliveryAllowed: true,
          location: { city: 'Ramallah', area: 'Al-Bireh' },
          images: [{ imageUrl: '/uploads/materials/arduino.jpg', isCover: true }],
          supplierProfile: {
            publicName: 'Tech Reuse Hub',
            avatarImageUrl: '/uploads/suppliers/hub.png',
            verificationStatus: 'APPROVED',
            defaultPickupLocation: { city: 'Ramallah', area: 'Al-Bireh' },
          },
          owner: {
            displayName: 'Hidden Owner',
            profileImageUrl: null,
            email: 'secret@impactloop.test',
            phone: '+970599999999',
          },
        },
      },
      'OPEN',
    );

    assert.equal(mapped.canReserve, true);
    assert.equal(mapped.material?.title, 'Arduino Uno');
    assert.equal(mapped.material?.condition, 'GOOD');
    assert.equal(mapped.material?.isFree, false);
    assert.equal(mapped.material?.price, 45);
    assert.equal(mapped.supplier?.displayName, 'Tech Reuse Hub');
    assert.equal(mapped.supplier?.isVerified, true);
    assert.equal(mapped.supplier?.city, 'Ramallah');

    const serialized = JSON.stringify(mapped);
    assert.equal(serialized.includes('secret@impactloop.test'), false);
    assert.equal(serialized.includes('+970599999999'), false);
    assert.equal(serialized.includes('supplierUserId'), false);
  });

  test('sortLearnerMatches prioritizes reservable suggestions first', () => {
    const sorted = sortLearnerMatches([
      {
        id: 'unavailable',
        status: 'UNAVAILABLE',
        canReserve: false,
        reservationId: null,
        createdAt: '2026-07-03T00:00:00.000Z',
      },
      {
        id: 'reservable',
        status: 'SUGGESTED',
        canReserve: true,
        reservationId: null,
        createdAt: '2026-07-01T00:00:00.000Z',
      },
      {
        id: 'reserved',
        status: 'RESERVATION_CREATED',
        canReserve: false,
        reservationId: 'res-1',
        createdAt: '2026-07-02T00:00:00.000Z',
      },
    ]);

    assert.deepEqual(
      sorted.map((match) => match.id),
      ['reservable', 'reserved', 'unavailable'],
    );
  });
});
