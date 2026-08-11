import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';

import {
  isPendingReservationExpired,
  pendingReservationExpiredNote,
  type PendingReservationExpiryRecord,
} from './reservation-pending-expiry.js';
import { PENDING_SUPPLIER_RESPONSE_HOURS } from './reservation-timing-policy.js';
import { notifyReservationsExpired } from '../notifications/reservation-notifications.js';
import { invalidateLearnerHomeForReservationTransition } from '../learner-home/learner-home.service.js';
import {
  recomputeAndUpdateMaterialStatus,
  runSerializableTransaction,
} from './reservations.quantity.js';
import { applyBuildReservationSyncInTransaction } from '../learning-projects/learning-projects.build-reservation-sync.js';

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
    await applyBuildReservationSyncInTransaction(tx, reservation.id);
    expiredIds.push(reservation.id);
  }

  return expiredIds;
};

const runPendingExpiry = async (
  pending: PendingExpiryReservationRecord[],
  changedBy: string | null,
): Promise<string[]> => {
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

/**
 * Due-only PENDING discovery matching resolvePendingReservationDeadline:
 * now > min(createdAt + 48h, latest preferred window end).
 * Timeout path is SQL-filtered; preferred-window early expiry uses the shared
 * in-memory deadline helper on young PENDING rows only (not all active statuses).
 */
export const findDuePendingExpiryCandidates = async (
  batchSize: number,
  now: Date = new Date(),
): Promise<PendingExpiryReservationRecord[]> => {
  const timeoutCutoff = new Date(
    now.getTime() - PENDING_SUPPLIER_RESPONSE_HOURS * 60 * 60 * 1000,
  );

  const timedOut = await prisma.reservation.findMany({
    where: {
      status: 'PENDING',
      createdAt: { lte: timeoutCutoff },
    },
    select: pendingExpirySelect,
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
    take: batchSize,
  });

  if (timedOut.length >= batchSize) {
    return timedOut;
  }

  const remaining = batchSize - timedOut.length;
  // Only PENDING younger than the 48h timeout can still be early-due via windows.
  const youngPending = await prisma.reservation.findMany({
    where: {
      status: 'PENDING',
      createdAt: { gt: timeoutCutoff },
    },
    select: pendingExpirySelect,
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
    take: Math.max(remaining * 10, 200),
  });

  const earlyDue = youngPending
    .filter((row) => isPendingReservationExpired(row, now))
    .slice(0, remaining);

  return [...timedOut, ...earlyDue];
};

export const expireDuePendingReservationsBatch = async (
  batchSize: number,
  changedBy: string | null = null,
  now: Date = new Date(),
): Promise<string[]> => {
  const pending = await findDuePendingExpiryCandidates(batchSize, now);
  return runPendingExpiry(pending, changedBy);
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

  return runPendingExpiry(pending, changedBy);
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

  return runPendingExpiry(pending, changedBy);
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

  return runPendingExpiry(pending, changedBy);
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
