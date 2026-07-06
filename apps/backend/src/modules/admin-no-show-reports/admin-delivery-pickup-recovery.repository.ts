import type { DeliveryStatus, Prisma } from '../../generated/prisma/client.js';
import {
  ADMIN_SUPPLIER_PICKUP_RECONFIRM_REASONS,
  NO_DRIVER_CANCEL_REASON,
  NO_DRIVER_SUPPLIER_RECONFIRM_REASON,
  STALE_PICKUP_CANCEL_REASON,
  STALE_PICKUP_SUPPLIER_RECONFIRM_REASON,
} from '../reservations/reservation-timing-policy.js';
import {
  recomputeAndUpdateMaterialStatus,
  runSerializableTransaction,
} from '../reservations/reservations.quantity.js';
import { reportInclude, type AdminNoShowReportRecord } from './admin-no-show-reports.repository.js';

const pickupRecoveryReportInclude = {
  ...reportInclude,
  delivery: {
    select: {
      id: true,
      status: true,
      assignedDriverProfileId: true,
      reservationId: true,
    },
  },
} satisfies Prisma.NoShowReportInclude;

type PickupRecoveryReportRecord = Prisma.NoShowReportGetPayload<{
  include: typeof pickupRecoveryReportInclude;
}>;

export type PickupRecoveryKind = 'NO_DRIVER' | 'STALE_PICKUP';

const RECOVERY_DELIVERY_STATUSES = [
  'AWAITING_RESOLUTION',
  'DRIVER_NO_SHOW',
  'FAILED_PICKUP',
] as const satisfies readonly DeliveryStatus[];

export const isNoDriverAvailableSystemReport = (report: {
  reasonCode: string;
  targetRole: string;
}) =>
  report.targetRole === 'SYSTEM' && report.reasonCode === 'NO_DRIVER_AVAILABLE';

export const isStaleAssignedPickupReport = (report: { reasonCode: string }) =>
  report.reasonCode === 'NO_RESPONSE_AFTER_PICKUP_WINDOW' ||
  report.reasonCode === 'DRIVER_DID_NOT_ARRIVE' ||
  report.reasonCode === 'PICKUP_FAILED';

export const isDeliveryPickupRecoveryReport = (report: {
  reasonCode: string;
  targetRole: string;
}) =>
  isNoDriverAvailableSystemReport(report) || isStaleAssignedPickupReport(report);

export const pickupRecoveryKind = (report: {
  reasonCode: string;
  targetRole: string;
}): PickupRecoveryKind =>
  isNoDriverAvailableSystemReport(report) ? 'NO_DRIVER' : 'STALE_PICKUP';

const reconfirmReasonForKind = (kind: PickupRecoveryKind) =>
  kind === 'NO_DRIVER'
    ? NO_DRIVER_SUPPLIER_RECONFIRM_REASON
    : STALE_PICKUP_SUPPLIER_RECONFIRM_REASON;

const cancelReasonForKind = (kind: PickupRecoveryKind) =>
  kind === 'NO_DRIVER' ? NO_DRIVER_CANCEL_REASON : STALE_PICKUP_CANCEL_REASON;

const loadPickupRecoveryReport = async (
  tx: Prisma.TransactionClient,
  reportId: string,
) =>
  tx.noShowReport.findUnique({
    where: { id: reportId },
    include: pickupRecoveryReportInclude,
  });

const validatePickupRecoveryContext = (report: PickupRecoveryReportRecord | null) => {
  if (!report) {
    return { outcome: 'NOT_FOUND' as const };
  }

  if (!isDeliveryPickupRecoveryReport(report)) {
    return { outcome: 'NOT_ELIGIBLE' as const, report };
  }

  if (report.status !== 'PENDING_REVIEW' && report.status !== 'VERIFIED') {
    return { outcome: 'REPORT_NOT_PENDING' as const, report };
  }

  if (report.reservation.status !== 'AWAITING_RESOLUTION') {
    return { outcome: 'INVALID_RESERVATION_STATUS' as const, report };
  }

  if (report.reservation.fulfillmentMethod !== 'DELIVERY') {
    return { outcome: 'NOT_DELIVERY' as const, report };
  }

  const delivery = report.delivery;

  if (
    !delivery ||
    !(RECOVERY_DELIVERY_STATUSES as readonly DeliveryStatus[]).includes(
      delivery.status,
    )
  ) {
    return { outcome: 'INVALID_DELIVERY_STATUS' as const, report };
  }

  if (
    isNoDriverAvailableSystemReport(report) &&
    delivery.assignedDriverProfileId
  ) {
    return { outcome: 'DRIVER_ASSIGNED' as const, report };
  }

  return { outcome: 'OK' as const, report, delivery };
};

const resolveReportWithoutStrike = async (
  tx: Prisma.TransactionClient,
  input: {
    reportId: string;
    adminUserId: string;
    reviewNote?: string;
  },
) =>
  tx.noShowReport.update({
    where: { id: input.reportId },
    data: {
      status: 'RESOLVED_NO_STRIKE',
      reviewedById: input.adminUserId,
      reviewedAt: new Date(),
      reviewNote: input.reviewNote?.trim() || null,
    },
    include: reportInclude,
  });

export const requestSupplierRescheduleForPickupRecoveryReport = async (input: {
  reportId: string;
  adminUserId: string;
  adminNote?: string;
}) =>
  runSerializableTransaction(async (tx) => {
    const loaded = await loadPickupRecoveryReport(tx, input.reportId);
    const validation = validatePickupRecoveryContext(loaded);

    if (validation.outcome !== 'OK') {
      return validation;
    }

    const { report, delivery } = validation;
    const kind = pickupRecoveryKind(report);
    const defaultNote =
      kind === 'NO_DRIVER'
        ? 'Admin asked supplier to choose a new pickup window after no driver was available'
        : 'Admin asked supplier to choose a new pickup window after pickup was not completed';

    await tx.deliveryAssignment.updateMany({
      where: {
        deliveryId: delivery.id,
        status: 'ACTIVE',
      },
      data: {
        status: 'RELEASED',
        releasedAt: new Date(),
        releaseReason: 'Admin requested supplier pickup reschedule',
      },
    });

    await tx.reservation.update({
      where: { id: report.reservationId },
      data: {
        status: 'AWAITING_SUPPLIER_CONFIRMATION',
        pendingRescheduleRequestedBy: 'SUPPLIER',
        pendingRescheduleReason: reconfirmReasonForKind(kind),
        pendingRescheduleNote: input.adminNote?.trim() || defaultNote,
        supplierProposedPickupWindowStart: null,
        supplierProposedPickupWindowEnd: null,
        learnerProposedPickupWindowStart: null,
        learnerProposedPickupWindowEnd: null,
      },
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: report.reservationId,
        statusGroup: 'RESERVATION',
        oldStatus: 'AWAITING_RESOLUTION',
        newStatus: 'AWAITING_SUPPLIER_CONFIRMATION',
        changedBy: input.adminUserId,
        note: input.adminNote?.trim() || defaultNote,
      },
    });

    let updatedReport: AdminNoShowReportRecord;

    if (report.status === 'PENDING_REVIEW') {
      updatedReport = await resolveReportWithoutStrike(tx, {
        reportId: report.id,
        adminUserId: input.adminUserId,
        reviewNote: input.adminNote,
      });
    } else {
      updatedReport = await tx.noShowReport.findUniqueOrThrow({
        where: { id: report.id },
        include: reportInclude,
      });
    }

    return {
      outcome: 'REQUESTED' as const,
      report: updatedReport,
      supplierId: updatedReport.reservation.owner.id,
      reservationId: report.reservationId,
      recoveryKind: kind,
    };
  });

export const cancelAndReleaseHoldForPickupRecoveryReport = async (input: {
  reportId: string;
  adminUserId: string;
  adminNote?: string;
}) =>
  runSerializableTransaction(async (tx) => {
    const loaded = await loadPickupRecoveryReport(tx, input.reportId);
    const validation = validatePickupRecoveryContext(loaded);

    if (validation.outcome !== 'OK') {
      return validation;
    }

    const { report, delivery } = validation;
    const kind = pickupRecoveryKind(report);
    const now = new Date();
    const defaultNote =
      kind === 'NO_DRIVER'
        ? 'Admin cancelled and released hold after no driver available'
        : 'Admin cancelled and released hold after pickup was not completed';

    await tx.deliveryAssignment.updateMany({
      where: {
        deliveryId: delivery.id,
        status: 'ACTIVE',
      },
      data: {
        status: 'RELEASED',
        releasedAt: now,
        releaseReason: 'Admin cancelled reservation after pickup recovery review',
      },
    });

    await tx.reservation.update({
      where: { id: report.reservationId },
      data: {
        status: 'EXPIRED',
        rejectionReason: cancelReasonForKind(kind),
      },
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: report.reservationId,
        statusGroup: 'RESERVATION',
        oldStatus: 'AWAITING_RESOLUTION',
        newStatus: 'EXPIRED',
        changedBy: input.adminUserId,
        note: input.adminNote?.trim() || defaultNote,
      },
    });

    await tx.delivery.update({
      where: { id: delivery.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: now,
        assignedDriverProfileId: null,
        assignedAt: null,
      },
    });

    await tx.deliveryStatusHistory.create({
      data: {
        deliveryId: delivery.id,
        oldStatus: delivery.status,
        newStatus: 'CANCELLED',
        changedByUserId: input.adminUserId,
        note:
          input.adminNote?.trim() ||
          'Admin cancelled delivery after pickup recovery review',
      },
    });

    await recomputeAndUpdateMaterialStatus(tx, report.reservation.material.id);

    const updatedReport =
      report.status === 'PENDING_REVIEW'
        ? await resolveReportWithoutStrike(tx, {
            reportId: report.id,
            adminUserId: input.adminUserId,
            reviewNote: input.adminNote,
          })
        : await tx.noShowReport.findUniqueOrThrow({
            where: { id: report.id },
            include: reportInclude,
          });

    return {
      outcome: 'CANCELLED' as const,
      report: updatedReport,
      recoveryKind: kind,
    };
  });

export const requiresPickupRecoveryOperationalAction = (input: {
  report: {
    reasonCode: string;
    targetRole: string;
    status: string;
  };
  reservationStatus: string;
}) => {
  if (!isDeliveryPickupRecoveryReport(input.report)) {
    return false;
  }

  if (input.reservationStatus !== 'AWAITING_RESOLUTION') {
    return false;
  }

  return input.report.status === 'PENDING_REVIEW';
};

export { ADMIN_SUPPLIER_PICKUP_RECONFIRM_REASONS };
