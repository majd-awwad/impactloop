import type { Prisma } from '../../generated/prisma/client.js';

import { ACTIVE_BUILD_ITEM_LINKED_RESERVATION_STATUSES } from './learning-projects.build-reservation.constants.js';
import {
  isReservationLinkedToAnotherBuildItem,
  unitsAreCompatible,
} from './learning-projects.build-material-allocation.js';

export type BuildMaterialRequestSyncOutcome =
  | 'synced'
  | 'already_synced'
  | 'no_build_link'
  | 'conflict'
  | 'invalid_relationship'
  | 'incompatible_unit'
  | 'archived_build'
  | 'build_item_not_found'
  | 'dismissed_allocation';

const isActiveReservationStatus = (status: string) =>
  (ACTIVE_BUILD_ITEM_LINKED_RESERVATION_STATUSES as readonly string[]).includes(
    status,
  );

export type SyncBuildItemFromCompletedMaterialRequestInput = {
  materialRequest: {
    id: string;
    learnerId: string;
    projectBuildId: string | null;
    projectBuildItemId: string | null;
  };
  match: {
    materialRequestId: string;
    materialId: string;
    reservationId: string | null;
  };
  reservation: {
    id: string;
    status: string;
    requesterId: string;
    materialId: string;
  };
};

const isAlreadySynchronized = (input: {
  linkedMaterialId: string | null;
  linkedReservationId: string | null;
  materialId: string;
  reservationId: string;
}) =>
  input.linkedMaterialId === input.materialId &&
  input.linkedReservationId === input.reservationId;

export const syncBuildItemFromCompletedMaterialRequest = async (
  tx: Prisma.TransactionClient,
  input: SyncBuildItemFromCompletedMaterialRequestInput,
): Promise<BuildMaterialRequestSyncOutcome> => {
  const { materialRequest, match, reservation } = input;

  if (!materialRequest.projectBuildId || !materialRequest.projectBuildItemId) {
    return 'no_build_link';
  }

  if (reservation.status !== 'COMPLETED') {
    return 'invalid_relationship';
  }

  if (reservation.requesterId !== materialRequest.learnerId) {
    return 'invalid_relationship';
  }

  if (match.materialRequestId !== materialRequest.id) {
    return 'invalid_relationship';
  }

  if (match.reservationId !== reservation.id) {
    return 'invalid_relationship';
  }

  if (match.materialId !== reservation.materialId) {
    return 'invalid_relationship';
  }

  const buildItem = await tx.projectBuildItem.findFirst({
    where: {
      id: materialRequest.projectBuildItemId,
      buildId: materialRequest.projectBuildId,
      build: {
        learnerId: materialRequest.learnerId,
      },
    },
    select: {
      id: true,
      linkedMaterialId: true,
      linkedReservationId: true,
      dismissedAcquiredReservationId: true,
      requiredComponent: {
        select: {
          unit: true,
          componentRole: true,
        },
      },
      build: {
        select: {
          status: true,
        },
      },
    },
  });

  if (!buildItem) {
    return 'build_item_not_found';
  }

  if (buildItem.build.status === 'ARCHIVED') {
    return 'archived_build';
  }

  if (buildItem.dismissedAcquiredReservationId === reservation.id) {
    return 'dismissed_allocation';
  }

  const reservationLinkedElsewhere = await isReservationLinkedToAnotherBuildItem(
    tx,
    {
      reservationId: reservation.id,
      buildItemId: buildItem.id,
    },
  );

  if (reservationLinkedElsewhere) {
    return 'conflict';
  }

  if (
    isAlreadySynchronized({
      linkedMaterialId: buildItem.linkedMaterialId,
      linkedReservationId: buildItem.linkedReservationId,
      materialId: match.materialId,
      reservationId: reservation.id,
    })
  ) {
    return 'already_synced';
  }

  if (
    buildItem.linkedMaterialId != null &&
    buildItem.linkedMaterialId !== match.materialId
  ) {
    return 'conflict';
  }

  if (
    buildItem.linkedReservationId &&
    buildItem.linkedReservationId !== reservation.id
  ) {
    const linkedReservation = await tx.reservation.findUnique({
      where: { id: buildItem.linkedReservationId },
      select: { status: true },
    });

    if (
      linkedReservation &&
      isActiveReservationStatus(linkedReservation.status)
    ) {
      return 'conflict';
    }
  }

  const now = new Date();
  const { materialId } = match;
  const { id: reservationId } = reservation;

  const material = await tx.material.findUnique({
    where: { id: materialId },
    select: { unit: true },
  });

  if (
    material &&
    buildItem.requiredComponent.componentRole !== 'TOOL' &&
    !unitsAreCompatible(buildItem.requiredComponent.unit, material.unit)
  ) {
    return 'incompatible_unit';
  }

  if (!buildItem.linkedMaterialId && !buildItem.linkedReservationId) {
    const claimed = await tx.projectBuildItem.updateMany({
      where: {
        id: buildItem.id,
        linkedMaterialId: null,
        linkedReservationId: null,
      },
      data: {
        linkedMaterialId: materialId,
        linkedMaterialAt: now,
        linkedReservationId: reservationId,
      },
    });

    if (claimed.count === 1) {
      return 'synced';
    }
  }

  if (buildItem.linkedMaterialId === materialId && !buildItem.linkedReservationId) {
    const claimed = await tx.projectBuildItem.updateMany({
      where: {
        id: buildItem.id,
        linkedMaterialId: materialId,
        linkedReservationId: null,
      },
      data: {
        linkedReservationId: reservationId,
      },
    });

    if (claimed.count === 1) {
      return 'synced';
    }
  }

  if (
    buildItem.linkedMaterialId === materialId &&
    buildItem.linkedReservationId != null &&
    buildItem.linkedReservationId !== reservationId
  ) {
    const previousReservationId = buildItem.linkedReservationId;
    const claimed = await tx.projectBuildItem.updateMany({
      where: {
        id: buildItem.id,
        linkedMaterialId: materialId,
        linkedReservationId: previousReservationId,
      },
      data: {
        linkedReservationId: reservationId,
      },
    });

    if (claimed.count === 1) {
      return 'synced';
    }
  }

  if (!buildItem.linkedMaterialId && buildItem.linkedReservationId != null) {
    const previousReservationId = buildItem.linkedReservationId;
    const claimed = await tx.projectBuildItem.updateMany({
      where: {
        id: buildItem.id,
        linkedMaterialId: null,
        linkedReservationId: previousReservationId,
      },
      data: {
        linkedMaterialId: materialId,
        linkedMaterialAt: now,
        linkedReservationId: reservationId,
      },
    });

    if (claimed.count === 1) {
      return 'synced';
    }
  }

  const refreshed = await tx.projectBuildItem.findUnique({
    where: { id: buildItem.id },
    select: {
      linkedMaterialId: true,
      linkedReservationId: true,
    },
  });

  if (
    refreshed &&
    isAlreadySynchronized({
      linkedMaterialId: refreshed.linkedMaterialId,
      linkedReservationId: refreshed.linkedReservationId,
      materialId,
      reservationId,
    })
  ) {
    return 'already_synced';
  }

  return 'conflict';
};
