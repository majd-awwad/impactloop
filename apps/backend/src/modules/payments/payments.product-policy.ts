import { AppError } from '../../utils/app-error.js';

/**
 * Current MVP product policy: cash-only for new payment-bearing operations.
 * Electronic/card checkout infrastructure remains dormant for future reactivation.
 */
export const CARD_PAYMENT_DISABLED = 'CARD_PAYMENT_DISABLED' as const;

let cardCheckoutProductPolicyOverride: boolean | undefined;

const isTestRuntime = (): boolean =>
  (process.env.NODE_ENV ?? '').trim() === 'test' ||
  Boolean(process.env.NODE_TEST_CONTEXT?.trim());

/**
 * Whether learner-initiated electronic checkout API routes are mounted and
 * whether CARD may be selected for new reservations.
 */
export const isCardCheckoutProductEnabled = (): boolean => {
  if (cardCheckoutProductPolicyOverride !== undefined) {
    return cardCheckoutProductPolicyOverride;
  }
  return false;
};

export const assertCardPaymentAcceptedForNewReservation = (
  paymentMethod: string,
): void => {
  if (
    paymentMethod === 'CARD' &&
    !isCardCheckoutProductEnabled()
  ) {
    throw new AppError(
      'Card payment is not available in the current product.',
      400,
      CARD_PAYMENT_DISABLED,
    );
  }
};

export const assertCardCheckoutApiAvailable = (): void => {
  if (!isCardCheckoutProductEnabled()) {
    throw new AppError(
      'Electronic card checkout is not available in the current product.',
      403,
      CARD_PAYMENT_DISABLED,
    );
  }
};

/** Test-only override for dormant provider infrastructure suites. */
export const setCardCheckoutProductPolicyForTests = (
  value: boolean | undefined,
): void => {
  if (!isTestRuntime()) {
    throw new Error(
      'setCardCheckoutProductPolicyForTests is only available in test runtime.',
    );
  }
  cardCheckoutProductPolicyOverride = value;
};
