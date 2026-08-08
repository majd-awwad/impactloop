import type { ProcessProviderEventResult } from './payments.event-processor.types.js';
import type { NormalizedProviderEvent } from './providers/payment-provider.js';

type ProcessVerifiedProviderEvent = (
  event: NormalizedProviderEvent,
  signatureValid: boolean,
) => Promise<ProcessProviderEventResult>;

let processVerifiedProviderEventImpl: ProcessVerifiedProviderEvent | null = null;

export const registerProcessVerifiedProviderEvent = (
  impl: ProcessVerifiedProviderEvent,
) => {
  processVerifiedProviderEventImpl = impl;
};

export const invokeProcessVerifiedProviderEvent: ProcessVerifiedProviderEvent = (
  event,
  signatureValid,
) => {
  if (!processVerifiedProviderEventImpl) {
    throw new Error('Payment event processor is not registered.');
  }

  return processVerifiedProviderEventImpl(event, signatureValid);
};
