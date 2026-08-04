import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { MaterialCondition, MaterialStatus } from '../../generated/prisma/client.js';

import { mapLinkedMaterialSummary } from './learning-projects.build-material-linking.js';

type LinkedMaterialInput = NonNullable<Parameters<typeof mapLinkedMaterialSummary>[0]>;

describe('mapLinkedMaterialSummary availability warning', () => {
  const material = {
    id: 'material-1',
    title: 'Sorted Plastic Bottle Caps Bag',
    condition: 'GOOD' as MaterialCondition,
    status: 'REUSED' as MaterialStatus,
    unit: 'pieces',
    materialType: 'Storage',
    ownerId: 'owner-1',
    isFree: true,
    price: null,
    currency: 'NIS',
    pickupAllowed: true,
    deliveryAllowed: false,
    category: {
      id: 'cat-1',
      nameEn: 'Storage',
      nameAr: 'تخزين',
    },
    location: {
      city: 'Ramallah',
      area: null,
    },
    images: [] as LinkedMaterialInput['images'],
    supplierProfile: {
      publicName: 'Supplier',
      supplierType: 'INDIVIDUAL_SUPPLIER',
      verificationStatus: 'APPROVED',
      user: {
        displayName: 'Supplier User',
      },
    },
    owner: {
      displayName: 'Owner',
    },
  } satisfies LinkedMaterialInput;

  test('completed reservation suppresses unavailable warning', () => {
    const summary = mapLinkedMaterialSummary(material, {
      linkedReservationStatus: 'COMPLETED',
    });

    assert.ok(summary);
    assert.equal(summary?.availabilityWarning, null);
  });

  test('incomplete link keeps unavailable warning for non-public material', () => {
    const summary = mapLinkedMaterialSummary(material, {
      linkedReservationStatus: 'ACCEPTED',
    });

    assert.ok(summary);
    assert.equal(
      summary?.availabilityWarning,
      'This linked material is no longer available on the platform.',
    );
  });
});
