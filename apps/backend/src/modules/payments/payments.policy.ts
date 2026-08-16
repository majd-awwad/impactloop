import { env } from '../../config/env.js';

import {
  isCardCheckoutProductEnabled,
  setCardCheckoutProductPolicyForTests,
} from './payments.product-policy.js';

/**
 * Business feature switch for electronic payment obligations.
 * Independent of NODE_ENV — uses configured PAYMENT_PROVIDER.
 *
 * Current MVP is cash-only: electronic enforcement is inactive unless the
 * dormant card checkout product policy is explicitly enabled (tests only).
 *
 * In automated tests, enforcement defaults off so legacy reservation/delivery
 * suites keep PAYMENT_PROVIDER=disabled semantics. PAY-02 tests must call
 * `setElectronicPaymentEnforcementForTests(true)` to exercise Mock gating.
 */
let electronicPaymentEnforcementOverride: boolean | undefined;

const isTestRuntime = (): boolean =>
  (process.env.NODE_ENV ?? '').trim() === 'test' ||
  Boolean(process.env.NODE_TEST_CONTEXT?.trim());

export const isElectronicPaymentEnforced = (): boolean => {
  if (!isCardCheckoutProductEnabled()) {
    return false;
  }
  if (electronicPaymentEnforcementOverride !== undefined) {
    return electronicPaymentEnforcementOverride;
  }
  if (isTestRuntime()) {
    return false;
  }
  return env.paymentProvider === 'mock';
};

export const isPaymentsDisabled = (): boolean =>
  !isElectronicPaymentEnforced();

/** Test-only override. Pass `undefined` to clear (restore default). */
export const setElectronicPaymentEnforcementForTests = (
  value: boolean | undefined,
): void => {
  if (!isTestRuntime()) {
    throw new Error(
      'setElectronicPaymentEnforcementForTests is only available in test runtime.',
    );
  }
  electronicPaymentEnforcementOverride = value;
  if (value === true) {
    setCardCheckoutProductPolicyForTests(true);
  } else if (value === undefined) {
    setCardCheckoutProductPolicyForTests(undefined);
  }
};
