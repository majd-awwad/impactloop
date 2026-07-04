import type {
  NoShowReportReason,
  NoShowReportTargetRole,
  Prisma,
} from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import {
  canSupplierMarkDeliveryPickupExpired,
} from '../fulfillment-failures/fulfillment-failures.eligibility.js';
import {
  isAfterAllowedEnd,
  isAfterWindowWithGrace,
  HANDOVER_GRACE_MINUTES,
} from '../../utils/handover-timing.js';
import { recomputeAndUpdateMaterialStatus, runSerializableTransaction } from './reservations.quantity.js';

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

    if (existing.fulfillmentMethod !== 'PICKUP' || existing.deliveryRequested) {
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

    const duplicate = await tx.noShowReport.findFirst({
      where: {
        reservationId: existing.id,
        targetRole: 'SYSTEM',
        reasonCode: 'NO_DRIVER_AVAILABLE',
      },
    });

    if (duplicate) {
      return { outcome: 'DUPLICATE' as const, report: duplicate };
    }

    const report = await tx.noShowReport.create({
      data: {
        reservationId: existing.id,
        deliveryId: delivery.id,
        reporterUserId: input.reporterUserId,
        targetUserId: null,
        targetRole: 'SYSTEM',
        reasonCode: 'NO_DRIVER_AVAILABLE',
        note: input.note?.trim() || null,
        pickupWindowStart: existing.supplierPickupWindowStart,
        pickupWindowEnd: existing.supplierPickupWindowEnd,
      },
    });

    await tx.delivery.update({
      where: { id: delivery.id },
      data: { status: 'AWAITING_RESOLUTION' },
    });

    await tx.deliveryStatusHistory.create({
      data: {
        deliveryId: delivery.id,
        oldStatus: delivery.status,
        newStatus: 'AWAITING_RESOLUTION',
        changedByUserId: input.reporterUserId,
        note: 'No driver available reported',
      },
    });

    await tx.reservation.update({
      where: { id: existing.id },
      data: { status: 'AWAITING_RESOLUTION' },
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: existing.id,
        statusGroup: 'RESERVATION',
        oldStatus: existing.status,
        newStatus: 'AWAITING_RESOLUTION',
        changedBy: input.reporterUserId,
        note: 'No driver available',
      },
    });

    return { outcome: 'CREATED' as const, report };
  });

export const canReportNoDriverAvailable = (input: {
  status: string;
  fulfillmentMethod: string;
  supplierPickupWindowEnd: Date | null;
  deliveryStatus: string | null;
  assignedDriverProfileId: string | null;
  hasPendingReport: boolean;
}) => {
  if (input.hasPendingReport || input.status !== 'ACCEPTED') {
    return false;
  }

  return canSupplierMarkDeliveryPickupExpired({
    status: input.status as 'ACCEPTED',
    fulfillmentMethod: input.fulfillmentMethod,
    supplierPickupWindowEnd: input.supplierPickupWindowEnd,
    deliveryStatus: input.deliveryStatus as
      | import('../../generated/prisma/client.js').DeliveryStatus
      | null,
    assignedDriverProfileId: input.assignedDriverProfileId,
  });
};

export const canLearnerReportSupplierIssue = (input: {
  status: string;
  fulfillmentMethod: string;
  deliveryRequested: boolean;
  pickupWindowEnd: Date | null;
  hasPendingReport: boolean;
}) => {
  if (input.hasPendingReport || input.status !== 'ACCEPTED') {
    return false;
  }

  if (input.fulfillmentMethod !== 'PICKUP' || input.deliveryRequested) {
    return false;
  }

  if (!input.pickupWindowEnd) {
    return false;
  }

  return isAfterAllowedEnd(new Date(), input.pickupWindowEnd);
};

export type IncidentTargetRole = NoShowReportTargetRole;
