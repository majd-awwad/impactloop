import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';

import {
  isAcceptedMissedPickupExpired,
  missedPickupExpiredNote,
} from './reservation-missed-pickup-expiry.js';
import { MISSED_PICKUP_EXPIRY_REASON } from './reservation-timing-policy.js';
import { notifyReservationsExpired } from '../notifications/reservation-notifications.js';
import { invalidateLearnerHomeForReservationTransition } from '../learner-home/learner-home.service.js';
import {
  recomputeAndUpdateMaterialStatus,
  runSerializableTransaction,
  loadReservationIdsWithAnyDelivery,
} from './reservations.quantity.js';
import { MISSED_PICKUP_AUTO_CLOSE_GRACE_HOURS } from './reservation-timing-policy.js';

const missedPickupExpirySelect = {
  id: true,
  status: true,
  materialId: true,
  fulfillmentMethod: true,
  pickupWindowEnd: true,
} satisfies Prisma.ReservationSelect;

export type MissedPickupExpiryReservationRecord = Prisma.ReservationGetPayload<{
  select: typeof missedPickupExpirySelect;
}>;

const missedPickupExpiryCutoff = (now: Date = new Date()) =>
  new Date(
    now.getTime() - MISSED_PICKUP_AUTO_CLOSE_GRACE_HOURS * 60 * 60 * 1000,
  );

export const expireStaleMissedPickupsInTransaction = async (
  tx: Prisma.TransactionClient,
  reservations: MissedPickupExpiryReservationRecord[],
  changedBy: string | null = null,
  now: Date = new Date(),
): Promise<string[]> => {
  const expiredIds: string[] = [];
  const reservationIdsWithDeliveries = await loadReservationIdsWithAnyDelivery(
    tx,
    reservations.map((reservation) => reservation.id),
  );

  for (const reservation of reservations) {
    const deliveryCount = reservationIdsWithDeliveries.has(reservation.id)
      ? 1
      : 0;

    if (
      !isAcceptedMissedPickupExpired(
        {
          status: reservation.status,
          fulfillmentMethod: reservation.fulfillmentMethod,
          pickupWindowEnd: reservation.pickupWindowEnd,
          deliveryCount,
        },
        now,
      )
    ) {
      continue;
    }

    const updated = await tx.reservation.updateMany({
      where: {
        id: reservation.id,
        status: 'ACCEPTED',
      },
      data: {
        status: 'EXPIRED',
        rejectionReason: MISSED_PICKUP_EXPIRY_REASON,
      },
    });

    if (updated.count !== 1) {
      continue;
    }

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: reservation.id,
        statusGroup: 'RESERVATION',
        oldStatus: 'ACCEPTED',
        newStatus: 'EXPIRED',
        changedBy,
        note: missedPickupExpiredNote(),
      },
    });

    await recomputeAndUpdateMaterialStatus(tx, reservation.materialId);
    expiredIds.push(reservation.id);
  }

  return expiredIds;
};

const findMissedPickupExpiryCandidates = async (
  client: typeof prisma | Prisma.TransactionClient,
  where: Prisma.ReservationWhereInput,
  now: Date = new Date(),
) =>
  client.reservation.findMany({
    where: {
      ...where,
      status: 'ACCEPTED',
      fulfillmentMethod: 'PICKUP',
      pickupWindowEnd: {
        not: null,
        lte: missedPickupExpiryCutoff(now),
      },
    },
    select: missedPickupExpirySelect,
  });

export const expireStaleMissedPickupsByIds = async (
  reservationIds: string[],
  changedBy: string | null = null,
): Promise<string[]> => {
  if (reservationIds.length === 0) {
    return [];
  }

  const candidates = await findMissedPickupExpiryCandidates(prisma, {
    id: { in: reservationIds },
  });

  if (candidates.length === 0) {
    return [];
  }

  const expiredIds = await runSerializableTransaction(async (tx) =>
    expireStaleMissedPickupsInTransaction(tx, candidates, changedBy),
  );

  if (expiredIds.length > 0) {
    invalidateLearnerHomeForReservationTransition('ACCEPTED', 'EXPIRED');
  }
  void notifyReservationsExpired(expiredIds);

  return expiredIds;
};

export const expireStaleMissedPickupsForMaterialIds = async (
  materialIds: string[],
  changedBy: string | null = null,
): Promise<string[]> => {
  if (materialIds.length === 0) {
    return [];
  }

  const candidates = await findMissedPickupExpiryCandidates(prisma, {
    materialId: { in: materialIds },
  });

  if (candidates.length === 0) {
    return [];
  }

  const expiredIds = await runSerializableTransaction(async (tx) =>
    expireStaleMissedPickupsInTransaction(tx, candidates, changedBy),
  );

  if (expiredIds.length > 0) {
    invalidateLearnerHomeForReservationTransition('ACCEPTED', 'EXPIRED');
  }
  void notifyReservationsExpired(expiredIds);

  return expiredIds;
};

export const expireStaleMissedPickupsForOwner = async (
  ownerId: string,
  changedBy: string | null = null,
): Promise<string[]> => {
  const candidates = await findMissedPickupExpiryCandidates(prisma, {
    ownerId,
  });

  if (candidates.length === 0) {
    return [];
  }

  const expiredIds = await runSerializableTransaction(async (tx) =>
    expireStaleMissedPickupsInTransaction(tx, candidates, changedBy),
  );

  if (expiredIds.length > 0) {
    invalidateLearnerHomeForReservationTransition('ACCEPTED', 'EXPIRED');
  }
  void notifyReservationsExpired(expiredIds);

  return expiredIds;
};

export const expireStaleMissedPickupsForRequester = async (
  requesterId: string,
  changedBy: string | null = null,
): Promise<string[]> => {
  const candidates = await findMissedPickupExpiryCandidates(prisma, {
    requesterId,
  });

  if (candidates.length === 0) {
    return [];
  }

  const expiredIds = await runSerializableTransaction(async (tx) =>
    expireStaleMissedPickupsInTransaction(tx, candidates, changedBy),
  );

  if (expiredIds.length > 0) {
    invalidateLearnerHomeForReservationTransition('ACCEPTED', 'EXPIRED');
  }
  void notifyReservationsExpired(expiredIds);

  return expiredIds;
};

export const expireStaleMissedPickupsForMaterialIdsInTransaction = async (
  tx: Prisma.TransactionClient,
  materialIds: string[],
  changedBy: string | null = null,
) => {
  if (materialIds.length === 0) {
    return [];
  }

  const candidates = await findMissedPickupExpiryCandidates(tx, {
    materialId: { in: materialIds },
  });

  return expireStaleMissedPickupsInTransaction(tx, candidates, changedBy);
};
