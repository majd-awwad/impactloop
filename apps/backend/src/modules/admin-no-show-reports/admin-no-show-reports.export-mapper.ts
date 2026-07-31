import { classifyAdminReportContract } from './admin-no-show-reports.classifier.js';
import type { AdminNoShowReportExportRecord } from './admin-no-show-reports.repository.js';

/**
 * Explicit safe Incident Report export DTO.
 * Never serialize Prisma nests, availableActions, or auth/geo secrets.
 */
export type AdminIncidentReportExportRecord = {
  reportId: string;
  reportStatus: string;
  reason: string;
  targetRole: string;
  strikeImpact: string;
  workflowType: string;
  operationalState: string;
  createdAt: Date;
  reviewedAt: Date | null;
  reservationId: string;
  deliveryId: string | null;
  materialId: string | null;
  materialTitle: string | null;
  reporterId: string;
  reporterName: string;
  reporterEmail: string;
  targetUserId: string | null;
  targetUserName: string | null;
  targetUserEmail: string | null;
  reviewNote: string | null;
  reportNote: string | null;
};

/**
 * Maps a loaded report (+ relations) through the existing classifier.
 * Query cost: classification is in-memory on already-fetched rows.
 */
export const toAdminIncidentReportExportRecord = (
  report: AdminNoShowReportExportRecord,
): AdminIncidentReportExportRecord => {
  const contract = classifyAdminReportContract({
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
    isGroupRecoverySupported: false,
  });

  return {
    reportId: report.id,
    reportStatus: report.status,
    reason: report.reasonCode,
    targetRole: report.targetRole,
    strikeImpact: contract.strikeImpact,
    workflowType: contract.workflowType,
    operationalState: contract.operationalState,
    createdAt: report.createdAt,
    reviewedAt: report.reviewedAt,
    reservationId: report.reservationId,
    deliveryId: report.deliveryId,
    materialId: report.reservation.material?.id ?? null,
    materialTitle: report.reservation.material?.title ?? null,
    reporterId: report.reporter.id,
    reporterName: report.reporter.displayName,
    reporterEmail: report.reporter.email,
    targetUserId: report.target?.id ?? null,
    targetUserName: report.target?.displayName ?? null,
    targetUserEmail: report.target?.email ?? null,
    reviewNote: report.reviewNote,
    reportNote: report.note,
  };
};

export const INCIDENT_REPORT_EXPORT_HEADERS = [
  'Report ID',
  'Report Status',
  'Reason',
  'Target Role',
  'Strike Impact',
  'Workflow Type',
  'Operational State',
  'Created At',
  'Reviewed At',
  'Reservation ID',
  'Delivery ID',
  'Material ID',
  'Material Title',
  'Reporter ID',
  'Reporter Name',
  'Reporter Email',
  'Target User ID',
  'Target User Name',
  'Target User Email',
  'Review Note',
  'Report Note',
] as const;

/** 1-based Excel column indexes. */
export const INCIDENT_REPORT_EXPORT_CREATED_AT_COLUMN = 8;
export const INCIDENT_REPORT_EXPORT_REVIEWED_AT_COLUMN = 9;
export const INCIDENT_REPORT_EXPORT_REVIEW_NOTE_COLUMN = 20;
export const INCIDENT_REPORT_EXPORT_REPORT_NOTE_COLUMN = 21;

export const incidentReportExportRecordToDetailedCells = (
  record: AdminIncidentReportExportRecord,
): unknown[] => [
  record.reportId,
  record.reportStatus,
  record.reason,
  record.targetRole,
  record.strikeImpact,
  record.workflowType,
  record.operationalState,
  record.createdAt,
  record.reviewedAt,
  record.reservationId,
  record.deliveryId,
  record.materialId,
  record.materialTitle,
  record.reporterId,
  record.reporterName,
  record.reporterEmail,
  record.targetUserId,
  record.targetUserName,
  record.targetUserEmail,
  record.reviewNote,
  record.reportNote,
];

export const incidentReportExportRecordToCsvCells = (
  record: AdminIncidentReportExportRecord,
): unknown[] => {
  const cells = incidentReportExportRecordToDetailedCells(record);
  cells[7] = record.createdAt.toISOString();
  cells[8] = record.reviewedAt?.toISOString() ?? null;
  return cells;
};
