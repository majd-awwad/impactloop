import type {
  PaymentProviderMode,
  PaymentProviderType,
} from '../../../generated/prisma/client.js';

export type ProviderCheckoutRequest = {
  attemptId: string;
  paymentOrderId: string;
  payerUserId: string;
  amountMinor: number;
  currency: string;
};

export type ProviderCheckoutResult = {
  providerRef: string;
  checkoutRef: string;
  checkoutUrl: string;
  expiresAt: Date;
  metadata?: Record<string, unknown>;
};

export type NormalizedProviderEvent = {
  provider: PaymentProviderType;
  providerEventId: string;
  eventType: string;
  paymentAttemptId: string | null;
  providerRef: string | null;
  amountMinor: number | null;
  currency: string | null;
  occurredAt: Date;
  payload: Record<string, unknown>;
};

export type ProviderEventVerificationResult =
  | {
      ok: true;
      signatureValid: true;
      event: NormalizedProviderEvent;
    }
  | {
      ok: false;
      signatureValid: boolean;
      code: string;
      message: string;
      providerEventId?: string;
      payload?: Record<string, unknown>;
    };

export type ProviderRefundRequest = {
  paymentOrderId: string;
  paymentAttemptId: string;
  providerRef: string;
  amountMinor: number;
  currency: string;
  reason?: string;
};

export type ProviderRefundResult = {
  providerRefundRef: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
  failureCode?: string;
  failureMessage?: string;
};

export type PaymentProviderCapabilities = {
  hostedCheckout: boolean;
  asynchronousPayment: boolean;
  asynchronousRefund: boolean;
  supportedModes: PaymentProviderMode[];
};

export interface PaymentProvider {
  readonly name: PaymentProviderType;
  readonly mode: PaymentProviderMode;
  readonly capabilities: PaymentProviderCapabilities;
  createCheckout(input: ProviderCheckoutRequest): Promise<ProviderCheckoutResult>;
  verifyAndNormalizeEvent(input: {
    rawBody: Buffer;
    headers: Record<string, string | string[] | undefined>;
  }): Promise<ProviderEventVerificationResult>;
  queryAttemptStatus?(providerRef: string): Promise<{
    status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
    amountMinor?: number;
    currency?: string;
  }>;
  requestRefund(input: ProviderRefundRequest): Promise<ProviderRefundResult>;
  queryRefundStatus?(providerRefundRef: string): Promise<{
    status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
  }>;
}
