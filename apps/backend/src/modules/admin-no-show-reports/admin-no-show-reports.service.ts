import { AppError } from '../../utils/app-error.js';

import { findReservationMessages, mapReservationMessage } from '../reservations/reservation-messages.repository.js';
import { mapPendingRescheduleSummary } from '../reservations/reservation-reschedule.js';
import { getMaterialQuantityState } from '../reservations/reservations.quantity.js';
import { prisma } from '../../database/prisma.js';
import * as repository from './admin-no-show-reports.repository.js';
import { classifyAdminReportContract } from './admin-no-show-reports.classifier.js';
import {
  cancelAndReleaseHoldForPickupRecoveryReport,
  requestSupplierRescheduleForPickupRecoveryReport,
} from './admin-delivery-pickup-recovery.repository.js';
import type {
  AdminNoShowReportsListQuery,
  CancelReleaseHoldInput,
  RequestSupplierRescheduleInput,
} from './admin-no-show-reports.validation.js';
import {
  notifyNoDriverSupplierRescheduleRequested,
  notifyStalePickupSupplierRescheduleRequested,
} from '../notifications/reservation-notifications.js';
import { invalidateLearnerHomeForReservationTransition } from '../learner-home/learner-home.service.js';

const mapReport = (report: repository.AdminNoShowReportRecord) => ({
  ...classifyAdminReportContract({
    report: {
      status: report.status,
      reasonCode: report.reasonCode,
      targetRole: report.targetRole,
      targetUserId: report.targetUserId,
      deliveryId: report.deliveryId,
    },
    reservation: report.reservation,
    delivery: report.delivery,
    isGroupedDelivery: report.delivery?.deliveryGroupId != null,
    // Group-level recovery is intentionally unsupported by the mutation layer.
    isGroupRecoverySupported: false,
  }),
  id: report.id,
  reservationId: report.reservationId,
  deliveryId: report.deliveryId,
  status: report.status,
  reasonCode: report.reasonCode,
  note: report.note,
  targetRole: report.targetRole,
  pickupWindowStart: report.pickupWindowStart?.toISOString() ?? null,
  pickupWindowEnd: report.pickupWindowEnd?.toISOString() ?? null,
  createdAt: report.createdAt.toISOString(),
  reviewedAt: report.reviewedAt?.toISOString() ?? null,
  reviewNote: report.reviewNote,
  reporter: report.reporter,
  target: report.target,
  reviewedBy: report.reviewedBy,
  reservation: {
    id: report.reservation.id,
    status: report.reservation.status,
    pickupWindowStart: report.reservation.pickupWindowStart?.toISOString() ?? null,
    pickupWindowEnd: report.reservation.pickupWindowEnd?.toISOString() ?? null,
    pendingReschedule: mapPendingRescheduleSummary(report.reservation),
    material: report.reservation.material,
    requester: report.reservation.requester,
    owner: report.reservation.owner,
  },
});

const throwActionUnavailable = (): never => {
  throw new AppError(
    'This report action is not currently available.',
    409,
    'REPORT_ACTION_NOT_AVAILABLE',
  );
};

export const listAdminNoShowReports = async (query: AdminNoShowReportsListQuery) => {
  const result = await repository.listNoShowReportsForAdmin(query);

  return {
    items: result.items.map(mapReport),
    pagination: {
      page: query.page,
      limit: query.limit,
      total: result.total,
    },
  };
};

export const getAdminNoShowReportById = async (id: string) => {
  const report = await repository.findNoShowReportByIdForAdmin(id);

  if (!report) {
    throw new AppError('No-show report not found.', 404, 'NOT_FOUND');
  }

  const messages = await findReservationMessages(report.reservationId);
  const [activityHistory, deliveryHistory, quantityState] = await Promise.all([
    prisma.reservationStatusHistory.findMany({
      where: { reservationId: report.reservationId },
      orderBy: { createdAt: 'asc' },
      include: {
        changedByUser: {
          select: { id: true, displayName: true },
        },
      },
    }),
    report.deliveryId
      ? prisma.deliveryStatusHistory.findMany({
          where: { deliveryId: report.deliveryId },
          orderBy: { createdAt: 'asc' },
          include: {
            changedByUser: {
              select: { id: true, displayName: true },
            },
          },
        })
      : Promise.resolve([]),
    getMaterialQuantityState(prisma, report.reservation.material.id),
  ]);

  return {
    ...mapReport(report),
    messages: messages.map(mapReservationMessage),
    activityHistory: activityHistory.map((entry) => ({
      id: entry.id,
      statusGroup: entry.statusGroup,
      oldStatus: entry.oldStatus,
      newStatus: entry.newStatus,
      note: entry.note,
      createdAt: entry.createdAt.toISOString(),
      changedBy: entry.changedByUser
        ? {
            id: entry.changedByUser.id,
            displayName: entry.changedByUser.displayName,
          }
        : null,
    })),
    deliveryTimeline: deliveryHistory.map((entry) => ({
      id: entry.id,
      oldStatus: entry.oldStatus,
      newStatus: entry.newStatus,
      note: entry.note,
      createdAt: entry.createdAt.toISOString(),
      changedBy: entry.changedByUser
        ? {
            id: entry.changedByUser.id,
            displayName: entry.changedByUser.displayName,
          }
        : null,
    })),
    quantityStatus: quantityState
      ? {
          materialQuantity: Number(quantityState.materialQuantity),
          heldQuantity: Number(quantityState.heldQuantity),
          availableQuantity: Number(quantityState.availableQuantity),
        }
      : null,
    targetVerifiedNoShowCount: report.targetUserId
      ? await repository.countVerifiedNoShowReportsForTarget(report.targetUserId)
      : 0,
  };
};

export const verifyAdminNoShowReport = async (
  adminUserId: string,
  reportId: string,
  reviewNote?: string,
) => {
  const result = await repository.verifyNoShowReport({
    reportId,
    adminUserId,
    reviewNote,
  });

  if (!result) {
    throw new AppError('No-show report not found.', 404, 'NOT_FOUND');
  }

  if (!('report' in result)) {
    return throwActionUnavailable();
  }

  return {
    report: mapReport(result.report),
    targetVerifiedNoShowCount: result.verifiedCount,
    shouldWarnAdmin: result.shouldWarnAdmin,
    targetSuspended: result.targetSuspended,
    adminRecommendation: result.targetSuspended
      ? 'Target account was automatically suspended after 3 verified incident reports.'
      : result.shouldWarnAdmin
        ? 'Target user has 3 or more verified incident reports.'
        : null,
  };
};

export const resolveAdminNoShowReport = async (
  adminUserId: string,
  reportId: string,
  reviewNote?: string,
) => {
  const result = await repository.resolveNoShowReportWithoutStrike({
    reportId,
    adminUserId,
    reviewNote,
  });

  if (!result) {
    throw new AppError('No-show report not found.', 404, 'NOT_FOUND');
  }

  if (!('report' in result)) {
    return throwActionUnavailable();
  }

  return mapReport(result.report);
};

type PickupRecoveryResolutionError =
  | Exclude<
      Awaited<ReturnType<typeof requestSupplierRescheduleForPickupRecoveryReport>>,
      { outcome: 'REQUESTED' }
    >
  | Exclude<
      Awaited<ReturnType<typeof cancelAndReleaseHoldForPickupRecoveryReport>>,
      { outcome: 'CANCELLED' }
    >;

const mapNoDriverResolutionError = (
  result: PickupRecoveryResolutionError,
): never => {
  if (result.outcome === 'NOT_FOUND') {
    throw new AppError('No-show report not found.', 404, 'NOT_FOUND');
  }

  if (result.outcome === 'ACTION_NOT_AVAILABLE') {
    return throwActionUnavailable();
  }

  return throwActionUnavailable();
};

export const requestSupplierRescheduleAdminNoShowReport = async (
  adminUserId: string,
  reportId: string,
  input: RequestSupplierRescheduleInput,
) => {
  const result = await requestSupplierRescheduleForPickupRecoveryReport({
    reportId,
    adminUserId,
    adminNote: input.adminNote,
  });

  switch (result.outcome) {
    case 'REQUESTED':
      invalidateLearnerHomeForReservationTransition(
        'AWAITING_RESOLUTION',
        'AWAITING_SUPPLIER_CONFIRMATION',
      );
      if (result.recoveryKind === 'NO_DRIVER') {
        await notifyNoDriverSupplierRescheduleRequested(
          result.reservationId,
          input.adminNote,
        );
      } else {
        await notifyStalePickupSupplierRescheduleRequested(
          result.reservationId,
          input.adminNote,
        );
      }

      return mapReport(result.report);
    default:
      return mapNoDriverResolutionError(result);
  }
};

export const cancelReleaseHoldAdminNoShowReport = async (
  adminUserId: string,
  reportId: string,
  input: CancelReleaseHoldInput,
) => {
  const result = await cancelAndReleaseHoldForPickupRecoveryReport({
    reportId,
    adminUserId,
    adminNote: input.adminNote,
  });

  switch (result.outcome) {
    case 'CANCELLED':
      invalidateLearnerHomeForReservationTransition(
        'AWAITING_RESOLUTION',
        'EXPIRED',
      );
      return mapReport(result.report);
    default:
      return mapNoDriverResolutionError(result);
  }
};

export const rejectAdminNoShowReport = async (
  adminUserId: string,
  reportId: string,
  reviewNote?: string,
) => {
  const result = await repository.rejectNoShowReport({
    reportId,
    adminUserId,
    reviewNote,
  });

  if (!result) {
    throw new AppError('No-show report not found.', 404, 'NOT_FOUND');
  }

  if (!('report' in result)) {
    return throwActionUnavailable();
  }

  return mapReport(result.report);
};
