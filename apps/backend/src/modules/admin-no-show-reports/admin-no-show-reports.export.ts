import type { Response } from 'express';

import { AppError } from '../../utils/app-error.js';
import {
  createStreamExportAuditGuard,
  logAdminDataExport,
} from '../admin-export/admin-export.audit.js';
import { getAdminExportChunkSize } from '../admin-export/admin-export.config.js';
import { iterateKeysetChunks } from '../admin-export/admin-export.chunk.js';
import {
  buildContentDisposition,
  buildExportFilename,
  CSV_UTF8_BOM,
  formatCsvHeaderRow,
  formatCsvRow,
} from '../admin-export/admin-export.csv.js';
import {
  assertExportWithinLimit,
  buildSpreadsheetExportPreflightResult,
  normalizeExportFilters,
} from '../admin-export/admin-export.preflight.js';
import type { AdminExportSpreadsheetFormat } from '../admin-export/admin-export.validation.js';
import { buildXlsxBuffer } from '../admin-export/admin-export.xlsx.js';

import {
  INCIDENT_REPORT_EXPORT_CREATED_AT_COLUMN,
  INCIDENT_REPORT_EXPORT_HEADERS,
  INCIDENT_REPORT_EXPORT_REPORT_NOTE_COLUMN,
  INCIDENT_REPORT_EXPORT_REVIEW_NOTE_COLUMN,
  INCIDENT_REPORT_EXPORT_REVIEWED_AT_COLUMN,
  incidentReportExportRecordToCsvCells,
  incidentReportExportRecordToDetailedCells,
  toAdminIncidentReportExportRecord,
  type AdminIncidentReportExportRecord,
} from './admin-no-show-reports.export-mapper.js';
import * as repository from './admin-no-show-reports.repository.js';
import type {
  AdminNoShowReportsExportDownloadQuery,
  AdminNoShowReportsExportFilters,
} from './admin-no-show-reports.validation.js';

const AUDIT_DOMAIN = 'incident_reports';
const FILENAME_DOMAIN = 'incident-reports';

/**
 * Per chunk (default take 500): 1 keyset findMany.
 * Classifier fields are derived in-memory from the same include payload
 * used by the Admin list (no per-row detail/strike queries).
 */

export const preflightAdminNoShowReportsExport = async (
  filters: AdminNoShowReportsExportFilters,
) => {
  const normalized = normalizeExportFilters(filters);
  const count = await repository.countAdminNoShowReportsForExport(normalized);
  return buildSpreadsheetExportPreflightResult(count, normalized);
};

const collectIncidentReportExportRecords = async (
  filters: AdminNoShowReportsExportFilters,
): Promise<AdminIncidentReportExportRecord[]> => {
  const records: AdminIncidentReportExportRecord[] = [];

  for await (const batch of iterateKeysetChunks({
    take: getAdminExportChunkSize(),
    fetchPage: (cursor) =>
      repository.listAdminNoShowReportsExportBatch({
        query: filters,
        cursor,
        take: getAdminExportChunkSize(),
      }),
  })) {
    for (const report of batch) {
      records.push(toAdminIncidentReportExportRecord(report));
    }
  }

  return records;
};

const filenameOptions = (filters: AdminNoShowReportsExportFilters) => ({
  domain: FILENAME_DOMAIN,
  dateFrom: filters.dateFrom,
  dateTo: filters.dateTo,
});

export const exportAdminNoShowReportsCsv = async (
  filters: AdminNoShowReportsExportFilters,
) => {
  const normalized = normalizeExportFilters(filters);
  const count = await repository.countAdminNoShowReportsForExport(normalized);
  assertExportWithinLimit(count, 'csv');
  const records = await collectIncidentReportExportRecords(normalized);
  const { buildCsvBuffer } = await import('../admin-export/admin-export.csv.js');
  return buildCsvBuffer(
    [...INCIDENT_REPORT_EXPORT_HEADERS],
    records.map(incidentReportExportRecordToCsvCells),
  );
};

export const exportAdminNoShowReportsXlsx = async (
  filters: AdminNoShowReportsExportFilters,
) => {
  const normalized = normalizeExportFilters(filters);
  const count = await repository.countAdminNoShowReportsForExport(normalized);
  assertExportWithinLimit(count, 'xlsx');
  const records = await collectIncidentReportExportRecords(normalized);
  return buildXlsxBuffer({
    sheetName: 'Incident Reports',
    headers: [...INCIDENT_REPORT_EXPORT_HEADERS],
    rows: records.map(incidentReportExportRecordToDetailedCells),
    dateColumnIndexes: [
      INCIDENT_REPORT_EXPORT_CREATED_AT_COLUMN,
      INCIDENT_REPORT_EXPORT_REVIEWED_AT_COLUMN,
    ],
    wrapColumnIndexes: [
      INCIDENT_REPORT_EXPORT_REVIEW_NOTE_COLUMN,
      INCIDENT_REPORT_EXPORT_REPORT_NOTE_COLUMN,
    ],
  });
};

const sendBufferedExport = async (input: {
  res: Response;
  actorUserId: string;
  format: AdminExportSpreadsheetFormat;
  normalized: AdminNoShowReportsExportFilters;
  count: number;
  buffer: Buffer;
  contentType: string;
  exportedCount: number;
}) => {
  const filename = buildExportFilename({
    ...filenameOptions(input.normalized),
    format: input.format,
  });

  try {
    input.res.setHeader('Content-Type', input.contentType);
    input.res.setHeader('Content-Disposition', buildContentDisposition(filename));
    input.res.send(input.buffer);

    await logAdminDataExport({
      actorUserId: input.actorUserId,
      domain: AUDIT_DOMAIN,
      format: input.format,
      filters: input.normalized,
      expectedCount: input.count,
      exportedCount: input.exportedCount,
      success: true,
    });
  } catch (error) {
    await logAdminDataExport({
      actorUserId: input.actorUserId,
      domain: AUDIT_DOMAIN,
      format: input.format,
      filters: input.normalized,
      expectedCount: input.count,
      exportedCount: input.exportedCount,
      success: false,
      errorCode: error instanceof AppError ? error.code : 'EXPORT_FAILED',
    });
    throw error;
  }
};

export const streamAdminNoShowReportsExport = async (input: {
  res: Response;
  filters: AdminNoShowReportsExportDownloadQuery;
  actorUserId: string;
}) => {
  const { format, ...filters } = input.filters;
  const normalized = normalizeExportFilters(filters);
  const count = await repository.countAdminNoShowReportsForExport(normalized);

  assertExportWithinLimit(count, format);

  if (format === 'xlsx') {
    const buffer = await exportAdminNoShowReportsXlsx(normalized);
    await sendBufferedExport({
      res: input.res,
      actorUserId: input.actorUserId,
      format,
      normalized,
      count,
      buffer,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      exportedCount: count,
    });
    return;
  }

  const filename = buildExportFilename({
    ...filenameOptions(normalized),
    format: 'csv',
  });

  let exportedCount = 0;
  const audit = createStreamExportAuditGuard({
    actorUserId: input.actorUserId,
    domain: AUDIT_DOMAIN,
    format: 'csv',
    filters: normalized,
    expectedCount: count,
    getExportedCount: () => exportedCount,
  });

  const onFinish = () => {
    audit.markFinished();
  };
  const onClose = () => {
    audit.markClosed();
  };
  const onError = () => {
    audit.markError('EXPORT_STREAM_ERROR');
  };

  input.res.once('finish', onFinish);
  input.res.once('close', onClose);
  input.res.once('error', onError);

  try {
    input.res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    input.res.setHeader('Content-Disposition', buildContentDisposition(filename));
    input.res.write(CSV_UTF8_BOM);
    input.res.write(`${formatCsvHeaderRow([...INCIDENT_REPORT_EXPORT_HEADERS])}\r\n`);

    for await (const batch of iterateKeysetChunks({
      take: getAdminExportChunkSize(),
      fetchPage: (cursor) =>
        repository.listAdminNoShowReportsExportBatch({
          query: normalized,
          cursor,
          take: getAdminExportChunkSize(),
        }),
    })) {
      for (const report of batch) {
        const record = toAdminIncidentReportExportRecord(report);
        input.res.write(
          `${formatCsvRow(incidentReportExportRecordToCsvCells(record))}\r\n`,
        );
        exportedCount += 1;
      }
    }

    input.res.end();
  } catch (error) {
    audit.markError(error instanceof AppError ? error.code : 'EXPORT_FAILED');
    throw error;
  } finally {
    input.res.off('finish', onFinish);
    input.res.off('close', onClose);
    input.res.off('error', onError);
    await audit.finalize();
  }
};
