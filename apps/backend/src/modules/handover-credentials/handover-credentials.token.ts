import { generateOpaqueToken, hashToken } from '../../utils/token.js';
import {
  allowedHandoverEnd,
  HANDOVER_GRACE_MINUTES,
} from '../../utils/handover-timing.js';

export const HANDOVER_QR_URI_PREFIX = 'impactloop://handover/';

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
