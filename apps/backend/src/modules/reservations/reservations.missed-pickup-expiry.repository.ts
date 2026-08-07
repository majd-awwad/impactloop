import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';

import {
  isAcceptedMissedPickupExpired,
  missedPickupExpiredNote,
} from './reservation-missed-pickup-expiry.js';
import {
  MISSED_PICKUP_AUTO_CLOSE_GRACE_HOURS,
  MISSED_PICKUP_EXPIRY_REASON,
} from './reservation-timing-policy.js';
import { notifyReservationsExpired } from '../notifications/reservation-notifications.js';
import { invalidateLearnerHomeForReservationTransition } from '../learner-home/learner-home.service.js';
import {
  recomputeAndUpdateMaterialStatus,
  runSerializableTransaction,
  loadReservationIdsWithAnyDelivery,
} from './reservations.quantity.js';
import { applyBuildReservationSyncInTransaction } from '../learning-projects/learning-projects.build-reservation-sync.js';
import {
  flushPostCommitPaymentRefunds,
  handleReservationPaymentLifecycleTransition,
  type PostCommitRefundTask,
  type PostCommitResolutionTask,
} from '../payments/payments.lifecycle.js';

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
    now.getTime() - MISSED_PICKUP_AUTO_CLOSE_GRACE_HOURS * 60 * 60_000,
  );

export const expireStaleMissedPickupsInTransaction = async (
  tx: Prisma.TransactionClient,
  reservations: MissedPickupExpiryReservationRecord[],
  changedBy: string | null = null,
  now: Date = new Date(),
): Promise<{
  expiredIds: string[];
  postCommitRefunds: PostCommitRefundTask[];
  postCommitResolutions: PostCommitResolutionTask[];
}> => {
  const expiredIds: string[] = [];
  const postCommitRefunds: PostCommitRefundTask[] = [];
  const postCommitResolutions: PostCommitResolutionTask[] = [];
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
    await applyBuildReservationSyncInTransaction(tx, reservation.id);

    const payment = await handleReservationPaymentLifecycleTransition(tx, {
      reservationId: reservation.id,
      newStatus: 'EXPIRED',
      actorUserId: changedBy,
      reason: MISSED_PICKUP_EXPIRY_REASON,
    });
    postCommitRefunds.push(...payment.postCommitRefunds);
    if (payment.postCommitResolution) {
      postCommitResolutions.push(payment.postCommitResolution);
    }

    expiredIds.push(reservation.id);
  }

  return { expiredIds, postCommitRefunds, postCommitResolutions };
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

const runMissedPickupExpiry = async (
  candidates: MissedPickupExpiryReservationRecord[],
  changedBy: string | null,
): Promise<string[]> => {
  if (candidates.length === 0) {
    return [];
  }

  const { expiredIds, postCommitRefunds, postCommitResolutions } =
    await runSerializableTransaction(async (tx) =>
      expireStaleMissedPickupsInTransaction(tx, candidates, changedBy),
    );

  await flushPostCommitPaymentRefunds(
    postCommitRefunds,
    postCommitResolutions,
  );

  if (expiredIds.length > 0) {
    invalidateLearnerHomeForReservationTransition('ACCEPTED', 'EXPIRED');
  }
  void notifyReservationsExpired(expiredIds);

  return expiredIds;
};

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

  return runMissedPickupExpiry(candidates, changedBy);
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

  return runMissedPickupExpiry(candidates, changedBy);
};

export const expireStaleMissedPickupsForOwner = async (
  ownerId: string,
  changedBy: string | null = null,
): Promise<string[]> => {
  const candidates = await findMissedPickupExpiryCandidates(prisma, {
    ownerId,
  });

  return runMissedPickupExpiry(candidates, changedBy);
};

export const expireStaleMissedPickupsForRequester = async (
  requesterId: string,
  changedBy: string | null = null,
): Promise<string[]> => {
  const candidates = await findMissedPickupExpiryCandidates(prisma, {
    requesterId,
  });

  return runMissedPickupExpiry(candidates, changedBy);
};

export const expireStaleMissedPickupsForMaterialIdsInTransaction = async (
  tx: Prisma.TransactionClient,
  materialIds: string[],
  changedBy: string | null = null,
): Promise<{
  expiredIds: string[];
  postCommitRefunds: PostCommitRefundTask[];
  postCommitResolutions: PostCommitResolutionTask[];
}> => {
  if (materialIds.length === 0) {
    return {
      expiredIds: [],
      postCommitRefunds: [],
      postCommitResolutions: [],
    };
  }

  const candidates = await findMissedPickupExpiryCandidates(tx, {
    materialId: { in: materialIds },
  });

  return expireStaleMissedPickupsInTransaction(tx, candidates, changedBy);
};
