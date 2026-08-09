import type {
  DeliveryStatus,
  Prisma,
  ReservationStatus,
} from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { DRIVER_IN_PROGRESS_ASSIGNED_STATUSES } from '../deliveries/deliveries.service.js';
import type { ListDriverArchiveQuery } from './driver.validation.js';

export type DriverArchiveCursorKind =
  | 'DRIVER_HISTORY'
  | 'DRIVER_INCIDENTS';

type ArchiveCursor = {
  v: 1;
  kind: DriverArchiveCursorKind;
  at: string;
  id: string;
};

type DriverArchiveDatabase = Pick<
  typeof prisma,
  'driverProfile' | 'delivery' | 'noShowReport'
>;

export const encodeDriverArchiveCursor = (
  kind: DriverArchiveCursorKind,
  at: Date,
  id: string,
) =>
  Buffer.from(
    JSON.stringify({
      v: 1,
      kind,
      at: at.toISOString(),
      id,
    } satisfies ArchiveCursor),
  ).toString('base64url');

export const decodeDriverArchiveCursor = (
  value: string | undefined,
  expectedKind: DriverArchiveCursorKind,
): { at: Date; id: string } | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as Partial<ArchiveCursor>;
    const at = new Date(parsed.at ?? '');
    return parsed.v === 1 &&
      parsed.kind === expectedKind &&
      typeof parsed.id === 'string' &&
      parsed.id.length > 0 &&
      !Number.isNaN(at.getTime())
      ? { at, id: parsed.id }
      : null;
  } catch {
    return null;
  }
};

const invalidCursor = (
  code: 'DRIVER_HISTORY_CURSOR_INVALID' | 'DRIVER_INCIDENTS_CURSOR_INVALID',
): never => {
  throw new AppError('The pagination cursor is invalid.', 400, code);
};

const findDriverProfile = async (
  userId: string,
  db: DriverArchiveDatabase,
) => {
  const profile = await db.driverProfile.findUnique({ where: { userId } });
  if (!profile || profile.status !== 'ACTIVE') {
    throw new AppError('Active driver profile required.', 403, 'FORBIDDEN');
  }
  return profile;
};

export const driverHistoricalWhere = (
  driverProfileId: string,
): Prisma.DeliveryWhereInput => ({
  assignments: { some: { driverProfileId } },
  NOT: {
    assignedDriverProfileId: driverProfileId,
    status: { in: [...DRIVER_IN_PROGRESS_ASSIGNED_STATUSES] },
  },
});

const historicalBaseSelect = (
  driverProfileId: string,
  driverUserId: string,
) => ({
  id: true,
  reservationId: true,
  deliveryGroupId: true,
  assignedDriverProfileId: true,
  status: true,
  requestedAt: true,
  assignedAt: true,
  arrivedPickupAt: true,
  pickedUpAt: true,
  onTheWayAt: true,
  arrivedDropoffAt: true,
  deliveredAt: true,
  cancelledAt: true,
  failedAt: true,
  failureReason: true,
  updatedAt: true,
  reservation: {
    select: {
      id: true,
      status: true,
      quantityRequested: true,
      material: {
        select: { id: true, title: true, unit: true, condition: true },
      },
      owner: {
        select: {
          displayName: true,
          supplierProfile: {
            select: {
              publicName: true,
              organizationProfile: { select: { organizationName: true } },
            },
          },
        },
      },
    },
  },
  deliveryGroup: {
    select: {
      reservations: {
        select: {
          id: true,
          quantityRequested: true,
          material: {
            select: { id: true, title: true, unit: true, condition: true },
          },
        },
        orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
        take: 50,
      },
    },
  },
  pickupLocation: { select: { country: true, city: true, area: true } },
  dropoffLocation: { select: { country: true, city: true, area: true } },
  assignments: {
    orderBy: [{ acceptedAt: 'desc' as const }, { id: 'desc' as const }],
    take: 50,
    select: {
      driverProfileId: true,
      status: true,
      acceptedAt: true,
      releasedAt: true,
    },
  },
  incidentReports: {
    where: { reporterUserId: driverUserId },
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
    take: 1,
    select: { id: true, reasonCode: true, status: true, createdAt: true },
  },
  _count: {
    select: {
      incidentReports: { where: { reporterUserId: driverUserId } },
    },
  },
}) satisfies Prisma.DeliverySelect;

export const driverHistoryListSelect = (
  driverProfileId: string,
  driverUserId: string,
) => ({
  ...historicalBaseSelect(driverProfileId, driverUserId),
  pickupItems: {
    orderBy: [
      { wasPicked: 'asc' as const },
      { recordedAt: 'asc' as const },
      { id: 'asc' as const },
    ],
    take: 50,
    select: {
      reservationId: true,
      materialId: true,
      materialTitle: true,
      quantity: true,
      unit: true,
      condition: true,
      wasPicked: true,
      unpickedReason: true,
      driverNote: true,
      recordedAt: true,
    },
  },
}) satisfies Prisma.DeliverySelect;

export const driverHistoryDetailSelect = (
  driverProfileId: string,
  driverUserId: string,
) => ({
  ...historicalBaseSelect(driverProfileId, driverUserId),
  pickupItems: {
    orderBy: [{ recordedAt: 'asc' as const }, { id: 'asc' as const }],
    select: {
      reservationId: true,
      materialId: true,
      materialTitle: true,
      quantity: true,
      unit: true,
      condition: true,
      wasPicked: true,
      unpickedReason: true,
      driverNote: true,
      recordedAt: true,
    },
  },
  statusHistory: {
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
    take: 50,
    select: { oldStatus: true, newStatus: true, createdAt: true },
  },
}) satisfies Prisma.DeliverySelect;

type HistoricalListDelivery = Prisma.DeliveryGetPayload<{
  select: ReturnType<typeof driverHistoryListSelect>;
}>;

type HistoricalDetailDelivery = Prisma.DeliveryGetPayload<{
  select: ReturnType<typeof driverHistoryDetailSelect>;
}>;

type HistoricalDelivery = HistoricalListDelivery | HistoricalDetailDelivery;

const supplierName = (delivery: HistoricalDelivery) =>
  delivery.reservation.owner.supplierProfile?.organizationProfile
    ?.organizationName ??
  delivery.reservation.owner.supplierProfile?.publicName ??
  delivery.reservation.owner.displayName;

const safeFailureReason = (value: string | null) => {
  if (!value) return null;
  const code = value.split(':', 1)[0]?.trim();
  return [
    'SUPPLIER_UNAVAILABLE',
    'MATERIAL_NOT_READY',
    'OTHER',
    'LEARNER_UNAVAILABLE',
    'ADDRESS_ISSUE',
    'ACCESS_ISSUE',
  ].includes(code)
    ? code
    : null;
};

export const classifyDriverAssignmentOutcome = (input: {
  status: DeliveryStatus;
  driverProfileId: string;
  assignments: Array<{
    driverProfileId: string;
    acceptedAt: Date;
    releasedAt: Date | null;
  }>;
}) => {
  const ownAssignment = input.assignments
    .filter((assignment) => assignment.driverProfileId === input.driverProfileId)
    .sort((left, right) => right.acceptedAt.getTime() - left.acceptedAt.getTime())[0];
  const laterAssignment = ownAssignment
    ? input.assignments.some(
        (assignment) =>
          assignment.driverProfileId !== input.driverProfileId &&
          assignment.acceptedAt.getTime() > ownAssignment.acceptedAt.getTime(),
      )
    : false;

  if (laterAssignment) return 'REASSIGNED' as const;
  if (input.status === 'AWAITING_RESOLUTION') {
    return 'MOVED_TO_ADMIN_REVIEW' as const;
  }
  if (input.status === 'WAITING_FOR_DRIVER') return 'RELEASED_TO_POOL' as const;
  return 'CLOSED' as const;
};

const mapCarriedItem = (item: HistoricalDelivery['pickupItems'][number]) => ({
  reservationId: item.reservationId,
  materialId: item.materialId,
  materialTitle: item.materialTitle,
  quantity: Number(item.quantity),
  unit: item.unit,
  condition: item.condition,
  recordedAt: item.recordedAt.toISOString(),
});

const mapUnpickedItem = (item: HistoricalDelivery['pickupItems'][number]) => ({
  ...mapCarriedItem(item),
  unpickedReason: item.unpickedReason,
  driverNote: item.driverNote,
});

const mapHistoricalBase = (
  delivery: HistoricalDelivery,
  driverProfileId: string,
) => {
  const hasAudit = delivery.pickupItems.length > 0;
  const auditedCarriedItems = delivery.pickupItems
    .filter((item) => item.wasPicked)
    .map(mapCarriedItem);
  const legacyFallback = delivery.deliveryGroup?.reservations.length
    ? delivery.deliveryGroup.reservations
    : [delivery.reservation];
  const carriedItems = hasAudit
    ? auditedCarriedItems
    : legacyFallback.map((item) => ({
        reservationId: item.id,
        materialId: item.material.id,
        materialTitle: item.material.title,
        quantity: Number(item.quantityRequested),
        unit: item.material.unit,
        condition: item.material.condition,
        recordedAt: null,
      }));
  const unpickedItems = hasAudit
    ? delivery.pickupItems.filter((item) => !item.wasPicked).map(mapUnpickedItem)
    : [];
  const ownAssignment = delivery.assignments.find(
    (assignment) => assignment.driverProfileId === driverProfileId,
  );

  return {
    id: delivery.id,
    reservationId: delivery.reservationId,
    deliveryGroupId: delivery.deliveryGroupId,
    groupedDelivery: delivery.deliveryGroupId != null,
    status: delivery.status,
    historicalAt: delivery.updatedAt.toISOString(),
    assignmentOutcome: classifyDriverAssignmentOutcome({
      status: delivery.status,
      driverProfileId,
      assignments: delivery.assignments,
    }),
    supplier: { displayName: supplierName(delivery) },
    pickupLocation: delivery.pickupLocation,
    dropoffLocation: delivery.dropoffLocation,
    itemCount: carriedItems.length,
    carriedItems,
    unpickedItems,
    partialPickupOccurred: unpickedItems.length > 0,
    itemAuditComplete: delivery.pickedUpAt == null || hasAudit,
    failureReasonCode: safeFailureReason(delivery.failureReason),
    requestedAt: delivery.requestedAt.toISOString(),
    assignedAt: delivery.assignedAt?.toISOString() ?? null,
    arrivedPickupAt: delivery.arrivedPickupAt?.toISOString() ?? null,
    pickedUpAt: delivery.pickedUpAt?.toISOString() ?? null,
    onTheWayAt: delivery.onTheWayAt?.toISOString() ?? null,
    arrivedDropoffAt: delivery.arrivedDropoffAt?.toISOString() ?? null,
    deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
    cancelledAt: delivery.cancelledAt?.toISOString() ?? null,
    failedAt: delivery.failedAt?.toISOString() ?? null,
    lastAssignment: ownAssignment
      ? {
          status: ownAssignment.status,
          acceptedAt: ownAssignment.acceptedAt.toISOString(),
          releasedAt: ownAssignment.releasedAt?.toISOString() ?? null,
        }
      : null,
    incidentSummary: delivery.incidentReports[0]
      ? {
          id: delivery.incidentReports[0].id,
          type: delivery.incidentReports[0].reasonCode,
          reviewStatus: delivery.incidentReports[0].status,
          createdAt: delivery.incidentReports[0].createdAt.toISOString(),
          count: delivery._count.incidentReports,
        }
      : null,
    readOnly: true,
  };
};

export const mapHistoricalDeliveryListItem = (
  delivery: HistoricalListDelivery,
  driverProfileId: string,
) => mapHistoricalBase(delivery, driverProfileId);

export const mapHistoricalDeliveryDetail = (
  delivery: HistoricalDetailDelivery,
  driverProfileId: string,
) => ({
  ...mapHistoricalBase(delivery, driverProfileId),
  statusTimeline: [...delivery.statusHistory]
    .reverse()
    .map((entry) => ({
      oldStatus: entry.oldStatus,
      newStatus: entry.newStatus,
      occurredAt: entry.createdAt.toISOString(),
    })),
});

export const listDriverDeliveryHistory = async (
  driverUserId: string,
  query: ListDriverArchiveQuery,
  db: DriverArchiveDatabase = prisma,
) => {
  const profile = await findDriverProfile(driverUserId, db);
  const cursor = decodeDriverArchiveCursor(query.cursor, 'DRIVER_HISTORY');
  if (query.cursor && !cursor) {
    invalidCursor('DRIVER_HISTORY_CURSOR_INVALID');
  }
  const limit = query.limit ?? 20;
  const rows = await db.delivery.findMany({
    where: {
      ...driverHistoricalWhere(profile.id),
      ...(cursor
        ? {
            AND: [
              {
                OR: [
                  { updatedAt: { lt: cursor.at } },
                  { updatedAt: cursor.at, id: { lt: cursor.id } },
                ],
              },
            ],
          }
        : {}),
    },
    select: driverHistoryListSelect(profile.id, driverUserId),
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);
  return {
    deliveries: page.map((row) =>
      mapHistoricalDeliveryListItem(row, profile.id),
    ),
    pagination: {
      limit,
      hasMore,
      nextCursor:
        hasMore && last
          ? encodeDriverArchiveCursor(
              'DRIVER_HISTORY',
              last.updatedAt,
              last.id,
            )
          : null,
    },
  };
};

export const getDriverHistoricalDelivery = async (
  driverUserId: string,
  deliveryId: string,
  db: DriverArchiveDatabase = prisma,
) => {
  const profile = await findDriverProfile(driverUserId, db);
  const delivery = await db.delivery.findFirst({
    where: { id: deliveryId, ...driverHistoricalWhere(profile.id) },
    select: driverHistoryDetailSelect(profile.id, driverUserId),
  });
  if (!delivery) throw new AppError('Delivery not found.', 404, 'NOT_FOUND');
  return mapHistoricalDeliveryDetail(delivery, profile.id);
};

export const driverIncidentOutcome = (report: {
  recoveryAction: string | null;
  recoveryCompletedAt: Date | null;
  holdReleasedAt: Date | null;
  reservation: { status: ReservationStatus };
}) => {
  if (report.holdReleasedAt) return 'RESERVATION_CANCELLED_OR_EXPIRED';
  if (report.recoveryCompletedAt) {
    return report.recoveryAction ?? 'REPLACEMENT_WINDOW_SUBMITTED';
  }
  if (report.recoveryAction) return report.recoveryAction;
  if (report.reservation.status === 'AWAITING_RESOLUTION') {
    return 'PENDING_RECOVERY';
  }
  return 'NO_RECOVERY_UPDATE';
};

export const listDriverIncidents = async (
  driverUserId: string,
  query: ListDriverArchiveQuery,
  db: DriverArchiveDatabase = prisma,
) => {
  const profile = await findDriverProfile(driverUserId, db);
  const cursor = decodeDriverArchiveCursor(query.cursor, 'DRIVER_INCIDENTS');
  if (query.cursor && !cursor) {
    invalidCursor('DRIVER_INCIDENTS_CURSOR_INVALID');
  }
  const limit = query.limit ?? 20;
  const rows = await db.noShowReport.findMany({
    where: {
      reporterUserId: driverUserId,
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.at } },
              { createdAt: cursor.at, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      deliveryId: true,
      reasonCode: true,
      targetRole: true,
      status: true,
      reporterReasonDetail: true,
      reporterNote: true,
      createdAt: true,
      reviewedAt: true,
      recoveryAction: true,
      recoveryActionAt: true,
      recoveryDeliveryId: true,
      recoveryCompletedAt: true,
      holdReleasedAt: true,
      reservation: {
        select: {
          id: true,
          status: true,
          material: { select: { id: true, title: true, unit: true } },
        },
      },
      delivery: {
        select: {
          status: true,
          assignedDriverProfileId: true,
          assignments: {
            where: { driverProfileId: profile.id },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });

  const recoveryIds = [
    ...new Set(
      rows
        .map((row) => row.recoveryDeliveryId)
        .filter((id): id is string => id != null),
    ),
  ];
  const authorizedRecoveries = recoveryIds.length
    ? await db.delivery.findMany({
        where: {
          id: { in: recoveryIds },
          assignments: { some: { driverProfileId: profile.id } },
        },
        select: { id: true, status: true, assignedDriverProfileId: true },
        take: recoveryIds.length,
      })
    : [];
  const recoveryById = new Map(
    authorizedRecoveries.map((delivery) => [delivery.id, delivery]),
  );
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);

  return {
    incidents: page.map((report) => {
      const recoveryDelivery = report.recoveryDeliveryId
        ? recoveryById.get(report.recoveryDeliveryId)
        : null;
      return {
        id: report.id,
        type: report.reasonCode,
        targetRole: report.targetRole,
        reviewStatus: report.status,
        reporterReasonDetail: report.reporterReasonDetail,
        reporterNote: report.reporterNote,
        createdAt: report.createdAt.toISOString(),
        reviewedAt: report.reviewedAt?.toISOString() ?? null,
        resolutionOutcome: driverIncidentOutcome(report),
        recoveryActionAt: report.recoveryActionAt?.toISOString() ?? null,
        recoveryCompletedAt:
          report.recoveryCompletedAt?.toISOString() ?? null,
        holdReleasedAt: report.holdReleasedAt?.toISOString() ?? null,
        reservation: report.reservation,
        relatedDelivery:
          report.deliveryId && report.delivery?.assignments.length
            ? {
                id: report.deliveryId,
                status: report.delivery.status,
                isHistorical: !(
                  report.delivery.assignedDriverProfileId === profile.id &&
                  (
                    DRIVER_IN_PROGRESS_ASSIGNED_STATUSES as readonly DeliveryStatus[]
                  ).includes(report.delivery.status)
                ),
              }
            : null,
        recoveryDelivery: recoveryDelivery
          ? {
              id: recoveryDelivery.id,
              status: recoveryDelivery.status,
              isHistorical: !(
                recoveryDelivery.assignedDriverProfileId === profile.id &&
                (
                  DRIVER_IN_PROGRESS_ASSIGNED_STATUSES as readonly DeliveryStatus[]
                ).includes(recoveryDelivery.status)
              ),
            }
          : null,
      };
    }),
    pagination: {
      limit,
      hasMore,
      nextCursor:
        hasMore && last
          ? encodeDriverArchiveCursor(
              'DRIVER_INCIDENTS',
              last.createdAt,
              last.id,
            )
          : null,
    },
  };
};
