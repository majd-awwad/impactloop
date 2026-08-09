import type { Prisma, ReservationStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';

import type {
  AdminReservationsExportFilters,
  AdminReservationsListQuery,
} from './admin-reservations.validation.js';
import {
  ADMIN_ACCEPTED_ACTIVE_KPI_RESERVATION_STATUSES,
  ADMIN_COMPLETED_KPI_RESERVATION_STATUSES,
  ADMIN_PENDING_KPI_RESERVATION_STATUSES,
} from './admin-reservations.status.js';

const startOfUtcDay = (date: Date) => {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
};

const buildDateRange = (dateFrom?: string, dateTo?: string) => {
  if (!dateFrom && !dateTo) return undefined;

  const createdAt: Prisma.DateTimeFilter = {};
  if (dateFrom) {
    const parsed = new Date(dateFrom);
    if (!Number.isNaN(parsed.getTime())) {
      createdAt.gte = startOfUtcDay(parsed);
    }
  }
  if (dateTo) {
    const parsed = new Date(dateTo);
    if (!Number.isNaN(parsed.getTime())) {
      const end = startOfUtcDay(parsed);
      end.setUTCHours(23, 59, 59, 999);
      createdAt.lte = end;
    }
  }

  return Object.keys(createdAt).length > 0 ? createdAt : undefined;
};

export const adminReservationListInclude = {
  material: {
    select: {
      id: true,
      title: true,
      unit: true,
      images: {
        where: { isCover: true },
        take: 1,
        orderBy: { sortOrder: 'asc' as const },
        select: { imageUrl: true, isCover: true, sortOrder: true },
      },
    },
  },
  requester: {
    select: {
      id: true,
      displayName: true,
      email: true,
    },
  },
  owner: {
    select: {
      id: true,
      displayName: true,
      email: true,
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
  deliveries: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: {
      id: true,
      status: true,
      requestedAt: true,
      assignedAt: true,
      deliveredAt: true,
    },
  },
  _count: {
    select: { deliveries: true },
  },
} satisfies Prisma.ReservationInclude;

export const adminReservationDetailInclude = {
  material: {
    select: {
      id: true,
      title: true,
      unit: true,
      condition: true,
      isFree: true,
      price: true,
      currency: true,
      pickupAllowed: true,
      deliveryAllowed: true,
      category: { select: { nameEn: true } },
      images: {
        orderBy: { sortOrder: 'asc' as const },
        select: { imageUrl: true, isCover: true, sortOrder: true },
      },
    },
  },
  requester: {
    select: {
      id: true,
      displayName: true,
      email: true,
      phone: true,
    },
  },
  owner: {
    select: {
      id: true,
      displayName: true,
      email: true,
      supplierProfile: {
        select: {
          publicName: true,
          verificationStatus: true,
          organizationProfile: {
            select: { organizationName: true },
          },
        },
      },
    },
  },
  deliveries: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: {
      id: true,
      status: true,
      requestedAt: true,
      assignedAt: true,
      deliveredAt: true,
      assignedDriverProfile: {
        select: {
          id: true,
          displayName: true,
          user: { select: { email: true } },
        },
      },
    },
  },
  statusHistory: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      statusGroup: true,
      oldStatus: true,
      newStatus: true,
      note: true,
      createdAt: true,
    },
  },
  noShowReports: {
    orderBy: { createdAt: 'desc' as const },
    select: {
      id: true,
      status: true,
      reasonCode: true,
      targetRole: true,
      createdAt: true,
    },
  },
} satisfies Prisma.ReservationInclude;

export type AdminReservationListRecord = Prisma.ReservationGetPayload<{
  include: typeof adminReservationListInclude;
}>;

export type AdminReservationDetailRecord = Prisma.ReservationGetPayload<{
  include: typeof adminReservationDetailInclude;
}>;

const buildSearchWhere = (search?: string): Prisma.ReservationWhereInput | undefined => {
  const normalized = search?.trim();
  if (!normalized) return undefined;

  return {
    OR: [
      { material: { title: { contains: normalized, mode: 'insensitive' } } },
      { requester: { displayName: { contains: normalized, mode: 'insensitive' } } },
      { requester: { email: { contains: normalized, mode: 'insensitive' } } },
      { owner: { displayName: { contains: normalized, mode: 'insensitive' } } },
      { owner: { email: { contains: normalized, mode: 'insensitive' } } },
      {
        owner: {
          supplierProfile: {
            publicName: { contains: normalized, mode: 'insensitive' },
          },
        },
      },
      {
        owner: {
          supplierProfile: {
            organizationProfile: {
              organizationName: { contains: normalized, mode: 'insensitive' },
            },
          },
        },
      },
    ],
  };
};

const buildHasDeliveryWhere = (
  hasDelivery?: AdminReservationsExportFilters['hasDelivery'],
): Prisma.ReservationWhereInput | undefined => {
  if (hasDelivery === 'YES') {
    return { deliveries: { some: {} } };
  }
  if (hasDelivery === 'NO') {
    return { deliveries: { none: {} } };
  }
  return undefined;
};

export const buildAdminReservationsWhere = (
  query: AdminReservationsExportFilters,
): Prisma.ReservationWhereInput => {
  const and: Prisma.ReservationWhereInput[] = [];

  const searchWhere = buildSearchWhere(query.search);
  if (searchWhere) and.push(searchWhere);

  if (query.status) {
    and.push({ status: query.status as ReservationStatus });
  }

  const hasDeliveryWhere = buildHasDeliveryWhere(query.hasDelivery);
  if (hasDeliveryWhere) and.push(hasDeliveryWhere);

  const createdAt = buildDateRange(query.dateFrom, query.dateTo);
  if (createdAt) and.push({ createdAt });

  return and.length > 0 ? { AND: and } : {};
};

export const countAdminReservationsSummary = async () => {
  const [total, pending, acceptedActive, completed, withDelivery] =
    await Promise.all([
      prisma.reservation.count(),
      prisma.reservation.count({
        where: { status: { in: [...ADMIN_PENDING_KPI_RESERVATION_STATUSES] } },
      }),
      prisma.reservation.count({
        where: {
          status: {
            in: [...ADMIN_ACCEPTED_ACTIVE_KPI_RESERVATION_STATUSES],
          },
        },
      }),
      prisma.reservation.count({
        where: {
          status: { in: [...ADMIN_COMPLETED_KPI_RESERVATION_STATUSES] },
        },
      }),
      prisma.reservation.count({ where: { deliveries: { some: {} } } }),
    ]);

  return { total, pending, acceptedActive, completed, withDelivery };
};

export const listAdminReservations = async (query: AdminReservationsListQuery) => {
  const where = buildAdminReservationsWhere(query);
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.reservation.findMany({
      where,
      include: adminReservationListInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.limit,
    }),
    prisma.reservation.count({ where }),
  ]);

  return { items, total };
};

export const findAdminReservationById = async (id: string) => {
  return prisma.reservation.findUnique({
    where: { id },
    include: adminReservationDetailInclude,
  });
};

export const countAdminReservationsForExport = async (
  query: AdminReservationsExportFilters,
) => prisma.reservation.count({ where: buildAdminReservationsWhere(query) });

export const groupAdminReservationsStatusForExport = async (
  query: AdminReservationsExportFilters,
) =>
  prisma.reservation.groupBy({
    by: ['status'],
    where: buildAdminReservationsWhere(query),
    _count: { _all: true },
  });

export type AdminReservationExportKeysetCursor = {
  createdAt: Date;
  id: string;
};

/**
 * Keyset pagination: createdAt DESC, id DESC.
 * Predicate: createdAt < cursor.createdAt OR (createdAt = cursor.createdAt AND id < cursor.id)
 */
export const listAdminReservationsExportBatch = async (input: {
  query: AdminReservationsExportFilters;
  cursor?: AdminReservationExportKeysetCursor;
  take: number;
}) => {
  const baseWhere = buildAdminReservationsWhere(input.query);
  const where: Prisma.ReservationWhereInput = input.cursor
    ? {
        AND: [
          baseWhere,
          {
            OR: [
              { createdAt: { lt: input.cursor.createdAt } },
              {
                AND: [
                  { createdAt: input.cursor.createdAt },
                  { id: { lt: input.cursor.id } },
                ],
              },
            ],
          },
        ],
      }
    : baseWhere;

  return prisma.reservation.findMany({
    where,
    include: adminReservationListInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: input.take,
  });
};
