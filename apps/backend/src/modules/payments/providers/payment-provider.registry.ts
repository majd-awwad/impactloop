import { env } from '../../../config/env.js';
import { AppError } from '../../../utils/app-error.js';

import type { PaymentProvider } from './payment-provider.js';
import { MockPaymentProvider } from './mock/mock.provider.js';

let cached: PaymentProvider | null = null;

export const isPaymentProviderEnabled = (): boolean =>
  env.paymentProvider !== 'disabled';

export const getPaymentProvider = (): PaymentProvider => {
  if (cached) {
    return cached;
  }

  if (env.paymentProvider === 'disabled') {
    throw new AppError(
      'Electronic payments are disabled in this environment.',
      503,
      'PAYMENTS_DISABLED',
    );
  }

  if (env.paymentProvider !== 'mock') {
    throw new AppError(
      `Unsupported payment provider: ${env.paymentProvider}`,
      500,
      'PAYMENT_PROVIDER_MISCONFIGURED',
      { provider: env.paymentProvider },
    );
  }

  if (!env.paymentProviderMode) {
    throw new AppError(
      'Payment provider mode is not configured.',
      500,
      'PAYMENT_PROVIDER_MISCONFIGURED',
    );
  }

  cached = new MockPaymentProvider(env.paymentProviderMode);
  return cached!;
};

/** Test helper to clear singleton between suites. */
export const resetPaymentProviderCache = (): void => {
  cached = null;
};
