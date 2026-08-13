import { generateOpaqueToken, hashToken } from '../../utils/token.js';
import {
  allowedHandoverEnd,
  HANDOVER_GRACE_MINUTES,
} from '../../utils/handover-timing.js';

export const HANDOVER_QR_URI_PREFIX = 'impactloop://handover/';
export const DELIVERY_HANDOVER_QR_URI_PREFIX =
  'impactloop://delivery-handover/';
export const SUPPLIER_PICKUP_HANDOVER_QR_URI_PREFIX =
  'impactloop://supplier-pickup-handover/';

export const createHandoverCredentialToken = (): string => generateOpaqueToken();

export const hashHandoverCredentialToken = (token: string): string =>
  hashToken(token);

export const formatHandoverQrPayload = (token: string): string =>
  `${HANDOVER_QR_URI_PREFIX}${token}`;

/**
 * Accepts either the raw opaque token or `impactloop://handover/<token>`.
 * Returns null for empty/malformed input.
 */
export const normalizeHandoverCredentialToken = (
  value: string | null | undefined,
): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (
    trimmed.toLowerCase().startsWith(DELIVERY_HANDOVER_QR_URI_PREFIX) ||
    trimmed.toLowerCase().startsWith(SUPPLIER_PICKUP_HANDOVER_QR_URI_PREFIX)
  ) {
    return null;
  }

  let opaque = trimmed;
  if (trimmed.toLowerCase().startsWith(HANDOVER_QR_URI_PREFIX)) {
    opaque = trimmed.slice(HANDOVER_QR_URI_PREFIX.length);
  }

  const cleaned = opaque.trim();
  if (!cleaned || cleaned.length < 16 || cleaned.length > 256) {
    return null;
  }

  // Opaque tokens are base64url — reject path/query injection.
  if (/[/\\\s?]/.test(cleaned)) {
    return null;
  }

  return cleaned;
};

export const resolveHandoverCredentialExpiry = (
  pickupWindowEnd: Date | null | undefined,
  now: Date = new Date(),
): Date => {
  if (pickupWindowEnd) {
    return allowedHandoverEnd(pickupWindowEnd, HANDOVER_GRACE_MINUTES);
  }

  // Legacy/missing window: short-lived absolute fallback (1 hour).
  return new Date(now.getTime() + 60 * 60_000);
};

export const formatDeliveryHandoverQrPayload = (token: string): string =>
  `${DELIVERY_HANDOVER_QR_URI_PREFIX}${token}`;

/**
 * Accepts either the raw opaque token or `impactloop://delivery-handover/<token>`.
 * Rejects pickup QR payloads.
 */
export const normalizeDeliveryHandoverCredentialToken = (
  value: string | null | undefined,
): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (
    trimmed.toLowerCase().startsWith(HANDOVER_QR_URI_PREFIX) ||
    trimmed.toLowerCase().startsWith(SUPPLIER_PICKUP_HANDOVER_QR_URI_PREFIX)
  ) {
    return null;
  }

  let opaque = trimmed;
  if (trimmed.toLowerCase().startsWith(DELIVERY_HANDOVER_QR_URI_PREFIX)) {
    opaque = trimmed.slice(DELIVERY_HANDOVER_QR_URI_PREFIX.length);
  }

  const cleaned = opaque.trim();
  if (!cleaned || cleaned.length < 16 || cleaned.length > 256) {
    return null;
  }

  if (/[/\\\s?]/.test(cleaned)) {
    return null;
  }

  return cleaned;
};

export const resolveDeliveryHandoverCredentialExpiry = (
  confirmedDeliveryWindowEnd: Date | null | undefined,
  now: Date = new Date(),
): Date => {
  if (confirmedDeliveryWindowEnd) {
    return allowedHandoverEnd(confirmedDeliveryWindowEnd, HANDOVER_GRACE_MINUTES);
  }

  return new Date(now.getTime() + 60 * 60_000);
};

export const formatSupplierPickupHandoverQrPayload = (token: string): string =>
  `${SUPPLIER_PICKUP_HANDOVER_QR_URI_PREFIX}${token}`;

/**
 * Accepts either the raw opaque token or `impactloop://supplier-pickup-handover/<token>`.
 * Rejects pickup and drop-off delivery QR payloads.
 */
export const normalizeSupplierPickupHandoverCredentialToken = (
  value: string | null | undefined,
): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (
    trimmed.toLowerCase().startsWith(HANDOVER_QR_URI_PREFIX) ||
    trimmed.toLowerCase().startsWith(DELIVERY_HANDOVER_QR_URI_PREFIX)
  ) {
    return null;
  }

  let opaque = trimmed;
  if (trimmed.toLowerCase().startsWith(SUPPLIER_PICKUP_HANDOVER_QR_URI_PREFIX)) {
    opaque = trimmed.slice(SUPPLIER_PICKUP_HANDOVER_QR_URI_PREFIX.length);
  }

  const cleaned = opaque.trim();
  if (!cleaned || cleaned.length < 16 || cleaned.length > 256) {
    return null;
  }

  if (/[/\\\s?]/.test(cleaned)) {
    return null;
  }

  return cleaned;
};

export const resolveSupplierPickupHandoverCredentialExpiry = (
  supplierPickupWindowEnd: Date | null | undefined,
  now: Date = new Date(),
): Date => {
  if (supplierPickupWindowEnd) {
    return allowedHandoverEnd(supplierPickupWindowEnd, HANDOVER_GRACE_MINUTES);
  }

  return new Date(now.getTime() + 60 * 60_000);
};
