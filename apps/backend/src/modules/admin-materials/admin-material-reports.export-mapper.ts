import type { AdminMaterialReportExportRecord } from './admin-materials.repository.js';

export type MaterialReportExportRecord = {
  reportId: string;
  reportStatus: string;
  reportReason: string;
  reportNote: string;
  materialId: string;
  materialTitle: string;
  materialStatus: string;
  reporterName: string;
  reporterEmail: string;
  supplierName: string;
  supplierVerificationStatus: string;
  createdAt: Date;
  reviewedAt: Date | null;
  adminNote: string;
};

const resolveSupplierName = (
  report: AdminMaterialReportExportRecord,
): string =>
  report.material.owner.supplierProfile?.publicName?.trim() ||
  report.material.owner.displayName ||
  'Unknown supplier';

/**
 * Explicit safe mapper — never pass Prisma records to writers.
 * Omits secrets, phones, addresses, coordinates, reviewer identity,
 * and unrelated user/auth fields. Includes report/admin notes for ops
 * (do not put note text into audit metadata).
 */
export const toMaterialReportExportRecord = (
  report: AdminMaterialReportExportRecord,
): MaterialReportExportRecord => ({
  reportId: report.id,
  reportStatus: report.status,
  reportReason: report.reason,
  reportNote: report.note ?? '',
  materialId: report.material.id,
  materialTitle: report.material.title,
  materialStatus: report.material.status,
  reporterName: report.reporter.displayName,
  reporterEmail: report.reporter.email,
  supplierName: resolveSupplierName(report),
  supplierVerificationStatus:
    report.material.owner.supplierProfile?.verificationStatus ?? 'NOT_REQUIRED',
  createdAt: report.createdAt,
  reviewedAt: report.reviewedAt,
  adminNote: report.adminNote ?? '',
});

export const MATERIAL_REPORT_EXPORT_HEADERS = [
  'Report ID',
  'Report status',
  'Report reason',
  'Report note',
  'Material ID',
  'Material title',
  'Material status',
  'Reporter name',
  'Reporter email',
  'Supplier name',
  'Supplier verification status',
  'Created At',
  'Reviewed At',
  'Admin note',
] as const;

/** 1-based Excel column indexes. */
export const MATERIAL_REPORT_EXPORT_NOTE_COLUMN = 4;
export const MATERIAL_REPORT_EXPORT_CREATED_AT_COLUMN = 12;
export const MATERIAL_REPORT_EXPORT_REVIEWED_AT_COLUMN = 13;
export const MATERIAL_REPORT_EXPORT_ADMIN_NOTE_COLUMN = 14;

export const materialReportExportRecordToDetailedCells = (
  record: MaterialReportExportRecord,
): unknown[] => [
  record.reportId,
  record.reportStatus,
  record.reportReason,
  record.reportNote,
  record.materialId,
  record.materialTitle,
  record.materialStatus,
  record.reporterName,
  record.reporterEmail,
  record.supplierName,
  record.supplierVerificationStatus,
  record.createdAt,
  record.reviewedAt ?? '',
  record.adminNote,
];

export const materialReportExportRecordToCsvCells = (
  record: MaterialReportExportRecord,
): unknown[] => {
  const cells = materialReportExportRecordToDetailedCells(record);
  cells[11] = record.createdAt.toISOString();
  cells[12] = record.reviewedAt?.toISOString() ?? '';
  return cells;
};
