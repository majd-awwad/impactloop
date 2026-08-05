import { randomUUID } from 'node:crypto';

import { env } from '../../../../config/env.js';
import type {
  PaymentProvider,
  ProviderCheckoutRequest,
  ProviderCheckoutResult,
  ProviderEventVerificationResult,
  ProviderRefundRequest,
  ProviderRefundResult,
} from '../payment-provider.js';
import {
  PROVIDER_EVENT_TYPES,
  type MockCheckoutAction,
} from '../../payments.constants.js';
import {
  assertMockSecretsConfigured,
  signMockCheckoutToken,
  verifyMockSignature,
} from './mock.hmac.js';

const actionToEventType = (
  action: MockCheckoutAction,
): (typeof PROVIDER_EVENT_TYPES)[keyof typeof PROVIDER_EVENT_TYPES] => {
  switch (action) {
    case 'success':
      return PROVIDER_EVENT_TYPES.PAYMENT_SUCCEEDED;
    case 'decline':
      return PROVIDER_EVENT_TYPES.PAYMENT_DECLINED;
    case 'cancel':
      return PROVIDER_EVENT_TYPES.PAYMENT_CANCELLED;
    case 'pending':
      return PROVIDER_EVENT_TYPES.PAYMENT_PENDING;
    case 'timeout':
      return PROVIDER_EVENT_TYPES.PAYMENT_EXPIRED;
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
};

export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'MOCK' as const;
  readonly mode;
  readonly capabilities: PaymentProvider['capabilities'] = {
    hostedCheckout: true,
    asynchronousPayment: true,
    asynchronousRefund: true,
    supportedModes: ['LOCAL', 'SANDBOX'],
  };

  constructor(mode: 'LOCAL' | 'SANDBOX') {
    assertMockSecretsConfigured();
    this.mode = mode;
  }

  async createCheckout(
    input: ProviderCheckoutRequest,
  ): Promise<ProviderCheckoutResult> {
    const providerRef = `mock_pay_${input.attemptId}`;
    const expiresAt = new Date(Date.now() + env.paymentMockCheckoutTtlMs);
    const token = signMockCheckoutToken({
      attemptId: input.attemptId,
      payerUserId: input.payerUserId,
      expiresAtMs: expiresAt.getTime(),
    });

    const checkoutRef = `mock_chk_${input.attemptId}`;
    const base = env.appPublicBaseUrl.replace(/\/$/, '');
    const checkoutUrl = `${base}/api/payments/mock/checkout/${input.attemptId}/act?token=${encodeURIComponent(token)}`;

    return {
      providerRef,
      checkoutRef,
      checkoutUrl,
      expiresAt,
    };
  }

  buildActionEvent(input: {
    action: MockCheckoutAction;
    attemptId: string;
    providerRef: string;
    amountMinor: number;
    currency: string;
    providerEventId?: string;
  }): {
    providerEventId: string;
    eventType: string;
    body: Record<string, unknown>;
  } {
    const providerEventId = input.providerEventId ?? `mock_evt_${randomUUID()}`;
    const eventType = actionToEventType(input.action);
    return {
      providerEventId,
      eventType,
      body: {
        id: providerEventId,
        type: eventType,
        data: {
          attemptId: input.attemptId,
          providerRef: input.providerRef,
          amountMinor: input.amountMinor,
          currency: input.currency,
        },
        createdAt: new Date().toISOString(),
      },
    };
  }

  buildRefundEvent(input: {
    outcome: 'pending' | 'succeeded' | 'failed';
    attemptId: string;
    providerRef: string;
    providerRefundRef: string;
    amountMinor: number;
    currency: string;
    failureCode?: string;
    failureMessage?: string;
    providerEventId?: string;
  }): {
    providerEventId: string;
    eventType: string;
    body: Record<string, unknown>;
  } {
    const providerEventId = input.providerEventId ?? `mock_evt_${randomUUID()}`;
    const eventType =
      input.outcome === 'pending'
        ? PROVIDER_EVENT_TYPES.REFUND_PENDING
        : input.outcome === 'succeeded'
          ? PROVIDER_EVENT_TYPES.REFUND_SUCCEEDED
          : PROVIDER_EVENT_TYPES.REFUND_FAILED;

    return {
      providerEventId,
      eventType,
      body: {
        id: providerEventId,
        type: eventType,
        data: {
          attemptId: input.attemptId,
          providerRef: input.providerRef,
          providerRefundRef: input.providerRefundRef,
          amountMinor: input.amountMinor,
          currency: input.currency,
          failureCode: input.failureCode ?? null,
          failureMessage: input.failureMessage ?? null,
        },
        createdAt: new Date().toISOString(),
      },
    };
  }

  async verifyAndNormalizeEvent(input: {
    rawBody: Buffer;
    headers: Record<string, string | string[] | undefined>;
  }): Promise<ProviderEventVerificationResult> {
    const signatureHeader = Array.isArray(input.headers['x-impactloop-mock-signature'])
      ? input.headers['x-impactloop-mock-signature'][0]
      : input.headers['x-impactloop-mock-signature'];
    const timestampHeader = Array.isArray(input.headers['x-impactloop-mock-timestamp'])
      ? input.headers['x-impactloop-mock-timestamp'][0]
      : input.headers['x-impactloop-mock-timestamp'];

    const verified = verifyMockSignature({
      rawBody: input.rawBody,
      signatureHeader,
      timestampHeader,
    });

    if (!verified.ok) {
      return {
        ok: false,
        signatureValid: false,
        code: verified.code,
        message: verified.message,
      };
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(input.rawBody.toString('utf8')) as Record<
        string,
        unknown
      >;
    } catch {
      return {
        ok: false,
        signatureValid: true,
        code: 'INVALID_PAYLOAD',
        message: 'Mock webhook body must be valid JSON.',
      };
    }

    const providerEventId =
      typeof parsed.id === 'string' ? parsed.id : undefined;
    const eventType = typeof parsed.type === 'string' ? parsed.type : undefined;
    const data =
      parsed.data && typeof parsed.data === 'object'
        ? (parsed.data as Record<string, unknown>)
        : {};

    if (!providerEventId || !eventType) {
      return {
        ok: false,
        signatureValid: true,
        code: 'INVALID_PAYLOAD',
        message: 'Mock webhook requires id and type.',
        payload: { redacted: true },
      };
    }

    const paymentAttemptId =
      typeof data.attemptId === 'string' ? data.attemptId : null;
    const providerRef =
      typeof data.providerRef === 'string' ? data.providerRef : null;
    const amountMinor =
      typeof data.amountMinor === 'number' ? data.amountMinor : null;
    const currency = typeof data.currency === 'string' ? data.currency : null;

    return {
      ok: true,
      signatureValid: true,
      event: {
        provider: 'MOCK',
        providerEventId,
        eventType,
        paymentAttemptId,
        providerRef,
        amountMinor,
        currency,
        occurredAt: new Date(),
        payload: {
          type: eventType,
          providerRefundRef:
            typeof data.providerRefundRef === 'string'
              ? data.providerRefundRef
              : null,
          failureCode:
            typeof data.failureCode === 'string' ? data.failureCode : null,
          failureMessage:
            typeof data.failureMessage === 'string'
              ? data.failureMessage
              : null,
        },
      },
    };
  }

  async requestRefund(
    input: ProviderRefundRequest,
  ): Promise<ProviderRefundResult> {
    return {
      providerRefundRef: `mock_rfnd_${input.paymentOrderId}`,
      status: 'PENDING',
    };
  }
}
