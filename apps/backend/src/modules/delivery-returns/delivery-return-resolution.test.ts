import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { deliveryReturnFinancialPolicy } from './delivery-return-resolution.js';

describe('returned delivery financial policy', () => {
  test('verified learner responsibility refunds CARD material but retains CARD fee', () => {
    const policy = deliveryReturnFinancialPolicy(
      'VERIFIED_LEARNER_RESPONSIBILITY',
    );
    assert.equal(policy.materialSubtotal.refundPaidCard, true);
    assert.equal(policy.deliveryFee.refundPaidCard, false);
  });

  test('learner-not-responsible refunds both CARD order boundaries', () => {
    const policy = deliveryReturnFinancialPolicy('LEARNER_NOT_RESPONSIBLE');
    assert.equal(policy.materialSubtotal.refundPaidCard, true);
    assert.equal(policy.deliveryFee.refundPaidCard, true);
  });

  test('uncollected CASH is cancelled for both outcomes without provider refund', () => {
    for (const outcome of [
      'VERIFIED_LEARNER_RESPONSIBILITY',
      'LEARNER_NOT_RESPONSIBLE',
    ] as const) {
      const policy = deliveryReturnFinancialPolicy(outcome);
      assert.equal(policy.materialSubtotal.cancelUnpaidCash, true);
      assert.equal(policy.deliveryFee.cancelUnpaidCash, true);
    }
  });
});
