import type { Prisma, ReservationStatus } from '../../generated/prisma/client.js';

import { ACTIVE_BUILD_ITEM_LINKED_RESERVATION_STATUSES } from './learning-projects.build-reservation.constants.js';

export const UNSUCCESSFUL_TERMINAL_RESERVATION_STATUSES = [
  'CANCELLED',
  'REJECTED',
  'EXPIRED',
  'NO_SHOW',
  'FULFILLMENT_FAILED',
] as const satisfies readonly ReservationStatus[];

const ACTIVE_RESERVATION_STATUSES = new Set<ReservationStatus>(
  ACTIVE_BUILD_ITEM_LINKED_RESERVATION_STATUSES,
);

const UNSUCCESSFUL_TERMINAL_SET = new Set<ReservationStatus>(
  UNSUCCESSFUL_TERMINAL_RESERVATION_STATUSES,
);

export type BuildReservationSyncOutcome =
  | 'completed_preserved'
  | 'active_preserved'
  | 'awaiting_resolution'
  | 'terminal_reservation_cleared'
  | 'already_consistent'
  | 'stale_event'
  | 'conflict'
  | 'no_build_item'
  | 'archived_build';

export const isUnsuccessfulTerminalReservationStatus = (status: ReservationStatus) =>
  UNSUCCESSFUL_TERMINAL_SET.has(status);

export const syncBuildItemFromReservationStatus = async (
  tx: Prisma.TransactionClient,
  input: {
    reservationId: string;
    reservationStatus: ReservationStatus;
  },
): Promise<BuildReservationSyncOutcome> => {
  const { reservationId, reservationStatus } = input;

  if (reservationStatus === 'COMPLETED') {
    const buildItem = await tx.projectBuildItem.findFirst({
      where: { linkedReservationId: reservationId },
      select: {
        id: true,
        build: { select: { status: true } },
      },
    });

    if (!buildItem) {
      return 'no_build_item';
    }

    if (buildItem.build.status === 'ARCHIVED') {
      return 'archived_build';
    }

    return 'completed_preserved';
  }

  if (reservationStatus === 'AWAITING_RESOLUTION') {
    const buildItem = await tx.projectBuildItem.findFirst({
      where: { linkedReservationId: reservationId },
      select: {
        id: true,
        linkedReservationId: true,
        build: { select: { status: true } },
      },
    });

    if (!buildItem) {
      return 'no_build_item';
    }

    if (buildItem.build.status === 'ARCHIVED') {
      return 'archived_build';
    }

    if (buildItem.linkedReservationId !== reservationId) {
      return 'stale_event';
    }

    return 'awaiting_resolution';
  }

  if (ACTIVE_RESERVATION_STATUSES.has(reservationStatus)) {
    const buildItem = await tx.projectBuildItem.findFirst({
      where: { linkedReservationId: reservationId },
      select: {
        id: true,
        linkedReservationId: true,
        build: { select: { status: true } },
      },
    });

    if (!buildItem) {
      return 'no_build_item';
    }

    if (buildItem.build.status === 'ARCHIVED') {
      return 'archived_build';
    }

    if (buildItem.linkedReservationId !== reservationId) {
      return 'stale_event';
    }

    return 'active_preserved';
  }

  if (!isUnsuccessfulTerminalReservationStatus(reservationStatus)) {
    return 'already_consistent';
  }

  const buildItem = await tx.projectBuildItem.findFirst({
    where: { linkedReservationId: reservationId },
    select: {
      id: true,
      linkedMaterialId: true,
      linkedReservationId: true,
      build: { select: { status: true } },
    },
  });

  if (!buildItem) {
    if (isUnsuccessfulTerminalReservationStatus(reservationStatus)) {
      return 'already_consistent';
    }

    return 'no_build_item';
  }

  if (buildItem.build.status === 'ARCHIVED') {
    return 'archived_build';
  }

  if (buildItem.linkedReservationId !== reservationId) {
    return 'already_consistent';
  }

  const claimed = await tx.projectBuildItem.updateMany({
    where: {
      id: buildItem.id,
      linkedReservationId: reservationId,
    },
    data: {
      linkedReservationId: null,
    },
  });

  if (claimed.count === 1) {
    return 'terminal_reservation_cleared';
  }

  const refreshed = await tx.projectBuildItem.findUnique({
    where: { id: buildItem.id },
    select: { linkedReservationId: true },
  });

  if (!refreshed?.linkedReservationId) {
    return 'already_consistent';
  }

  if (refreshed.linkedReservationId !== reservationId) {
    return 'stale_event';
  }

  return 'conflict';
};

export const syncLinkedBuildItemFromReservationInTransaction = async (
  tx: Prisma.TransactionClient,
  reservationId: string,
): Promise<BuildReservationSyncOutcome> => {
  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
    select: { id: true, status: true },
  });

  if (!reservation) {
    return 'no_build_item';
  }

  return syncBuildItemFromReservationStatus(tx, {
    reservationId: reservation.id,
    reservationStatus: reservation.status,
  });
};

export const applyBuildReservationSyncInTransaction = async (
  tx: Prisma.TransactionClient,
  reservationId: string,
): Promise<void> => {
  await syncLinkedBuildItemFromReservationInTransaction(tx, reservationId);
};
