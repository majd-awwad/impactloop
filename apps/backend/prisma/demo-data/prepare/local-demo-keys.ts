/** Stable local-demo identity markers. Safe to search in existing text fields. */

export const LOCAL_DEMO_KEY_PREFIX = 'local-demo:';

export const CASH_HANDOVER_DEMO_KEY = 'local-demo:cash-handover-v1';
export const DRIVER_ON_THE_WAY_DEMO_KEY = 'local-demo:driver-ontheway-v1';
export const ADMIN_AUDIT_DEMO_PREFIX = 'admin-audit-v1:';

export const CASH_HANDOVER_PREFERRED_TITLES = [
  'Mixed Color LED Packs',
  'HC-SR04 Ultrasonic Sensors',
  'Small DC Gear Motors Pair',
  'Salvaged Arduino Uno Boards',
] as const;

export const DRIVER_ON_THE_WAY_PREFERRED_TITLES = [
  'Resistor Assortment Boxes',
] as const;

export const TERMINAL_RESERVATION_STATUSES = [
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
  'NO_SHOW',
  'FULFILLMENT_FAILED',
] as const;

export const adminAuditDemoKey = (scenario: string) =>
  `${ADMIN_AUDIT_DEMO_PREFIX}${scenario}`;

export const hasDemoMarker = (
  value: string | null | undefined,
  key: string,
): boolean => Boolean(value && value.includes(key));

export const isTerminalReservationStatus = (status: string): boolean =>
  (TERMINAL_RESERVATION_STATUSES as readonly string[]).includes(status);

export const isCompletedReservationStatus = (status: string): boolean =>
  status === 'COMPLETED';
