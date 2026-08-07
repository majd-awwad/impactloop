/**
 * Pure payment runtime configuration (no process side effects).
 * Used by env.ts and focused configuration tests.
 */

export type PaymentProviderName = 'mock' | 'disabled';
export type PaymentProviderModeName = 'LOCAL' | 'SANDBOX';

export type PaymentRuntimeConfig = {
  paymentProvider: PaymentProviderName;
  paymentProviderMode: PaymentProviderModeName | null;
  paymentMockRoutesEnabled: boolean;
  paymentMockWebhookSecret: string | null;
  paymentMockCheckoutTokenSecret: string | null;
  paymentMockWebhookReplayWindowMs: number;
  paymentMockCheckoutTtlMs: number;
  usedDevelopmentSecretFallback: boolean;
};

const DEV_WEBHOOK_FALLBACK = 'dev-payment-mock-webhook-secret-change-me';
const DEV_CHECKOUT_FALLBACK = 'dev-payment-mock-checkout-token-secret-change-me';
const TEST_WEBHOOK_SECRET = 'test-payment-mock-webhook-secret-only';
const TEST_CHECKOUT_SECRET = 'test-payment-mock-checkout-token-only';

const KNOWN_PLACEHOLDER_SECRETS = new Set([
  DEV_WEBHOOK_FALLBACK,
  DEV_CHECKOUT_FALLBACK,
  'change-me',
  'changeme',
  'replace_me',
  'mock-secret',
  'mock_secret',
  'secret',
  'password',
  'payment-secret',
]);

const MIN_SECRET_LENGTH = 24;

const parsePositiveInt = (
  value: string | undefined,
  fallback: number,
): number => {
  if (!value?.trim()) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const isTestRuntime = (env: NodeJS.Dict<string>): boolean =>
  (env.NODE_ENV ?? '').trim() === 'test' ||
  Boolean(env.NODE_TEST_CONTEXT?.trim());

const isProductionRuntime = (env: NodeJS.Dict<string>): boolean =>
  (env.NODE_ENV ?? '').trim() === 'production';

export const isKnownPaymentSecretPlaceholder = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  if (KNOWN_PLACEHOLDER_SECRETS.has(normalized)) {
    return true;
  }
  if (KNOWN_PLACEHOLDER_SECRETS.has(value.trim())) {
    return true;
  }
  if (normalized.includes('change-me') || normalized.includes('changeme')) {
    return true;
  }
  if (normalized.includes('replace_me') || normalized.includes('your-')) {
    return true;
  }
  return false;
};

const assertStrongSecret = (
  label: string,
  value: string,
  options: { allowDevFallback: boolean },
): void => {
  if (!value || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }
  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `${label} must be at least ${MIN_SECRET_LENGTH} characters.`,
    );
  }
  if (
    !options.allowDevFallback &&
    isKnownPaymentSecretPlaceholder(value)
  ) {
    throw new Error(
      `${label} must not use a known placeholder or example value.`,
    );
  }
};

/**
 * Resolve payment provider/mode/secrets from an env dictionary.
 * Throws configuration errors; never returns secrets for logging.
 */
export const resolvePaymentRuntimeConfig = (
  env: NodeJS.Dict<string> = process.env,
): PaymentRuntimeConfig => {
  const nodeEnv = (env.NODE_ENV ?? 'development').trim() || 'development';
  const production = isProductionRuntime(env);
  const testRuntime = isTestRuntime(env);

  const rawProvider = env.PAYMENT_PROVIDER?.trim().toLowerCase();
  let paymentProvider: PaymentProviderName;

  if (production) {
    if (!rawProvider) {
      throw new Error(
        'PAYMENT_PROVIDER must be set explicitly in production. Supported values: disabled. Mock is not allowed.',
      );
    }
    if (rawProvider === 'mock') {
      throw new Error(
        'PAYMENT_PROVIDER=mock is not allowed when NODE_ENV=production.',
      );
    }
    if (rawProvider !== 'disabled') {
      throw new Error(
        `Invalid PAYMENT_PROVIDER "${rawProvider}". In production, supported values: disabled.`,
      );
    }
    paymentProvider = 'disabled';
  } else if (!rawProvider) {
    paymentProvider = testRuntime ? 'mock' : 'mock';
  } else if (rawProvider === 'mock' || rawProvider === 'disabled') {
    paymentProvider = rawProvider;
  } else {
    throw new Error(
      `Invalid PAYMENT_PROVIDER "${rawProvider}". Supported values: mock, disabled.`,
    );
  }

  const rawMode = env.PAYMENT_PROVIDER_MODE?.trim().toUpperCase();
  let paymentProviderMode: PaymentProviderModeName | null = null;

  if (paymentProvider === 'disabled') {
    if (rawMode) {
      throw new Error(
        'PAYMENT_PROVIDER_MODE must not be set when PAYMENT_PROVIDER=disabled.',
      );
    }
  } else if (production) {
    // unreachable today — production cannot select mock
    throw new Error('Mock payment provider cannot run in production.');
  } else if (!rawMode || rawMode === 'LOCAL') {
    paymentProviderMode = 'LOCAL';
  } else if (rawMode === 'SANDBOX') {
    paymentProviderMode = 'SANDBOX';
  } else {
    throw new Error(
      `Invalid PAYMENT_PROVIDER_MODE "${rawMode}". Supported values: LOCAL, SANDBOX.`,
    );
  }

  const paymentMockRoutesEnabled = paymentProvider === 'mock';

  let paymentMockWebhookSecret: string | null = null;
  let paymentMockCheckoutTokenSecret: string | null = null;
  let usedDevelopmentSecretFallback = false;

  if (paymentProvider === 'mock') {
    const mode = paymentProviderMode!;
    const requireStrict =
      mode === 'SANDBOX' || production || nodeEnv === 'production';

    if (testRuntime) {
      paymentMockWebhookSecret =
        env.PAYMENT_MOCK_WEBHOOK_SECRET?.trim() || TEST_WEBHOOK_SECRET;
      paymentMockCheckoutTokenSecret =
        env.PAYMENT_MOCK_CHECKOUT_TOKEN_SECRET?.trim() || TEST_CHECKOUT_SECRET;
      assertStrongSecret(
        'PAYMENT_MOCK_WEBHOOK_SECRET',
        paymentMockWebhookSecret,
        { allowDevFallback: true },
      );
      assertStrongSecret(
        'PAYMENT_MOCK_CHECKOUT_TOKEN_SECRET',
        paymentMockCheckoutTokenSecret,
        { allowDevFallback: true },
      );
    } else if (requireStrict) {
      const webhook = env.PAYMENT_MOCK_WEBHOOK_SECRET?.trim();
      const checkout = env.PAYMENT_MOCK_CHECKOUT_TOKEN_SECRET?.trim();
      if (!webhook) {
        throw new Error('PAYMENT_MOCK_WEBHOOK_SECRET is required in SANDBOX mode.');
      }
      if (!checkout) {
        throw new Error(
          'PAYMENT_MOCK_CHECKOUT_TOKEN_SECRET is required in SANDBOX mode.',
        );
      }
      assertStrongSecret('PAYMENT_MOCK_WEBHOOK_SECRET', webhook, {
        allowDevFallback: false,
      });
      assertStrongSecret('PAYMENT_MOCK_CHECKOUT_TOKEN_SECRET', checkout, {
        allowDevFallback: false,
      });
      paymentMockWebhookSecret = webhook;
      paymentMockCheckoutTokenSecret = checkout;
    } else {
      // Development LOCAL: allow documented fallbacks, but prefer .env values.
      const webhook =
        env.PAYMENT_MOCK_WEBHOOK_SECRET?.trim() || DEV_WEBHOOK_FALLBACK;
      const checkout =
        env.PAYMENT_MOCK_CHECKOUT_TOKEN_SECRET?.trim() || DEV_CHECKOUT_FALLBACK;
      assertStrongSecret('PAYMENT_MOCK_WEBHOOK_SECRET', webhook, {
        allowDevFallback: true,
      });
      assertStrongSecret('PAYMENT_MOCK_CHECKOUT_TOKEN_SECRET', checkout, {
        allowDevFallback: true,
      });
      paymentMockWebhookSecret = webhook;
      paymentMockCheckoutTokenSecret = checkout;
      usedDevelopmentSecretFallback =
        webhook === DEV_WEBHOOK_FALLBACK ||
        checkout === DEV_CHECKOUT_FALLBACK ||
        isKnownPaymentSecretPlaceholder(webhook) ||
        isKnownPaymentSecretPlaceholder(checkout);
    }

    if (
      paymentMockWebhookSecret &&
      paymentMockCheckoutTokenSecret &&
      paymentMockWebhookSecret === paymentMockCheckoutTokenSecret
    ) {
      throw new Error(
        'PAYMENT_MOCK_WEBHOOK_SECRET and PAYMENT_MOCK_CHECKOUT_TOKEN_SECRET must be distinct.',
      );
    }
  }

  return {
    paymentProvider,
    paymentProviderMode,
    paymentMockRoutesEnabled,
    paymentMockWebhookSecret,
    paymentMockCheckoutTokenSecret,
    paymentMockWebhookReplayWindowMs: parsePositiveInt(
      env.PAYMENT_MOCK_WEBHOOK_REPLAY_WINDOW_MS,
      5 * 60 * 1000,
    ),
    paymentMockCheckoutTtlMs: parsePositiveInt(
      env.PAYMENT_MOCK_CHECKOUT_TTL_MS,
      30 * 60 * 1000,
    ),
    usedDevelopmentSecretFallback,
  };
};

export const PAYMENT_DEV_SECRET_FALLBACKS = {
  webhook: DEV_WEBHOOK_FALLBACK,
  checkout: DEV_CHECKOUT_FALLBACK,
} as const;

export const PAYMENT_TEST_SECRET_DEFAULTS = {
  webhook: TEST_WEBHOOK_SECRET,
  checkout: TEST_CHECKOUT_SECRET,
} as const;
