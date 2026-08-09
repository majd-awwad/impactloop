import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  SUPPLIER_VERIFICATION_ADMIN_PENDING_STATUSES,
  SUPPLIER_VERIFICATION_REVISION_STATUSES,
  SUPPLIER_VERIFICATION_STATUSES,
  isSupplierVerificationAwaitingAdminReview,
  isSupplierVerificationRevisionRequired,
  resolveSupplierVerificationEligibility,
} from './supplier-verification.status.js';

describe('supplier verification eligibility policy', () => {
  test('defines exact revision and admin-pending status groups', () => {
    assert.deepEqual(SUPPLIER_VERIFICATION_REVISION_STATUSES, [
      'REJECTED',
      'CHANGES_REQUESTED',
    ]);
    assert.deepEqual(SUPPLIER_VERIFICATION_ADMIN_PENDING_STATUSES, [
      'PENDING',
      'UNVERIFIED',
    ]);

    for (const status of SUPPLIER_VERIFICATION_STATUSES) {
      assert.equal(
        isSupplierVerificationRevisionRequired(status),
        status === 'REJECTED' || status === 'CHANGES_REQUESTED',
      );
      assert.equal(
        isSupplierVerificationAwaitingAdminReview(status),
        status === 'PENDING' || status === 'UNVERIFIED',
      );
    }
  });

  test('allows submission actions only for eligible organization statuses', () => {
    for (const status of SUPPLIER_VERIFICATION_STATUSES) {
      assert.deepEqual(
        resolveSupplierVerificationEligibility({
          supplierType: 'WORKSHOP',
          verificationStatus: status,
        }),
        {
          canSubmit: status === 'UNVERIFIED',
          canResubmit:
            status === 'REJECTED' || status === 'CHANGES_REQUESTED',
        },
      );

      assert.deepEqual(
        resolveSupplierVerificationEligibility({
          supplierType: 'INDIVIDUAL_SUPPLIER',
          verificationStatus: status,
        }),
        { canSubmit: false, canResubmit: false },
      );
    }
  });
});
