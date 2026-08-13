import {
  Prisma,
  type ReservationFulfillmentMethod,
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
import { collectPickupCashForHandover } from '../payments/payments.handover.js';
import {
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
      returnRequiredAt: true,
      returnReason: true,
      returnedToSupplierAt: true,
      returnConfirmedByUserId: true,
      deliveryGroupId: true,
      pickupItems: {
        where: { wasPicked: true },
        select: { materialTitle: true, quantity: true, unit: true },
      },
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
          returnRequiredAt: true,
          returnReason: true,
          returnedToSupplierAt: true,
          returnConfirmedByUserId: true,
          pickupItems: {
            where: { wasPicked: true },
            select: { materialTitle: true, quantity: true, unit: true },
          },
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
  materialPaymentOrders: {
    where: { purpose: 'MATERIAL_SUBTOTAL' as const },
    select: {
      paymentMethod: true,
      status: true,
      amount: true,
      currency: true,
    },
    orderBy: { cycleNumber: 'desc' as const },
    take: 1,
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
  paymentMethod: true,
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
      returnRequiredAt: true,
      returnReason: true,
      returnedToSupplierAt: true,
      returnConfirmedByUserId: true,
      deliveryGroupId: true,
      pickupItems: {
        where: { wasPicked: true },
        select: { materialTitle: true, quantity: true, unit: true },
      },
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
          returnRequiredAt: true,
          returnReason: true,
          returnedToSupplierAt: true,
          returnConfirmedByUserId: true,
          pickupItems: {
            where: { wasPicked: true },
            select: { materialTitle: true, quantity: true, unit: true },
          },
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
  materialPaymentOrders: {
    where: { purpose: 'MATERIAL_SUBTOTAL' as const },
    select: {
      paymentMethod: true,
      status: true,
      amount: true,
      currency: true,
    },
    orderBy: { cycleNumber: 'desc' as const },
    take: 1,
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
  fulfillmentMethod: ReservationFulfillmentMethod;
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
  const updated = await tx.reservation.update({
    where: { id: input.reservation.id },
    data: {
      status: 'ACCEPTED',
      supplierPickupWindowStart: input.supplierPickupWindow.start,
      supplierPickupWindowEnd: input.supplierPickupWindow.end,
      earliestDeliveryStart: null,
      confirmedDeliveryWindowStart: null,
      confirmedDeliveryWindowEnd: null,
      schedulingConflictReason: null,
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

/**
 * Shared ACCEPTED → COMPLETED mutation for self-pickup.
 * Callers must already have verified payment, ownership, and credential/code.
 * Consumes any issued QR handover credential atomically with completion.
 */
export const finalizeAcceptedSelfPickupCompletion = async (
  tx: Prisma.TransactionClient,
  input: {
    reservation: {
      id: string;
      materialId: string;
      quantityRequested: Prisma.Decimal;
      pickupWindowStart: Date | null;
      pickupWindowEnd: Date | null;
      handoverTokenHash: string | null;
    };
    ownerId: string;
    now?: Date;
  },
): Promise<
  | { ok: true; reservationId: string }
  | { windowNotStarted: true }
  | { windowExpired: true }
  | { alreadyCompleted: true }
> => {
  const now = input.now ?? new Date();
  const timing = evaluateHandoverWindow(
    now,
    input.reservation.pickupWindowStart,
    input.reservation.pickupWindowEnd,
  );

  if (!timing.ok) {
    if (timing.reason === 'NOT_STARTED') {
      return { windowNotStarted: true };
    }

    return { windowExpired: true };
  }

  const updated = await tx.reservation.updateMany({
    where: {
      id: input.reservation.id,
      ownerId: input.ownerId,
      status: 'ACCEPTED',
    },
    data: {
      status: 'COMPLETED',
      completedAt: now,
      ...(input.reservation.handoverTokenHash
        ? { handoverTokenUsedAt: now }
        : {}),
    },
  });

  if (updated.count !== 1) {
    return { alreadyCompleted: true };
  }

  await tx.reservationStatusHistory.create({
    data: {
      reservationId: input.reservation.id,
      statusGroup: 'RESERVATION',
      oldStatus: 'ACCEPTED',
      newStatus: 'COMPLETED',
      changedBy: input.ownerId,
      note: formatReservationHistoryNote('PICKUP_COMPLETED_BY_SUPPLIER'),
    },
  });

  await applyReservationCompletionToMaterial(tx, {
    materialId: input.reservation.materialId,
    reservationId: input.reservation.id,
    quantityRequested: input.reservation.quantityRequested,
    completedAt: now,
  });

  return { ok: true, reservationId: input.reservation.id };
};

export const completeSupplierReservation = async (input: {
  reservationId: string;
  ownerId: string;
  confirmationCode: string;
  cashReceivedConfirmed?: boolean;
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

    await ensureSelfPickupCodeStored(tx, existing.id);

    const reservationWithCode = await tx.reservation.findUniqueOrThrow({
      where: { id: existing.id },
      select: { selfPickupCodeHash: true, handoverTokenHash: true },
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

    const now = new Date();
    await collectPickupCashForHandover(tx, {
      reservationId: existing.id,
      collectorUserId: input.ownerId,
      cashReceivedConfirmed: input.cashReceivedConfirmed,
      now,
    });

    const finalized = await finalizeAcceptedSelfPickupCompletion(tx, {
      reservation: {
        id: existing.id,
        materialId: existing.materialId,
        quantityRequested: existing.quantityRequested,
        pickupWindowStart: existing.pickupWindowStart,
        pickupWindowEnd: existing.pickupWindowEnd,
        handoverTokenHash: reservationWithCode.handoverTokenHash,
      },
      ownerId: input.ownerId,
      now,
    });

    if ('windowNotStarted' in finalized) {
      return { windowNotStarted: true as const, reservation: existing };
    }

    if ('windowExpired' in finalized) {
      return { windowExpired: true as const, reservation: existing };
    }

    if ('alreadyCompleted' in finalized) {
      const latest = await tx.reservation.findUniqueOrThrow({
        where: { id: existing.id },
      });
      return { conflict: true as const, reservation: latest };
    }

    return { conflict: false as const, reservationId: finalized.reservationId };
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

export const completeSupplierReservationByHandoverToken = async (input: {
  ownerId: string;
  tokenHash: string;
  cashReceivedConfirmed?: boolean;
}) => {
  const outcome = await runSerializableTransaction(async (tx) => {
    const existing = await tx.reservation.findFirst({
      where: {
        handoverTokenHash: input.tokenHash,
      },
    });

    if (!existing) {
      return { invalidCredential: true as const };
    }

    // Do not reveal whether a valid credential exists for another supplier.
    if (existing.ownerId !== input.ownerId) {
      return { invalidCredential: true as const };
    }

    if (existing.handoverTokenUsedAt) {
      if (existing.status === 'COMPLETED') {
        return { conflict: true as const, reservation: existing };
      }

      return { invalidCredential: true as const };
    }

    const now = new Date();
    if (
      existing.handoverTokenExpiresAt &&
      existing.handoverTokenExpiresAt.getTime() <= now.getTime()
    ) {
      return { expiredCredential: true as const };
    }

    if (existing.status !== 'ACCEPTED') {
      return { conflict: true as const, reservation: existing };
    }

    const deliveryCount = await tx.delivery.count({
      where: { reservationId: existing.id },
    });

    if (deliveryCount > 0 || existing.fulfillmentMethod !== 'PICKUP') {
      return { conflict: true as const, reservation: existing };
    }

    await collectPickupCashForHandover(tx, {
      reservationId: existing.id,
      collectorUserId: input.ownerId,
      cashReceivedConfirmed: input.cashReceivedConfirmed,
      now,
    });

    const finalized = await finalizeAcceptedSelfPickupCompletion(tx, {
      reservation: {
        id: existing.id,
        materialId: existing.materialId,
        quantityRequested: existing.quantityRequested,
        pickupWindowStart: existing.pickupWindowStart,
        pickupWindowEnd: existing.pickupWindowEnd,
        handoverTokenHash: existing.handoverTokenHash,
      },
      ownerId: input.ownerId,
      now,
    });

    if ('windowNotStarted' in finalized) {
      return { windowNotStarted: true as const, reservation: existing };
    }

    if ('windowExpired' in finalized) {
      return { windowExpired: true as const, reservation: existing };
    }

    if ('alreadyCompleted' in finalized) {
      const latest = await tx.reservation.findUniqueOrThrow({
        where: { id: existing.id },
      });
      return { conflict: true as const, reservation: latest };
    }

    return { conflict: false as const, reservationId: finalized.reservationId };
  });

  if ('invalidCredential' in outcome && outcome.invalidCredential) {
    return outcome;
  }

  if ('expiredCredential' in outcome && outcome.expiredCredential) {
    return outcome;
  }

  if ('conflict' in outcome && outcome.conflict) {
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
