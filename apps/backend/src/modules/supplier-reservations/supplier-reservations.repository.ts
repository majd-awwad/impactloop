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
  findFeasibleDeliveryWindow,
  parsePreferredWindowsJson,
  resolvePreferredWindowByIndex,
  windowMatchesLearnerPreference,
  type PreferredWindow,
} from './supplier-reservation-scheduling.js';

const reservationInclude = {
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
    },
    orderBy: { requestedAt: 'desc' as const },
    take: 1,
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
  deliveryRequested: boolean;
  hasDelivery: boolean;
}) => {
  if (input.status !== 'ACCEPTED') {
    return false;
  }

  if (input.fulfillmentMethod === 'DELIVERY') {
    return false;
  }

  if (input.deliveryRequested || input.hasDelivery) {
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

const createDeliveryForAcceptedReservation = async (
  tx: Prisma.TransactionClient,
  input: {
    reservationId: string;
    requesterId: string;
    changedByUserId: string;
    materialLocation: {
      country: string;
      city: string;
      area: string | null;
      addressLine: string | null;
      latitude: number | null;
      longitude: number | null;
      isApproximate: boolean;
    };
    deliveryAddressText: string;
    deliveryNote: string | null;
  },
) => {
  const pickupLocation = await tx.location.create({
    data: {
      country: input.materialLocation.country,
      city: input.materialLocation.city,
      area: input.materialLocation.area,
      addressLine: input.materialLocation.addressLine,
      latitude: input.materialLocation.latitude,
      longitude: input.materialLocation.longitude,
      visibility: 'PRIVATE',
      isApproximate: input.materialLocation.isApproximate,
      locationType: 'DELIVERY_PICKUP',
    },
  });

  const dropoffLocation = await tx.location.create({
    data: {
      country: input.materialLocation.country,
      city: input.materialLocation.city,
      addressLine: input.deliveryAddressText,
      visibility: 'PRIVATE',
      isApproximate: true,
      locationType: 'DELIVERY_DROPOFF',
    },
  });

  return tx.delivery.create({
    data: {
      reservationId: input.reservationId,
      pickupLocationId: pickupLocation.id,
      dropoffLocationId: dropoffLocation.id,
      requestedByUserId: input.requesterId,
      status: 'WAITING_FOR_DRIVER',
      learnerNote: input.deliveryNote,
      statusHistory: {
        create: {
          oldStatus: null,
          newStatus: 'WAITING_FOR_DRIVER',
          changedByUserId: input.changedByUserId,
          note: 'Delivery created when supplier accepted reservation',
        },
      },
    },
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

const acceptDeliveryReservation = async (
  tx: Prisma.TransactionClient,
  input: {
    reservation: {
      id: string;
      requesterId: string;
      deliveryAddressText: string | null;
      deliveryNote: string | null;
      learnerPreferredDeliveryWindows: unknown;
      material: {
        location: {
          country: string;
          city: string;
          area: string | null;
          addressLine: string | null;
          latitude: number | null;
          longitude: number | null;
          isApproximate: boolean;
        };
      };
    };
    ownerId: string;
    supplierPickupWindow: PreferredWindow;
    supplierNote: string | null;
  },
) => {
  const learnerWindows = parsePreferredWindowsJson(
    input.reservation.learnerPreferredDeliveryWindows,
  );
  const feasible = findFeasibleDeliveryWindow(
    input.supplierPickupWindow.end,
    learnerWindows,
  );

  if (feasible) {
    const reservation = await tx.reservation.update({
      where: { id: input.reservation.id },
      data: {
        status: 'ACCEPTED',
        supplierPickupWindowStart: input.supplierPickupWindow.start,
        supplierPickupWindowEnd: input.supplierPickupWindow.end,
        confirmedDeliveryWindowStart: feasible.confirmed.start,
        confirmedDeliveryWindowEnd: feasible.confirmed.end,
        earliestDeliveryStart: feasible.earliestDeliveryStart,
        schedulingConflictReason: null,
        supplierProposedPickupWindowStart: null,
        supplierProposedPickupWindowEnd: null,
        deliveryRequested: true,
        supplierNote: input.supplierNote,
        acceptedAt: new Date(),
      },
      include: reservationInclude,
    });

    await createDeliveryForAcceptedReservation(tx, {
      reservationId: input.reservation.id,
      requesterId: input.reservation.requesterId,
      changedByUserId: input.ownerId,
      materialLocation: input.reservation.material.location,
      deliveryAddressText: input.reservation.deliveryAddressText!.trim(),
      deliveryNote: input.reservation.deliveryNote,
    });

    return tx.reservation.findFirstOrThrow({
      where: { id: input.reservation.id },
      include: reservationInclude,
    });
  }

  const earliestDeliveryStart = new Date(
    input.supplierPickupWindow.end.getTime() + 60 * 60_000,
  );

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
        'No learner delivery window is feasible after supplier pickup and buffer.',
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

    if (existing.deliveryRequested || deliveryCount > 0) {
      return { conflict: true as const, reservation: existing };
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

    if (existing.status !== 'ACCEPTED') {
      return { conflict: true as const, reservation: existing };
    }

    const supplierNote = input.supplierNote?.trim() || existing.supplierNote;
    const reservation = await tx.reservation.update({
      where: { id: existing.id },
      data: {
        pickupWindowStart: input.pickupWindowStart,
        pickupWindowEnd: input.pickupWindowEnd,
        supplierNote,
      },
      include: reservationInclude,
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: reservation.id,
        statusGroup: 'RESERVATION',
        oldStatus: 'ACCEPTED',
        newStatus: 'ACCEPTED',
        changedBy: input.ownerId,
        note: 'Pickup window rescheduled by supplier',
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

    if (existing.status !== 'ACCEPTED') {
      return { conflict: true as const, reservation: existing };
    }

    const followUp = resolveReservationFollowUp({
      status: existing.status,
      pickupWindowStart: existing.pickupWindowStart,
      pickupWindowEnd: existing.pickupWindowEnd,
    });

    if (!followUp.isOverdue) {
      return { notOverdue: true as const, reservation: existing };
    }

    const deliveryCount = await tx.delivery.count({
      where: { reservationId: existing.id },
    });

    if (deliveryCount > 0 || existing.deliveryRequested) {
      return { deliveryBlocked: true as const, reservation: existing };
    }

    const now = new Date();
    const reason = input.reason?.trim() || 'Cancelled by supplier after overdue pickup window';

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

    if (existing.status !== 'ACCEPTED') {
      return { conflict: true as const };
    }

    const followUp = resolveReservationFollowUp({
      status: existing.status,
      pickupWindowStart: existing.pickupWindowStart,
      pickupWindowEnd: existing.pickupWindowEnd,
    });

    if (!followUp.isOverdue) {
      return { windowNotEnded: true as const };
    }

    const latestDelivery = existing.deliveries[0] ?? null;
    let targetUserId = existing.requesterId;
    let targetRole: 'LEARNER' | 'DRIVER' = 'LEARNER';

    if (existing.deliveryRequested || latestDelivery) {
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
        reporterUserId: input.ownerId,
        targetUserId,
        targetRole,
        reasonCode: input.reasonCode,
        note: input.note?.trim() || null,
        pickupWindowStart: existing.pickupWindowStart,
        pickupWindowEnd: existing.pickupWindowEnd,
      },
    });

    return { report };
  });
};
