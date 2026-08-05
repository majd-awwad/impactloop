import type {
  DeliveryStatus,
  NoShowReportReason,
  NoShowReportTargetRole,
  Prisma,
} from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import {
  canSupplierMarkDeliveryPickupExpired,
} from '../fulfillment-failures/fulfillment-failures.eligibility.js';
import { releaseDriverFromDelivery } from '../fulfillment-failures/fulfillment-failures.repository.js';
import {
  isAfterAllowedEnd,
  isAfterWindowWithGrace,
  HANDOVER_GRACE_MINUTES,
} from '../../utils/handover-timing.js';
import { recomputeAndUpdateMaterialStatus, runSerializableTransaction } from './reservations.quantity.js';
import { applyBuildReservationSyncInTransaction } from '../learning-projects/learning-projects.build-reservation-sync.js';

const mapLearnerSupplierReason = (
  reason: string,
): NoShowReportReason => {
  switch (reason.toUpperCase()) {
    case 'SUPPLIER_UNAVAILABLE':
      return 'SUPPLIER_UNAVAILABLE';
    case 'SUPPLIER_MATERIAL_NOT_READY':
      return 'SUPPLIER_MATERIAL_NOT_READY';
    case 'WRONG_PICKUP_INFO':
      return 'WRONG_INFORMATION';
    default:
      return 'OTHER';
  }
};

const transitionSelfPickupToAwaitingResolution = async (
  tx: Prisma.TransactionClient,
  input: {
    reservationId: string;
    materialId: string;
    oldStatus: string;
    changedBy: string;
    note: string;
    releaseHold: boolean;
  },
) => {
  await tx.reservation.update({
    where: { id: input.reservationId },
    data: { status: 'AWAITING_RESOLUTION' },
  });

  await tx.reservationStatusHistory.create({
    data: {
      reservationId: input.reservationId,
      statusGroup: 'RESERVATION',
      oldStatus: input.oldStatus,
      newStatus: 'AWAITING_RESOLUTION',
      changedBy: input.changedBy,
      note: input.note,
    },
  });

  if (input.releaseHold) {
    await recomputeAndUpdateMaterialStatus(tx, input.materialId);
  }

  await applyBuildReservationSyncInTransaction(tx, input.reservationId);
};

export const createLearnerSupplierIssueReport = async (input: {
  learnerId: string;
  reservationId: string;
  reason: string;
  note?: string;
}) =>
  runSerializableTransaction(async (tx) => {
    const existing = await tx.reservation.findFirst({
      where: {
        id: input.reservationId,
        requesterId: input.learnerId,
      },
    });

    if (!existing) {
      return { outcome: 'NOT_FOUND' as const };
    }

    if (existing.status !== 'ACCEPTED') {
      return { outcome: 'INVALID_STATUS' as const };
    }

    const deliveryCount = await tx.delivery.count({
      where: { reservationId: existing.id },
    });

    if (existing.fulfillmentMethod !== 'PICKUP' || deliveryCount > 0) {
      return { outcome: 'NOT_SELF_PICKUP' as const };
    }

    if (!existing.pickupWindowEnd) {
      return { outcome: 'MISSING_WINDOW' as const };
    }

    if (
      !isAfterWindowWithGrace(
        new Date(),
        existing.pickupWindowEnd,
        HANDOVER_GRACE_MINUTES,
      )
    ) {
      return { outcome: 'WINDOW_NOT_EXPIRED' as const };
    }

    const duplicate = await tx.noShowReport.findFirst({
      where: {
        reservationId: existing.id,
        targetUserId: existing.ownerId,
        targetRole: 'SUPPLIER',
      },
    });

    if (duplicate) {
      return { outcome: 'DUPLICATE' as const, report: duplicate };
    }

    const report = await tx.noShowReport.create({
      data: {
        reservationId: existing.id,
        reporterUserId: input.learnerId,
        targetUserId: existing.ownerId,
        targetRole: 'SUPPLIER',
        reasonCode: mapLearnerSupplierReason(input.reason),
        note: input.note?.trim() || null,
        pickupWindowStart: existing.pickupWindowStart,
        pickupWindowEnd: existing.pickupWindowEnd,
      },
    });

    await transitionSelfPickupToAwaitingResolution(tx, {
      reservationId: existing.id,
      materialId: existing.materialId,
      oldStatus: existing.status,
      changedBy: input.learnerId,
      note: 'Learner reported supplier issue after pickup window',
      releaseHold: true,
    });

    return { outcome: 'CREATED' as const, report };
  });

export const escalateNoDriverAvailableInTransaction = async (
  tx: Prisma.TransactionClient,
  input: {
    reservation: {
      id: string;
      status: string;
      requesterId: string;
      supplierPickupWindowStart: Date | null;
      supplierPickupWindowEnd: Date | null;
    };
    delivery: {
      id: string;
      status: DeliveryStatus;
    };
    reporterUserId: string;
    changedBy: string | null;
    note: string;
    deliveryHistoryNote: string;
    reservationHistoryNote: string;
  },
) => {
  const duplicate = await tx.noShowReport.findFirst({
    where: {
      reservationId: input.reservation.id,
      targetRole: 'SYSTEM',
      reasonCode: 'NO_DRIVER_AVAILABLE',
    },
  });

  if (duplicate) {
    return { created: false as const, report: duplicate };
  }

  if (input.reservation.status !== 'ACCEPTED') {
    return { created: false as const, report: null };
  }

  const report = await tx.noShowReport.create({
    data: {
      reservationId: input.reservation.id,
      deliveryId: input.delivery.id,
      reporterUserId: input.reporterUserId,
      targetUserId: null,
      targetRole: 'SYSTEM',
      reasonCode: 'NO_DRIVER_AVAILABLE',
      note: input.note.trim() || null,
      pickupWindowStart: input.reservation.supplierPickupWindowStart,
      pickupWindowEnd: input.reservation.supplierPickupWindowEnd,
    },
  });

  await tx.delivery.update({
    where: { id: input.delivery.id },
    data: { status: 'AWAITING_RESOLUTION' },
  });

  await tx.deliveryStatusHistory.create({
    data: {
      deliveryId: input.delivery.id,
      oldStatus: input.delivery.status,
      newStatus: 'AWAITING_RESOLUTION',
      changedByUserId: input.changedBy ?? input.reporterUserId,
      note: input.deliveryHistoryNote,
    },
  });

  await tx.reservation.update({
    where: { id: input.reservation.id },
    data: { status: 'AWAITING_RESOLUTION' },
  });

  await tx.reservationStatusHistory.create({
    data: {
      reservationId: input.reservation.id,
      statusGroup: 'RESERVATION',
      oldStatus: input.reservation.status,
      newStatus: 'AWAITING_RESOLUTION',
      changedBy: input.changedBy ?? input.reporterUserId,
      note: input.reservationHistoryNote,
    },
  });

  return { created: true as const, report };
};

export const escalateStaleAssignedDriverPickupInTransaction = async (
  tx: Prisma.TransactionClient,
  input: {
    reservation: {
      id: string;
      status: string;
      requesterId: string;
      supplierPickupWindowStart: Date | null;
      supplierPickupWindowEnd: Date | null;
    };
    delivery: {
      id: string;
      status: DeliveryStatus;
      assignedDriverProfileId: string | null;
    };
    reporterUserId: string;
    changedBy: string | null;
    note: string;
    deliveryHistoryNote: string;
    reservationHistoryNote: string;
  },
) => {
  if (input.reservation.status !== 'ACCEPTED') {
    return { created: false as const, report: null, driverUserId: null };
  }

  if (!input.delivery.assignedDriverProfileId) {
    return { created: false as const, report: null, driverUserId: null };
  }

  const driverProfile = await tx.driverProfile.findUnique({
    where: { id: input.delivery.assignedDriverProfileId },
    select: { userId: true },
  });

  if (!driverProfile) {
    return { created: false as const, report: null, driverUserId: null };
  }

  const isDriverAssignedNoArrival = input.delivery.status === 'DRIVER_ASSIGNED';
  const targetRole = isDriverAssignedNoArrival ? 'DRIVER' : 'SYSTEM';
  const targetUserId = isDriverAssignedNoArrival ? driverProfile.userId : null;

  const duplicate = isDriverAssignedNoArrival
    ? await tx.noShowReport.findFirst({
        where: {
          reservationId: input.reservation.id,
          deliveryId: input.delivery.id,
          targetUserId: driverProfile.userId,
          reasonCode: 'NO_RESPONSE_AFTER_PICKUP_WINDOW',
        },
      })
    : await tx.noShowReport.findFirst({
        where: {
          reservationId: input.reservation.id,
          targetRole: 'SYSTEM',
          reasonCode: 'NO_RESPONSE_AFTER_PICKUP_WINDOW',
        },
      });

  if (duplicate) {
    return {
      created: false as const,
      report: duplicate,
      driverUserId: driverProfile.userId,
    };
  }

  const report = await tx.noShowReport.create({
    data: {
      reservationId: input.reservation.id,
      deliveryId: input.delivery.id,
      reporterUserId: input.reporterUserId,
      targetUserId,
      targetRole,
      reasonCode: 'NO_RESPONSE_AFTER_PICKUP_WINDOW',
      note: input.note.trim() || null,
      pickupWindowStart: input.reservation.supplierPickupWindowStart,
      pickupWindowEnd: input.reservation.supplierPickupWindowEnd,
    },
  });

  await releaseDriverFromDelivery(tx, {
    deliveryId: input.delivery.id,
    driverProfileId: input.delivery.assignedDriverProfileId,
    releaseReason: 'Assigned-driver pickup auto-escalated',
  });

  await tx.delivery.update({
    where: { id: input.delivery.id },
    data: {
      status: 'AWAITING_RESOLUTION',
      assignedDriverProfileId: null,
    },
  });

  await tx.deliveryStatusHistory.create({
    data: {
      deliveryId: input.delivery.id,
      oldStatus: input.delivery.status,
      newStatus: 'AWAITING_RESOLUTION',
      changedByUserId: input.changedBy ?? input.reporterUserId,
      note: input.deliveryHistoryNote,
    },
  });

  await tx.reservation.update({
    where: { id: input.reservation.id },
    data: { status: 'AWAITING_RESOLUTION' },
  });

  await tx.reservationStatusHistory.create({
    data: {
      reservationId: input.reservation.id,
      statusGroup: 'RESERVATION',
      oldStatus: input.reservation.status,
      newStatus: 'AWAITING_RESOLUTION',
      changedBy: input.changedBy ?? input.reporterUserId,
      note: input.reservationHistoryNote,
    },
  });

  return {
    created: true as const,
    report,
    driverUserId: driverProfile.userId,
    deliveryId: input.delivery.id,
  };
};

export const createNoDriverAvailableReport = async (input: {
  reporterUserId: string;
  reservationId: string;
  note?: string;
}) =>
  runSerializableTransaction(async (tx) => {
    const existing = await tx.reservation.findFirst({
      where: { id: input.reservationId },
      include: {
        deliveries: {
          orderBy: { requestedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!existing) {
      return { outcome: 'NOT_FOUND' as const };
    }

    const isLearner = existing.requesterId === input.reporterUserId;
    const isSupplier = existing.ownerId === input.reporterUserId;

    if (!isLearner && !isSupplier) {
      return { outcome: 'FORBIDDEN' as const };
    }

    if (existing.status !== 'ACCEPTED' || existing.fulfillmentMethod !== 'DELIVERY') {
      return { outcome: 'INVALID_STATUS' as const };
    }

    const delivery = existing.deliveries[0];

    if (!delivery || delivery.status !== 'WAITING_FOR_DRIVER' || delivery.assignedDriverProfileId) {
      return { outcome: 'INVALID_DELIVERY_STATE' as const };
    }

    if (
      !existing.supplierPickupWindowEnd ||
      !isAfterWindowWithGrace(
        new Date(),
        existing.supplierPickupWindowEnd,
        HANDOVER_GRACE_MINUTES,
      )
    ) {
      return { outcome: 'WINDOW_NOT_EXPIRED' as const };
    }

    const result = await escalateNoDriverAvailableInTransaction(tx, {
      reservation: existing,
      delivery,
      reporterUserId: input.reporterUserId,
      changedBy: input.reporterUserId,
      note: input.note ?? 'No driver available',
      deliveryHistoryNote: 'No driver available reported',
      reservationHistoryNote: 'No driver available',
    });

    if (!result.created) {
      return { outcome: 'DUPLICATE' as const, report: result.report };
    }

    return { outcome: 'CREATED' as const, report: result.report };
  });

export const canReportNoDriverAvailable = (input: {
  status: string;
  fulfillmentMethod: string;
  supplierPickupWindowEnd: Date | null;
  pickupWindowEnd?: Date | null;
  deliveryStatus: string | null;
  assignedDriverProfileId: string | null;
  hasDelivery?: boolean;
  hasPendingReport: boolean;
}) => {
  if (input.hasPendingReport || input.status !== 'ACCEPTED') {
    return false;
  }

  return canSupplierMarkDeliveryPickupExpired({
    status: input.status as 'ACCEPTED',
    fulfillmentMethod: input.fulfillmentMethod,
    supplierPickupWindowEnd: input.supplierPickupWindowEnd,
    pickupWindowEnd: input.pickupWindowEnd,
    deliveryStatus: input.deliveryStatus as
      | import('../../generated/prisma/client.js').DeliveryStatus
      | null,
    assignedDriverProfileId: input.assignedDriverProfileId,
    hasDelivery: input.hasDelivery,
  });
};

export const canLearnerReportSupplierIssue = (input: {
  status: string;
  fulfillmentMethod: string;
  deliveryCount: number;
  pickupWindowEnd: Date | null;
  hasPendingReport: boolean;
}) => {
  if (input.hasPendingReport || input.status !== 'ACCEPTED') {
    return false;
  }

  if (input.fulfillmentMethod !== 'PICKUP' || input.deliveryCount > 0) {
    return false;
  }

  if (!input.pickupWindowEnd) {
    return false;
  }

  return isAfterAllowedEnd(new Date(), input.pickupWindowEnd);
};

export type IncidentTargetRole = NoShowReportTargetRole;
