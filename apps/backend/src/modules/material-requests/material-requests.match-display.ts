import type {
  LearnerMaterialRequestMatchStatus,
  LearnerMaterialRequestStatus,
  MaterialStatus,
  ReservationStatus,
} from '../../generated/prisma/client.js';
import { decimalToNumber } from '../../utils/decimal.js';
import { cardMaterialImageUrl } from '../../utils/material-image-url.js';
import { isPublicMaterialStatus } from '../materials/public-material-visibility.js';
import { deriveEffectiveMatchStatus } from './material-requests.match-availability.js';

type MatchMaterialRow = {
  id: string;
  title: string;
  status: MaterialStatus;
  quantity: { toNumber(): number } | number;
  unit: string;
  condition: string;
  isFree: boolean;
  price: { toNumber(): number } | number | null;
  currency: string;
  pickupAllowed: boolean;
  deliveryAllowed: boolean;
  location?: { city: string; area: string | null } | null;
  images?: { imageUrl: string; isCover: boolean }[];
  supplierProfile?: {
    publicName: string | null;
    avatarImageUrl: string | null;
    verificationStatus: string;
    defaultPickupLocation?: { city: string; area: string | null } | null;
  } | null;
  owner?: {
    displayName: string;
    profileImageUrl: string | null;
    email?: string;
    phone?: string;
  } | null;
};

export type LearnerMatchRow = {
  id: string;
  materialRequestId: string;
  materialId: string;
  supplierUserId: string;
  status: LearnerMaterialRequestMatchStatus;
  matchReasonCode: string | null;
  rankingScore: number | null;
  reservationId: string | null;
  createdAt: Date;
  updatedAt: Date;
  material?: MatchMaterialRow | null;
  reservation?: { id: string; status: ReservationStatus } | null;
};

const toQuantity = (value: { toNumber(): number } | number) =>
  typeof value === 'number' ? value : decimalToNumber(value);

const resolvePrimaryImageUrl = (material: MatchMaterialRow) => {
  const images = material.images ?? [];
  const cover = images.find((image) => image.isCover);
  const original = cover?.imageUrl ?? images[0]?.imageUrl ?? null;
  return original ? cardMaterialImageUrl(original) : null;
};

const resolveSupplierDisplayName = (material: MatchMaterialRow) =>
  material.supplierProfile?.publicName?.trim() ||
  material.owner?.displayName?.trim() ||
  null;

const resolveSupplierAvatarUrl = (material: MatchMaterialRow) =>
  material.supplierProfile?.avatarImageUrl ??
  material.owner?.profileImageUrl ??
  null;

const resolveSupplierCity = (material: MatchMaterialRow) =>
  material.location?.city ??
  material.supplierProfile?.defaultPickupLocation?.city ??
  null;

const resolveSupplierArea = (material: MatchMaterialRow) =>
  material.location?.area ??
  material.supplierProfile?.defaultPickupLocation?.area ??
  null;

const isSupplierVerified = (verificationStatus: string | null | undefined) => {
  const normalized = verificationStatus?.trim().toUpperCase();
  return normalized === 'APPROVED' || normalized === 'VERIFIED';
};

export const deriveMatchReserveEligibility = (input: {
  matchStatus: LearnerMaterialRequestMatchStatus;
  requestStatus: LearnerMaterialRequestStatus;
  materialStatus?: MaterialStatus | null;
  reservationId?: string | null;
}) => {
  if (input.reservationId) {
    return {
      canReserve: false as const,
      unavailableReason: null,
    };
  }

  if (input.matchStatus === 'RESERVATION_CREATED') {
    return {
      canReserve: false as const,
      unavailableReason: null,
    };
  }

  if (input.matchStatus === 'DISMISSED') {
    return {
      canReserve: false as const,
      unavailableReason: 'DISMISSED' as const,
    };
  }

  if (input.matchStatus === 'UNAVAILABLE') {
    return {
      canReserve: false as const,
      unavailableReason: 'NO_LONGER_AVAILABLE' as const,
    };
  }

  if (input.matchStatus !== 'SUGGESTED') {
    return {
      canReserve: false as const,
      unavailableReason: 'NOT_SUGGESTED' as const,
    };
  }

  if (input.requestStatus !== 'OPEN') {
    return {
      canReserve: false as const,
      unavailableReason: 'REQUEST_CLOSED' as const,
    };
  }

  if (!isPublicMaterialStatus(input.materialStatus)) {
    return {
      canReserve: false as const,
      unavailableReason: 'NO_LONGER_AVAILABLE' as const,
    };
  }

  return {
    canReserve: true as const,
    unavailableReason: null,
  };
};

export const sortLearnerMatches = <T extends { canReserve: boolean; status: LearnerMaterialRequestMatchStatus; reservationId?: string | null; createdAt: string }>(
  matches: T[],
) =>
  [...matches].sort((left, right) => {
    const priority = (match: T) => {
      if (match.canReserve) {
        return 0;
      }
      if (match.reservationId || match.status === 'RESERVATION_CREATED') {
        return 1;
      }
      if (match.status === 'SUGGESTED') {
        return 2;
      }
      return 3;
    };

    const priorityDiff = priority(left) - priority(right);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return right.createdAt.localeCompare(left.createdAt);
  });

export const mapMatchForLearner = (
  match: LearnerMatchRow,
  requestStatus: LearnerMaterialRequestStatus,
  options?: { heldQuantity?: number },
) => {
  const effectiveMatchStatus = deriveEffectiveMatchStatus(match, options?.heldQuantity);
  const material = match.material;
  const eligibility = deriveMatchReserveEligibility({
    matchStatus: effectiveMatchStatus,
    requestStatus,
    materialStatus: material?.status,
    reservationId: match.reservationId,
  });
  const reservationStatus = match.reservation?.status ?? null;
  const isAcquired =
    requestStatus === 'FULFILLED' &&
    match.reservationId != null &&
    reservationStatus === 'COMPLETED';

  return {
    id: match.id,
    materialRequestId: match.materialRequestId,
    materialId: match.materialId,
    status: effectiveMatchStatus,
    matchReasonCode: match.matchReasonCode,
    rankingScore: match.rankingScore,
    reservationId: match.reservationId,
    reservationStatus,
    isAcquired,
    canReserve: eligibility.canReserve,
    unavailableReason: eligibility.unavailableReason,
    createdAt: match.createdAt.toISOString(),
    updatedAt: match.updatedAt.toISOString(),
    material: material
      ? {
          id: material.id,
          title: material.title,
          status: material.status,
          quantity: toQuantity(material.quantity),
          unit: material.unit,
          condition: material.condition,
          isFree: material.isFree,
          price: material.price == null ? null : decimalToNumber(material.price),
          currency: material.currency,
          pickupAllowed: material.pickupAllowed,
          deliveryAllowed: material.deliveryAllowed,
          imageUrl: resolvePrimaryImageUrl(material),
          location: material.location
            ? {
                city: material.location.city,
                area: material.location.area,
              }
            : null,
          supplierPublicName: resolveSupplierDisplayName(material),
        }
      : null,
    supplier: material
      ? {
          displayName: resolveSupplierDisplayName(material),
          avatarUrl: resolveSupplierAvatarUrl(material),
          city: resolveSupplierCity(material),
          area: resolveSupplierArea(material),
          isVerified: isSupplierVerified(
            material.supplierProfile?.verificationStatus,
          ),
        }
      : null,
  };
};

export const countActiveSuggestions = (
  matches: Array<{
    status: LearnerMaterialRequestMatchStatus;
    materialId: string;
    material?: MatchMaterialRow | null;
  }>,
  _requestStatus?: LearnerMaterialRequestStatus,
  heldByMaterialId?: Map<string, number>,
) =>
  matches.filter((match) => {
    const effectiveStatus = deriveEffectiveMatchStatus(
      match,
      heldByMaterialId?.get(match.materialId),
    );
    return effectiveStatus === 'SUGGESTED';
  }).length;
