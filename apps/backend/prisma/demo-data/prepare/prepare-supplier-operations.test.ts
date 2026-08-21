import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  CASH_HANDOVER_DEMO_KEY,
  CASH_HANDOVER_PREFERRED_TITLES,
  DRIVER_ON_THE_WAY_DEMO_KEY,
  DRIVER_ON_THE_WAY_PREFERRED_TITLES,
  SUPPLIER_OPERATIONS_DEMO_KEY,
} from './local-demo-keys.js';
import {
  isForbiddenSupplierOperationsMaterial,
  isSupplierOperationsDemoReady,
  isSupplierOperationsVerificationReady,
  isUpcomingConfirmedPickup,
  listingDraftHasDemoMarker,
  resolveSupplierOperationsPickupAction,
  shouldReusePendingCategoryRequest,
  upcomingPickupWindow,
} from './prepare-supplier-operations.js';

describe('supplier-operations demo marker', () => {
  test('uses the Figure 3.56 local-demo namespace', () => {
    assert.equal(SUPPLIER_OPERATIONS_DEMO_KEY, 'local-demo:supplier-operations-v1');
    assert.notEqual(SUPPLIER_OPERATIONS_DEMO_KEY, CASH_HANDOVER_DEMO_KEY);
    assert.notEqual(SUPPLIER_OPERATIONS_DEMO_KEY, DRIVER_ON_THE_WAY_DEMO_KEY);
  });

  test('recognizes a stamped category-request draft', () => {
    assert.equal(
      listingDraftHasDemoMarker(
        { suggestedUses: `classroom foam [${SUPPLIER_OPERATIONS_DEMO_KEY}]` },
        SUPPLIER_OPERATIONS_DEMO_KEY,
      ),
      true,
    );
    assert.equal(
      listingDraftHasDemoMarker({ suggestedUses: 'unrelated' }, SUPPLIER_OPERATIONS_DEMO_KEY),
      false,
    );
  });
});

describe('supplier-operations verification readiness', () => {
  test('requires an organization supplier with APPROVED status', () => {
    assert.equal(
      isSupplierOperationsVerificationReady({
        supplierType: 'WORKSHOP',
        verificationStatus: 'APPROVED',
      }),
      true,
    );
    assert.equal(
      isSupplierOperationsVerificationReady({
        supplierType: 'WORKSHOP',
        verificationStatus: 'VERIFIED',
      }),
      true,
    );
    assert.equal(
      isSupplierOperationsVerificationReady({
        supplierType: 'INDIVIDUAL_SUPPLIER',
        verificationStatus: 'APPROVED',
      }),
      false,
    );
    assert.equal(
      isSupplierOperationsVerificationReady({
        supplierType: 'WORKSHOP',
        verificationStatus: 'PENDING',
      }),
      false,
    );
  });
});

describe('supplier-operations category request reuse', () => {
  test('reuses an existing PENDING request instead of creating another', () => {
    assert.equal(shouldReusePendingCategoryRequest({ status: 'PENDING' }), true);
    assert.equal(shouldReusePendingCategoryRequest({ status: 'APPROVED' }), false);
    assert.equal(shouldReusePendingCategoryRequest({ status: 'REJECTED' }), false);
    assert.equal(shouldReusePendingCategoryRequest(null), false);
  });
});

describe('supplier-operations pickup isolation', () => {
  test('never uses CASH handover or ON_THE_WAY preferred materials', () => {
    for (const title of CASH_HANDOVER_PREFERRED_TITLES) {
      assert.equal(isForbiddenSupplierOperationsMaterial(title), true);
    }
    for (const title of DRIVER_ON_THE_WAY_PREFERRED_TITLES) {
      assert.equal(isForbiddenSupplierOperationsMaterial(title), true);
    }
    assert.equal(isForbiddenSupplierOperationsMaterial('Felt Sheet Offcuts'), false);
  });

  test('reuses an ACCEPTED upcoming SELF-PICKUP and repairs a stale window', () => {
    const now = new Date('2026-08-20T09:00:00');
    const window = upcomingPickupWindow(now);
    assert.equal(
      resolveSupplierOperationsPickupAction(
        {
          status: 'ACCEPTED',
          fulfillmentMethod: 'PICKUP',
          pickupWindowStart: window.start,
        },
        now,
      ),
      'reuse',
    );
    assert.equal(
      resolveSupplierOperationsPickupAction(
        {
          status: 'ACCEPTED',
          fulfillmentMethod: 'PICKUP',
          pickupWindowStart: new Date('2026-08-20T10:00:00'),
        },
        now,
      ),
      'repair-window',
    );
    assert.equal(
      resolveSupplierOperationsPickupAction({
        status: 'PENDING',
        fulfillmentMethod: 'PICKUP',
        pickupWindowStart: null,
      }),
      'accept',
    );
    assert.equal(
      resolveSupplierOperationsPickupAction({
        status: 'COMPLETED',
        fulfillmentMethod: 'PICKUP',
        pickupWindowStart: window.start,
      }),
      'create',
    );
    assert.equal(
      resolveSupplierOperationsPickupAction({
        status: 'ACCEPTED',
        fulfillmentMethod: 'DELIVERY',
        pickupWindowStart: window.start,
      }),
      'create',
    );
  });

  test('upcoming windows start after the local day boundary', () => {
    const now = new Date('2026-08-20T15:30:00');
    const window = upcomingPickupWindow(now);
    assert.equal(
      isUpcomingConfirmedPickup({
        status: 'ACCEPTED',
        fulfillmentMethod: 'PICKUP',
        pickupWindowStart: window.start,
        now,
      }),
      true,
    );
    assert.equal(
      isUpcomingConfirmedPickup({
        status: 'ACCEPTED',
        fulfillmentMethod: 'PICKUP',
        pickupWindowStart: now,
        now,
      }),
      false,
    );
  });
});

describe('supplier-operations screenshot readiness', () => {
  test('requires verification, a PENDING category request, and upcoming self-pickup', () => {
    assert.equal(
      isSupplierOperationsDemoReady({
        verificationReady: true,
        pendingCategoryRequest: true,
        upcomingSelfPickup: true,
      }),
      true,
    );
    assert.equal(
      isSupplierOperationsDemoReady({
        verificationReady: true,
        pendingCategoryRequest: false,
        upcomingSelfPickup: true,
      }),
      false,
    );
    assert.equal(
      isSupplierOperationsDemoReady({
        verificationReady: true,
        pendingCategoryRequest: true,
        upcomingSelfPickup: false,
      }),
      false,
    );
  });
});
