export const DELIVERY_BUFFER_MINUTES = 60;

export const MIN_PICKUP_LEAD_TIME_MINUTES = 30;
export const MIN_REMAINING_PICKUP_WINDOW_MINUTES = 30;

/** @deprecated Use MIN_REMAINING_PICKUP_WINDOW_MINUTES */
export const MIN_PICKUP_NOTICE_MINUTES = MIN_REMAINING_PICKUP_WINDOW_MINUTES;

/** @deprecated Use MIN_PICKUP_LEAD_TIME_MINUTES */
export const MIN_CUSTOM_PICKUP_START_NOTICE_MINUTES = MIN_PICKUP_LEAD_TIME_MINUTES;

export const PICKUP_WINDOW_TOO_CLOSE_MESSAGE =
  'This pickup window is too close to ending. Propose a new time.';

export const LEARNER_PICKUP_WINDOW_TOO_CLOSE_MESSAGE =
  'Preferred pickup window is too close to ending. Choose a window with at least 30 minutes remaining.';

export const PROPOSED_PICKUP_START_TOO_SOON_MESSAGE =
  'Proposed pickup time must start at least 30 minutes from now.';

/** When a PENDING reservation has no stored preferred windows (legacy rows). */
export const PENDING_RESERVATION_FALLBACK_HOURS = 48;

/** Max hours a supplier may leave a PENDING reservation unanswered. */
export const PENDING_SUPPLIER_RESPONSE_HOURS = PENDING_RESERVATION_FALLBACK_HOURS;

/** Grace period after confirmed pickup window end before auto-closing missed pickups. */
export const MISSED_PICKUP_AUTO_CLOSE_GRACE_HOURS = 72;

/** Stored in reservations.rejection_reason when a missed pickup auto-expires. */
export const MISSED_PICKUP_EXPIRY_REASON = 'PICKUP_WINDOW_MISSED';

/** Hours after supplier pickup window end before auto-escalating unassigned-driver deliveries. */
export const NO_DRIVER_AUTO_ESCALATION_HOURS = 24;

/** Stored in reservations.rejection_reason when admin cancels after no driver was available. */
export const NO_DRIVER_CANCEL_REASON = 'NO_DRIVER_UNAVAILABLE';

/** Stored in reservations.pending_reschedule_reason when admin asks supplier to reconfirm pickup. */
export const NO_DRIVER_SUPPLIER_RECONFIRM_REASON = 'NO_DRIVER_ADMIN_REQUEST';

/** Stored when admin asks supplier to reconfirm after stale assigned-driver pickup. */
export const STALE_PICKUP_SUPPLIER_RECONFIRM_REASON = 'STALE_PICKUP_ADMIN_REQUEST';

/** Stored in reservations.rejection_reason when admin cancels after stale pickup failure. */
export const STALE_PICKUP_CANCEL_REASON = 'PICKUP_NOT_COMPLETED';

export const ADMIN_SUPPLIER_PICKUP_RECONFIRM_REASONS = [
  NO_DRIVER_SUPPLIER_RECONFIRM_REASON,
  STALE_PICKUP_SUPPLIER_RECONFIRM_REASON,
] as const;

export type AdminSupplierPickupReconfirmReason =
  (typeof ADMIN_SUPPLIER_PICKUP_RECONFIRM_REASONS)[number];

export const isAdminSupplierPickupReconfirmReason = (
  value: string | null | undefined,
): value is AdminSupplierPickupReconfirmReason =>
  value != null &&
  (ADMIN_SUPPLIER_PICKUP_RECONFIRM_REASONS as readonly string[]).includes(
    value,
  );
