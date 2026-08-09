/**
 * Delivery-domain operational configuration.
 *
 * Keep reservation timing (`reservation-timing-policy`) and delivery pricing
 * elsewhere — equal numeric values do not mean the same business rule.
 */

/** Minutes after "now" used as the earliest derived delivery start when a pickup end exists. */
export const DERIVED_DELIVERY_WINDOW_LEAD_MINUTES = 60;

/** Hours after "now" used as delivery start when no pickup window end is available. */
export const DERIVED_DELIVERY_WINDOW_FALLBACK_DELAY_HOURS = 24;

/** Duration of a derived (unconfirmed) delivery window. */
export const DERIVED_DELIVERY_WINDOW_DURATION_HOURS = 2;

/** Learner live tracking treats the latest driver location as stale after this age. */
export const LIVE_DRIVER_LOCATION_STALE_AFTER_MS = 90_000;

/**
 * Maximum age for a driver's recent location ping when resolving a reference
 * point for job matching / proximity — not the same policy as live tracking
 * staleness or the derived-window fallback delay.
 */
export const DRIVER_RECENT_LOCATION_PING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Maximum concurrent in-progress deliveries assigned to one driver. */
export const MAX_ACTIVE_DRIVER_DELIVERIES = 3;

export const deriveUnconfirmedDeliveryWindow = (
  pickupWindowEnd: Date | null,
  nowMs = Date.now(),
): { start: Date; end: Date } => {
  const earliest = pickupWindowEnd
    ? Math.max(
        pickupWindowEnd.getTime(),
        nowMs + DERIVED_DELIVERY_WINDOW_LEAD_MINUTES * 60 * 1000,
      )
    : nowMs + DERIVED_DELIVERY_WINDOW_FALLBACK_DELAY_HOURS * 60 * 60 * 1000;

  const start = new Date(earliest);
  return {
    start,
    end: new Date(
      start.getTime() + DERIVED_DELIVERY_WINDOW_DURATION_HOURS * 60 * 60 * 1000,
    ),
  };
};

export const isLiveDriverLocationStale = (
  locationRecordedAt: Date,
  nowMs = Date.now(),
): boolean =>
  nowMs - locationRecordedAt.getTime() > LIVE_DRIVER_LOCATION_STALE_AFTER_MS;
