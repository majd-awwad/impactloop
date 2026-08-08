import { decimalToNumber } from '../../utils/decimal.js';
import type { LearnerMaterialRequestStatus } from '../../generated/prisma/client.js';
import {
  effectiveRequestStatus,
} from './material-requests.lifecycle.js';
import {
  deriveEffectiveMatchStatus,
} from './material-requests.match-availability.js';
import {
  countActiveSuggestions,
  mapMatchForLearner,
  sortLearnerMatches,
  type LearnerMatchRow,
} from './material-requests.match-display.js';

export type BroadLocationDto = {
  country: string;
  city: string;
  area: string | null;
};

export type AnonymizedProjectContextDto = {
  title: string;
  componentName: string | null;
} | null;

export type RequestRow = {
  id: string;
  learnerId: string;
  categoryId: string;
  requestedItemName: string;
  description: string | null;
  quantity: { toNumber(): number } | number;
  unit: string;
  alternativesAllowed: boolean;
  locationCountry: string;
  locationCity: string;
  locationArea: string | null;
  sourceSavedLocationId: string | null;
  projectId: string | null;
  projectBuildId: string | null;
  projectBuildItemId: string | null;
  status: string;
  neededBy: Date | null;
  expiresAt: Date;
  fulfilledAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  category?: { id: string; nameEn: string; nameAr: string } | null;
  project?: { id: string; title: string } | null;
  projectBuildItem?: {
    id: string;
    requiredComponent?: { componentName: string } | null;
  } | null;
  matches?: LearnerMatchRow[];
  _count?: { matches: number };
};

const toQuantity = (value: { toNumber(): number } | number) =>
  typeof value === 'number' ? value : decimalToNumber(value);

export const mapBroadLocation = (row: {
  locationCountry: string;
  locationCity: string;
  locationArea: string | null;
}): BroadLocationDto => ({
  country: row.locationCountry,
  city: row.locationCity,
  area: row.locationArea,
});

export const mapAnonymizedProjectContext = (
  row: RequestRow,
): AnonymizedProjectContextDto => {
  if (!row.project) {
    return null;
  }
  return {
    title: row.project.title,
    componentName:
      row.projectBuildItem?.requiredComponent?.componentName ?? null,
  };
};

export const mapLearnerRequest = (
  row: RequestRow,
  options?: {
    includeMatches?: boolean;
    heldByMaterialId?: Map<string, number>;
  },
) => {
  const effectiveStatus = effectiveRequestStatus({
    status: row.status as LearnerMaterialRequestStatus,
    expiresAt: row.expiresAt,
  });
  const activeSuggestionCount = countActiveSuggestions(
    row.matches ?? [],
    effectiveStatus,
    options?.heldByMaterialId,
  );
  const mappedMatches =
    options?.includeMatches === false
      ? undefined
      : sortLearnerMatches(
          (row.matches ?? []).map((match) =>
            mapMatchForLearner(match, effectiveStatus, {
              heldQuantity: options?.heldByMaterialId?.get(match.materialId),
            }),
          ),
        );

  return {
  id: row.id,
  categoryId: row.categoryId,
  categoryNameEn: row.category?.nameEn ?? null,
  categoryNameAr: row.category?.nameAr ?? null,
  requestedItemName: row.requestedItemName,
  description: row.description,
  quantity: toQuantity(row.quantity),
  unit: row.unit,
  alternativesAllowed: row.alternativesAllowed,
  location: mapBroadLocation(row),
  sourceSavedLocationId: row.sourceSavedLocationId,
  projectId: row.projectId,
  projectBuildId: row.projectBuildId,
  projectBuildItemId: row.projectBuildItemId,
  projectContext: mapAnonymizedProjectContext(row),
  status: effectiveStatus,
  neededBy: row.neededBy?.toISOString() ?? null,
  expiresAt: row.expiresAt.toISOString(),
  fulfilledAt: row.fulfilledAt?.toISOString() ?? null,
  cancelledAt: row.cancelledAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  suggestionCount: activeSuggestionCount || row._count?.matches || 0,
  activeSuggestionCount,
  matches: mappedMatches,
};
};

export const mapSupplierRequest = (
  row: RequestRow,
  options: {
    supplierUserId: string;
    includeOwnMatches?: boolean;
    heldByMaterialId?: Map<string, number>;
  },
) => {
  const effectiveStatus = effectiveRequestStatus({
    status: row.status as LearnerMaterialRequestStatus,
    expiresAt: row.expiresAt,
  });
  const ownMatches = (row.matches ?? []).filter(
    (match) => match.supplierUserId === options.supplierUserId,
  );
  return {
    id: row.id,
    categoryId: row.categoryId,
    categoryNameEn: row.category?.nameEn ?? null,
    categoryNameAr: row.category?.nameAr ?? null,
    requestedItemName: row.requestedItemName,
    description: row.description,
    quantity: toQuantity(row.quantity),
    unit: row.unit,
    alternativesAllowed: row.alternativesAllowed,
    location: mapBroadLocation(row),
    projectContext: mapAnonymizedProjectContext(row),
    status: effectiveStatus,
    neededBy: row.neededBy?.toISOString() ?? null,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    suggestionCount: row._count?.matches ?? row.matches?.length ?? 0,
    respondedByMe: ownMatches.length > 0,
    ownMatches: options.includeOwnMatches
      ? ownMatches.map((match) => ({
          id: match.id,
          materialId: match.materialId,
          status: deriveEffectiveMatchStatus(match, options.heldByMaterialId?.get(match.materialId)),
          matchReasonCode: match.matchReasonCode,
          rankingScore: match.rankingScore,
          reservationId: match.reservationId,
          createdAt: match.createdAt.toISOString(),
          materialTitle: match.material?.title ?? null,
        }))
      : undefined,
  };
};
