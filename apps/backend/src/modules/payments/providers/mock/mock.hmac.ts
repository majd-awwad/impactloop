import { createHmac, timingSafeEqual } from 'node:crypto';

import { env } from '../../../../config/env.js';
import { AppError } from '../../../../utils/app-error.js';

export const MOCK_SIGNATURE_HEADER = 'x-impactloop-mock-signature';
export const MOCK_TIMESTAMP_HEADER = 'x-impactloop-mock-timestamp';

export const buildMockSignedPayload = (
  timestampSeconds: number,
  rawBody: string | Buffer,
): string => `${timestampSeconds}.${Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody}`;

export const signMockPayload = (
  timestampSeconds: number,
  rawBody: string | Buffer,
  secret = env.paymentMockWebhookSecret ?? '',
): string => {
  if (!secret) {
    throw new AppError(
      'Mock webhook secret is not configured.',
      500,
      'PAYMENT_PROVIDER_MISCONFIGURED',
    );
  }
  const payload = buildMockSignedPayload(timestampSeconds, rawBody);
  return createHmac('sha256', secret).update(payload).digest('hex');
};

export const verifyMockSignature = (input: {
  rawBody: Buffer;
  signatureHeader: string | undefined;
  timestampHeader: string | undefined;
  nowMs?: number;
}):
  | { ok: true; timestampSeconds: number }
  | { ok: false; code: string; message: string } => {
  const signature = input.signatureHeader?.trim();
  const timestampRaw = input.timestampHeader?.trim();

  if (!signature || !timestampRaw) {
    return {
      ok: false,
      code: 'INVALID_SIGNATURE',
      message: 'Mock webhook signature headers are required.',
    };
  }

  const timestampSeconds = Number(timestampRaw);
  if (!Number.isInteger(timestampSeconds) || timestampSeconds <= 0) {
    return {
      ok: false,
      code: 'INVALID_TIMESTAMP',
      message: 'Mock webhook timestamp is invalid.',
    };
  }

  const nowMs = input.nowMs ?? Date.now();
  const ageMs = Math.abs(nowMs - timestampSeconds * 1000);
  if (ageMs > env.paymentMockWebhookReplayWindowMs) {
    return {
      ok: false,
      code: 'REPLAY_WINDOW_EXCEEDED',
      message: 'Mock webhook timestamp is outside the allowed replay window.',
    };
  }

  const expected = signMockPayload(timestampSeconds, input.rawBody);
  const provided = Buffer.from(signature, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');

  if (
    provided.length !== expectedBuf.length ||
    !timingSafeEqual(provided, expectedBuf)
  ) {
    return {
      ok: false,
      code: 'INVALID_SIGNATURE',
      message: 'Mock webhook signature verification failed.',
    };
  }

  return { ok: true, timestampSeconds };
};

export const signMockCheckoutToken = (input: {
  attemptId: string;
  payerUserId: string;
  expiresAtMs: number;
}): string => {
  const secret = env.paymentMockCheckoutTokenSecret;
  if (!secret) {
    throw new AppError(
      'Mock checkout token secret is not configured.',
      500,
      'PAYMENT_PROVIDER_MISCONFIGURED',
    );
  }
  const body = Buffer.from(
    JSON.stringify({
      attemptId: input.attemptId,
      payerUserId: input.payerUserId,
      exp: input.expiresAtMs,
    }),
    'utf8',
  ).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
};

export const verifyMockCheckoutToken = (
  token: string | undefined,
  attemptId: string,
): { ok: true; payerUserId: string } | { ok: false } => {
  if (!token?.includes('.')) {
    return { ok: false };
  }

  const secret = env.paymentMockCheckoutTokenSecret;
  if (!secret) {
    return { ok: false };
  }

  const [body, sig] = token.split('.');
  if (!body || !sig) {
    return { ok: false };
  }

  const expectedSig = createHmac('sha256', secret)
    .update(body)
    .digest('base64url');
  const provided = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (
    provided.length !== expectedBuf.length ||
    !timingSafeEqual(provided, expectedBuf)
  ) {
    return { ok: false };
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as {
      attemptId?: string;
      payerUserId?: string;
      exp?: number;
    };

    if (
      parsed.attemptId !== attemptId ||
      typeof parsed.payerUserId !== 'string' ||
      typeof parsed.exp !== 'number' ||
      parsed.exp < Date.now()
    ) {
      return { ok: false };
    }

    return { ok: true, payerUserId: parsed.payerUserId };
  } catch {
    return { ok: false };
  }
};

export const assertMockSecretsConfigured = (): void => {
  if (
    !env.paymentMockWebhookSecret ||
    env.paymentMockWebhookSecret.length < 24
  ) {
    throw new AppError(
      'PAYMENT_MOCK_WEBHOOK_SECRET must be configured with sufficient entropy.',
      500,
      'PAYMENT_PROVIDER_MISCONFIGURED',
    );
  }

  if (
    !env.paymentMockCheckoutTokenSecret ||
    env.paymentMockCheckoutTokenSecret.length < 24
  ) {
    throw new AppError(
      'PAYMENT_MOCK_CHECKOUT_TOKEN_SECRET must be configured with sufficient entropy.',
      500,
      'PAYMENT_PROVIDER_MISCONFIGURED',
    );
  }

  if (env.paymentMockWebhookSecret === env.paymentMockCheckoutTokenSecret) {
    throw new AppError(
      'Mock webhook and checkout-token secrets must be distinct.',
      500,
      'PAYMENT_PROVIDER_MISCONFIGURED',
    );
  }
};
