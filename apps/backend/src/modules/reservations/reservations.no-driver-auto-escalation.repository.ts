import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';

import {
  isNoDriverAutoEscalationDue,
  noDriverAutoEscalationNote,
} from './reservation-no-driver-auto-escalation.js';
import { NO_DRIVER_AUTO_ESCALATION_HOURS } from './reservation-timing-policy.js';
import { escalateNoDriverAvailableInTransaction } from './reservations.incidents.repository.js';
import { formatReservationHistoryNote } from './reservation-status-history.js';
import { runSerializableTransaction } from './reservations.quantity.js';
import { invalidateLearnerHomeForReservationTransition } from '../learner-home/learner-home.service.js';

const noDriverEscalationSelect = {
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
    where: {
      targetRole: 'SYSTEM',
      reasonCode: 'NO_DRIVER_AVAILABLE',
    },
    select: { id: true },
    take: 1,
  },
} satisfies Prisma.ReservationSelect;

export type NoDriverEscalationReservationRecord = Prisma.ReservationGetPayload<{
  select: typeof noDriverEscalationSelect;
}>;

const noDriverEscalationCutoff = (now: Date = new Date()) =>
  new Date(
    now.getTime() - NO_DRIVER_AUTO_ESCALATION_HOURS * 60 * 60 * 1000,
  );

const toEscalationRecord = (
  reservation: NoDriverEscalationReservationRecord,
) => {
  const delivery = reservation.deliveries[0] ?? null;

  return {
    status: reservation.status,
    fulfillmentMethod: reservation.fulfillmentMethod,
    supplierPickupWindowEnd: reservation.supplierPickupWindowEnd,
    deliveryStatus: delivery?.status ?? null,
    assignedDriverProfileId: delivery?.assignedDriverProfileId ?? null,
    hasNoDriverReport: reservation.noShowReports.length > 0,
  };
};

export const escalateStaleNoDriverDeliveriesInTransaction = async (
  tx: Prisma.TransactionClient,
  reservations: NoDriverEscalationReservationRecord[],
  now: Date = new Date(),
): Promise<string[]> => {
  const escalatedIds: string[] = [];

  for (const reservation of reservations) {
    if (!isNoDriverAutoEscalationDue(toEscalationRecord(reservation), now)) {
      continue;
    }

    const delivery = reservation.deliveries[0];

    if (!delivery) {
      continue;
    }

    const result = await escalateNoDriverAvailableInTransaction(tx, {
      reservation,
      delivery,
      reporterUserId: reservation.requesterId,
      changedBy: null,
      note: noDriverAutoEscalationNote(),
      deliveryHistoryNote: 'No driver auto-escalated',
      reservationHistoryNote: formatReservationHistoryNote('NO_DRIVER_AUTO_ESCALATED'),
    });

    if (result.created) {
      escalatedIds.push(reservation.id);
    }
  }

  return escalatedIds;
};

const findNoDriverEscalationCandidates = async (
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
        lte: noDriverEscalationCutoff(now),
      },
      deliveries: {
        some: {
          status: 'WAITING_FOR_DRIVER',
          assignedDriverProfileId: null,
        },
      },
      noShowReports: {
        none: {
          targetRole: 'SYSTEM',
          reasonCode: 'NO_DRIVER_AVAILABLE',
        },
      },
    },
    select: noDriverEscalationSelect,
  });

export const escalateStaleNoDriverDeliveriesByIds = async (
  reservationIds: string[],
): Promise<string[]> => {
  if (reservationIds.length === 0) {
    return [];
  }

  const candidates = await findNoDriverEscalationCandidates(prisma, {
    id: { in: reservationIds },
  });

  if (candidates.length === 0) {
    return [];
  }

  const escalatedIds = await runSerializableTransaction(async (tx) =>
    escalateStaleNoDriverDeliveriesInTransaction(tx, candidates),
  );

  if (escalatedIds.length > 0) {
    invalidateLearnerHomeForReservationTransition(
      'ACCEPTED',
      'AWAITING_RESOLUTION',
    );
  }

  return escalatedIds;
};

export const escalateStaleNoDriverDeliveriesForRequester = async (
  requesterId: string,
): Promise<string[]> => {
  const candidates = await findNoDriverEscalationCandidates(prisma, {
    requesterId,
  });

  if (candidates.length === 0) {
    return [];
  }

  const escalatedIds = await runSerializableTransaction(async (tx) =>
    escalateStaleNoDriverDeliveriesInTransaction(tx, candidates),
  );

  if (escalatedIds.length > 0) {
    invalidateLearnerHomeForReservationTransition(
      'ACCEPTED',
      'AWAITING_RESOLUTION',
    );
  }

  return escalatedIds;
};

export const escalateStaleNoDriverDeliveriesForOwner = async (
  ownerId: string,
): Promise<string[]> => {
  const candidates = await findNoDriverEscalationCandidates(prisma, {
    ownerId,
  });

  if (candidates.length === 0) {
    return [];
  }

  const escalatedIds = await runSerializableTransaction(async (tx) =>
    escalateStaleNoDriverDeliveriesInTransaction(tx, candidates),
  );

  if (escalatedIds.length > 0) {
    invalidateLearnerHomeForReservationTransition(
      'ACCEPTED',
      'AWAITING_RESOLUTION',
    );
  }

  return escalatedIds;
};
