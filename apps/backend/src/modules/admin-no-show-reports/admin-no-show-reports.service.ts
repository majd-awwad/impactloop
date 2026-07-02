import { AppError } from '../../utils/app-error.js';

import { findReservationMessages, mapReservationMessage } from '../reservations/reservation-messages.repository.js';
import * as repository from './admin-no-show-reports.repository.js';
import type { AdminNoShowReportsListQuery } from './admin-no-show-reports.validation.js';

const mapReport = (report: repository.AdminNoShowReportRecord) => ({
  id: report.id,
  reservationId: report.reservationId,
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

  return {
    ...mapReport(report),
    messages: messages.map(mapReservationMessage),
    targetVerifiedNoShowCount:
      report.status === 'VERIFIED'
        ? await repository.countVerifiedNoShowReportsForTarget(report.targetUserId)
        : undefined,
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
    adminRecommendation: result.shouldWarnAdmin
      ? 'Target user has 3 or more verified no-show reports. Consider suspension or restriction using People management.'
      : null,
  };
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
