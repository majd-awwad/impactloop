import type { ReservationStatus } from '../../generated/prisma/client.js';

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
    input.status === 'EXPIRED'
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
  if (end.getTime() < now.getTime()) {
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
  return status === 'PENDING' || status === 'ACCEPTED';
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
