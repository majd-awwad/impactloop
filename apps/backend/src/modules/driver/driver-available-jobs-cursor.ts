import { AppError } from '../../utils/app-error.js';
import type { ListAvailableDeliveriesQuery } from './driver.validation.js';
import {
  metersToKm,
  roundPresentationDistanceKm,
} from './driver-available-jobs-distance.js';

export type AvailableJobsSortBy = 'nearest' | 'newest';

/**
 * v2 cursor: PostGIS geography meters as the nearest ordering key.
 * v1 (km-rounded) cursors are rejected fail-closed for nearest continuation.
 */
export type AvailableJobsCursorPayload = {
  v: 2;
  sortBy: AvailableJobsSortBy;
  city: string | null;
  area: string | null;
  maxDistanceKm: number | null;
  requestedAt: string;
  /** Canonical KNN meters from `location <-> reference`; null when no geography. */
  distanceMeters: number | null;
  /** Presentation helper only; not used as the ordering key. */
  distanceKm: number | null;
  id: string;
  /** Driver reference coordinates bound into nearest cursors. */
  refLat: number | null;
  refLng: number | null;
};

export type AvailableJobsCursorFilters = {
  sortBy: AvailableJobsSortBy;
  city?: string;
  area?: string;
  maxDistanceKm?: number;
  refLat?: number | null;
  refLng?: number | null;
};

const normalizeOptional = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const roundRefCoord = (value: number | null | undefined): number | null => {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  return Math.round(value * 1e7) / 1e7;
};

export const encodeAvailableJobsCursor = (
  payload: AvailableJobsCursorPayload,
): string => Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');

export const decodeAvailableJobsCursor = (
  raw: string,
): AvailableJobsCursorPayload | null => {
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf8'),
    ) as Partial<AvailableJobsCursorPayload> & { v?: number };

    // Nearest/newest continuation requires v2 meters + reference binding.
    if (parsed.v !== 2) {
      return null;
    }

    if (
      (parsed.sortBy !== 'nearest' && parsed.sortBy !== 'newest') ||
      typeof parsed.requestedAt !== 'string' ||
      typeof parsed.id !== 'string' ||
      !parsed.id.trim() ||
      Number.isNaN(Date.parse(parsed.requestedAt))
    ) {
      return null;
    }

    if (
      parsed.distanceMeters != null &&
      (typeof parsed.distanceMeters !== 'number' ||
        Number.isNaN(parsed.distanceMeters))
    ) {
      return null;
    }

    if (
      parsed.maxDistanceKm != null &&
      (typeof parsed.maxDistanceKm !== 'number' ||
        Number.isNaN(parsed.maxDistanceKm))
    ) {
      return null;
    }

    const distanceMeters =
      parsed.distanceMeters == null ? null : Number(parsed.distanceMeters);

    return {
      v: 2,
      sortBy: parsed.sortBy,
      city: normalizeOptional(parsed.city),
      area: normalizeOptional(parsed.area),
      maxDistanceKm:
        parsed.maxDistanceKm == null ? null : Number(parsed.maxDistanceKm),
      requestedAt: parsed.requestedAt,
      distanceMeters,
      distanceKm:
        parsed.distanceKm == null
          ? roundPresentationDistanceKm(metersToKm(distanceMeters))
          : Number(parsed.distanceKm),
      id: parsed.id.trim(),
      refLat: roundRefCoord(
        parsed.refLat == null ? null : Number(parsed.refLat),
      ),
      refLng: roundRefCoord(
        parsed.refLng == null ? null : Number(parsed.refLng),
      ),
    };
  } catch {
    return null;
  }
};

export const buildAvailableJobsCursorFilters = (
  query: ListAvailableDeliveriesQuery,
  sortBy: AvailableJobsSortBy,
  reference?: { latitude: number; longitude: number } | null,
): AvailableJobsCursorFilters => ({
  sortBy,
  city: normalizeOptional(query.city) ?? undefined,
  area: normalizeOptional(query.area) ?? undefined,
  maxDistanceKm: query.maxDistanceKm,
  refLat: reference ? roundRefCoord(reference.latitude) : null,
  refLng: reference ? roundRefCoord(reference.longitude) : null,
});

/** Reference affects membership/order for nearest and/or radius filters. */
export const referenceAffectsAvailableJobsQuery = (
  filters: AvailableJobsCursorFilters,
): boolean =>
  filters.sortBy === 'nearest' || filters.maxDistanceKm != null;

export const assertAvailableJobsCursorCompatible = (
  cursor: AvailableJobsCursorPayload,
  filters: AvailableJobsCursorFilters,
) => {
  const city = normalizeOptional(filters.city);
  const area = normalizeOptional(filters.area);
  const maxDistanceKm =
    filters.maxDistanceKm == null ? null : Number(filters.maxDistanceKm);
  const refLat = roundRefCoord(filters.refLat);
  const refLng = roundRefCoord(filters.refLng);

  if (
    cursor.sortBy !== filters.sortBy ||
    cursor.city !== city ||
    cursor.area !== area ||
    cursor.maxDistanceKm !== maxDistanceKm
  ) {
    throw new AppError(
      'Available jobs cursor is incompatible with the current filters.',
      409,
      'DRIVER_AVAILABLE_JOBS_CURSOR_INVALID',
    );
  }

  if (referenceAffectsAvailableJobsQuery(filters)) {
    // Includes nearest+null/null (newest fallback) and newest+radius.
    // Null→valid or valid→null transitions conflict when the effective query changes.
    if (cursor.refLat !== refLat || cursor.refLng !== refLng) {
      throw new AppError(
        'Available jobs cursor is incompatible with the current filters.',
        409,
        'DRIVER_AVAILABLE_JOBS_CURSOR_INVALID',
      );
    }
  }
};

export const rejectInvalidAvailableJobsCursor = (): never => {
  throw new AppError(
    'Available jobs cursor is invalid or stale.',
    409,
    'DRIVER_AVAILABLE_JOBS_CURSOR_INVALID',
  );
};

/** Page emptied by concurrent claims while SQL still indicated continuation. */
export const rejectStaleAvailableJobsPage = (): never => {
  throw new AppError(
    'Available jobs page is stale; refresh and try again.',
    409,
    'DRIVER_AVAILABLE_JOBS_CURSOR_INVALID',
  );
};

type RankedDelivery = {
  delivery: { id: string; requestedAt: Date };
  distanceMeters: number | null;
};

const compareNewest = (left: RankedDelivery, right: RankedDelivery) => {
  const timeDiff =
    right.delivery.requestedAt.getTime() - left.delivery.requestedAt.getTime();
  if (timeDiff !== 0) {
    return timeDiff;
  }

  return right.delivery.id.localeCompare(left.delivery.id);
};

const compareNearest = (left: RankedDelivery, right: RankedDelivery) => {
  if (left.distanceMeters == null && right.distanceMeters == null) {
    return compareNewest(left, right);
  }

  if (left.distanceMeters == null) {
    return 1;
  }

  if (right.distanceMeters == null) {
    return -1;
  }

  const distanceDiff = left.distanceMeters - right.distanceMeters;
  if (distanceDiff !== 0) {
    return distanceDiff;
  }

  return compareNewest(left, right);
};

export const compareAvailableJobs = (
  left: RankedDelivery,
  right: RankedDelivery,
  sortBy: AvailableJobsSortBy,
) => (sortBy === 'nearest' ? compareNearest(left, right) : compareNewest(left, right));

export const isAvailableJobAfterCursor = (
  item: RankedDelivery,
  cursor: AvailableJobsCursorPayload,
  sortBy: AvailableJobsSortBy,
): boolean => {
  const cursorItem: RankedDelivery = {
    delivery: {
      id: cursor.id,
      requestedAt: new Date(cursor.requestedAt),
    },
    distanceMeters: cursor.distanceMeters,
  };

  return compareAvailableJobs(item, cursorItem, sortBy) > 0;
};

export const availableJobMatchesCursorPosition = (
  item: RankedDelivery,
  cursor: AvailableJobsCursorPayload,
): boolean => {
  if (
    item.delivery.id !== cursor.id ||
    item.delivery.requestedAt.toISOString() !== cursor.requestedAt
  ) {
    return false;
  }

  if (cursor.sortBy === 'newest') {
    return true;
  }

  if (item.distanceMeters == null || cursor.distanceMeters == null) {
    return item.distanceMeters == null && cursor.distanceMeters == null;
  }

  // Exact meter equality from the same PostGIS expression.
  return item.distanceMeters === cursor.distanceMeters;
};

export const buildNextAvailableJobsCursor = (
  item: RankedDelivery,
  filters: AvailableJobsCursorFilters,
): string =>
  encodeAvailableJobsCursor({
    v: 2,
    sortBy: filters.sortBy,
    city: normalizeOptional(filters.city),
    area: normalizeOptional(filters.area),
    maxDistanceKm:
      filters.maxDistanceKm == null ? null : Number(filters.maxDistanceKm),
    requestedAt: item.delivery.requestedAt.toISOString(),
    distanceMeters: item.distanceMeters,
    distanceKm: roundPresentationDistanceKm(metersToKm(item.distanceMeters)),
    id: item.delivery.id,
    refLat: roundRefCoord(filters.refLat),
    refLng: roundRefCoord(filters.refLng),
  });
