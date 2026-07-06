import type { Prisma } from '../../generated/prisma/client.js';
import { NO_DRIVER_CANCEL_REASON, NO_DRIVER_SUPPLIER_RECONFIRM_REASON } from '../reservations/reservation-timing-policy.js';
import {
  recomputeAndUpdateMaterialStatus,
  runSerializableTransaction,
} from '../reservations/reservations.quantity.js';
import { reportInclude, type AdminNoShowReportRecord } from './admin-no-show-reports.repository.js';

const noDriverReportInclude = {
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

type NoDriverReportRecord = Prisma.NoShowReportGetPayload<{
  include: typeof noDriverReportInclude;
}>;

export const isNoDriverAvailableSystemReport = (report: {
  reasonCode: string;
  targetRole: string;
}) =>
  report.targetRole === 'SYSTEM' && report.reasonCode === 'NO_DRIVER_AVAILABLE';

const loadNoDriverReport = async (
  tx: Prisma.TransactionClient,
  reportId: string,
) =>
  tx.noShowReport.findUnique({
    where: { id: reportId },
    include: noDriverReportInclude,
  });

const validateNoDriverResolutionContext = (
  report: NoDriverReportRecord | null,
) => {
  if (!report) {
    return { outcome: 'NOT_FOUND' as const };
  }

  if (!isNoDriverAvailableSystemReport(report)) {
    return { outcome: 'NOT_ELIGIBLE' as const, report };
  }

  if (report.status !== 'PENDING_REVIEW') {
    return { outcome: 'REPORT_NOT_PENDING' as const, report };
  }

  if (report.reservation.status !== 'AWAITING_RESOLUTION') {
    return { outcome: 'INVALID_RESERVATION_STATUS' as const, report };
  }

  if (report.reservation.fulfillmentMethod !== 'DELIVERY') {
    return { outcome: 'NOT_DELIVERY' as const, report };
  }

  const delivery = report.delivery;

  if (!delivery || delivery.status !== 'AWAITING_RESOLUTION') {
    return { outcome: 'INVALID_DELIVERY_STATUS' as const, report };
  }

  if (delivery.assignedDriverProfileId) {
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

export const requestSupplierRescheduleForNoDriverReport = async (input: {
  reportId: string;
  adminUserId: string;
  adminNote?: string;
}) =>
  runSerializableTransaction(async (tx) => {
    const loaded = await loadNoDriverReport(tx, input.reportId);
    const validation = validateNoDriverResolutionContext(loaded);

    if (validation.outcome !== 'OK') {
      return validation;
    }

    const { report, delivery } = validation;

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
        pendingRescheduleReason: NO_DRIVER_SUPPLIER_RECONFIRM_REASON,
        pendingRescheduleNote:
          input.adminNote?.trim() ||
          'Admin asked supplier to choose a new pickup window after no driver was available',
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
        note:
          input.adminNote?.trim() ||
          'Admin asked supplier to choose a new pickup window after no driver available',
      },
    });

    const updatedReport = await tx.noShowReport.findUniqueOrThrow({
      where: { id: report.id },
      include: reportInclude,
    });

    return {
      outcome: 'REQUESTED' as const,
      report: updatedReport,
      supplierId: updatedReport.reservation.owner.id,
      reservationId: report.reservationId,
    };
  });

export const cancelAndReleaseHoldForNoDriverReport = async (input: {
  reportId: string;
  adminUserId: string;
  adminNote?: string;
}) =>
  runSerializableTransaction(async (tx) => {
    const loaded = await loadNoDriverReport(tx, input.reportId);
    const validation = validateNoDriverResolutionContext(loaded);

    if (validation.outcome !== 'OK') {
      return validation;
    }

    const { report, delivery } = validation;
    const now = new Date();

    await tx.deliveryAssignment.updateMany({
      where: {
        deliveryId: delivery.id,
        status: 'ACTIVE',
      },
      data: {
        status: 'RELEASED',
        releasedAt: now,
        releaseReason: 'Admin cancelled reservation after no driver available',
      },
    });

    await tx.reservation.update({
      where: { id: report.reservationId },
      data: {
        status: 'EXPIRED',
        rejectionReason: NO_DRIVER_CANCEL_REASON,
      },
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: report.reservationId,
        statusGroup: 'RESERVATION',
        oldStatus: 'AWAITING_RESOLUTION',
        newStatus: 'EXPIRED',
        changedBy: input.adminUserId,
        note:
          input.adminNote?.trim() ||
          'Admin cancelled and released hold after no driver available',
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
        oldStatus: 'AWAITING_RESOLUTION',
        newStatus: 'CANCELLED',
        changedByUserId: input.adminUserId,
        note:
          input.adminNote?.trim() ||
          'Admin cancelled delivery after no driver available',
      },
    });

    await recomputeAndUpdateMaterialStatus(tx, report.reservation.material.id);

    const updatedReport = await resolveReportWithoutStrike(tx, {
      reportId: report.id,
      adminUserId: input.adminUserId,
      reviewNote: input.adminNote,
    });

    return {
      outcome: 'CANCELLED' as const,
      report: updatedReport,
    };
  });

export type AdminNoDriverResolutionResult =
  | Awaited<ReturnType<typeof requestSupplierRescheduleForNoDriverReport>>
  | Awaited<ReturnType<typeof cancelAndReleaseHoldForNoDriverReport>>;

export type AdminNoDriverResolutionReport = AdminNoShowReportRecord;
