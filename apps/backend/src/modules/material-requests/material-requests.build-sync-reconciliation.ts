import { prisma } from '../../database/prisma.js';
import type {
  LearnerMaterialRequestStatus,
  ReservationStatus,
} from '../../generated/prisma/client.js';

import type { BuildMaterialRequestSyncOutcome } from '../learning-projects/learning-projects.build-material-request-sync.js';

export type ReconcileFulfilledRequestBuildSyncResult = {
  attempted: boolean;
  repaired: boolean;
  buildSyncOutcome: BuildMaterialRequestSyncOutcome | null;
};

const isBuildItemSyncedWithMatch = (input: {
  linkedMaterialId: string | null;
  linkedReservationId: string | null;
  materialId: string;
  reservationId: string;
}) =>
  input.linkedMaterialId === input.materialId &&
  input.linkedReservationId === input.reservationId;

export const findCompletedReservationMatchForFulfilledRequest = (input: {
  status: LearnerMaterialRequestStatus;
  matches: Array<{
    materialId: string;
    reservationId: string | null;
    reservation?: {
      id: string;
      status: ReservationStatus;
      materialId: string;
    } | null;
  }>;
}) => {
  if (input.status !== 'FULFILLED') {
    return null;
  }

  const completedMatches = input.matches.filter(
    (match) =>
      match.reservationId &&
      match.reservation?.status === 'COMPLETED' &&
      match.reservation.id === match.reservationId &&
      match.reservation.materialId === match.materialId,
  );

  return completedMatches.length === 1 ? completedMatches[0]! : null;
};

export const needsFulfilledRequestBuildSync = async (input: {
  learnerId: string;
  projectBuildId: string | null;
  projectBuildItemId: string | null;
  completedMatch: {
    materialId: string;
    reservationId: string;
  };
}) => {
  if (!input.projectBuildId || !input.projectBuildItemId) {
    return false;
  }

  const buildItem = await prisma.projectBuildItem.findFirst({
    where: {
      id: input.projectBuildItemId,
      buildId: input.projectBuildId,
      build: {
        learnerId: input.learnerId,
      },
    },
    select: {
      linkedMaterialId: true,
      linkedReservationId: true,
      dismissedAcquiredReservationId: true,
    },
  });

  if (!buildItem) {
    return false;
  }

  if (buildItem.dismissedAcquiredReservationId === input.completedMatch.reservationId) {
    return false;
  }

  return !isBuildItemSyncedWithMatch({
    linkedMaterialId: buildItem.linkedMaterialId,
    linkedReservationId: buildItem.linkedReservationId,
    materialId: input.completedMatch.materialId,
    reservationId: input.completedMatch.reservationId,
  });
};

export const reconcileFulfilledRequestBuildSync = async (
  requestId: string,
  learnerId: string,
  fulfillRequestFromCompletedReservation: (
    reservationId: string,
  ) => Promise<{
    buildSyncOutcome: BuildMaterialRequestSyncOutcome;
  } | null>,
): Promise<ReconcileFulfilledRequestBuildSyncResult> => {
  const request = await prisma.learnerMaterialRequest.findFirst({
    where: { id: requestId, learnerId },
    select: {
      id: true,
      status: true,
      learnerId: true,
      projectBuildId: true,
      projectBuildItemId: true,
      matches: {
        where: { reservationId: { not: null } },
        select: {
          materialId: true,
          reservationId: true,
          reservation: {
            select: {
              id: true,
              status: true,
              materialId: true,
            },
          },
        },
      },
    },
  });

  if (!request) {
    return { attempted: false, repaired: false, buildSyncOutcome: null };
  }

  const completedMatch = findCompletedReservationMatchForFulfilledRequest(
    request,
  );
  if (!completedMatch?.reservationId) {
    return { attempted: false, repaired: false, buildSyncOutcome: null };
  }

  const needsSync = await needsFulfilledRequestBuildSync({
    learnerId: request.learnerId,
    projectBuildId: request.projectBuildId,
    projectBuildItemId: request.projectBuildItemId,
    completedMatch: {
      materialId: completedMatch.materialId,
      reservationId: completedMatch.reservationId,
    },
  });

  if (!needsSync) {
    return {
      attempted: false,
      repaired: false,
      buildSyncOutcome: 'already_synced',
    };
  }

  const result = await fulfillRequestFromCompletedReservation(
    completedMatch.reservationId,
  );

  return {
    attempted: true,
    repaired: result?.buildSyncOutcome === 'synced',
    buildSyncOutcome: result?.buildSyncOutcome ?? null,
  };
};

export const reconcileProjectBuildMaterialRequestSync = async (
  projectBuildId: string,
  learnerId: string,
  fulfillRequestFromCompletedReservation: (
    reservationId: string,
  ) => Promise<{
    buildSyncOutcome: BuildMaterialRequestSyncOutcome;
  } | null>,
) => {
  const requests = await prisma.learnerMaterialRequest.findMany({
    where: {
      projectBuildId,
      learnerId,
      status: 'FULFILLED',
      projectBuildItemId: { not: null },
    },
    select: { id: true },
    take: 20,
  });

  let repairedCount = 0;
  for (const request of requests) {
    const outcome = await reconcileFulfilledRequestBuildSync(
      request.id,
      learnerId,
      fulfillRequestFromCompletedReservation,
    );
    if (outcome.repaired) {
      repairedCount += 1;
    }
  }

  return { repairedCount };
};

export const reconcileStaleFulfilledBuildSyncBatch = async (
  fulfillRequestFromCompletedReservation: (
    reservationId: string,
  ) => Promise<{
    buildSyncOutcome: BuildMaterialRequestSyncOutcome;
  } | null>,
  input: {
    batchSize: number;
    cursor?: { updatedAt: Date; id: string } | null;
  },
): Promise<{
  processed: number;
  repairedCount: number;
  nextCursor: { updatedAt: Date; id: string } | null;
}> => {
  const cursor = input.cursor;
  const requests = await prisma.learnerMaterialRequest.findMany({
    where: {
      status: 'FULFILLED',
      projectBuildItemId: { not: null },
      ...(cursor
        ? {
            OR: [
              { updatedAt: { gt: cursor.updatedAt } },
              { updatedAt: cursor.updatedAt, id: { gt: cursor.id } },
            ],
          }
        : {}),
    },
    select: { id: true, learnerId: true, updatedAt: true },
    orderBy: [{ updatedAt: 'asc' as const }, { id: 'asc' as const }],
    take: input.batchSize,
  });

  if (requests.length === 0) {
    return { processed: 0, repairedCount: 0, nextCursor: null };
  }

  let repairedCount = 0;
  for (const request of requests) {
    const outcome = await reconcileFulfilledRequestBuildSync(
      request.id,
      request.learnerId,
      fulfillRequestFromCompletedReservation,
    );
    if (outcome.repaired) {
      repairedCount += 1;
    }
  }

  const last = requests.at(-1)!;
  return {
    processed: requests.length,
    repairedCount,
    nextCursor: { updatedAt: last.updatedAt, id: last.id },
  };
};
