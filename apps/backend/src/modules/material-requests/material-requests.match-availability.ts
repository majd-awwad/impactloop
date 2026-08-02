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
    if (NON_ELIGIBLE_MATERIAL_STATUSES.has(match.material.status)) {
      toMark.push(match.id);
      continue;
    }
    const availableQuantity = computeAvailableQuantity(
      match.material.quantity,
      heldByMaterial.get(match.materialId) ?? 0,
    );
    if (availableQuantity.lte(0)) {
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
    await createNotificationIfMissing({
      userId: input.learnerId,
      notificationType: 'MATERIAL_REQUEST_MATCH_UNAVAILABLE',
      title: 'Suggested material unavailable',
      body: `A suggested material for your request "${input.requestedItemName}" is no longer available.`,
      relatedEntityType: 'MATERIAL_REQUEST',
      relatedEntityId: requestId,
      eventKey: `mr:unavail:${matchId}`,
      entityType: 'MATERIAL_REQUEST',
      entityId: requestId,
      actionType: 'OPEN_ENTITY',
    });
  }

  return toMark;
};
