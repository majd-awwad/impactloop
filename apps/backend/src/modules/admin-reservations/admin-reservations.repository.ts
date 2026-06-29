import type { Prisma, ReservationStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';

import type { AdminReservationsListQuery } from './admin-reservations.validation.js';

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
  hasDelivery?: AdminReservationsListQuery['hasDelivery'],
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
  query: AdminReservationsListQuery,
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
      prisma.reservation.count({ where: { status: 'PENDING' } }),
      prisma.reservation.count({ where: { status: 'ACCEPTED' } }),
      prisma.reservation.count({ where: { status: 'COMPLETED' } }),
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
