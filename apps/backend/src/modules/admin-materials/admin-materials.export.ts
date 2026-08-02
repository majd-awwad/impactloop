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
  MATERIAL_EXPORT_CREATED_AT_COLUMN,
  MATERIAL_EXPORT_HEADERS,
  MATERIAL_EXPORT_UPDATED_AT_COLUMN,
  materialExportRecordToCsvCells,
  materialExportRecordToDetailedCells,
  toMaterialExportRecord,
  type MaterialExportRecord,
} from './admin-materials.export-mapper.js';
import * as repository from './admin-materials.repository.js';
import type {
  AdminMaterialsExportDownloadQuery,
  AdminMaterialsExportFilters,
} from './admin-materials.validation.js';

export const preflightAdminMaterialsExport = async (
  filters: AdminMaterialsExportFilters,
) => {
  const normalized = normalizeExportFilters(filters);
  const count = await repository.countAdminMaterialsForExport(normalized);
  return buildSpreadsheetExportPreflightResult(count, normalized);
};

const collectMaterialExportRecords = async (
  filters: AdminMaterialsExportFilters,
): Promise<MaterialExportRecord[]> => {
  const records: MaterialExportRecord[] = [];

  for await (const batch of iterateKeysetChunks({
    take: getAdminExportChunkSize(),
    fetchPage: (cursor) =>
      repository.listAdminMaterialsExportBatch({
        query: filters,
        cursor,
        take: getAdminExportChunkSize(),
      }),
  })) {
    const pendingByMaterial = await repository.countPendingReportsByMaterialIds(
      batch.map((item) => item.id),
    );
    for (const material of batch) {
      records.push(
        toMaterialExportRecord(
          material,
          pendingByMaterial.get(material.id) ?? 0,
        ),
      );
    }
  }

  return records;
};

export const exportAdminMaterialsCsv = async (
  filters: AdminMaterialsExportFilters,
) => {
  const normalized = normalizeExportFilters(filters);
  const count = await repository.countAdminMaterialsForExport(normalized);
  assertExportWithinLimit(count, 'csv');
  const records = await collectMaterialExportRecords(normalized);
  const { buildCsvBuffer } = await import('../admin-export/admin-export.csv.js');
  return buildCsvBuffer(
    [...MATERIAL_EXPORT_HEADERS],
    records.map(materialExportRecordToCsvCells),
  );
};

export const exportAdminMaterialsXlsx = async (
  filters: AdminMaterialsExportFilters,
) => {
  const normalized = normalizeExportFilters(filters);
  const count = await repository.countAdminMaterialsForExport(normalized);
  assertExportWithinLimit(count, 'xlsx');
  const records = await collectMaterialExportRecords(normalized);
  return buildXlsxBuffer({
    sheetName: 'Materials',
    headers: [...MATERIAL_EXPORT_HEADERS],
    rows: records.map(materialExportRecordToDetailedCells),
    dateColumnIndexes: [
      MATERIAL_EXPORT_CREATED_AT_COLUMN,
      MATERIAL_EXPORT_UPDATED_AT_COLUMN,
    ],
  });
};

const sendBufferedExport = async (input: {
  res: Response;
  actorUserId: string;
  format: AdminExportSpreadsheetFormat;
  normalized: AdminMaterialsExportFilters;
  count: number;
  buffer: Buffer;
  contentType: string;
  exportedCount: number;
}) => {
  const filename = buildExportFilename({
    domain: 'materials',
    format: input.format,
  });

  try {
    input.res.setHeader('Content-Type', input.contentType);
    input.res.setHeader('Content-Disposition', buildContentDisposition(filename));
    input.res.send(input.buffer);

    await logAdminDataExport({
      actorUserId: input.actorUserId,
      domain: 'materials',
      format: input.format,
      filters: input.normalized,
      expectedCount: input.count,
      exportedCount: input.exportedCount,
      success: true,
    });
  } catch (error) {
    await logAdminDataExport({
      actorUserId: input.actorUserId,
      domain: 'materials',
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

export const streamAdminMaterialsExport = async (input: {
  res: Response;
  filters: AdminMaterialsExportDownloadQuery;
  actorUserId: string;
}) => {
  const { format, ...filters } = input.filters;
  const normalized = normalizeExportFilters(filters);
  const count = await repository.countAdminMaterialsForExport(normalized);

  assertExportWithinLimit(count, format);

  if (format === 'xlsx') {
    const buffer = await exportAdminMaterialsXlsx(normalized);
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
    domain: 'materials',
    format: 'csv',
  });

  let exportedCount = 0;
  const audit = createStreamExportAuditGuard({
    actorUserId: input.actorUserId,
    domain: 'materials',
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
    input.res.write(`${formatCsvHeaderRow([...MATERIAL_EXPORT_HEADERS])}\r\n`);

    for await (const batch of iterateKeysetChunks({
      take: getAdminExportChunkSize(),
      fetchPage: (cursor) =>
        repository.listAdminMaterialsExportBatch({
          query: normalized,
          cursor,
          take: getAdminExportChunkSize(),
        }),
    })) {
      const pendingByMaterial =
        await repository.countPendingReportsByMaterialIds(
          batch.map((item) => item.id),
        );
      for (const material of batch) {
        const record = toMaterialExportRecord(
          material,
          pendingByMaterial.get(material.id) ?? 0,
        );
        input.res.write(
          `${formatCsvRow(materialExportRecordToCsvCells(record))}\r\n`,
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
