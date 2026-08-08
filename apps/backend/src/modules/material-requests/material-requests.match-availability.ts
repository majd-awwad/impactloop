import type { Prisma } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';
import { createNotificationIfMissing } from '../notifications/notifications.repository.js';
import {
  computeAvailableQuantity,
  getHeldQuantitiesByMaterialIds,
} from '../reservations/reservations.quantity.js';

const NON_ELIGIBLE_MATERIAL_STATUSES = new Set(['REUSED', 'UNAVAILABLE']);

export type SuggestedMatchAvailabilityRow = {
  id: string;
  status: string;
  materialId: string;
  materialRequestId: string;
  material: {
    status: string;
    quantity: Prisma.Decimal;
  };
};

const isSuggestedMatchMaterialUnavailable = (
  match: SuggestedMatchAvailabilityRow,
  heldQuantity: number | Prisma.Decimal,
): boolean => {
  if (NON_ELIGIBLE_MATERIAL_STATUSES.has(match.material.status)) {
    return true;
  }

  const availableQuantity = computeAvailableQuantity(
    match.material.quantity,
    heldQuantity,
  );
  return availableQuantity.lte(0);
};

/** Read-only SUGGESTED→UNAVAILABLE view for responses without mutating rows. */
export const deriveEffectiveMatchStatus = (
  match: {
    status: string;
    materialId: string;
    material?: {
      status: string;
      quantity: Prisma.Decimal | { toNumber(): number } | number;
    } | null;
  },
  heldQuantity?: number | Prisma.Decimal,
): string => {
  if (match.status !== 'SUGGESTED' || !match.material) {
    return match.status;
  }

  if (NON_ELIGIBLE_MATERIAL_STATUSES.has(match.material.status)) {
    return 'UNAVAILABLE';
  }

  if (heldQuantity !== undefined) {
    const availabilityRow: SuggestedMatchAvailabilityRow = {
      id: '',
      status: match.status,
      materialId: match.materialId,
      materialRequestId: '',
      material: {
        status: match.material.status,
        quantity: match.material.quantity as Prisma.Decimal,
      },
    };
    if (isSuggestedMatchMaterialUnavailable(availabilityRow, heldQuantity)) {
      return 'UNAVAILABLE';
    }
  }

  return match.status;
};

const matchAvailabilitySelect = {
  id: true,
  status: true,
  materialId: true,
  materialRequestId: true,
  createdAt: true,
  materialRequest: {
    select: {
      learnerId: true,
      requestedItemName: true,
    },
  },
  material: {
    select: {
      status: true,
      quantity: true,
    },
  },
} satisfies Prisma.LearnerMaterialRequestMatchSelect;

type MatchAvailabilityCandidate = Prisma.LearnerMaterialRequestMatchGetPayload<{
  select: typeof matchAvailabilitySelect;
}>;

const notifyUnavailableMatch = async (input: {
  matchId: string;
  learnerId: string;
  requestId: string;
  requestedItemName: string;
}) => {
  await createNotificationIfMissing({
    userId: input.learnerId,
    notificationType: 'MATERIAL_REQUEST_MATCH_UNAVAILABLE',
    title: 'Suggested material unavailable',
    body: `A suggested material for your request "${input.requestedItemName}" is no longer available.`,
    relatedEntityType: 'MATERIAL_REQUEST',
    relatedEntityId: input.requestId,
    eventKey: `mr:unavail:${input.matchId}`,
    entityType: 'MATERIAL_REQUEST',
    entityId: input.requestId,
    actionType: 'OPEN_ENTITY',
  });
};

const markUnavailableMatches = async (
  matches: MatchAvailabilityCandidate[],
  heldByMaterial: Map<string, number | Prisma.Decimal>,
): Promise<string[]> => {
  const toMark: MatchAvailabilityCandidate[] = [];
  for (const match of matches) {
    if (match.status !== 'SUGGESTED') {
      continue;
    }
    const held = heldByMaterial.get(match.materialId) ?? 0;
    if (
      isSuggestedMatchMaterialUnavailable(
        {
          id: match.id,
          status: match.status,
          materialId: match.materialId,
          materialRequestId: match.materialRequestId,
          material: match.material,
        },
        held,
      )
    ) {
      toMark.push(match);
    }
  }

  if (toMark.length === 0) {
    return [];
  }

  const matchIds = toMark.map((match) => match.id);
  await prisma.learnerMaterialRequestMatch.updateMany({
    where: { id: { in: matchIds }, status: 'SUGGESTED' },
    data: { status: 'UNAVAILABLE' },
  });

  for (const match of toMark) {
    await notifyUnavailableMatch({
      matchId: match.id,
      learnerId: match.materialRequest.learnerId,
      requestId: match.materialRequestId,
      requestedItemName: match.materialRequest.requestedItemName,
    });
  }

  return matchIds;
};

/**
 * Worker-oriented batch reconciliation for stale SUGGESTED matches.
 */
export const reconcileUnavailableSuggestedMatchesBatch = async (input: {
  batchSize: number;
  cursor?: { createdAt: Date; id: string } | null;
}): Promise<{
  processed: number;
  marked: string[];
  nextCursor: { createdAt: Date; id: string } | null;
}> => {
  const cursor = input.cursor;
  const matches = await prisma.learnerMaterialRequestMatch.findMany({
    where: {
      status: 'SUGGESTED',
      ...(cursor
        ? {
            OR: [
              { createdAt: { gt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { gt: cursor.id } },
            ],
          }
        : {}),
    },
    select: matchAvailabilitySelect,
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
    take: input.batchSize,
  });

  if (matches.length === 0) {
    return { processed: 0, marked: [], nextCursor: null };
  }

  const heldByMaterial = await getHeldQuantitiesByMaterialIds(
    matches.map((match) => match.materialId),
  );
  const marked = await markUnavailableMatches(matches, heldByMaterial);
  const last = matches.at(-1)!;

  return {
    processed: matches.length,
    marked,
    nextCursor: { createdAt: last.createdAt, id: last.id },
  };
};

/**
 * Lazily flips SUGGESTED matches to UNAVAILABLE when the linked material is
 * no longer eligible (REUSED/UNAVAILABLE or zero available quantity).
 * Notifies the learner once per match via eventKey.
 */
export const refreshUnavailableSuggestedMatches = async (input: {
  matches: SuggestedMatchAvailabilityRow[];
  learnerId: string;
  requestedItemName: string;
}): Promise<string[]> => {
  const suggested = input.matches.filter(
    (match) => match.status === 'SUGGESTED',
  );
  if (suggested.length === 0) {
    return [];
  }

  const heldByMaterial = await getHeldQuantitiesByMaterialIds(
    suggested.map((match) => match.materialId),
  );

  const toMark: string[] = [];
  for (const match of suggested) {
    if (isSuggestedMatchMaterialUnavailable(match, heldByMaterial.get(match.materialId) ?? 0)) {
      toMark.push(match.id);
    }
  }

  if (toMark.length === 0) {
    return [];
  }

  await prisma.learnerMaterialRequestMatch.updateMany({
    where: { id: { in: toMark }, status: 'SUGGESTED' },
    data: { status: 'UNAVAILABLE' },
  });

  const requestId = suggested[0]!.materialRequestId;
  for (const matchId of toMark) {
    await notifyUnavailableMatch({
      matchId,
      learnerId: input.learnerId,
      requestId,
      requestedItemName: input.requestedItemName,
    });
  }

  return toMark;
};
