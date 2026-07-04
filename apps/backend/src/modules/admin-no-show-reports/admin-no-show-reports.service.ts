import { AppError } from '../../utils/app-error.js';

import { findReservationMessages, mapReservationMessage } from '../reservations/reservation-messages.repository.js';
import { mapPendingRescheduleSummary } from '../reservations/reservation-reschedule.js';
import { getMaterialQuantityState } from '../reservations/reservations.quantity.js';
import { prisma } from '../../database/prisma.js';
import * as repository from './admin-no-show-reports.repository.js';
import type { AdminNoShowReportsListQuery } from './admin-no-show-reports.validation.js';

const mapReport = (report: repository.AdminNoShowReportRecord) => ({
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

export const listAdminNoShowReports = async (query: AdminNoShowReportsListQuery) => {
  const result = await repository.listNoShowReportsForAdmin({
    status: query.status,
    page: query.page,
    limit: query.limit,
  });

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
    targetVerifiedStrikeCount: report.targetUserId
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

  if ('conflict' in result && result.conflict) {
    throw new AppError(
      'Only pending no-show reports can be verified.',
      409,
      'CONFLICT',
    );
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

  if ('conflict' in result && result.conflict) {
    throw new AppError(
      'Only pending reports can be resolved without strike.',
      409,
      'CONFLICT',
    );
  }

  return mapReport(result.report);
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

  if ('conflict' in result && result.conflict) {
    throw new AppError(
      'Only pending no-show reports can be rejected.',
      409,
      'CONFLICT',
    );
  }

  return mapReport(result.report);
};
