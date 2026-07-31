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
  MATERIAL_REPORT_EXPORT_ADMIN_NOTE_COLUMN,
  MATERIAL_REPORT_EXPORT_CREATED_AT_COLUMN,
  MATERIAL_REPORT_EXPORT_HEADERS,
  MATERIAL_REPORT_EXPORT_NOTE_COLUMN,
  MATERIAL_REPORT_EXPORT_REVIEWED_AT_COLUMN,
  materialReportExportRecordToCsvCells,
  materialReportExportRecordToDetailedCells,
  toMaterialReportExportRecord,
  type MaterialReportExportRecord,
} from './admin-material-reports.export-mapper.js';
import * as repository from './admin-materials.repository.js';
import type {
  AdminMaterialReportsExportDownloadQuery,
  AdminMaterialReportsExportFilters,
} from './admin-materials.validation.js';

const AUDIT_DOMAIN = 'material_reports';
const FILENAME_DOMAIN = 'material-reports';

export const preflightAdminMaterialReportsExport = async (
  filters: AdminMaterialReportsExportFilters,
) => {
  const normalized = normalizeExportFilters(filters);
  const count = await repository.countAdminMaterialReportsForExport(normalized);
  return buildSpreadsheetExportPreflightResult(count, normalized);
};

const collectMaterialReportExportRecords = async (
  filters: AdminMaterialReportsExportFilters,
): Promise<MaterialReportExportRecord[]> => {
  const records: MaterialReportExportRecord[] = [];

  for await (const batch of iterateKeysetChunks({
    take: getAdminExportChunkSize(),
    fetchPage: (cursor) =>
      repository.listAdminMaterialReportsExportBatch({
        query: filters,
        cursor,
        take: getAdminExportChunkSize(),
      }),
  })) {
    for (const report of batch) {
      records.push(toMaterialReportExportRecord(report));
    }
  }

  return records;
};

export const exportAdminMaterialReportsCsv = async (
  filters: AdminMaterialReportsExportFilters,
) => {
  const normalized = normalizeExportFilters(filters);
  const count = await repository.countAdminMaterialReportsForExport(normalized);
  assertExportWithinLimit(count, 'csv');
  const records = await collectMaterialReportExportRecords(normalized);
  const { buildCsvBuffer } = await import('../admin-export/admin-export.csv.js');
  return buildCsvBuffer(
    [...MATERIAL_REPORT_EXPORT_HEADERS],
    records.map(materialReportExportRecordToCsvCells),
  );
};

export const exportAdminMaterialReportsXlsx = async (
  filters: AdminMaterialReportsExportFilters,
) => {
  const normalized = normalizeExportFilters(filters);
  const count = await repository.countAdminMaterialReportsForExport(normalized);
  assertExportWithinLimit(count, 'xlsx');
  const records = await collectMaterialReportExportRecords(normalized);
  return buildXlsxBuffer({
    sheetName: 'Material Reports',
    headers: [...MATERIAL_REPORT_EXPORT_HEADERS],
    rows: records.map(materialReportExportRecordToDetailedCells),
    dateColumnIndexes: [
      MATERIAL_REPORT_EXPORT_CREATED_AT_COLUMN,
      MATERIAL_REPORT_EXPORT_REVIEWED_AT_COLUMN,
    ],
    wrapColumnIndexes: [
      MATERIAL_REPORT_EXPORT_NOTE_COLUMN,
      MATERIAL_REPORT_EXPORT_ADMIN_NOTE_COLUMN,
    ],
  });
};

const sendBufferedExport = async (input: {
  res: Response;
  actorUserId: string;
  format: AdminExportSpreadsheetFormat;
  normalized: AdminMaterialReportsExportFilters;
  count: number;
  buffer: Buffer;
  contentType: string;
  exportedCount: number;
}) => {
  const filename = buildExportFilename({
    domain: FILENAME_DOMAIN,
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

export const streamAdminMaterialReportsExport = async (input: {
  res: Response;
  filters: AdminMaterialReportsExportDownloadQuery;
  actorUserId: string;
}) => {
  const { format, ...filters } = input.filters;
  const normalized = normalizeExportFilters(filters);
  const count = await repository.countAdminMaterialReportsForExport(normalized);

  assertExportWithinLimit(count, format);

  if (format === 'xlsx') {
    const buffer = await exportAdminMaterialReportsXlsx(normalized);
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
    domain: FILENAME_DOMAIN,
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
    input.res.write(
      `${formatCsvHeaderRow([...MATERIAL_REPORT_EXPORT_HEADERS])}\r\n`,
    );

    for await (const batch of iterateKeysetChunks({
      take: getAdminExportChunkSize(),
      fetchPage: (cursor) =>
        repository.listAdminMaterialReportsExportBatch({
          query: normalized,
          cursor,
          take: getAdminExportChunkSize(),
        }),
    })) {
      for (const report of batch) {
        const record = toMaterialReportExportRecord(report);
        input.res.write(
          `${formatCsvRow(materialReportExportRecordToCsvCells(record))}\r\n`,
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
