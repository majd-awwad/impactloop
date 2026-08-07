import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  buildDeliveryDispatchReadyEventKey,
  buildDeliveryDispatchReadyFingerprint,
} from './payments.notification-fingerprint.js';

describe('PAY-04R delivery dispatch fingerprint', () => {
  test('same obligation set is order-independent', () => {
    const a = buildDeliveryDispatchReadyFingerprint([
      {
        purpose: 'MATERIAL_SUBTOTAL',
        paymentOrderId: 'mat-b',
        cycleNumber: 2,
      },
      {
        purpose: 'DELIVERY_FEE',
        paymentOrderId: 'fee-1',
        cycleNumber: 1,
      },
      {
        purpose: 'MATERIAL_SUBTOTAL',
        paymentOrderId: 'mat-a',
        cycleNumber: 1,
      },
    ]);
    const b = buildDeliveryDispatchReadyFingerprint([
      {
        purpose: 'DELIVERY_FEE',
        paymentOrderId: 'fee-1',
        cycleNumber: 1,
      },
      {
        purpose: 'MATERIAL_SUBTOTAL',
        paymentOrderId: 'mat-a',
        cycleNumber: 1,
      },
      {
        purpose: 'MATERIAL_SUBTOTAL',
        paymentOrderId: 'mat-b',
        cycleNumber: 2,
      },
    ]);
    assert.equal(a, b);
    assert.equal(a.length, 32);
  });

  test('material cycle change produces a different fingerprint', () => {
    const cycle1 = buildDeliveryDispatchReadyEventKey({
      deliveryGroupId: 'g1',
      parts: [
        {
          purpose: 'DELIVERY_FEE',
          paymentOrderId: 'fee-1',
          cycleNumber: 1,
        },
        {
          purpose: 'MATERIAL_SUBTOTAL',
          paymentOrderId: 'mat-1',
          cycleNumber: 1,
        },
      ],
    });
    const cycle2 = buildDeliveryDispatchReadyEventKey({
      deliveryGroupId: 'g1',
      parts: [
        {
          purpose: 'DELIVERY_FEE',
          paymentOrderId: 'fee-1',
          cycleNumber: 1,
        },
        {
          purpose: 'MATERIAL_SUBTOTAL',
          paymentOrderId: 'mat-2',
          cycleNumber: 2,
        },
      ],
    });
    assert.notEqual(cycle1, cycle2);
    assert.match(cycle1, /^delivery-group:g1:dispatch-ready:/);
  });
});
