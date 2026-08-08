import {
  Prisma,
  type ReservationStatus,
} from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';

import {
  applyReservationCompletionToMaterial,
  recomputeAndUpdateMaterialStatus,
  runSerializableTransaction,
} from '../reservations/reservations.quantity.js';
import { applyBuildReservationSyncInTransaction } from '../learning-projects/learning-projects.build-reservation-sync.js';
import { ACTIVE_RESERVATION_STATUSES } from '../reservations/reservation-status.js';
import { formatReservationHistoryNote } from '../reservations/reservation-status-history.js';
import { resolveReservationFollowUp } from '../reservations/reservation-follow-up.js';
import {
  buildSelfPickupCodeData,
  ensureSelfPickupCodeStored,
} from '../../utils/handover-codes.js';
import { verifyHandoverCodeWithAttemptLimit } from '../../utils/handover-code-attempts.js';
import { afterFinalAcceptanceInTransaction } from '../payments/payments.acceptance.js';
import {
  flushPostCommitPaymentRefunds,
  handleReservationPaymentLifecycleTransition,
  type PostCommitRefundTask,
} from '../payments/payments.lifecycle.js';
import { assertPickupPaymentSatisfiedOrThrow } from '../payments/payments.readiness.js';
import {
  computeEarliestDeliveryStart,
  findFeasibleDeliveryWindow,
  parsePreferredWindowsJson,
  resolvePreferredWindowByIndex,
  windowMatchesLearnerPreference,
  type PreferredWindow,
} from './supplier-reservation-scheduling.js';
import {
  MIN_PICKUP_NOTICE_MINUTES,
} from '../reservations/reservation-timing-policy.js';
import { evaluateHandoverWindow, isAfterAllowedEnd } from '../../utils/handover-timing.js';
import { createNoShowReportOnce } from '../no-show-reports/no-show-report.create.js';
import {
  isSupplierGeneralIncidentReasonCode,
  type SupplierNoShowReportReasonCode,
} from './supplier-reservations.validation.js';
import {
  assertRescheduleAllowedOutsideHandover,
  clearPendingRescheduleFields,
} from '../reservations/reservation-reschedule.js';

export const reservationInclude = {
  material: {
    include: {
      category: { select: { nameEn: true } },
      location: true,
      images: {
        orderBy: { sortOrder: 'asc' as const },
      },
    },
  },
  requester: {
    select: {
      id: true,
      displayName: true,
      profileImageUrl: true,
    },
  },
  deliveries: {
    select: {
      id: true,
      status: true,
      assignedDriverProfileId: true,
      requestedAt: true,
      assignedAt: true,
      pickedUpAt: true,
      deliveredAt: true,
      failedAt: true,
      failureReason: true,
      deliveryGroupId: true,
      assignedDriverProfile: {
        select: {
          id: true,
          displayName: true,
          user: { select: { id: true, displayName: true, profileImageUrl: true } },
        },
      },
    },
    orderBy: { requestedAt: 'desc' as const },
    take: 1,
  },
  deliveryGroup: {
    select: {
      id: true,
      deliveryFee: true,
      currency: true,
      status: true,
      assignedDriverProfileId: true,
      assignedDriverProfile: {
        select: {
          id: true,
          displayName: true,
          user: { select: { id: true, displayName: true, profileImageUrl: true } },
        },
      },
      delivery: {
        select: {
          id: true,
          status: true,
          assignedDriverProfileId: true,
          requestedAt: true,
          assignedAt: true,
          pickedUpAt: true,
          deliveredAt: true,
          failedAt: true,
          failureReason: true,
          assignedDriverProfile: {
            select: {
              id: true,
              displayName: true,
              user: { select: { id: true, displayName: true, profileImageUrl: true } },
            },
          },
        },
      },
      _count: {
        select: { reservations: true },
      },
    },
  },
  _count: {
    select: {
      deliveries: true,
      messages: true,
    },
  },
  noShowReports: {
    select: {
      id: true,
      targetUserId: true,
      targetRole: true,
      status: true,
      reasonCode: true,
      note: true,
      createdAt: true,
      reviewedAt: true,
      reviewNote: true,
    },
  },
} satisfies Prisma.ReservationInclude;

const supplierReservationListScalarSelect = {
  id: true,
  ownerId: true,
  status: true,
  quantityRequested: true,
  message: true,
  fulfillmentMethod: true,
  learnerPreferredPickupWindows: true,
  learnerPreferredDeliveryWindows: true,
  deliveryAddressText: true,
  safeDropoffAllowed: true,
  deliveryNote: true,
  createdAt: true,
  updatedAt: true,
  acceptedAt: true,
  rejectedAt: true,
  cancelledAt: true,
  pickupWindowStart: true,
  pickupWindowEnd: true,
  supplierProposedPickupWindowStart: true,
  supplierProposedPickupWindowEnd: true,
  learnerProposedPickupWindowStart: true,
  learnerProposedPickupWindowEnd: true,
  pendingRescheduleRequestedBy: true,
  pendingRescheduleReason: true,
  pendingRescheduleNote: true,
  supplierPickupWindowStart: true,
  supplierPickupWindowEnd: true,
  confirmedDeliveryWindowStart: true,
  confirmedDeliveryWindowEnd: true,
  earliestDeliveryStart: true,
  schedulingConflictReason: true,
  supplierNote: true,
  rejectionReason: true,
  completedAt: true,
} satisfies Prisma.ReservationSelect;

const supplierReservationListSelect = {
  ...supplierReservationListScalarSelect,
  material: {
    include: {
      category: { select: { nameEn: true } },
      location: true,
      images: {
        orderBy: { sortOrder: 'asc' as const },
      },
    },
  },
  requester: {
    select: {
      id: true,
      displayName: true,
      profileImageUrl: true,
    },
  },
  deliveries: {
    select: {
      id: true,
      status: true,
      assignedDriverProfileId: true,
      requestedAt: true,
      assignedAt: true,
      pickedUpAt: true,
      deliveredAt: true,
      failedAt: true,
      failureReason: true,
      deliveryGroupId: true,
      assignedDriverProfile: {
        select: {
          id: true,
          displayName: true,
          user: { select: { id: true, displayName: true, profileImageUrl: true } },
        },
      },
    },
    orderBy: { requestedAt: 'desc' as const },
    take: 1,
  },
  deliveryGroup: {
    select: {
      id: true,
      status: true,
      assignedDriverProfileId: true,
      assignedDriverProfile: {
        select: {
          id: true,
          displayName: true,
          user: { select: { id: true, displayName: true, profileImageUrl: true } },
        },
      },
      delivery: {
        select: {
          id: true,
          status: true,
          assignedDriverProfileId: true,
          requestedAt: true,
          assignedAt: true,
          pickedUpAt: true,
          deliveredAt: true,
          failedAt: true,
          failureReason: true,
          assignedDriverProfile: {
            select: {
              id: true,
              displayName: true,
              user: { select: { id: true, displayName: true, profileImageUrl: true } },
            },
          },
        },
      },
      _count: { select: { reservations: true } },
    },
  },
  _count: {
    select: {
      deliveries: true,
      messages: true,
    },
  },
  noShowReports: {
    select: {
      id: true,
      targetUserId: true,
      targetRole: true,
      status: true,
      reasonCode: true,
      note: true,
      createdAt: true,
      reviewedAt: true,
      reviewNote: true,
    },
  },
} satisfies Prisma.ReservationSelect;

export type SupplierReservationRecord = Prisma.ReservationGetPayload<{
  include: typeof reservationInclude;
}>;

export type SupplierReservationListRecord = Prisma.ReservationGetPayload<{
  select: typeof supplierReservationListSelect;
}>;

const supplierReservationDetailInclude = {
  ...reservationInclude,
  messages: {
    take: 5,
    orderBy: { createdAt: 'desc' as const },
    include: {
      sender: {
        select: { id: true, displayName: true, profileImageUrl: true },
      },
    },
  },
  statusHistory: {
    take: 50,
    orderBy: { createdAt: 'desc' as const },
    include: {
      changedByUser: { select: { id: true, displayName: true } },
    },
  },
} satisfies Prisma.ReservationInclude;

export type SupplierReservationDetailRecord = Prisma.ReservationGetPayload<{
  include: typeof supplierReservationDetailInclude;
}>;

const reservationMutationSelect = {
  id: true,
  status: true,
} satisfies Prisma.ReservationSelect;

type ReservationMutationResult = Prisma.ReservationGetPayload<{
  select: typeof reservationMutationSelect;
}>;

const loadSupplierReservationRecord = async (
  reservationId: string,
): Promise<SupplierReservationRecord> => {
  return prisma.reservation.findUniqueOrThrow({
    where: { id: reservationId },
    include: reservationInclude,
  });
};

const acceptReservationMaterialLocationSelect = {
  country: true,
  city: true,
  area: true,
  addressLine: true,
  latitude: true,
  longitude: true,
  isApproximate: true,
} satisfies Prisma.LocationSelect;

const acceptReservationExistingSelect = {
  id: true,
  status: true,
  materialId: true,
  fulfillmentMethod: true,
  learnerPreferredPickupWindows: true,
  learnerPreferredDeliveryWindows: true,
  requesterId: true,
  deliveryGroupId: true,
  deliveryAddressText: true,
  dropoffCity: true,
  dropoffArea: true,
  deliveryNote: true,
  material: {
    select: {
      location: {
        select: acceptReservationMaterialLocationSelect,
      },
    },
  },
} satisfies Prisma.ReservationSelect;

export const supplierCanCompleteReservation = (input: {
  status: ReservationStatus;
  fulfillmentMethod: string;
  hasDelivery: boolean;
}) => {
  if (input.status !== 'ACCEPTED') {
    return false;
  }

  if (input.fulfillmentMethod === 'DELIVERY') {
    return false;
  }

  if (input.hasDelivery) {
    return false;
  }

  return true;
};

export const findSupplierReservations = async (
  ownerId: string,
  statuses?: ReservationStatus[],
) => {
  return prisma.reservation.findMany({
    where: {
      ownerId,
      ...(statuses?.length ? { status: { in: statuses } } : {}),
    },
    select: supplierReservationListSelect,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
};

export const findSupplierReservationsByIds = async (
  ownerId: string,
  reservationIds: string[],
) => {
  if (reservationIds.length === 0) return [];

  return prisma.reservation.findMany({
    where: { ownerId, id: { in: reservationIds } },
    select: supplierReservationListSelect,
  });
};

export type SupplierReservationReadFilter = {
  statuses?: ReservationStatus[];
  fulfillmentMethod?: 'PICKUP' | 'DELIVERY';
  historyScope: 'ACTIVE' | 'TERMINAL' | 'ALL';
  materialId?: string;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
};

const buildSupplierReservationWhere = (
  ownerId: string,
  filter: SupplierReservationReadFilter,
): Prisma.ReservationWhereInput => {
  const and: Prisma.ReservationWhereInput[] = [{ ownerId }];

  if (filter.statuses?.length) {
    and.push({ status: { in: filter.statuses } });
  }
  if (filter.fulfillmentMethod) {
    and.push({ fulfillmentMethod: filter.fulfillmentMethod });
  }
  if (filter.materialId) and.push({ materialId: filter.materialId });
  if (filter.historyScope === 'ACTIVE') {
    and.push({ status: { in: [...ACTIVE_RESERVATION_STATUSES] } });
  }
  if (filter.historyScope === 'TERMINAL') {
    and.push({ status: { notIn: [...ACTIVE_RESERVATION_STATUSES] } });
  }
  if (filter.dateFrom || filter.dateTo) {
    and.push({
      createdAt: {
        ...(filter.dateFrom ? { gte: filter.dateFrom } : {}),
        ...(filter.dateTo ? { lte: filter.dateTo } : {}),
      },
    });
  }
  if (filter.search) {
    and.push({
      OR: [
        { id: { contains: filter.search, mode: 'insensitive' } },
        { material: { title: { contains: filter.search, mode: 'insensitive' } } },
        {
          requester: {
            displayName: { contains: filter.search, mode: 'insensitive' },
          },
        },
      ],
    });
  }

  return { AND: and };
};

/** Bounded batches keep contract summaries exact without loading every row at once. */
export const forEachSupplierReservationBatch = async (input: {
  ownerId: string;
  filter: SupplierReservationReadFilter;
  batchSize: number;
  onBatch: (items: SupplierReservationListRecord[]) => void;
}) => {
  const where = buildSupplierReservationWhere(input.ownerId, input.filter);
  let skip = 0;

  while (true) {
    const items = await prisma.reservation.findMany({
      where,
      select: supplierReservationListSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take: input.batchSize,
    });
    if (!items.length) return;
    input.onBatch(items);
    if (items.length < input.batchSize) return;
    skip += items.length;
  }
};

export const findSupplierReservationDetailForOwner = async (
  ownerId: string,
  reservationId: string,
): Promise<SupplierReservationDetailRecord | null> =>
  prisma.reservation.findFirst({
    where: { id: reservationId, ownerId },
    include: supplierReservationDetailInclude,
  });

const acceptPickupReservation = async (
  tx: Prisma.TransactionClient,
  input: {
    reservationId: string;
    proposedWindow: PreferredWindow;
    supplierNote: string | null;
    learnerPreferredPickupWindows: unknown;
    selectedPreferredWindowIndex?: number;
  },
): Promise<ReservationMutationResult> => {
  const pickupCodeData = await buildSelfPickupCodeData(input.reservationId);
  const learnerWindows = parsePreferredWindowsJson(
    input.learnerPreferredPickupWindows,
  );

  if (!learnerWindows.length) {
    const updated = await tx.reservation.update({
      where: { id: input.reservationId },
      data: {
        status: 'ACCEPTED',
        pickupWindowStart: input.proposedWindow.start,
        pickupWindowEnd: input.proposedWindow.end,
        supplierProposedPickupWindowStart: null,
        supplierProposedPickupWindowEnd: null,
        schedulingConflictReason: null,
        supplierNote: input.supplierNote,
        acceptedAt: new Date(),
        ...pickupCodeData.data,
      },
      select: reservationMutationSelect,
    });
    await afterFinalAcceptanceInTransaction(tx, {
      reservationId: updated.id,
    });
    return updated;
  }

  if (input.selectedPreferredWindowIndex != null) {
    const selectedWindow = resolvePreferredWindowByIndex(
      input.learnerPreferredPickupWindows,
      input.selectedPreferredWindowIndex,
    );

    if (!selectedWindow) {
      throw new Error('Selected preferred pickup window is invalid.');
    }

    const updated = await tx.reservation.update({
      where: { id: input.reservationId },
      data: {
        status: 'ACCEPTED',
        pickupWindowStart: selectedWindow.start,
        pickupWindowEnd: selectedWindow.end,
        supplierProposedPickupWindowStart: null,
        supplierProposedPickupWindowEnd: null,
        schedulingConflictReason: null,
        supplierNote: input.supplierNote,
        acceptedAt: new Date(),
        ...pickupCodeData.data,
      },
      select: reservationMutationSelect,
    });
    await afterFinalAcceptanceInTransaction(tx, {
      reservationId: updated.id,
    });
    return updated;
  }

  if (windowMatchesLearnerPreference(input.proposedWindow, learnerWindows)) {
    const updated = await tx.reservation.update({
      where: { id: input.reservationId },
      data: {
        status: 'ACCEPTED',
        pickupWindowStart: input.proposedWindow.start,
        pickupWindowEnd: input.proposedWindow.end,
        supplierProposedPickupWindowStart: null,
        supplierProposedPickupWindowEnd: null,
        schedulingConflictReason: null,
        supplierNote: input.supplierNote,
        acceptedAt: new Date(),
        ...pickupCodeData.data,
      },
      select: reservationMutationSelect,
    });
    await afterFinalAcceptanceInTransaction(tx, {
      reservationId: updated.id,
    });
    return updated;
  }

  return tx.reservation.update({
    where: { id: input.reservationId },
    data: {
      status: 'AWAITING_LEARNER_CONFIRMATION',
      supplierProposedPickupWindowStart: input.proposedWindow.start,
      supplierProposedPickupWindowEnd: input.proposedWindow.end,
      pickupWindowStart: null,
      pickupWindowEnd: null,
      schedulingConflictReason: null,
      supplierNote: input.supplierNote,
      acceptedAt: new Date(),
    },
    select: reservationMutationSelect,
  });
};

const acceptDeliveryWithConfirmedWindow = async (
  tx: Prisma.TransactionClient,
  input: {
    reservation: {
      id: string;
      requesterId: string;
      deliveryGroupId: string | null;
      deliveryAddressText: string | null;
      dropoffCity: string | null;
      dropoffArea: string | null;
      deliveryNote: string | null;
      material: {
        location: {
          country: string;
          city: string;
          area: string | null;
          addressLine: string | null;
          latitude: Prisma.Decimal | number | null;
          longitude: Prisma.Decimal | number | null;
          isApproximate: boolean;
        };
      };
    };
    ownerId: string;
    supplierPickupWindow: PreferredWindow;
    supplierNote: string | null;
    confirmedDeliveryWindow: PreferredWindow;
    earliestDeliveryStart: Date;
  },
) => {
  const updated = await tx.reservation.update({
    where: { id: input.reservation.id },
    data: {
      status: 'ACCEPTED',
      supplierPickupWindowStart: input.supplierPickupWindow.start,
      supplierPickupWindowEnd: input.supplierPickupWindow.end,
      confirmedDeliveryWindowStart: input.confirmedDeliveryWindow.start,
      confirmedDeliveryWindowEnd: input.confirmedDeliveryWindow.end,
      earliestDeliveryStart: input.earliestDeliveryStart,
      schedulingConflictReason: null,
      supplierProposedPickupWindowStart: null,
      supplierProposedPickupWindowEnd: null,
      supplierNote: input.supplierNote,
      acceptedAt: new Date(),
    },
    select: reservationMutationSelect,
  });

  await afterFinalAcceptanceInTransaction(tx, {
    reservationId: updated.id,
    ensureDelivery: {
      reservation: input.reservation,
      changedByUserId: input.ownerId,
      statusHistoryNote: 'Delivery created when supplier accepted reservation',
    },
  });

  return updated;
};

const acceptDeliveryReservation = async (
  tx: Prisma.TransactionClient,
  input: {
    reservation: {
      id: string;
      requesterId: string;
      deliveryGroupId: string | null;
      deliveryAddressText: string | null;
      dropoffCity: string | null;
      dropoffArea: string | null;
      deliveryNote: string | null;
      material: {
        location: {
          country: string;
          city: string;
          area: string | null;
          addressLine: string | null;
          latitude: Prisma.Decimal | number | null;
          longitude: Prisma.Decimal | number | null;
          isApproximate: boolean;
        };
      };
    };
    ownerId: string;
    supplierPickupWindow: PreferredWindow;
    supplierNote: string | null;
    learnerPreferredDeliveryWindows: unknown;
    selectedPreferredWindowIndex?: number;
    proposedDeliveryWindow?: PreferredWindow;
  },
): Promise<ReservationMutationResult> => {
  const learnerWindows = parsePreferredWindowsJson(
    input.learnerPreferredDeliveryWindows,
  );
  const earliestDeliveryStart = computeEarliestDeliveryStart(
    input.supplierPickupWindow.start,
  );

  if (input.proposedDeliveryWindow) {
    const isLearnerPreference = windowMatchesLearnerPreference(
      input.proposedDeliveryWindow,
      learnerWindows,
    );

    // Learner listed preferences and supplier proposed a different window → confirm.
    // Empty preferences mean the learner is flexible: auto-accept if feasible.
    if (!isLearnerPreference && learnerWindows.length > 0) {
      return tx.reservation.update({
        where: { id: input.reservation.id },
        data: {
          status: 'AWAITING_LEARNER_CONFIRMATION',
          supplierPickupWindowStart: input.supplierPickupWindow.start,
          supplierPickupWindowEnd: input.supplierPickupWindow.end,
          earliestDeliveryStart,
          confirmedDeliveryWindowStart: input.proposedDeliveryWindow.start,
          confirmedDeliveryWindowEnd: input.proposedDeliveryWindow.end,
          schedulingConflictReason: null,
          supplierNote: input.supplierNote,
          acceptedAt: new Date(),
        },
        select: reservationMutationSelect,
      });
    }

    const feasible = findFeasibleDeliveryWindow(
      input.supplierPickupWindow.start,
      [input.proposedDeliveryWindow],
    );

    if (feasible) {
      return acceptDeliveryWithConfirmedWindow(tx, {
        reservation: input.reservation,
        ownerId: input.ownerId,
        supplierPickupWindow: input.supplierPickupWindow,
        supplierNote: input.supplierNote,
        confirmedDeliveryWindow: feasible.confirmed,
        earliestDeliveryStart: feasible.earliestDeliveryStart,
      });
    }

    return tx.reservation.update({
      where: { id: input.reservation.id },
      data: {
        status: 'AWAITING_LEARNER_CONFIRMATION',
        supplierPickupWindowStart: input.supplierPickupWindow.start,
        supplierPickupWindowEnd: input.supplierPickupWindow.end,
        earliestDeliveryStart,
        confirmedDeliveryWindowStart: input.proposedDeliveryWindow.start,
        confirmedDeliveryWindowEnd: input.proposedDeliveryWindow.end,
        schedulingConflictReason:
          learnerWindows.length === 0
            ? 'Proposed delivery window is not feasible after supplier pickup and delivery buffer.'
            : 'Selected learner delivery window is not feasible after supplier pickup and delivery buffer.',
        supplierNote: input.supplierNote,
        acceptedAt: new Date(),
      },
      select: reservationMutationSelect,
    });
  }

  // Flexible learner with no delivery proposal: do not invent a fake conflict.
  // Service layer should require a proposed delivery window when prefs are empty.
  if (learnerWindows.length === 0) {
    return tx.reservation.update({
      where: { id: input.reservation.id },
      data: {
        status: 'AWAITING_LEARNER_CONFIRMATION',
        supplierPickupWindowStart: input.supplierPickupWindow.start,
        supplierPickupWindowEnd: input.supplierPickupWindow.end,
        earliestDeliveryStart,
        confirmedDeliveryWindowStart: null,
        confirmedDeliveryWindowEnd: null,
        schedulingConflictReason: null,
        supplierNote: input.supplierNote,
        acceptedAt: new Date(),
      },
      select: reservationMutationSelect,
    });
  }

  const windowsToEvaluate =
    input.selectedPreferredWindowIndex != null
      ? (() => {
          const selected = resolvePreferredWindowByIndex(
            input.learnerPreferredDeliveryWindows,
            input.selectedPreferredWindowIndex,
          );
          return selected ? [selected] : null;
        })()
      : learnerWindows;

  if (windowsToEvaluate === null) {
    throw new Error('Selected preferred delivery window is invalid.');
  }

  const feasible = findFeasibleDeliveryWindow(
    input.supplierPickupWindow.start,
    windowsToEvaluate,
  );

  if (feasible) {
    return acceptDeliveryWithConfirmedWindow(tx, {
      reservation: input.reservation,
      ownerId: input.ownerId,
      supplierPickupWindow: input.supplierPickupWindow,
      supplierNote: input.supplierNote,
      confirmedDeliveryWindow: feasible.confirmed,
      earliestDeliveryStart: feasible.earliestDeliveryStart,
    });
  }

  const conflictReason =
    input.selectedPreferredWindowIndex != null
      ? 'Selected learner delivery window is not feasible after supplier pickup and delivery buffer.'
      : 'No learner delivery window is feasible after supplier pickup and buffer.';

  return tx.reservation.update({
    where: { id: input.reservation.id },
    data: {
      status: 'AWAITING_LEARNER_CONFIRMATION',
      supplierPickupWindowStart: input.supplierPickupWindow.start,
      supplierPickupWindowEnd: input.supplierPickupWindow.end,
      earliestDeliveryStart,
      confirmedDeliveryWindowStart: null,
      confirmedDeliveryWindowEnd: null,
      schedulingConflictReason: conflictReason,
      supplierNote: input.supplierNote,
      acceptedAt: new Date(),
    },
    select: reservationMutationSelect,
  });
};

export const findSupplierReservationForOwner = async (
  ownerId: string,
  reservationId: string,
) => {
  return prisma.reservation.findFirst({
    where: {
      id: reservationId,
      ownerId,
    },
    include: reservationInclude,
  });
};

export const acceptSupplierReservation = async (input: {
  reservationId: string;
  ownerId: string;
  pickupWindowStart: Date;
  pickupWindowEnd: Date;
  supplierNote?: string;
  selectedPreferredWindowIndex?: number;
  proposedDeliveryWindow?: PreferredWindow;
}) => {
  const outcome = await prisma.$transaction(async (tx) => {
    const existing = await tx.reservation.findFirst({
      where: {
        id: input.reservationId,
        ownerId: input.ownerId,
      },
      select: acceptReservationExistingSelect,
    });

    if (!existing) {
      return null;
    }

    if (existing.status !== 'PENDING') {
      return { conflict: true as const, reservation: existing };
    }

    const supplierNote = input.supplierNote?.trim() || null;
    const proposedWindow: PreferredWindow = {
      start: input.pickupWindowStart,
      end: input.pickupWindowEnd,
    };

    const updated =
      existing.fulfillmentMethod === 'DELIVERY'
        ? await acceptDeliveryReservation(tx, {
            reservation: existing,
            ownerId: input.ownerId,
            supplierPickupWindow: proposedWindow,
            supplierNote,
            learnerPreferredDeliveryWindows:
              existing.learnerPreferredDeliveryWindows,
            selectedPreferredWindowIndex: input.selectedPreferredWindowIndex,
            proposedDeliveryWindow: input.proposedDeliveryWindow,
          })
        : await acceptPickupReservation(tx, {
            reservationId: existing.id,
            proposedWindow,
            supplierNote,
            learnerPreferredPickupWindows:
              existing.learnerPreferredPickupWindows,
            selectedPreferredWindowIndex: input.selectedPreferredWindowIndex,
          });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: updated.id,
        statusGroup: 'RESERVATION',
        oldStatus: 'PENDING',
        newStatus: updated.status,
        changedBy: input.ownerId,
        note: formatReservationHistoryNote('ACCEPTED_BY_SUPPLIER', {
          reasonText: supplierNote,
        }),
      },
    });

    await recomputeAndUpdateMaterialStatus(tx, existing.materialId);

    return { conflict: false as const, reservationId: updated.id };
  });

  if (!outcome) {
    return null;
  }

  if (outcome.conflict) {
    return outcome;
  }

  const reservation = await loadSupplierReservationRecord(outcome.reservationId);
  return { conflict: false as const, reservation };
};

export const declineSupplierReservation = async (input: {
  reservationId: string;
  ownerId: string;
  reason?: string;
}) => {
  const outcome = await prisma.$transaction(async (tx) => {
    const existing = await tx.reservation.findFirst({
      where: {
        id: input.reservationId,
        ownerId: input.ownerId,
      },
    });

    if (!existing) {
      return null;
    }

    if (existing.status !== 'PENDING') {
      return { conflict: true as const, reservation: existing };
    }

    const reason = input.reason?.trim() || null;

    const updated = await tx.reservation.update({
      where: { id: existing.id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
        rejectedAt: new Date(),
      },
      select: reservationMutationSelect,
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: updated.id,
        statusGroup: 'RESERVATION',
        oldStatus: 'PENDING',
        newStatus: 'REJECTED',
        changedBy: input.ownerId,
        note: formatReservationHistoryNote('DECLINED_BY_SUPPLIER', {
          reasonText: reason,
        }),
      },
    });

    await recomputeAndUpdateMaterialStatus(tx, existing.materialId);
    await applyBuildReservationSyncInTransaction(tx, updated.id);

    const payment = await handleReservationPaymentLifecycleTransition(tx, {
      reservationId: updated.id,
      newStatus: 'REJECTED',
      actorUserId: input.ownerId,
      reason: reason ?? 'Rejected by supplier',
    });

    return {
      conflict: false as const,
      reservationId: updated.id,
      postCommitRefunds: payment.postCommitRefunds,
      postCommitResolution: payment.postCommitResolution ?? null,
    };
  });

  if (!outcome) {
    return null;
  }

  if (outcome.conflict) {
    return outcome;
  }

  if ('postCommitRefunds' in outcome && outcome.postCommitRefunds) {
    await flushPostCommitPaymentRefunds(
      outcome.postCommitRefunds,
      'postCommitResolution' in outcome
        ? outcome.postCommitResolution
        : null,
    );
  }

  const reservation = await loadSupplierReservationRecord(outcome.reservationId);
  return { conflict: false as const, reservation };
};

export const completeSupplierReservation = async (input: {
  reservationId: string;
  ownerId: string;
  confirmationCode: string;
}) => {
  const outcome = await runSerializableTransaction(async (tx) => {
    const existing = await tx.reservation.findFirst({
      where: {
        id: input.reservationId,
        ownerId: input.ownerId,
      },
    });

    if (!existing) {
      return null;
    }

    if (existing.status !== 'ACCEPTED') {
      return { conflict: true as const, reservation: existing };
    }

    const deliveryCount = await tx.delivery.count({
      where: { reservationId: existing.id },
    });

    if (deliveryCount > 0) {
      return { conflict: true as const, reservation: existing };
    }

    if (existing.fulfillmentMethod !== 'PICKUP') {
      return { conflict: true as const, reservation: existing };
    }

    await assertPickupPaymentSatisfiedOrThrow(existing.id, tx);

    await ensureSelfPickupCodeStored(tx, existing.id);

    const reservationWithCode = await tx.reservation.findUniqueOrThrow({
      where: { id: existing.id },
      select: { selfPickupCodeHash: true },
    });

    const codeVerification = await verifyHandoverCodeWithAttemptLimit(tx, {
      userId: input.ownerId,
      scope: 'self-pickup',
      entityId: existing.id,
      providedCode: input.confirmationCode,
      storedHash: reservationWithCode.selfPickupCodeHash,
    });

    if (codeVerification.outcome === 'LOCKED') {
      return {
        locked: true as const,
        reservation: existing,
        retryAfterSeconds: codeVerification.retryAfterSeconds,
      };
    }

    if (codeVerification.outcome !== 'VALID') {
      return { invalidCode: true as const, reservation: existing };
    }

    const timing = evaluateHandoverWindow(
      new Date(),
      existing.pickupWindowStart,
      existing.pickupWindowEnd,
    );

    if (!timing.ok) {
      if (timing.reason === 'NOT_STARTED') {
        return { windowNotStarted: true as const, reservation: existing };
      }

      return { windowExpired: true as const, reservation: existing };
    }

    const now = new Date();

    const updated = await tx.reservation.update({
      where: { id: existing.id },
      data: {
        status: 'COMPLETED',
        completedAt: now,
      },
      select: reservationMutationSelect,
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: updated.id,
        statusGroup: 'RESERVATION',
        oldStatus: 'ACCEPTED',
        newStatus: 'COMPLETED',
        changedBy: input.ownerId,
        note: formatReservationHistoryNote('PICKUP_COMPLETED_BY_SUPPLIER'),
      },
    });

    await applyReservationCompletionToMaterial(tx, {
      materialId: existing.materialId,
      reservationId: updated.id,
      quantityRequested: existing.quantityRequested,
      completedAt: now,
    });

    return { conflict: false as const, reservationId: updated.id };
  });

  if (!outcome) {
    return null;
  }

  if ('conflict' in outcome && outcome.conflict) {
    return outcome;
  }

  if ('invalidCode' in outcome && outcome.invalidCode) {
    return outcome;
  }

  if ('locked' in outcome && outcome.locked) {
    return outcome;
  }

  if ('windowNotStarted' in outcome && outcome.windowNotStarted) {
    return outcome;
  }

  if ('windowExpired' in outcome && outcome.windowExpired) {
    return outcome;
  }

  const reservation = await loadSupplierReservationRecord(outcome.reservationId);
  return { conflict: false as const, reservation };
};

export const rescheduleSupplierReservation = async (input: {
  reservationId: string;
  ownerId: string;
  pickupWindowStart: Date;
  pickupWindowEnd: Date;
  supplierNote?: string;
  followUpMessage?: string;
  reason: string;
  note?: string;
}) => {
  const outcome = await prisma.$transaction(async (tx) => {
    const existing = await tx.reservation.findFirst({
      where: {
        id: input.reservationId,
        ownerId: input.ownerId,
      },
    });

    if (!existing) {
      return null;
    }

    if (
      existing.status !== 'ACCEPTED' &&
      existing.status !== 'AWAITING_SUPPLIER_CONFIRMATION'
    ) {
      return { conflict: true as const, reservation: existing };
    }

    if (existing.fulfillmentMethod !== 'PICKUP') {
      return { conflict: true as const, reservation: existing };
    }

    const phaseCheck = assertRescheduleAllowedOutsideHandover({
      pickupWindowStart: existing.pickupWindowStart,
      pickupWindowEnd: existing.pickupWindowEnd,
    });

    if (!phaseCheck.ok && existing.status === 'ACCEPTED') {
      return { duringHandover: true as const, reservation: existing };
    }

    const supplierNote = input.supplierNote?.trim() || existing.supplierNote;
    const reason = input.reason.trim();
    const note = input.note?.trim() || null;

    const updated = await tx.reservation.update({
      where: { id: existing.id },
      data: {
        status: 'AWAITING_LEARNER_CONFIRMATION',
        supplierProposedPickupWindowStart: input.pickupWindowStart,
        supplierProposedPickupWindowEnd: input.pickupWindowEnd,
        learnerProposedPickupWindowStart: null,
        learnerProposedPickupWindowEnd: null,
        pendingRescheduleRequestedBy: 'SUPPLIER',
        pendingRescheduleReason: reason,
        pendingRescheduleNote: note,
        supplierNote,
      },
      select: reservationMutationSelect,
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: updated.id,
        statusGroup: 'RESERVATION',
        oldStatus: existing.status,
        newStatus: 'AWAITING_LEARNER_CONFIRMATION',
        changedBy: input.ownerId,
        note: formatReservationHistoryNote('SUPPLIER_REQUESTED_RESCHEDULE', {
          reasonText: reason,
        }),
      },
    });

    if (input.followUpMessage?.trim()) {
      await tx.reservationMessage.create({
        data: {
          reservationId: updated.id,
          senderUserId: input.ownerId,
          body: input.followUpMessage.trim(),
        },
      });
    }

    return { conflict: false as const, reservationId: updated.id };
  });

  if (!outcome) {
    return null;
  }

  if ('conflict' in outcome && outcome.conflict) {
    return outcome;
  }

  if ('duringHandover' in outcome && outcome.duringHandover) {
    return outcome;
  }

  const reservation = await loadSupplierReservationRecord(outcome.reservationId);
  return { conflict: false as const, reservation };
};

export const acceptLearnerRescheduleProposal = async (input: {
  reservationId: string;
  ownerId: string;
}) => {
  const outcome = await prisma.$transaction(async (tx) => {
    const existing = await tx.reservation.findFirst({
      where: {
        id: input.reservationId,
        ownerId: input.ownerId,
      },
    });

    if (!existing) {
      return null;
    }

    if (existing.status !== 'AWAITING_SUPPLIER_CONFIRMATION') {
      return { conflict: true as const, reservation: existing };
    }

    if (
      !existing.learnerProposedPickupWindowStart ||
      !existing.learnerProposedPickupWindowEnd
    ) {
      return { missingProposal: true as const, reservation: existing };
    }

    if (
      existing.learnerProposedPickupWindowEnd.getTime() <
      Date.now() + MIN_PICKUP_NOTICE_MINUTES * 60_000
    ) {
      return { windowTooClose: true as const, reservation: existing };
    }

    const pickupCodeData = await buildSelfPickupCodeData(existing.id);

    const updated = await tx.reservation.update({
      where: { id: existing.id },
      data: {
        status: 'ACCEPTED',
        pickupWindowStart: existing.learnerProposedPickupWindowStart,
        pickupWindowEnd: existing.learnerProposedPickupWindowEnd,
        ...clearPendingRescheduleFields(),
        ...pickupCodeData.data,
      },
      select: reservationMutationSelect,
    });

    await afterFinalAcceptanceInTransaction(tx, {
      reservationId: updated.id,
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: updated.id,
        statusGroup: 'RESERVATION',
        oldStatus: 'AWAITING_SUPPLIER_CONFIRMATION',
        newStatus: 'ACCEPTED',
        changedBy: input.ownerId,
        note: formatReservationHistoryNote('SUPPLIER_ACCEPTED_LEARNER_RESCHEDULE'),
      },
    });

    await recomputeAndUpdateMaterialStatus(tx, existing.materialId);

    return { conflict: false as const, reservationId: updated.id };
  });

  if (!outcome) {
    return null;
  }

  if (
    ('conflict' in outcome && outcome.conflict) ||
    ('missingProposal' in outcome && outcome.missingProposal) ||
    ('windowTooClose' in outcome && outcome.windowTooClose)
  ) {
    return outcome;
  }

  const reservation = await loadSupplierReservationRecord(outcome.reservationId);
  return { conflict: false as const, reservation };
};

export const cancelSupplierAcceptedReservation = async (input: {
  reservationId: string;
  ownerId: string;
  reason?: string;
}) => {
  const outcome = await runSerializableTransaction(async (tx) => {
    const existing = await tx.reservation.findFirst({
      where: {
        id: input.reservationId,
        ownerId: input.ownerId,
      },
    });

    if (!existing) {
      return null;
    }

    if (existing.status !== 'ACCEPTED' && existing.status !== 'AWAITING_SUPPLIER_CONFIRMATION') {
      return { conflict: true as const, reservation: existing };
    }

    if (existing.status === 'AWAITING_SUPPLIER_CONFIRMATION') {
      const now = new Date();
      const reason =
        input.reason?.trim() ||
        'Pickup reservation closed after learner reschedule request';

      const updated = await tx.reservation.update({
        where: { id: existing.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          rejectionReason: reason,
          ...clearPendingRescheduleFields(),
        },
        select: reservationMutationSelect,
      });

      await tx.reservationStatusHistory.create({
        data: {
          reservationId: updated.id,
          statusGroup: 'RESERVATION',
          oldStatus: 'AWAITING_SUPPLIER_CONFIRMATION',
          newStatus: 'CANCELLED',
          changedBy: input.ownerId,
          note: formatReservationHistoryNote('SUPPLIER_CANCELLED_PENDING_RESCHEDULE', {
            reasonText: reason,
          }),
        },
      });

      await recomputeAndUpdateMaterialStatus(tx, existing.materialId);
      await applyBuildReservationSyncInTransaction(tx, updated.id);

      const payment = await handleReservationPaymentLifecycleTransition(tx, {
        reservationId: updated.id,
        newStatus: 'CANCELLED',
        actorUserId: input.ownerId,
        reason,
      });

      return {
        conflict: false as const,
        reservationId: updated.id,
        postCommitRefunds: payment.postCommitRefunds,
        postCommitResolution: payment.postCommitResolution ?? null,
      };
    }

    if (
      !existing.pickupWindowEnd ||
      !isAfterAllowedEnd(new Date(), existing.pickupWindowEnd) ||
      existing.fulfillmentMethod !== 'PICKUP'
    ) {
      return { notOverdue: true as const, reservation: existing };
    }

    const deliveryCount = await tx.delivery.count({
      where: { reservationId: existing.id },
    });

    if (deliveryCount > 0) {
      return { deliveryBlocked: true as const, reservation: existing };
    }

    const now = new Date();
    const reason =
      input.reason?.trim() ||
      'Pickup reservation cancelled after the window passed';

    const updated = await tx.reservation.update({
      where: { id: existing.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: now,
        rejectionReason: reason,
      },
      select: reservationMutationSelect,
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: updated.id,
        statusGroup: 'RESERVATION',
        oldStatus: 'ACCEPTED',
        newStatus: 'CANCELLED',
        changedBy: input.ownerId,
        note: formatReservationHistoryNote('SUPPLIER_CANCELLED', {
          reasonText: reason,
        }),
      },
    });

    await recomputeAndUpdateMaterialStatus(tx, existing.materialId);
    await applyBuildReservationSyncInTransaction(tx, updated.id);

    const payment = await handleReservationPaymentLifecycleTransition(tx, {
      reservationId: updated.id,
      newStatus: 'CANCELLED',
      actorUserId: input.ownerId,
      reason,
    });

    return {
      conflict: false as const,
      reservationId: updated.id,
      postCommitRefunds: payment.postCommitRefunds,
      postCommitResolution: payment.postCommitResolution ?? null,
    };
  });

  if (!outcome) {
    return null;
  }

  if (
    ('conflict' in outcome && outcome.conflict) ||
    ('notOverdue' in outcome && outcome.notOverdue) ||
    ('deliveryBlocked' in outcome && outcome.deliveryBlocked)
  ) {
    return outcome;
  }

  if ('postCommitRefunds' in outcome && outcome.postCommitRefunds) {
    await flushPostCommitPaymentRefunds(
      outcome.postCommitRefunds,
      'postCommitResolution' in outcome
        ? outcome.postCommitResolution
        : null,
    );
  }

  const reservation = await loadSupplierReservationRecord(outcome.reservationId);
  return { conflict: false as const, reservation };
};

export const createSupplierNoShowReport = async (input: {
  reservationId: string;
  ownerId: string;
  reasonCode: SupplierNoShowReportReasonCode;
  note?: string;
}) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.reservation.findFirst({
      where: {
        id: input.reservationId,
        ownerId: input.ownerId,
      },
      select: {
        id: true,
        status: true,
        requesterId: true,
        fulfillmentMethod: true,
        pickupWindowStart: true,
        pickupWindowEnd: true,
        materialId: true,
      },
    });

    if (!existing) {
      return null;
    }

    const latestDelivery = await tx.delivery.findFirst({
      where: { reservationId: existing.id },
      select: {
        id: true,
        assignedDriverProfileId: true,
      },
      orderBy: { requestedAt: 'desc' },
    });

    let latestDeliveryDriverUserId: string | null = null;
    if (latestDelivery?.assignedDriverProfileId) {
      const driverProfile = await tx.driverProfile.findUnique({
        where: { id: latestDelivery.assignedDriverProfileId },
        select: { userId: true },
      });
      latestDeliveryDriverUserId = driverProfile?.userId ?? null;
    }

    if (
      existing.status !== 'ACCEPTED' &&
      existing.status !== 'AWAITING_SUPPLIER_CONFIRMATION'
    ) {
      return { conflict: true as const };
    }

    const canReportWithoutOverdueWindow =
      existing.status === 'AWAITING_SUPPLIER_CONFIRMATION';

    if (
      !canReportWithoutOverdueWindow &&
      (!existing.pickupWindowEnd ||
        !isAfterAllowedEnd(new Date(), existing.pickupWindowEnd))
    ) {
      return { windowNotEnded: true as const };
    }

    const isGeneralIncident = isSupplierGeneralIncidentReasonCode(input.reasonCode);
    let targetUserId = existing.requesterId;
    let targetRole: 'LEARNER' | 'DRIVER' = 'LEARNER';

    if (!isGeneralIncident) {
      if (latestDelivery) {
        if (latestDeliveryDriverUserId) {
          targetUserId = latestDeliveryDriverUserId;
          targetRole = 'DRIVER';
        } else if (input.reasonCode === 'DRIVER_DID_NOT_ARRIVE') {
          return { driverNotAssigned: true as const };
        }
      } else if (input.reasonCode === 'DRIVER_DID_NOT_ARRIVE') {
        return { driverNotAssigned: true as const };
      }
    }

    const reportResult = await createNoShowReportOnce(tx, {
      key: {
        reservationId: existing.id,
        deliveryId: latestDelivery?.id ?? null,
        targetRole,
        targetUserId,
        reasonCode: input.reasonCode,
      },
      data: {
        reservationId: existing.id,
        deliveryId: latestDelivery?.id ?? null,
        reporterUserId: input.ownerId,
        targetUserId,
        targetRole,
        reasonCode: input.reasonCode,
        note: input.note?.trim() || null,
        pickupWindowStart: existing.pickupWindowStart,
        pickupWindowEnd: existing.pickupWindowEnd,
      },
    });

    if (!reportResult.created) {
      return { duplicate: true as const, report: reportResult.report };
    }

    const report = reportResult.report;

    const isSelfPickupOverdue =
      existing.fulfillmentMethod === 'PICKUP' &&
      latestDelivery == null &&
      (existing.status === 'AWAITING_SUPPLIER_CONFIRMATION' ||
        (existing.pickupWindowEnd != null &&
          isAfterAllowedEnd(new Date(), existing.pickupWindowEnd)));

    if (isSelfPickupOverdue && !isGeneralIncident) {
      await tx.reservation.update({
        where: { id: existing.id },
        data: { status: 'AWAITING_RESOLUTION' },
      });

      await tx.reservationStatusHistory.create({
        data: {
          reservationId: existing.id,
          statusGroup: 'RESERVATION',
          oldStatus: 'ACCEPTED',
          newStatus: 'AWAITING_RESOLUTION',
          changedBy: input.ownerId,
          note: formatReservationHistoryNote('REPORTED_AFTER_MISSED_PICKUP'),
        },
      });

      await recomputeAndUpdateMaterialStatus(tx, existing.materialId);
      await applyBuildReservationSyncInTransaction(tx, existing.id);
    }

    return { report };
  });
};
