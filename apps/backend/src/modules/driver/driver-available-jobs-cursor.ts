import { AppError } from '../../utils/app-error.js';
import type { ListAvailableDeliveriesQuery } from './driver.validation.js';

export type AvailableJobsSortBy = 'nearest' | 'newest';

export type AvailableJobsCursorPayload = {
  v: 1;
  sortBy: AvailableJobsSortBy;
  city: string | null;
  area: string | null;
  maxDistanceKm: number | null;
  requestedAt: string;
  distanceKm: number | null;
  id: string;
};

export type AvailableJobsCursorFilters = {
  sortBy: AvailableJobsSortBy;
  city?: string;
  area?: string;
  maxDistanceKm?: number;
};

const normalizeOptional = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
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
    ) as Partial<AvailableJobsCursorPayload>;

    if (
      parsed.v !== 1 ||
      (parsed.sortBy !== 'nearest' && parsed.sortBy !== 'newest') ||
      typeof parsed.requestedAt !== 'string' ||
      typeof parsed.id !== 'string' ||
      !parsed.id.trim() ||
      Number.isNaN(Date.parse(parsed.requestedAt))
    ) {
      return null;
    }

    if (
      parsed.distanceKm != null &&
      (typeof parsed.distanceKm !== 'number' ||
        Number.isNaN(parsed.distanceKm))
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

    return {
      v: 1,
      sortBy: parsed.sortBy,
      city: normalizeOptional(parsed.city),
      area: normalizeOptional(parsed.area),
      maxDistanceKm:
        parsed.maxDistanceKm == null ? null : Number(parsed.maxDistanceKm),
      requestedAt: parsed.requestedAt,
      distanceKm: parsed.distanceKm == null ? null : Number(parsed.distanceKm),
      id: parsed.id.trim(),
    };
  } catch {
    return null;
  }
};

export const buildAvailableJobsCursorFilters = (
  query: ListAvailableDeliveriesQuery,
  sortBy: AvailableJobsSortBy,
): AvailableJobsCursorFilters => ({
  sortBy,
  city: normalizeOptional(query.city) ?? undefined,
  area: normalizeOptional(query.area) ?? undefined,
  maxDistanceKm: query.maxDistanceKm,
});

export const assertAvailableJobsCursorCompatible = (
  cursor: AvailableJobsCursorPayload,
  filters: AvailableJobsCursorFilters,
) => {
  const city = normalizeOptional(filters.city);
  const area = normalizeOptional(filters.area);
  const maxDistanceKm =
    filters.maxDistanceKm == null ? null : Number(filters.maxDistanceKm);

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
};

export const rejectInvalidAvailableJobsCursor = (): never => {
  throw new AppError(
    'Available jobs cursor is invalid or stale.',
    409,
    'DRIVER_AVAILABLE_JOBS_CURSOR_INVALID',
  );
};

type RankedDelivery = {
  delivery: { id: string; requestedAt: Date };
  distanceKm: number | null;
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
  if (left.distanceKm == null && right.distanceKm == null) {
    return compareNewest(left, right);
  }

  if (left.distanceKm == null) {
    return 1;
  }

  if (right.distanceKm == null) {
    return -1;
  }

  const distanceDiff = left.distanceKm - right.distanceKm;
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

/**
 * Keyset: return true when `item` is strictly after the cursor position
 * in the selected ordering.
 */
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
    distanceKm: cursor.distanceKm,
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

  if (item.distanceKm == null || cursor.distanceKm == null) {
    return item.distanceKm == null && cursor.distanceKm == null;
  }

  return Math.abs(item.distanceKm - cursor.distanceKm) < 1e-9;
};

export const buildNextAvailableJobsCursor = (
  item: RankedDelivery,
  filters: AvailableJobsCursorFilters,
): string =>
  encodeAvailableJobsCursor({
    v: 1,
    sortBy: filters.sortBy,
    city: normalizeOptional(filters.city),
    area: normalizeOptional(filters.area),
    maxDistanceKm:
      filters.maxDistanceKm == null ? null : Number(filters.maxDistanceKm),
    requestedAt: item.delivery.requestedAt.toISOString(),
    distanceKm: item.distanceKm,
    id: item.delivery.id,
  });
