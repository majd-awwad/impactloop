import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';

import {
  isStaleAssignedDriverAutoEscalationDue,
  PRE_PICKUP_ASSIGNED_DRIVER_DELIVERY_STATUSES,
  staleAssignedDriverAutoEscalationNote,
} from './reservation-assigned-driver-pickup-overdue.js';
import { escalateStaleAssignedDriverPickupInTransaction } from './reservations.incidents.repository.js';
import { formatReservationHistoryNote } from './reservation-status-history.js';
import { NO_DRIVER_AUTO_ESCALATION_HOURS } from './reservation-timing-policy.js';
import { runSerializableTransaction } from './reservations.quantity.js';
import { notifyDriverDeliveryMovedToAdminReview } from '../notifications/driver-delivery-notifications.js';
import { invalidateLearnerHomeForReservationTransition } from '../learner-home/learner-home.service.js';

const staleAssignedDriverEscalationSelect = {
  id: true,
  status: true,
  requesterId: true,
  fulfillmentMethod: true,
  supplierPickupWindowStart: true,
  supplierPickupWindowEnd: true,
  deliveries: {
    orderBy: { requestedAt: 'desc' as const },
    take: 1,
    select: {
      id: true,
      status: true,
      assignedDriverProfileId: true,
    },
  },
  noShowReports: {
    where: { status: 'PENDING_REVIEW' },
    select: { id: true },
    take: 1,
  },
} satisfies Prisma.ReservationSelect;

export type StaleAssignedDriverEscalationReservationRecord =
  Prisma.ReservationGetPayload<{
    select: typeof staleAssignedDriverEscalationSelect;
  }>;

const staleAssignedDriverEscalationCutoff = (now: Date = new Date()) =>
  new Date(
    now.getTime() - NO_DRIVER_AUTO_ESCALATION_HOURS * 60 * 60 * 1000,
  );

const toEscalationRecord = (
  reservation: StaleAssignedDriverEscalationReservationRecord,
) => {
  const delivery = reservation.deliveries[0] ?? null;

  return {
    status: reservation.status,
    fulfillmentMethod: reservation.fulfillmentMethod,
    supplierPickupWindowEnd: reservation.supplierPickupWindowEnd,
    deliveryStatus: delivery?.status ?? null,
    assignedDriverProfileId: delivery?.assignedDriverProfileId ?? null,
    hasPendingReport: reservation.noShowReports.length > 0,
  };
};

export const escalateStaleAssignedDriverPickupsInTransaction = async (
  tx: Prisma.TransactionClient,
  reservations: StaleAssignedDriverEscalationReservationRecord[],
  now: Date = new Date(),
): Promise<{
  reservationIds: string[];
  driverNotifications: Array<{ deliveryId: string; driverUserId: string }>;
}> => {
  const escalatedIds: string[] = [];
  const driverNotifications: Array<{ deliveryId: string; driverUserId: string }> =
    [];

  for (const reservation of reservations) {
    if (!isStaleAssignedDriverAutoEscalationDue(toEscalationRecord(reservation), now)) {
      continue;
    }

    const delivery = reservation.deliveries[0];

    if (!delivery?.assignedDriverProfileId) {
      continue;
    }

    const result = await escalateStaleAssignedDriverPickupInTransaction(tx, {
      reservation,
      delivery,
      reporterUserId: reservation.requesterId,
      changedBy: null,
      note: staleAssignedDriverAutoEscalationNote(),
      deliveryHistoryNote: 'Assigned-driver pickup auto-escalated',
      reservationHistoryNote: formatReservationHistoryNote(
        'ASSIGNED_DRIVER_PICKUP_AUTO_ESCALATED',
      ),
    });

    if (result.created && result.driverUserId && result.deliveryId) {
      escalatedIds.push(reservation.id);
      driverNotifications.push({
        deliveryId: result.deliveryId,
        driverUserId: result.driverUserId,
      });
    }
  }

  return { reservationIds: escalatedIds, driverNotifications };
};

const findStaleAssignedDriverEscalationCandidates = async (
  client: typeof prisma | Prisma.TransactionClient,
  where: Prisma.ReservationWhereInput,
  now: Date = new Date(),
) =>
  client.reservation.findMany({
    where: {
      ...where,
      status: 'ACCEPTED',
      fulfillmentMethod: 'DELIVERY',
      supplierPickupWindowEnd: {
        not: null,
        lte: staleAssignedDriverEscalationCutoff(now),
      },
      deliveries: {
        some: {
          status: { in: [...PRE_PICKUP_ASSIGNED_DRIVER_DELIVERY_STATUSES] },
          assignedDriverProfileId: { not: null },
        },
      },
      noShowReports: {
        none: { status: 'PENDING_REVIEW' },
      },
    },
    select: staleAssignedDriverEscalationSelect,
  });

const notifyEscalatedDrivers = async (
  notifications: Array<{ deliveryId: string; driverUserId: string }>,
) => {
  await Promise.all(
    notifications.map((entry) =>
      notifyDriverDeliveryMovedToAdminReview(entry),
    ),
  );
};

export const escalateStaleAssignedDriverPickupsByIds = async (
  reservationIds: string[],
): Promise<string[]> => {
  if (reservationIds.length === 0) {
    return [];
  }

  const candidates = await findStaleAssignedDriverEscalationCandidates(prisma, {
    id: { in: reservationIds },
  });

  if (candidates.length === 0) {
    return [];
  }

  const result = await runSerializableTransaction(async (tx) =>
    escalateStaleAssignedDriverPickupsInTransaction(tx, candidates),
  );

  if (result.reservationIds.length > 0) {
    invalidateLearnerHomeForReservationTransition(
      'ACCEPTED',
      'AWAITING_RESOLUTION',
    );
  }
  await notifyEscalatedDrivers(result.driverNotifications);

  return result.reservationIds;
};

export const escalateStaleAssignedDriverPickupsForRequester = async (
  requesterId: string,
): Promise<string[]> => {
  const candidates = await findStaleAssignedDriverEscalationCandidates(prisma, {
    requesterId,
  });

  if (candidates.length === 0) {
    return [];
  }

  const result = await runSerializableTransaction(async (tx) =>
    escalateStaleAssignedDriverPickupsInTransaction(tx, candidates),
  );

  if (result.reservationIds.length > 0) {
    invalidateLearnerHomeForReservationTransition(
      'ACCEPTED',
      'AWAITING_RESOLUTION',
    );
  }
  await notifyEscalatedDrivers(result.driverNotifications);

  return result.reservationIds;
};

export const escalateStaleAssignedDriverPickupsForOwner = async (
  ownerId: string,
): Promise<string[]> => {
  const candidates = await findStaleAssignedDriverEscalationCandidates(prisma, {
    ownerId,
  });

  if (candidates.length === 0) {
    return [];
  }

  const result = await runSerializableTransaction(async (tx) =>
    escalateStaleAssignedDriverPickupsInTransaction(tx, candidates),
  );

  if (result.reservationIds.length > 0) {
    invalidateLearnerHomeForReservationTransition(
      'ACCEPTED',
      'AWAITING_RESOLUTION',
    );
  }
  await notifyEscalatedDrivers(result.driverNotifications);

  return result.reservationIds;
};
