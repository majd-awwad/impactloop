import type { Prisma, DeliveryStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';

import type { AdminDeliveriesListQuery } from './admin-deliveries.validation.js';

const startOfUtcDay = (date: Date) => {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
};

const buildDateRange = (dateFrom?: string, dateTo?: string) => {
  if (!dateFrom && !dateTo) return undefined;

  const requestedAt: Prisma.DateTimeFilter = {};
  if (dateFrom) {
    const parsed = new Date(dateFrom);
    if (!Number.isNaN(parsed.getTime())) {
      requestedAt.gte = startOfUtcDay(parsed);
    }
  }
  if (dateTo) {
    const parsed = new Date(dateTo);
    if (!Number.isNaN(parsed.getTime())) {
      const end = startOfUtcDay(parsed);
      end.setUTCHours(23, 59, 59, 999);
      requestedAt.lte = end;
    }
  }

  return Object.keys(requestedAt).length > 0 ? requestedAt : undefined;
};

const ownerSupplierSelect = {
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
} as const;

const locationSummarySelect = {
  country: true,
  city: true,
  area: true,
  addressLine: true,
} as const;

export const adminDeliveryListInclude = {
  reservation: {
    select: {
      id: true,
      pickupWindowStart: true,
      pickupWindowEnd: true,
      supplierNote: true,
      material: {
        select: {
          id: true,
          title: true,
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
        select: ownerSupplierSelect,
      },
    },
  },
  pickupLocation: {
    select: locationSummarySelect,
  },
  dropoffLocation: {
    select: locationSummarySelect,
  },
  assignedDriverProfile: {
    select: {
      id: true,
      displayName: true,
      phone: true,
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  },
} satisfies Prisma.DeliveryInclude;

export const adminDeliveryDetailInclude = {
  reservation: {
    select: {
      id: true,
      status: true,
      pickupWindowStart: true,
      pickupWindowEnd: true,
      supplierNote: true,
      quantityRequested: true,
      material: {
        select: {
          id: true,
          title: true,
          unit: true,
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
        select: ownerSupplierSelect,
      },
    },
  },
  pickupLocation: true,
  dropoffLocation: true,
  assignedDriverProfile: {
    select: {
      id: true,
      displayName: true,
      phone: true,
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  },
  statusHistory: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      oldStatus: true,
      newStatus: true,
      note: true,
      createdAt: true,
      changedByUser: {
        select: {
          displayName: true,
          email: true,
        },
      },
    },
  },
  locationPings: {
    orderBy: { capturedAt: 'desc' as const },
    take: 50,
    select: {
      id: true,
      latitude: true,
      longitude: true,
      accuracyMeters: true,
      capturedAt: true,
    },
  },
  assignments: {
    orderBy: { acceptedAt: 'desc' as const },
    take: 1,
    select: {
      acceptedAt: true,
      status: true,
    },
  },
} satisfies Prisma.DeliveryInclude;

export type AdminDeliveryListRecord = Prisma.DeliveryGetPayload<{
  include: typeof adminDeliveryListInclude;
}>;

export type AdminDeliveryDetailRecord = Prisma.DeliveryGetPayload<{
  include: typeof adminDeliveryDetailInclude;
}>;

const buildSearchWhere = (search?: string): Prisma.DeliveryWhereInput | undefined => {
  const normalized = search?.trim();
  if (!normalized) return undefined;

  return {
    OR: [
      {
        reservation: {
          material: { title: { contains: normalized, mode: 'insensitive' } },
        },
      },
      {
        reservation: {
          requester: {
            displayName: { contains: normalized, mode: 'insensitive' },
          },
        },
      },
      {
        reservation: {
          requester: { email: { contains: normalized, mode: 'insensitive' } },
        },
      },
      {
        reservation: {
          owner: { displayName: { contains: normalized, mode: 'insensitive' } },
        },
      },
      {
        reservation: {
          owner: { email: { contains: normalized, mode: 'insensitive' } },
        },
      },
      {
        assignedDriverProfile: {
          displayName: { contains: normalized, mode: 'insensitive' },
        },
      },
      {
        assignedDriverProfile: {
          user: { email: { contains: normalized, mode: 'insensitive' } },
        },
      },
    ],
  };
};

export const buildAdminDeliveriesWhere = (
  query: AdminDeliveriesListQuery,
): Prisma.DeliveryWhereInput => {
  const and: Prisma.DeliveryWhereInput[] = [];

  const searchWhere = buildSearchWhere(query.search);
  if (searchWhere) and.push(searchWhere);

  if (query.status) {
    and.push({ status: query.status as DeliveryStatus });
  }

  if (query.assignment === 'ASSIGNED') {
    and.push({ assignedDriverProfileId: { not: null } });
  } else if (query.assignment === 'UNASSIGNED') {
    and.push({ assignedDriverProfileId: null });
  }

  const requestedAt = buildDateRange(query.dateFrom, query.dateTo);
  if (requestedAt) and.push({ requestedAt });

  return and.length > 0 ? { AND: and } : {};
};

const inProgressStatuses: DeliveryStatus[] = [
  'DRIVER_ASSIGNED',
  'ARRIVED_PICKUP',
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
];

const failedCancelledStatuses: DeliveryStatus[] = [
  'CANCELLED',
  'FAILED_PICKUP',
  'FAILED_DELIVERY',
];

export const countAdminDeliveriesSummary = async () => {
  const [total, pendingUnassigned, assignedInProgress, delivered, failedCancelled] =
    await Promise.all([
      prisma.delivery.count(),
      prisma.delivery.count({ where: { status: 'WAITING_FOR_DRIVER' } }),
      prisma.delivery.count({
        where: { status: { in: inProgressStatuses } },
      }),
      prisma.delivery.count({ where: { status: 'DELIVERED' } }),
      prisma.delivery.count({
        where: { status: { in: failedCancelledStatuses } },
      }),
    ]);

  return {
    total,
    pendingUnassigned,
    assignedInProgress,
    delivered,
    failedCancelled,
  };
};

export const listAdminDeliveries = async (query: AdminDeliveriesListQuery) => {
  const where = buildAdminDeliveriesWhere(query);
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.delivery.findMany({
      where,
      include: adminDeliveryListInclude,
      orderBy: { requestedAt: 'desc' },
      skip,
      take: query.limit,
    }),
    prisma.delivery.count({ where }),
  ]);

  return { items, total };
};

export const findAdminDeliveryById = async (id: string) => {
  return prisma.delivery.findUnique({
    where: { id },
    include: adminDeliveryDetailInclude,
  });
};
