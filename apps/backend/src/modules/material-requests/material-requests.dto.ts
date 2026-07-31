import { decimalToNumber } from '../../utils/decimal.js';

export type BroadLocationDto = {
  country: string;
  city: string;
  area: string | null;
};

export type AnonymizedProjectContextDto = {
  title: string;
  componentName: string | null;
} | null;

type RequestRow = {
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
  matches?: MatchRow[];
  _count?: { matches: number };
};

type MatchRow = {
  id: string;
  materialRequestId: string;
  materialId: string;
  supplierUserId: string;
  status: string;
  matchReasonCode: string | null;
  rankingScore: number | null;
  reservationId: string | null;
  createdAt: Date;
  updatedAt: Date;
  material?: {
    id: string;
    title: string;
    status: string;
    quantity: { toNumber(): number } | number;
    unit: string;
    pickupAllowed: boolean;
    deliveryAllowed: boolean;
    location?: { city: string; area: string | null } | null;
    owner?: {
      displayName: string;
      supplierProfile?: { publicName: string | null } | null;
    } | null;
  } | null;
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

export const mapMatchForLearner = (match: MatchRow) => ({
  id: match.id,
  materialRequestId: match.materialRequestId,
  materialId: match.materialId,
  status: match.status,
  matchReasonCode: match.matchReasonCode,
  rankingScore: match.rankingScore,
  reservationId: match.reservationId,
  createdAt: match.createdAt.toISOString(),
  updatedAt: match.updatedAt.toISOString(),
  material: match.material
    ? {
        id: match.material.id,
        title: match.material.title,
        status: match.material.status,
        quantity: toQuantity(match.material.quantity),
        unit: match.material.unit,
        pickupAllowed: match.material.pickupAllowed,
        deliveryAllowed: match.material.deliveryAllowed,
        location: match.material.location
          ? {
              city: match.material.location.city,
              area: match.material.location.area,
            }
          : null,
        supplierPublicName:
          match.material.owner?.supplierProfile?.publicName ??
          match.material.owner?.displayName ??
          null,
      }
    : null,
});

export const mapLearnerRequest = (
  row: RequestRow,
  options?: { includeMatches?: boolean },
) => ({
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
  status: row.status,
  neededBy: row.neededBy?.toISOString() ?? null,
  expiresAt: row.expiresAt.toISOString(),
  fulfilledAt: row.fulfilledAt?.toISOString() ?? null,
  cancelledAt: row.cancelledAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  suggestionCount: row._count?.matches ?? row.matches?.length ?? 0,
  matches:
    options?.includeMatches === false
      ? undefined
      : (row.matches ?? []).map(mapMatchForLearner),
});

export const mapSupplierRequest = (
  row: RequestRow,
  options: { supplierUserId: string; includeOwnMatches?: boolean },
) => {
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
    status: row.status,
    neededBy: row.neededBy?.toISOString() ?? null,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    suggestionCount: row._count?.matches ?? row.matches?.length ?? 0,
    respondedByMe: ownMatches.length > 0,
    ownMatches: options.includeOwnMatches
      ? ownMatches.map((match) => ({
          id: match.id,
          materialId: match.materialId,
          status: match.status,
          matchReasonCode: match.matchReasonCode,
          rankingScore: match.rankingScore,
          reservationId: match.reservationId,
          createdAt: match.createdAt.toISOString(),
          materialTitle: match.material?.title ?? null,
        }))
      : undefined,
  };
};
