export const DELIVERY_BUFFER_MINUTES = 60;
export const MIN_PICKUP_NOTICE_MINUTES = 60;
export const MIN_CUSTOM_PICKUP_START_NOTICE_MINUTES = 30;

export const PICKUP_WINDOW_TOO_CLOSE_MESSAGE =
  'This pickup window is too close to ending. Propose a new time.';

export const LEARNER_PICKUP_WINDOW_TOO_CLOSE_MESSAGE =
  'Preferred pickup window is too close to ending. Choose a window with at least 60 minutes remaining.';

export const PROPOSED_PICKUP_START_TOO_SOON_MESSAGE =
  'Proposed pickup time must start in the future.';

/** When a PENDING reservation has no stored preferred windows (legacy rows). */
export const PENDING_RESERVATION_FALLBACK_HOURS = 72;
