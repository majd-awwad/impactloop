export const HANDOVER_EARLY_MINUTES = 30;
export const HANDOVER_GRACE_MINUTES = 30;

export type HandoverWindowTimingResult =
  | { ok: true }
  | { ok: false; reason: 'NOT_STARTED' | 'EXPIRED' | 'MISSING_WINDOW' };

export type PickupHandoverPhase =
  | 'BEFORE_ALLOWED'
  | 'DURING_ALLOWED'
  | 'AFTER_ALLOWED';

export const allowedHandoverStart = (
  windowStart: Date,
  earlyMinutes = HANDOVER_EARLY_MINUTES,
) => new Date(windowStart.getTime() - earlyMinutes * 60_000);

export const allowedHandoverEnd = (
  windowEnd: Date,
  graceMinutes = HANDOVER_GRACE_MINUTES,
) => new Date(windowEnd.getTime() + graceMinutes * 60_000);

export const graceEndFromWindowEnd = (
  windowEnd: Date,
  graceMinutes = HANDOVER_GRACE_MINUTES,
) => allowedHandoverEnd(windowEnd, graceMinutes);

export const isBeforeAllowedStart = (
  now: Date,
  windowStart: Date | null | undefined,
  earlyMinutes = HANDOVER_EARLY_MINUTES,
) => {
  if (!windowStart) {
    return false;
  }

  return now.getTime() < allowedHandoverStart(windowStart, earlyMinutes).getTime();
};

export const isAfterAllowedEnd = (
  now: Date,
  windowEnd: Date | null | undefined,
  graceMinutes = HANDOVER_GRACE_MINUTES,
) => {
  if (!windowEnd) {
    return false;
  }

  return now.getTime() > allowedHandoverEnd(windowEnd, graceMinutes).getTime();
};

/** @deprecated Use isAfterAllowedEnd */
export const isAfterWindowWithGrace = isAfterAllowedEnd;

export const isBeforeWindowStart = (
  now: Date,
  windowStart: Date | null | undefined,
) => isBeforeAllowedStart(now, windowStart);

export const isWithinAllowedHandoverRange = (
  now: Date,
  windowStart: Date | null | undefined,
  windowEnd: Date | null | undefined,
  earlyMinutes = HANDOVER_EARLY_MINUTES,
  graceMinutes = HANDOVER_GRACE_MINUTES,
) =>
  evaluateHandoverWindow(
    now,
    windowStart,
    windowEnd,
    earlyMinutes,
    graceMinutes,
  ).ok;

/** @deprecated Use isWithinAllowedHandoverRange */
export const isWithinWindowWithGrace = isWithinAllowedHandoverRange;

export const resolvePickupHandoverPhase = (
  now: Date,
  windowStart: Date | null | undefined,
  windowEnd: Date | null | undefined,
  earlyMinutes = HANDOVER_EARLY_MINUTES,
  graceMinutes = HANDOVER_GRACE_MINUTES,
): PickupHandoverPhase | null => {
  if (!windowStart || !windowEnd) {
    return null;
  }

  if (isBeforeAllowedStart(now, windowStart, earlyMinutes)) {
    return 'BEFORE_ALLOWED';
  }

  if (isAfterAllowedEnd(now, windowEnd, graceMinutes)) {
    return 'AFTER_ALLOWED';
  }

  return 'DURING_ALLOWED';
};

export const evaluateHandoverWindow = (
  now: Date,
  windowStart: Date | null | undefined,
  windowEnd: Date | null | undefined,
  earlyMinutes = HANDOVER_EARLY_MINUTES,
  graceMinutes = HANDOVER_GRACE_MINUTES,
): HandoverWindowTimingResult => {
  if (!windowStart || !windowEnd) {
    return { ok: false, reason: 'MISSING_WINDOW' };
  }

  if (isBeforeAllowedStart(now, windowStart, earlyMinutes)) {
    return { ok: false, reason: 'NOT_STARTED' };
  }

  if (isAfterAllowedEnd(now, windowEnd, graceMinutes)) {
    return { ok: false, reason: 'EXPIRED' };
  }

  return { ok: true };
};

export const pickupWindowNotStartedMessage = () =>
  'Pickup window has not started yet.';

export const pickupWindowPassedMessage = () => 'Pickup window has passed.';

/** @deprecated Use pickupWindowPassedMessage */
export const pickupWindowExpiredMessage = pickupWindowPassedMessage;

export const pickupWindowNotExpiredMessage = () =>
  'Pickup window has not expired yet.';

export const supplierPickupWindowNotStartedMessage = () =>
  'Supplier pickup window has not started yet.';

export const supplierPickupWindowPassedMessage = () =>
  'Supplier pickup window has passed.';

/** @deprecated Use supplierPickupWindowPassedMessage */
export const supplierPickupWindowExpiredMessage = supplierPickupWindowPassedMessage;

export const supplierPickupWindowNotExpiredMessage = () =>
  'Supplier pickup window has not expired yet.';

export const deliveryWindowNotStartedMessage = () =>
  'Delivery window has not started yet.';

export const deliveryWindowPassedMessage = () => 'Delivery window has passed.';

/** @deprecated Use deliveryWindowPassedMessage */
export const deliveryWindowExpiredMessage = deliveryWindowPassedMessage;

export const deliveryWindowNotExpiredMessage = () =>
  'Delivery window has not expired yet.';
