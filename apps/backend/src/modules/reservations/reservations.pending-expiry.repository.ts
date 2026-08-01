import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';

import {
  isPendingReservationExpired,
  pendingReservationExpiredNote,
  type PendingReservationExpiryRecord,
} from './reservation-pending-expiry.js';
import { notifyReservationsExpired } from '../notifications/reservation-notifications.js';
import { invalidateLearnerHomeForReservationTransition } from '../learner-home/learner-home.service.js';
import {
  recomputeAndUpdateMaterialStatus,
  runSerializableTransaction,
} from './reservations.quantity.js';

const pendingExpirySelect = {
  id: true,
  status: true,
  materialId: true,
  fulfillmentMethod: true,
  learnerPreferredPickupWindows: true,
  learnerPreferredDeliveryWindows: true,
  createdAt: true,
} satisfies Prisma.ReservationSelect;

export type PendingExpiryReservationRecord = Prisma.ReservationGetPayload<{
  select: typeof pendingExpirySelect;
}>;

export const expireStalePendingReservationsInTransaction = async (
  tx: Prisma.TransactionClient,
  reservations: PendingExpiryReservationRecord[],
  changedBy: string | null = null,
  now: Date = new Date(),
): Promise<string[]> => {
  const expiredIds: string[] = [];

  for (const reservation of reservations) {
    if (!isPendingReservationExpired(reservation, now)) {
      continue;
    }

    const updated = await tx.reservation.updateMany({
      where: {
        id: reservation.id,
        status: 'PENDING',
      },
      data: {
        status: 'EXPIRED',
      },
    });

    if (updated.count !== 1) {
      continue;
    }

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: reservation.id,
        statusGroup: 'RESERVATION',
        oldStatus: 'PENDING',
        newStatus: 'EXPIRED',
        changedBy,
        note: pendingReservationExpiredNote(reservation),
      },
    });

    await recomputeAndUpdateMaterialStatus(tx, reservation.materialId);
    expiredIds.push(reservation.id);
  }

  return expiredIds;
};

export const expireStalePendingReservationsByIds = async (
  reservationIds: string[],
  changedBy: string | null = null,
): Promise<string[]> => {
  if (reservationIds.length === 0) {
    return [];
  }

  const pending = await prisma.reservation.findMany({
    where: {
      id: { in: reservationIds },
      status: 'PENDING',
    },
    select: pendingExpirySelect,
  });

  if (pending.length === 0) {
    return [];
  }

  const expiredIds = await runSerializableTransaction(async (tx) =>
    expireStalePendingReservationsInTransaction(tx, pending, changedBy),
  );

  if (expiredIds.length > 0) {
    invalidateLearnerHomeForReservationTransition('PENDING', 'EXPIRED');
  }
  void notifyReservationsExpired(expiredIds);

  return expiredIds;
};

export const expireStalePendingReservationsForMaterialIds = async (
  materialIds: string[],
  changedBy: string | null = null,
): Promise<string[]> => {
  if (materialIds.length === 0) {
    return [];
  }

  const pending = await prisma.reservation.findMany({
    where: {
      materialId: { in: materialIds },
      status: 'PENDING',
    },
    select: pendingExpirySelect,
  });

  if (pending.length === 0) {
    return [];
  }

  const expiredIds = await runSerializableTransaction(async (tx) =>
    expireStalePendingReservationsInTransaction(tx, pending, changedBy),
  );

  if (expiredIds.length > 0) {
    invalidateLearnerHomeForReservationTransition('PENDING', 'EXPIRED');
  }
  void notifyReservationsExpired(expiredIds);

  return expiredIds;
};

export const expireStalePendingReservationsForOwner = async (
  ownerId: string,
  changedBy: string | null = null,
): Promise<string[]> => {
  const pending = await prisma.reservation.findMany({
    where: {
      ownerId,
      status: 'PENDING',
    },
    select: pendingExpirySelect,
  });

  if (pending.length === 0) {
    return [];
  }

  const expiredIds = await runSerializableTransaction(async (tx) =>
    expireStalePendingReservationsInTransaction(tx, pending, changedBy),
  );

  if (expiredIds.length > 0) {
    invalidateLearnerHomeForReservationTransition('PENDING', 'EXPIRED');
  }
  void notifyReservationsExpired(expiredIds);

  return expiredIds;
};

export const expireStalePendingReservationsForLearnerMaterial = async (
  tx: Prisma.TransactionClient,
  input: {
    requesterId: string;
    materialId: string;
  },
): Promise<string[]> => {
  const pending = await tx.reservation.findMany({
    where: {
      requesterId: input.requesterId,
      materialId: input.materialId,
      status: 'PENDING',
    },
    select: pendingExpirySelect,
  });

  return expireStalePendingReservationsInTransaction(
    tx,
    pending,
    input.requesterId,
  );
};

export type { PendingReservationExpiryRecord };
