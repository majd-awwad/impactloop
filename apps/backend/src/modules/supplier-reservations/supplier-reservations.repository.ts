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
import { resolveReservationFollowUp } from '../reservations/reservation-follow-up.js';
import {
  buildSelfPickupCodeData,
  ensureSelfPickupCodeStored,
  verifyHandoverCode,
} from '../../utils/handover-codes.js';
import { ensureDeliveryForAcceptedReservation } from '../delivery-groups/delivery-group-operations.service.js';
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
      delivery: {
        select: {
          id: true,
          status: true,
          assignedDriverProfileId: true,
        },
      },
      reservations: {
        where: {
          status: 'ACCEPTED',
          fulfillmentMethod: 'DELIVERY',
        },
        select: {
          id: true,
          materialSubtotal: true,
        },
      },
    },
  },
  _count: {
    select: {
      deliveries: true,
    },
  },
  noShowReports: {
    select: {
      id: true,
      targetUserId: true,
      targetRole: true,
      status: true,
      reasonCode: true,
      createdAt: true,
    },
  },
} satisfies Prisma.ReservationInclude;

export type SupplierReservationRecord = Prisma.ReservationGetPayload<{
  include: typeof reservationInclude;
}>;

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
    include: reservationInclude,
    orderBy: { createdAt: 'desc' },
  });
};

const acceptPickupReservation = async (
  tx: Prisma.TransactionClient,
  input: {
    reservationId: string;
    ownerId: string;
    proposedWindow: PreferredWindow;
    supplierNote: string | null;
    learnerPreferredPickupWindows: unknown;
    selectedPreferredWindowIndex?: number;
  },
) => {
  const pickupCodeData = await buildSelfPickupCodeData(input.reservationId);
  const learnerWindows = parsePreferredWindowsJson(
    input.learnerPreferredPickupWindows,
  );

  if (!learnerWindows.length) {
    return tx.reservation.update({
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
      include: reservationInclude,
    });
  }

  if (input.selectedPreferredWindowIndex != null) {
    const selectedWindow = resolvePreferredWindowByIndex(
      input.learnerPreferredPickupWindows,
      input.selectedPreferredWindowIndex,
    );

    if (!selectedWindow) {
      throw new Error('Selected preferred pickup window is invalid.');
    }

    return tx.reservation.update({
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
      include: reservationInclude,
    });
  }

  if (windowMatchesLearnerPreference(input.proposedWindow, learnerWindows)) {
    return tx.reservation.update({
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
      include: reservationInclude,
    });
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
    include: reservationInclude,
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
  const reservation = await tx.reservation.update({
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
    include: reservationInclude,
  });

  await ensureDeliveryForAcceptedReservation(tx, {
    reservation: input.reservation,
    changedByUserId: input.ownerId,
    statusHistoryNote: 'Delivery created when supplier accepted reservation',
  });

  return tx.reservation.findFirstOrThrow({
    where: { id: input.reservation.id },
    include: reservationInclude,
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
) => {
  const learnerWindows = parsePreferredWindowsJson(
    input.learnerPreferredDeliveryWindows,
  );
  const earliestDeliveryStart = computeEarliestDeliveryStart(
    input.supplierPickupWindow.end,
  );

  if (input.proposedDeliveryWindow) {
    const isLearnerPreference = windowMatchesLearnerPreference(
      input.proposedDeliveryWindow,
      learnerWindows,
    );

    if (!isLearnerPreference) {
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
        include: reservationInclude,
      });
    }

    const feasible = findFeasibleDeliveryWindow(
      input.supplierPickupWindow.end,
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
        confirmedDeliveryWindowStart: null,
        confirmedDeliveryWindowEnd: null,
        schedulingConflictReason:
          'Selected learner delivery window is not feasible after supplier pickup and delivery buffer.',
        supplierNote: input.supplierNote,
        acceptedAt: new Date(),
      },
      include: reservationInclude,
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
    input.supplierPickupWindow.end,
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
    include: reservationInclude,
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
  return prisma.$transaction(async (tx) => {
    const existing = await tx.reservation.findFirst({
      where: {
        id: input.reservationId,
        ownerId: input.ownerId,
      },
      include: {
        material: {
          include: {
            location: true,
          },
        },
      },
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

    const reservation =
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
            ownerId: input.ownerId,
            proposedWindow,
            supplierNote,
            learnerPreferredPickupWindows:
              existing.learnerPreferredPickupWindows,
            selectedPreferredWindowIndex: input.selectedPreferredWindowIndex,
          });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: reservation.id,
        statusGroup: 'RESERVATION',
        oldStatus: 'PENDING',
        newStatus: reservation.status,
        changedBy: input.ownerId,
        note: supplierNote ?? 'Accepted by supplier',
      },
    });

    await recomputeAndUpdateMaterialStatus(tx, existing.materialId);

    return { conflict: false as const, reservation };
  });
};

export const declineSupplierReservation = async (input: {
  reservationId: string;
  ownerId: string;
  reason?: string;
}) => {
  return prisma.$transaction(async (tx) => {
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

    const reservation = await tx.reservation.update({
      where: { id: existing.id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
        rejectedAt: new Date(),
      },
      include: reservationInclude,
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: reservation.id,
        statusGroup: 'RESERVATION',
        oldStatus: 'PENDING',
        newStatus: 'REJECTED',
        changedBy: input.ownerId,
        note: reason,
      },
    });

    await recomputeAndUpdateMaterialStatus(tx, existing.materialId);

    return { conflict: false as const, reservation };
  });
};

export const completeSupplierReservation = async (input: {
  reservationId: string;
  ownerId: string;
  confirmationCode: string;
}) => {
  return runSerializableTransaction(async (tx) => {
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
      select: { selfPickupCodeHash: true },
    });

    const codeValid = await verifyHandoverCode(
      input.confirmationCode,
      reservationWithCode.selfPickupCodeHash,
    );

    if (!codeValid) {
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

    const reservation = await tx.reservation.update({
      where: { id: existing.id },
      data: {
        status: 'COMPLETED',
        completedAt: now,
      },
      include: reservationInclude,
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: reservation.id,
        statusGroup: 'RESERVATION',
        oldStatus: 'ACCEPTED',
        newStatus: 'COMPLETED',
        changedBy: input.ownerId,
        note: 'Pickup completed by supplier',
      },
    });

    await applyReservationCompletionToMaterial(tx, {
      materialId: existing.materialId,
      reservationId: reservation.id,
      quantityRequested: existing.quantityRequested,
      completedAt: now,
    });

    return { conflict: false as const, reservation };
  });
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
  return prisma.$transaction(async (tx) => {
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

    const reservation = await tx.reservation.update({
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
      include: reservationInclude,
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: reservation.id,
        statusGroup: 'RESERVATION',
        oldStatus: existing.status,
        newStatus: 'AWAITING_LEARNER_CONFIRMATION',
        changedBy: input.ownerId,
        note: `Supplier requested reschedule: ${reason}`,
      },
    });

    if (input.followUpMessage?.trim()) {
      await tx.reservationMessage.create({
        data: {
          reservationId: reservation.id,
          senderUserId: input.ownerId,
          body: input.followUpMessage.trim(),
        },
      });
    }

    return { conflict: false as const, reservation };
  });
};

export const acceptLearnerRescheduleProposal = async (input: {
  reservationId: string;
  ownerId: string;
}) => {
  return prisma.$transaction(async (tx) => {
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

    const reservation = await tx.reservation.update({
      where: { id: existing.id },
      data: {
        status: 'ACCEPTED',
        pickupWindowStart: existing.learnerProposedPickupWindowStart,
        pickupWindowEnd: existing.learnerProposedPickupWindowEnd,
        ...clearPendingRescheduleFields(),
        ...pickupCodeData.data,
      },
      include: reservationInclude,
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: reservation.id,
        statusGroup: 'RESERVATION',
        oldStatus: 'AWAITING_SUPPLIER_CONFIRMATION',
        newStatus: 'ACCEPTED',
        changedBy: input.ownerId,
        note: 'Supplier accepted learner reschedule proposal',
      },
    });

    await recomputeAndUpdateMaterialStatus(tx, existing.materialId);

    return { conflict: false as const, reservation };
  });
};

export const cancelSupplierAcceptedReservation = async (input: {
  reservationId: string;
  ownerId: string;
  reason?: string;
}) => {
  return runSerializableTransaction(async (tx) => {
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

      const reservation = await tx.reservation.update({
        where: { id: existing.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          rejectionReason: reason,
          ...clearPendingRescheduleFields(),
        },
        include: reservationInclude,
      });

      await tx.reservationStatusHistory.create({
        data: {
          reservationId: reservation.id,
          statusGroup: 'RESERVATION',
          oldStatus: 'AWAITING_SUPPLIER_CONFIRMATION',
          newStatus: 'CANCELLED',
          changedBy: input.ownerId,
          note: reason,
        },
      });

      await recomputeAndUpdateMaterialStatus(tx, existing.materialId);

      return { conflict: false as const, reservation };
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

    const reservation = await tx.reservation.update({
      where: { id: existing.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: now,
        rejectionReason: reason,
      },
      include: reservationInclude,
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: reservation.id,
        statusGroup: 'RESERVATION',
        oldStatus: 'ACCEPTED',
        newStatus: 'CANCELLED',
        changedBy: input.ownerId,
        note: reason,
      },
    });

    await recomputeAndUpdateMaterialStatus(tx, existing.materialId);

    return { conflict: false as const, reservation };
  });
};

export const createSupplierNoShowReport = async (input: {
  reservationId: string;
  ownerId: string;
  reasonCode: 'LEARNER_DID_NOT_ARRIVE' | 'DRIVER_DID_NOT_ARRIVE' | 'NO_RESPONSE_AFTER_PICKUP_WINDOW' | 'OTHER';
  note?: string;
}) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.reservation.findFirst({
      where: {
        id: input.reservationId,
        ownerId: input.ownerId,
      },
      include: {
        deliveries: {
          select: {
            id: true,
            assignedDriverProfileId: true,
            assignedDriverProfile: {
              select: { userId: true },
            },
          },
          orderBy: { requestedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!existing) {
      return null;
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

    const latestDelivery = existing.deliveries[0] ?? null;
    let targetUserId = existing.requesterId;
    let targetRole: 'LEARNER' | 'DRIVER' = 'LEARNER';

    if (latestDelivery) {
      const driverUserId = latestDelivery?.assignedDriverProfile?.userId;
      if (driverUserId) {
        targetUserId = driverUserId;
        targetRole = 'DRIVER';
      } else if (input.reasonCode === 'DRIVER_DID_NOT_ARRIVE') {
        return { driverNotAssigned: true as const };
      }
    } else if (input.reasonCode === 'DRIVER_DID_NOT_ARRIVE') {
      return { driverNotAssigned: true as const };
    }

    const duplicate = await tx.noShowReport.findUnique({
      where: {
        reservationId_targetUserId: {
          reservationId: existing.id,
          targetUserId,
        },
      },
    });

    if (duplicate) {
      return { duplicate: true as const, report: duplicate };
    }

    const report = await tx.noShowReport.create({
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

    const isSelfPickupOverdue =
      existing.fulfillmentMethod === 'PICKUP' &&
      existing.deliveries.length === 0 &&
      (existing.status === 'AWAITING_SUPPLIER_CONFIRMATION' ||
        (existing.pickupWindowEnd != null &&
          isAfterAllowedEnd(new Date(), existing.pickupWindowEnd)));

    if (isSelfPickupOverdue) {
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
          note: 'Reported to admin after missed pickup window',
        },
      });

      await recomputeAndUpdateMaterialStatus(tx, existing.materialId);
    }

    return { report };
  });
};
