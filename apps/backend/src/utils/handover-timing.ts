export const HANDOVER_GRACE_MINUTES = 30;

export type HandoverWindowTimingResult =
  | { ok: true }
  | { ok: false; reason: 'NOT_STARTED' | 'EXPIRED' | 'MISSING_WINDOW' };

export const evaluateHandoverWindow = (
  now: Date,
  windowStart: Date | null | undefined,
  windowEnd: Date | null | undefined,
  graceMinutes = HANDOVER_GRACE_MINUTES,
): HandoverWindowTimingResult => {
  if (!windowStart || !windowEnd) {
    return { ok: false, reason: 'MISSING_WINDOW' };
  }

  const graceEnd = new Date(windowEnd.getTime() + graceMinutes * 60_000);

  if (now.getTime() < windowStart.getTime()) {
    return { ok: false, reason: 'NOT_STARTED' };
  }

  if (now.getTime() > graceEnd.getTime()) {
    return { ok: false, reason: 'EXPIRED' };
  }

  return { ok: true };
};

export const pickupWindowNotStartedMessage = () =>
  'Pickup window has not started yet.';

export const pickupWindowExpiredMessage = () => 'Pickup window has expired.';

export const supplierPickupWindowNotStartedMessage = () =>
  'Supplier pickup window has not started yet.';

export const supplierPickupWindowExpiredMessage = () =>
  'Supplier pickup window has expired.';

export const deliveryWindowNotStartedMessage = () =>
  'Delivery window has not started yet.';

export const deliveryWindowExpiredMessage = () => 'Delivery window has expired.';
