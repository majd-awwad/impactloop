import { prisma } from '../../database/prisma.js';

import {
  isUnsuccessfulTerminalReservationStatus,
  syncBuildItemFromReservationStatus,
} from './learning-projects.build-reservation-sync.js';

export const reconcileTerminalLinkedReservationsForBuild = async (
  projectBuildId: string,
  learnerId: string,
) => {
  const items = await prisma.projectBuildItem.findMany({
    where: {
      buildId: projectBuildId,
      linkedReservationId: { not: null },
      build: {
        learnerId,
        status: { not: 'ARCHIVED' },
      },
    },
    select: {
      id: true,
      linkedReservationId: true,
      linkedReservation: {
        select: {
          id: true,
          status: true,
        },
      },
    },
    take: 50,
  });

  let repairedCount = 0;

  for (const item of items) {
    const reservation = item.linkedReservation;
    if (!reservation || !item.linkedReservationId) {
      continue;
    }

    if (!isUnsuccessfulTerminalReservationStatus(reservation.status)) {
      continue;
    }

    const outcome = await prisma.$transaction((tx) =>
      syncBuildItemFromReservationStatus(tx, {
        reservationId: reservation.id,
        reservationStatus: reservation.status,
      }),
    );

    if (outcome === 'terminal_reservation_cleared') {
      repairedCount += 1;
    }
  }

  return { repairedCount };
};
