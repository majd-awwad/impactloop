import type { DeliveryStatus } from '../../generated/prisma/client.js';

export const TERMINAL_DELIVERY_STATUSES = [
  'DELIVERED',
  'CANCELLED',
  'FAILED_PICKUP',
  'FAILED_DELIVERY',
  'DRIVER_NO_SHOW',
  'LEARNER_NO_SHOW',
  'AWAITING_RESOLUTION',
  'RETURNED_TO_SUPPLIER',
] as const satisfies readonly DeliveryStatus[];

export type TerminalDeliveryStatus =
  (typeof TERMINAL_DELIVERY_STATUSES)[number];

export const isTerminalDeliveryStatus = (
  status: DeliveryStatus,
): status is TerminalDeliveryStatus =>
  (TERMINAL_DELIVERY_STATUSES as readonly DeliveryStatus[]).includes(status);
