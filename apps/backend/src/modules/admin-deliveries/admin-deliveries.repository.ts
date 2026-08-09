import type { Prisma, DeliveryStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { reconcileDriverAvailability } from '../driver/driver-availability.js';
import { runSerializableTransaction } from '../../utils/transaction-retry.js';
import { isTerminalDeliveryStatus } from '../deliveries/delivery-status.policy.js';

import type { AdminDeliveriesExportFilters, AdminDeliveriesListQuery } from './admin-deliveries.validation.js';

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
      status: true,
      fulfillmentMethod: true,
      pendingRescheduleRequestedBy: true,
      pendingRescheduleReason: true,
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
      user: {
        select: {
          id: true,
          displayName: true,
          email: true,
          phone: true,
        },
      },
    },
  },
  deliveryGroup: {
    select: {
      id: true,
      status: true,
      reservations: {
        orderBy: { createdAt: 'desc' as const },
        take: 3,
        select: { id: true, status: true },
      },
      _count: { select: { reservations: true } },
    },
  },
  assignments: {
    orderBy: [{ acceptedAt: 'desc' as const }, { id: 'desc' as const }],
    take: 2,
    select: {
      id: true,
      status: true,
      acceptedAt: true,
      releasedAt: true,
      driverProfile: {
        select: {
          id: true,
          user: { select: { displayName: true, email: true } },
        },
      },
    },
  },
  _count: { select: { incidentReports: true } },
} satisfies Prisma.DeliveryInclude;

export const adminDeliveryDetailInclude = {
  reservation: {
    select: {
      id: true,
      status: true,
      fulfillmentMethod: true,
      pendingRescheduleRequestedBy: true,
      pendingRescheduleReason: true,
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
      user: {
        select: {
          id: true,
          displayName: true,
          email: true,
          phone: true,
        },
      },
    },
  },
  deliveryGroup: {
    select: {
      id: true,
      status: true,
      assignedDriverProfileId: true,
      reservations: {
        orderBy: { createdAt: 'desc' as const },
        take: 50,
        select: {
          id: true,
          status: true,
          fulfillmentMethod: true,
        },
      },
      _count: { select: { reservations: true } },
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
    orderBy: [{ acceptedAt: 'desc' as const }, { id: 'desc' as const }],
    take: 20,
    select: {
      id: true,
      acceptedAt: true,
      releasedAt: true,
      status: true,
      releaseReason: true,
      driverProfile: {
        select: {
          id: true,
          user: { select: { displayName: true, email: true } },
        },
      },
    },
  },
  incidentReports: {
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
    take: 20,
    select: {
      id: true,
      status: true,
      reasonCode: true,
      targetRole: true,
      targetUserId: true,
      deliveryId: true,
      createdAt: true,
      note: true,
      reviewNote: true,
      reviewedAt: true,
    },
  },
  _count: { select: { incidentReports: true } },
} satisfies Prisma.DeliveryInclude;

export type AdminDeliveryListRecord = Prisma.DeliveryGetPayload<{
  include: typeof adminDeliveryListInclude;
}>;

export type AdminDeliveryDetailRecord = Prisma.DeliveryGetPayload<{
  include: typeof adminDeliveryDetailInclude;
}>;

const primaryIncidentSelect = {
  id: true,
  status: true,
  reasonCode: true,
  targetRole: true,
  targetUserId: true,
  deliveryId: true,
  createdAt: true,
  note: true,
  reviewNote: true,
  reviewedAt: true,
} satisfies Prisma.NoShowReportSelect;

export type AdminDeliveryPrimaryIncident = Prisma.NoShowReportGetPayload<{
  select: typeof primaryIncidentSelect;
}>;

type ReopenDeliveryGroupRecord = {
  id: string;
  status: string;
  assignedDriverProfileId: string | null;
  reservations: Array<{
    id: string;
    status: string;
    fulfillmentMethod: string;
  }>;
};

type ReopenDriverAssignmentRecord = {
  id: string;
  status: DeliveryStatus;
  arrivedPickupAt: Date | null;
  pickedUpAt: Date | null;
  onTheWayAt: Date | null;
  arrivedDropoffAt: Date | null;
  assignedDriverProfileId: string | null;
  assignedDriverProfile: { id: string; userId: string } | null;
  reservation: { material: { title: string } };
  deliveryGroup: ReopenDeliveryGroupRecord | null;
};

const loadReopenDelivery = async (
  tx: Prisma.TransactionClient,
  deliveryId: string,
): Promise<ReopenDriverAssignmentRecord | null> => {
  const delivery = await tx.delivery.findUnique({
    where: { id: deliveryId },
    select: {
      id: true,
      status: true,
      arrivedPickupAt: true,
      pickedUpAt: true,
      onTheWayAt: true,
      arrivedDropoffAt: true,
      assignedDriverProfileId: true,
      deliveryGroupId: true,
      assignedDriverProfile: {
        select: {
          id: true,
          userId: true,
        },
      },
      reservation: {
        select: {
          material: { select: { title: true } },
        },
      },
    },
  });

  if (!delivery) {
    return null;
  }

  const deliveryGroup = delivery.deliveryGroupId
    ? await tx.deliveryGroup.findUnique({
        where: { id: delivery.deliveryGroupId },
        select: {
          id: true,
          status: true,
          assignedDriverProfileId: true,
          reservations: {
            select: {
              id: true,
              status: true,
              fulfillmentMethod: true,
            },
          },
        },
      })
    : null;

  return {
    id: delivery.id,
    status: delivery.status,
    arrivedPickupAt: delivery.arrivedPickupAt,
    pickedUpAt: delivery.pickedUpAt,
    onTheWayAt: delivery.onTheWayAt,
    arrivedDropoffAt: delivery.arrivedDropoffAt,
    assignedDriverProfileId: delivery.assignedDriverProfileId,
    assignedDriverProfile: delivery.assignedDriverProfile,
    reservation: delivery.reservation,
    deliveryGroup,
  };
};

export type ReopenDriverAssignmentResult =
  | {
      outcome: 'REOPENED';
      deliveryId: string;
      removedDriverUserId: string;
      materialTitle: string;
    }
  | {
      outcome:
        | 'NOT_FOUND'
        | 'ALREADY_WAITING'
        | 'NOT_ASSIGNED'
        | 'PICKUP_STARTED'
        | 'TERMINAL_OR_FAILED'
        | 'GROUP_INCOMPATIBLE'
        | 'ACTIVE_ASSIGNMENT_MISSING'
        | 'CONCURRENT_UPDATE';
      status?: DeliveryStatus;
    };

const pickupStartedStatuses = new Set<DeliveryStatus>([
  'ARRIVED_PICKUP',
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
]);

export const hasPickupStarted = (delivery: {
  status: DeliveryStatus;
  arrivedPickupAt: Date | null;
  pickedUpAt: Date | null;
  onTheWayAt: Date | null;
  arrivedDropoffAt: Date | null;
}) =>
  pickupStartedStatuses.has(delivery.status) ||
  delivery.arrivedPickupAt != null ||
  delivery.pickedUpAt != null ||
  delivery.onTheWayAt != null ||
  delivery.arrivedDropoffAt != null;

const activeAssignedStatuses: DeliveryStatus[] = [
  'DRIVER_ASSIGNED',
  'ARRIVED_PICKUP',
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
];

const hasIncompatibleGroupedReservation = (
  delivery: ReopenDriverAssignmentRecord,
) =>
  delivery.deliveryGroup?.reservations.some(
    (reservation) =>
      reservation.fulfillmentMethod === 'DELIVERY' &&
      reservation.status !== 'ACCEPTED',
  ) ?? false;

const buildSearchWhere = (search?: string): Prisma.DeliveryWhereInput | undefined => {
  const normalized = search?.trim();
  if (!normalized) return undefined;

  return {
    OR: [
      { id: normalized },
      { reservationId: normalized },
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
  query: Pick<
    AdminDeliveriesListQuery,
    | 'search'
    | 'status'
    | 'assignment'
    | 'scope'
    | 'incidentState'
    | 'dateFrom'
    | 'dateTo'
  >,
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
  } else if (query.assignment === 'ACTIVE') {
    and.push({
      assignments: {
        some: { status: 'ACTIVE' },
      },
      assignedDriverProfileId: { not: null },
    });
  } else if (query.assignment === 'RELEASED') {
    and.push({
      assignedDriverProfileId: null,
      assignments: { some: { status: 'RELEASED' } },
    });
  } else if (query.assignment === 'HISTORICAL') {
    and.push({
      assignments: { some: {} },
      status: { in: ['DELIVERED', 'CANCELLED', 'FAILED_PICKUP', 'FAILED_DELIVERY', 'DRIVER_NO_SHOW', 'LEARNER_NO_SHOW'] },
    });
  }

  if (query.scope === 'GROUPED') {
    and.push({ deliveryGroupId: { not: null } });
  } else if (query.scope === 'SINGLE') {
    and.push({ deliveryGroupId: null });
  }

  if (query.incidentState) {
    and.push({ incidentReports: { some: { status: query.incidentState } } });
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

/**
 * Select one incident per delivery without relying on an arbitrary relation
 * limit.  Each query is batched and `distinct` is ordered by the requested
 * class priority before its timestamp tie-breaker.
 */
export const findPrimaryIncidentsForDeliveryIds = async (deliveryIds: string[]) => {
  if (deliveryIds.length === 0) return new Map<string, AdminDeliveryPrimaryIncident>();

  const ordered = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];
  const base = {
    deliveryId: { in: deliveryIds },
  } satisfies Prisma.NoShowReportWhereInput;

  const [operational, pendingAccountability, terminal] = await Promise.all([
    prisma.noShowReport.findMany({
      where: {
        ...base,
        reasonCode: {
          in: [
            'NO_DRIVER_AVAILABLE',
            'NO_RESPONSE_AFTER_PICKUP_WINDOW',
            'DRIVER_DID_NOT_ARRIVE',
            'PICKUP_FAILED',
          ],
        },
        reservation: {
          is: {
            fulfillmentMethod: 'DELIVERY',
            status: 'AWAITING_RESOLUTION',
          },
        },
        delivery: {
          is: {
            status: { in: ['AWAITING_RESOLUTION', 'DRIVER_NO_SHOW', 'FAILED_PICKUP'] },
          },
        },
      },
      distinct: ['deliveryId'],
      orderBy: ordered,
      select: primaryIncidentSelect,
    }),
    prisma.noShowReport.findMany({
      where: {
        ...base,
        status: 'PENDING_REVIEW',
        targetRole: { not: 'SYSTEM' },
      },
      distinct: ['deliveryId'],
      orderBy: ordered,
      select: primaryIncidentSelect,
    }),
    prisma.noShowReport.findMany({
      where: {
        ...base,
        status: { in: ['VERIFIED', 'REJECTED', 'RESOLVED_NO_STRIKE'] },
      },
      distinct: ['deliveryId'],
      orderBy: ordered,
      select: primaryIncidentSelect,
    }),
  ]);

  const selected = new Map<string, AdminDeliveryPrimaryIncident>();
  for (const candidates of [operational, pendingAccountability, terminal]) {
    for (const report of candidates) {
      if (report.deliveryId && !selected.has(report.deliveryId)) {
        selected.set(report.deliveryId, report);
      }
    }
  }
  return selected;
};

export const listAdminDeliveriesSummaryBatch = async (input: {
  query: AdminDeliveriesListQuery;
  cursor?: string;
  take: number;
}) =>
  prisma.delivery.findMany({
    where: buildAdminDeliveriesWhere(input.query),
    include: adminDeliveryListInclude,
    orderBy: { id: 'asc' },
    cursor: input.cursor ? { id: input.cursor } : undefined,
    skip: input.cursor ? 1 : undefined,
    take: input.take,
  });

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

/** Trimmed include for export — list-shaped, no phones/addressLine/group reservation lists. */
const adminDeliveryExportInclude = {
  reservation: {
    select: {
      id: true,
      status: true,
      fulfillmentMethod: true,
      pendingRescheduleRequestedBy: true,
      pendingRescheduleReason: true,
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
  assignedDriverProfile: {
    select: {
      id: true,
      displayName: true,
      user: {
        select: {
          email: true,
        },
      },
    },
  },
  deliveryGroup: {
    select: {
      id: true,
      status: true,
    },
  },
  assignments: {
    orderBy: [{ acceptedAt: 'desc' as const }, { id: 'desc' as const }],
    take: 2,
    select: {
      id: true,
      status: true,
      acceptedAt: true,
      releasedAt: true,
      driverProfile: {
        select: {
          id: true,
          displayName: true,
          user: { select: { email: true } },
        },
      },
    },
  },
  _count: { select: { incidentReports: true } },
} satisfies Prisma.DeliveryInclude;

export type AdminDeliveryExportKeysetCursor = {
  requestedAt: Date;
  id: string;
};

export type AdminDeliveryExportRecord = Prisma.DeliveryGetPayload<{
  include: typeof adminDeliveryExportInclude;
}>;

export const countAdminDeliveriesForExport = async (
  query: AdminDeliveriesExportFilters,
) => prisma.delivery.count({ where: buildAdminDeliveriesWhere(query) });

/**
 * Keyset pagination: requestedAt DESC, id DESC.
 * Predicate: requestedAt < cursor.requestedAt OR (requestedAt = cursor.requestedAt AND id < cursor.id)
 */
export const listAdminDeliveriesExportBatch = async (input: {
  query: AdminDeliveriesExportFilters;
  cursor?: AdminDeliveryExportKeysetCursor;
  take: number;
}): Promise<AdminDeliveryExportRecord[]> => {
  const baseWhere = buildAdminDeliveriesWhere(input.query);
  const where: Prisma.DeliveryWhereInput = input.cursor
    ? {
        AND: [
          baseWhere,
          {
            OR: [
              { requestedAt: { lt: input.cursor.requestedAt } },
              {
                AND: [
                  { requestedAt: input.cursor.requestedAt },
                  { id: { lt: input.cursor.id } },
                ],
              },
            ],
          },
        ],
      }
    : baseWhere;

  return prisma.delivery.findMany({
    where,
    include: adminDeliveryExportInclude,
    orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
    take: input.take,
  });
};

export const findAdminDeliveryById = async (id: string) => {
  return prisma.delivery.findUnique({
    where: { id },
    include: adminDeliveryDetailInclude,
  });
};

export const reopenDriverAssignmentForAdmin = async (input: {
  deliveryId: string;
  adminUserId: string;
}): Promise<ReopenDriverAssignmentResult> =>
  runSerializableTransaction(async (tx) => {
    const delivery = await loadReopenDelivery(tx, input.deliveryId);

    if (!delivery) {
      return { outcome: 'NOT_FOUND' as const };
    }

    if (delivery.status === 'WAITING_FOR_DRIVER') {
      return { outcome: 'ALREADY_WAITING' as const, status: delivery.status };
    }

    if (!delivery.assignedDriverProfileId || !delivery.assignedDriverProfile) {
      return { outcome: 'NOT_ASSIGNED' as const, status: delivery.status };
    }

    if (hasPickupStarted(delivery)) {
      return { outcome: 'PICKUP_STARTED' as const, status: delivery.status };
    }

    if (isTerminalDeliveryStatus(delivery.status)) {
      return { outcome: 'TERMINAL_OR_FAILED' as const, status: delivery.status };
    }

    if (delivery.status !== 'DRIVER_ASSIGNED') {
      return { outcome: 'NOT_ASSIGNED' as const, status: delivery.status };
    }

    if (
      delivery.deliveryGroup &&
      (delivery.deliveryGroup.status !== 'ASSIGNED' ||
        delivery.deliveryGroup.assignedDriverProfileId !==
          delivery.assignedDriverProfileId ||
        hasIncompatibleGroupedReservation(delivery))
    ) {
      return { outcome: 'GROUP_INCOMPATIBLE' as const, status: delivery.status };
    }

    const activeAssignmentCount = await tx.deliveryAssignment.count({
      where: {
        deliveryId: delivery.id,
        driverProfileId: delivery.assignedDriverProfileId,
        status: 'ACTIVE',
      },
    });

    if (activeAssignmentCount === 0) {
      return {
        outcome: 'ACTIVE_ASSIGNMENT_MISSING' as const,
        status: delivery.status,
      };
    }

    const now = new Date();
    const update = await tx.delivery.updateMany({
      where: {
        id: delivery.id,
        status: 'DRIVER_ASSIGNED',
        assignedDriverProfileId: delivery.assignedDriverProfileId,
      },
      data: {
        status: 'WAITING_FOR_DRIVER',
        assignedDriverProfileId: null,
        assignedAt: null,
      },
    });

    if (update.count !== 1) {
      return { outcome: 'CONCURRENT_UPDATE' as const, status: delivery.status };
    }

    const assignmentUpdate = await tx.deliveryAssignment.updateMany({
      where: {
        deliveryId: delivery.id,
        driverProfileId: delivery.assignedDriverProfileId,
        status: 'ACTIVE',
      },
      data: {
        status: 'RELEASED',
        releasedAt: now,
        releaseReason: 'Admin reopened delivery to driver pool',
      },
    });

    if (assignmentUpdate.count !== activeAssignmentCount) {
      throw new AppError(
        'Driver assignment changed. Refresh and try again.',
        409,
        'CONFLICT',
      );
    }

    if (delivery.deliveryGroup) {
      const groupUpdate = await tx.deliveryGroup.updateMany({
        where: {
          id: delivery.deliveryGroup.id,
          status: 'ASSIGNED',
          assignedDriverProfileId: delivery.assignedDriverProfileId,
        },
        data: {
          status: 'OPEN',
          assignedDriverProfileId: null,
        },
      });

      if (groupUpdate.count !== 1) {
        throw new AppError(
          'Grouped delivery state changed. Refresh and try again.',
          409,
          'CONFLICT',
        );
      }
    }

    await reconcileDriverAvailability(tx, delivery.assignedDriverProfileId);

    await tx.deliveryStatusHistory.create({
      data: {
        deliveryId: delivery.id,
        oldStatus: 'DRIVER_ASSIGNED',
        newStatus: 'WAITING_FOR_DRIVER',
        changedByUserId: input.adminUserId,
        note: 'Admin reopened delivery to driver pool',
      },
    });

    return {
      outcome: 'REOPENED' as const,
      deliveryId: delivery.id,
      removedDriverUserId: delivery.assignedDriverProfile.userId,
      materialTitle: delivery.reservation.material.title,
    };
  });
