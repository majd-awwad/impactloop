import type { ReservationStatus } from '../../generated/prisma/client.js';
import { isAfterAllowedEnd } from '../../utils/handover-timing.js';

export type PickupWindowStatus =
  | 'UPCOMING'
  | 'TODAY'
  | 'OVERDUE'
  | 'COMPLETED'
  | 'NONE';

export type ReservationFollowUpState = {
  pickupWindowStatus: PickupWindowStatus;
  isOverdue: boolean;
  needsFollowUp: boolean;
};

const dateOnly = (value: Date) => {
  const local = value;
  return new Date(local.getFullYear(), local.getMonth(), local.getDate());
};

export const resolveReservationFollowUp = (input: {
  status: ReservationStatus;
  pickupWindowStart: Date | null;
  pickupWindowEnd: Date | null;
  completedAt?: Date | null;
  now?: Date;
}): ReservationFollowUpState => {
  const now = input.now ?? new Date();

  if (input.status === 'COMPLETED') {
    return {
      pickupWindowStatus: 'COMPLETED',
      isOverdue: false,
      needsFollowUp: false,
    };
  }

  if (
    input.status === 'REJECTED' ||
    input.status === 'CANCELLED' ||
    input.status === 'EXPIRED' ||
    input.status === 'AWAITING_LEARNER_CONFIRMATION' ||
    input.status === 'AWAITING_SUPPLIER_CONFIRMATION' ||
    input.status === 'NO_SHOW' ||
    input.status === 'FULFILLMENT_FAILED' ||
    input.status === 'AWAITING_RESOLUTION'
  ) {
    return {
      pickupWindowStatus: 'NONE',
      isOverdue: false,
      needsFollowUp: false,
    };
  }

  if (input.status !== 'ACCEPTED' || !input.pickupWindowEnd) {
    return {
      pickupWindowStatus: 'NONE',
      isOverdue: false,
      needsFollowUp: false,
    };
  }

  const end = input.pickupWindowEnd;
  if (isAfterAllowedEnd(now, end)) {
    return {
      pickupWindowStatus: 'OVERDUE',
      isOverdue: true,
      needsFollowUp: true,
    };
  }

  const start = input.pickupWindowStart ?? end;
  const today = dateOnly(now);
  const pickupDay = dateOnly(start);

  if (pickupDay.getTime() === today.getTime()) {
    return {
      pickupWindowStatus: 'TODAY',
      isOverdue: false,
      needsFollowUp: false,
    };
  }

  return {
    pickupWindowStatus: 'UPCOMING',
    isOverdue: false,
    needsFollowUp: false,
  };
};

export const reservationAllowsMessaging = (status: ReservationStatus) => {
  return (
    status === 'PENDING' ||
    status === 'ACCEPTED' ||
    status === 'AWAITING_LEARNER_CONFIRMATION' ||
    status === 'AWAITING_SUPPLIER_CONFIRMATION'
  );
};

export const RESERVATION_MESSAGE_MAX_LENGTH = 1000;

export const countVerifiedNoShowReportsForTarget = async (
  countVerified: (targetUserId: string) => Promise<number>,
  targetUserId: string,
) => {
  const count = await countVerified(targetUserId);
  return {
    verifiedCount: count,
    shouldWarnAdmin: count >= 3,
  };
};
