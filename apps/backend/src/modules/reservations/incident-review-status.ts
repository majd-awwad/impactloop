import type { NoShowReportStatus } from '../../generated/prisma/client.js';

export type IncidentReviewStatus = NoShowReportStatus;

export const resolveIncidentReviewStatus = (
  reports: readonly { status: NoShowReportStatus }[],
): IncidentReviewStatus | null => {
  if (reports.length === 0) {
    return null;
  }

  if (reports.some((report) => report.status === 'PENDING_REVIEW')) {
    return 'PENDING_REVIEW';
  }

  if (reports.some((report) => report.status === 'VERIFIED')) {
    return 'VERIFIED';
  }

  if (reports.some((report) => report.status === 'RESOLVED_NO_STRIKE')) {
    return 'RESOLVED_NO_STRIKE';
  }

  if (reports.some((report) => report.status === 'REJECTED')) {
    return 'REJECTED';
  }

  return null;
};
