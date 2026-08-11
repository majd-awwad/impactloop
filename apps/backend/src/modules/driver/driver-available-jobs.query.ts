import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import type { AvailableJobsCursorPayload } from './driver-available-jobs-cursor.js';
import {
  kmToMeters,
  metersToKm,
  roundPresentationDistanceKm,
} from './driver-available-jobs-distance.js';

export type AvailableJobsListFilters = {
  city?: string;
  area?: string;
  maxDistanceKm?: number;
};

export type AvailableJobPageRow = {
  id: string;
  requestedAt: Date;
  /** Canonical KNN meters from `pl.location <-> reference`; null when no geography. */
  distanceMeters: number | null;
  distanceKm: number | null;
};

export type AvailableJobsReferencePoint = {
  latitude: number;
  longitude: number;
};

export type AvailableJobsCounts = {
  totalAvailableCount: number;
  nearbyAvailableCount: number;
};

/** Light Prisma select for Available Jobs list cards only. */
export const driverAvailableListSelect = {
  id: true,
  reservationId: true,
  deliveryGroupId: true,
  status: true,
  requestedAt: true,
  learnerNote: true,
  deliveryGroup: {
    select: {
      id: true,
      deliveryFee: true,
      currency: true,
      reservations: {
        where: {
          status: 'ACCEPTED' as const,
          fulfillmentMethod: 'DELIVERY' as const,
        },
        select: {
          id: true,
          quantityRequested: true,
          materialSubtotal: true,
          material: {
            select: {
              id: true,
              title: true,
              unit: true,
              condition: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' as const },
      },
    },
  },
  reservation: {
    select: {
      id: true,
      status: true,
      fulfillmentMethod: true,
      pickupWindowStart: true,
      pickupWindowEnd: true,
      supplierPickupWindowStart: true,
      supplierPickupWindowEnd: true,
      quantityRequested: true,
      material: {
        select: {
          id: true,
          title: true,
          unit: true,
        },
      },
      owner: {
        select: {
          displayName: true,
          supplierProfile: {
            select: {
              publicName: true,
              organizationProfile: {
                select: { organizationName: true },
              },
            },
          },
        },
      },
    },
  },
  pickupLocation: {
    select: {
      country: true,
      city: true,
      area: true,
    },
  },
  dropoffLocation: {
    select: {
      country: true,
      city: true,
      area: true,
    },
  },
} satisfies Prisma.DeliverySelect;

export type AvailableListDelivery = Prisma.DeliveryGetPayload<{
  select: typeof driverAvailableListSelect;
}>;

const waitingPoolPredicates = (filters: AvailableJobsListFilters) => {
  const clauses: Prisma.Sql[] = [
    Prisma.sql`d."status" = 'WAITING_FOR_DRIVER'::"DeliveryStatus"`,
    Prisma.sql`d."assigned_driver_profile_id" IS NULL`,
    // Accept only works on ACCEPTED reservations; exclude expired/cancelled zombies.
    Prisma.sql`EXISTS (
      SELECT 1
      FROM "reservations" r
      WHERE r."id" = d."reservation_id"
        AND r."status" = 'ACCEPTED'::"ReservationStatus"
    )`,
  ];

  if (filters.city?.trim()) {
    clauses.push(
      Prisma.sql`lower(pl."city") = lower(${filters.city.trim()})`,
    );
  }

  if (filters.area?.trim()) {
    clauses.push(
      Prisma.sql`lower(pl."area") = lower(${filters.area.trim()})`,
    );
  }

  return clauses;
};

/** Spherical geography reference point (lon, lat) SRID 4326. */
export const referenceGeographySql = (reference: AvailableJobsReferencePoint) =>
  Prisma.sql`ST_SetSRID(ST_MakePoint(${reference.longitude}, ${reference.latitude}), 4326)::geography`;

/**
 * Canonical KNN ordering distance in meters.
 * Must match ORDER BY, keyset, cursor key, and anchor verification exactly.
 */
export const knnOrderDistanceMetersSql = (
  reference: AvailableJobsReferencePoint,
) =>
  Prisma.sql`(pl."location" <-> ${referenceGeographySql(reference)})`;

const radiusWithinSql = (
  reference: AvailableJobsReferencePoint,
  maxDistanceKm: number,
) =>
  Prisma.sql`ST_DWithin(
    pl."location",
    ${referenceGeographySql(reference)},
    ${kmToMeters(maxDistanceKm)},
    false
  )`;

const newestKeysetSql = (cursor: AvailableJobsCursorPayload): Prisma.Sql => {
  const requestedAt = new Date(cursor.requestedAt);
  return Prisma.sql`(
    d."requested_at" < ${requestedAt}
    OR (d."requested_at" = ${requestedAt} AND d."id" < ${cursor.id})
  )`;
};

const nearestKeysetSql = (
  cursor: AvailableJobsCursorPayload,
  reference: AvailableJobsReferencePoint,
): Prisma.Sql => {
  const requestedAt = new Date(cursor.requestedAt);
  const orderDistance = knnOrderDistanceMetersSql(reference);
  const cursorDistance = cursor.distanceMeters;

  if (cursorDistance == null) {
    return Prisma.sql`(
      pl."location" IS NULL
      AND (
        d."requested_at" < ${requestedAt}
        OR (d."requested_at" = ${requestedAt} AND d."id" < ${cursor.id})
      )
    )`;
  }

  return Prisma.sql`(
    (
      pl."location" IS NOT NULL
      AND (
        (${orderDistance}) > ${cursorDistance}
        OR (
          (${orderDistance}) = ${cursorDistance}
          AND (
            d."requested_at" < ${requestedAt}
            OR (d."requested_at" = ${requestedAt} AND d."id" < ${cursor.id})
          )
        )
      )
    )
    OR pl."location" IS NULL
  )`;
};

const mapPageRows = (
  rows: Array<{
    id: string;
    requested_at: Date;
    order_distance_meters: number | null;
  }>,
): AvailableJobPageRow[] =>
  rows.map((row) => {
    const distanceMeters =
      row.order_distance_meters == null
        ? null
        : Number(row.order_distance_meters);
    return {
      id: row.id,
      requestedAt: row.requested_at,
      distanceMeters,
      distanceKm: roundPresentationDistanceKm(metersToKm(distanceMeters)),
    };
  });

/** Single aggregate: total after city/area; nearby applies ST_DWithin when radius set. */
export const countAvailableDeliveries = async (
  filters: AvailableJobsListFilters,
  reference: AvailableJobsReferencePoint | null,
): Promise<AvailableJobsCounts> => {
  const clauses = waitingPoolPredicates(filters);
  const where = Prisma.join(clauses, ' AND ');

  if (filters.maxDistanceKm == null || !reference) {
    const rows = await prisma.$queryRaw<Array<{ total_count: bigint }>>`
      SELECT COUNT(*)::bigint AS total_count
      FROM "deliveries" d
      INNER JOIN "locations" pl ON pl."id" = d."pickup_location_id"
      WHERE ${where}
    `;
    const total = Number(rows[0]?.total_count ?? 0n);
    return {
      totalAvailableCount: total,
      nearbyAvailableCount: filters.maxDistanceKm == null ? total : 0,
    };
  }

  const rows = await prisma.$queryRaw<
    Array<{ total_count: bigint; nearby_count: bigint }>
  >`
    SELECT
      COUNT(*)::bigint AS total_count,
      COUNT(*) FILTER (
        WHERE pl."location" IS NOT NULL
          AND ${radiusWithinSql(reference, filters.maxDistanceKm)}
      )::bigint AS nearby_count
    FROM "deliveries" d
    INNER JOIN "locations" pl ON pl."id" = d."pickup_location_id"
    WHERE ${where}
  `;

  return {
    totalAvailableCount: Number(rows[0]?.total_count ?? 0n),
    nearbyAvailableCount: Number(rows[0]?.nearby_count ?? 0n),
  };
};

export const fetchAvailableJobPageNewest = async (input: {
  filters: AvailableJobsListFilters;
  cursor: AvailableJobsCursorPayload | null;
  limit: number;
  reference?: AvailableJobsReferencePoint | null;
}): Promise<AvailableJobPageRow[]> => {
  const clauses = waitingPoolPredicates(input.filters);

  if (input.filters.maxDistanceKm != null) {
    if (!input.reference) {
      return [];
    }
    clauses.push(Prisma.sql`pl."location" IS NOT NULL`);
    clauses.push(radiusWithinSql(input.reference, input.filters.maxDistanceKm));
  }

  if (input.cursor) {
    clauses.push(newestKeysetSql(input.cursor));
  }

  const where = Prisma.join(clauses, ' AND ');
  const take = input.limit + 1;

  const distanceSelect = input.reference
    ? Prisma.sql`CASE
        WHEN pl."location" IS NULL THEN NULL
        ELSE ${knnOrderDistanceMetersSql(input.reference)}
      END`
    : Prisma.sql`NULL::double precision`;

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      requested_at: Date;
      order_distance_meters: number | null;
    }>
  >`
    SELECT
      d."id",
      d."requested_at",
      (${distanceSelect}) AS order_distance_meters
    FROM "deliveries" d
    INNER JOIN "locations" pl ON pl."id" = d."pickup_location_id"
    WHERE ${where}
    ORDER BY d."requested_at" DESC, d."id" DESC
    LIMIT ${take}
  `;

  return mapPageRows(rows);
};

/**
 * Global / radius nearest page.
 * Leads from locations so PostgreSQL can use GiST KNN (`Index Scan` + `Order By <->`).
 * Canonical order key is `pl.location <-> reference` everywhere.
 */
export const fetchAvailableJobPageNearest = async (input: {
  filters: AvailableJobsListFilters;
  reference: AvailableJobsReferencePoint;
  cursor: AvailableJobsCursorPayload | null;
  limit: number;
}): Promise<AvailableJobPageRow[]> => {
  const clauses = waitingPoolPredicates(input.filters);
  const orderDistance = knnOrderDistanceMetersSql(input.reference);

  if (input.filters.maxDistanceKm != null) {
    clauses.push(Prisma.sql`pl."location" IS NOT NULL`);
    clauses.push(radiusWithinSql(input.reference, input.filters.maxDistanceKm));
  }

  if (input.cursor) {
    clauses.push(nearestKeysetSql(input.cursor, input.reference));
  }

  const where = Prisma.join(clauses, ' AND ');
  const take = input.limit + 1;

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      requested_at: Date;
      order_distance_meters: number | null;
    }>
  >`
    SELECT
      d."id",
      d."requested_at",
      CASE
        WHEN pl."location" IS NULL THEN NULL
        ELSE ${orderDistance}
      END AS order_distance_meters
    FROM "locations" pl
    INNER JOIN "deliveries" d ON d."pickup_location_id" = pl."id"
    WHERE ${where}
    ORDER BY
      ${orderDistance} ASC NULLS LAST,
      d."requested_at" DESC,
      d."id" DESC
    LIMIT ${take}
  `;

  return mapPageRows(rows);
};

/**
 * Hydrate page IDs with the light list projection, re-checking availability
 * so rows claimed between selection and hydration are excluded.
 */
export const loadAvailableListDeliveriesByIds = async (
  ids: string[],
): Promise<AvailableListDelivery[]> => {
  if (ids.length === 0) {
    return [];
  }

  const rows = await prisma.delivery.findMany({
    where: {
      id: { in: ids },
      status: 'WAITING_FOR_DRIVER',
      assignedDriverProfileId: null,
      reservation: { status: 'ACCEPTED' },
    },
    select: driverAvailableListSelect,
  });

  const order = new Map(ids.map((id, index) => [id, index]));
  return rows.sort(
    (left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0),
  );
};

/**
 * Build the returned page from SQL order + hydration survivors only.
 * hasMore is driven by the raw limit+1 fetch (continuation evidence), not by
 * survivor count alone, so a mid-page claim cannot hide later rows.
 * nextCursor must come from the last returned row, never an excluded id.
 */
export const paginateHydratedAvailableJobs = <T extends { id: string }>(
  pageRows: AvailableJobPageRow[],
  hydrated: T[],
  pageLimit: number,
): {
  page: Array<{ row: AvailableJobPageRow; delivery: T }>;
  hasMore: boolean;
  /** Raw SQL produced a sentinel, but hydration left an empty page. */
  needsRetry: boolean;
} => {
  const hydratedById = new Map(
    hydrated.map((delivery) => [delivery.id, delivery] as const),
  );
  const surviving = pageRows
    .filter((row) => hydratedById.has(row.id))
    .map((row) => ({
      row,
      delivery: hydratedById.get(row.id)!,
    }));

  const rawHasMore = pageRows.length > pageLimit;
  const page = surviving.slice(0, pageLimit);
  const hasMore = rawHasMore && page.length > 0;
  const needsRetry = rawHasMore && page.length === 0;

  return { page, hasMore, needsRetry };
};

export const verifyAvailableJobsCursorAnchor = async (input: {
  cursor: AvailableJobsCursorPayload;
  filters: AvailableJobsListFilters;
  reference: AvailableJobsReferencePoint | null;
  sortBy: 'nearest' | 'newest';
}): Promise<boolean> => {
  const clauses = [
    ...waitingPoolPredicates(input.filters),
    Prisma.sql`d."id" = ${input.cursor.id}`,
  ];

  if (input.filters.maxDistanceKm != null) {
    if (!input.reference) {
      return false;
    }
    clauses.push(Prisma.sql`pl."location" IS NOT NULL`);
    clauses.push(radiusWithinSql(input.reference, input.filters.maxDistanceKm));
  }

  const where = Prisma.join(clauses, ' AND ');

  // Nearest with a reference: verify the canonical KNN meter key.
  if (input.sortBy === 'nearest' && input.reference) {
    const orderDistance = knnOrderDistanceMetersSql(input.reference);
    const rows = await prisma.$queryRaw<
      Array<{ requested_at: Date; order_distance_meters: number | null }>
    >`
      SELECT
        d."requested_at",
        CASE
          WHEN pl."location" IS NULL THEN NULL
          ELSE ${orderDistance}
        END AS order_distance_meters
      FROM "locations" pl
      INNER JOIN "deliveries" d ON d."pickup_location_id" = pl."id"
      WHERE ${where}
      LIMIT 1
    `;

    const row = rows[0];
    if (!row) {
      return false;
    }

    if (row.requested_at.toISOString() !== input.cursor.requestedAt) {
      return false;
    }

    const distanceMeters =
      row.order_distance_meters == null
        ? null
        : Number(row.order_distance_meters);
    if (distanceMeters == null || input.cursor.distanceMeters == null) {
      return distanceMeters == null && input.cursor.distanceMeters == null;
    }

    return distanceMeters === input.cursor.distanceMeters;
  }

  // Newest, or nearest without reference (newest fallback): requestedAt + id.
  const rows = await prisma.$queryRaw<Array<{ requested_at: Date }>>`
    SELECT d."requested_at"
    FROM "deliveries" d
    INNER JOIN "locations" pl ON pl."id" = d."pickup_location_id"
    WHERE ${where}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) {
    return false;
  }

  return row.requested_at.toISOString() === input.cursor.requestedAt;
};
