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
  buildExportPreflightResult,
  normalizeExportFilters,
} from '../admin-export/admin-export.preflight.js';
import { buildReservationsPdfBuffer } from '../admin-export/admin-export.pdf.js';
import type { AdminExportFormat } from '../admin-export/admin-export.validation.js';
import { buildXlsxBuffer } from '../admin-export/admin-export.xlsx.js';

import {
  RESERVATION_EXPORT_CREATED_AT_COLUMN,
  RESERVATION_EXPORT_HEADERS,
  reservationExportRecordToCsvCells,
  reservationExportRecordToDetailedCells,
  toReservationExportRecord,
  type ReservationExportRecord,
} from './admin-reservations.export-mapper.js';
import * as repository from './admin-reservations.repository.js';
import type {
  AdminReservationsExportDownloadQuery,
  AdminReservationsExportFilters,
} from './admin-reservations.validation.js';

export const preflightAdminReservationsExport = async (
  filters: AdminReservationsExportFilters,
) => {
  const normalized = normalizeExportFilters(filters);
  const count = await repository.countAdminReservationsForExport(normalized);
  return buildExportPreflightResult(count, normalized);
};

const collectReservationExportRecords = async (
  filters: AdminReservationsExportFilters,
): Promise<ReservationExportRecord[]> => {
  const records: ReservationExportRecord[] = [];

  for await (const batch of iterateKeysetChunks({
    take: getAdminExportChunkSize(),
    fetchPage: (cursor) =>
      repository.listAdminReservationsExportBatch({
        query: filters,
        cursor,
        take: getAdminExportChunkSize(),
      }),
  })) {
    for (const reservation of batch) {
      records.push(toReservationExportRecord(reservation));
    }
  }

  return records;
};

export const exportAdminReservationsCsv = async (
  filters: AdminReservationsExportFilters,
) => {
  const normalized = normalizeExportFilters(filters);
  const count = await repository.countAdminReservationsForExport(normalized);
  assertExportWithinLimit(count, 'csv');
  const records = await collectReservationExportRecords(normalized);
  const { buildCsvBuffer } = await import('../admin-export/admin-export.csv.js');
  return buildCsvBuffer(
    [...RESERVATION_EXPORT_HEADERS],
    records.map(reservationExportRecordToCsvCells),
  );
};

export const exportAdminReservationsXlsx = async (
  filters: AdminReservationsExportFilters,
) => {
  const normalized = normalizeExportFilters(filters);
  const count = await repository.countAdminReservationsForExport(normalized);
  assertExportWithinLimit(count, 'xlsx');
  const records = await collectReservationExportRecords(normalized);
  return buildXlsxBuffer({
    sheetName: 'Reservations',
    headers: [...RESERVATION_EXPORT_HEADERS],
    rows: records.map(reservationExportRecordToDetailedCells),
    dateColumnIndexes: [RESERVATION_EXPORT_CREATED_AT_COLUMN],
  });
};

export const exportAdminReservationsPdf = async (
  filters: AdminReservationsExportFilters,
) => {
  const normalized = normalizeExportFilters(filters);
  const count = await repository.countAdminReservationsForExport(normalized);
  assertExportWithinLimit(count, 'pdf');

  const [records, statusGroups] = await Promise.all([
    collectReservationExportRecords(normalized),
    repository.groupAdminReservationsStatusForExport(normalized),
  ]);

  const statusSummary: Record<string, number> = {};
  for (const group of statusGroups) {
    statusSummary[group.status] = group._count._all;
  }

  return buildReservationsPdfBuffer({
    generatedAt: new Date(),
    filters: normalized,
    totalCount: count,
    statusSummary,
    rows: records.map((record) => ({
      reservationId: record.reservationId,
      material: record.materialTitle,
      learner: record.learnerName,
      supplier: record.supplierName,
      status: record.status,
      quantityUnit: `${record.quantity} ${record.unit}`,
      createdAt: record.createdAt.toISOString().slice(0, 19).replace('T', ' '),
      deliveryStatus: record.deliveryStatus ?? '',
    })),
  });
};

const sendBufferedExport = async (input: {
  res: Response;
  actorUserId: string;
  format: AdminExportFormat;
  normalized: AdminReservationsExportFilters;
  count: number;
  buffer: Buffer;
  contentType: string;
  exportedCount: number;
}) => {
  const filename = buildExportFilename({
    domain: 'reservations',
    format: input.format,
    dateFrom: input.normalized.dateFrom,
    dateTo: input.normalized.dateTo,
  });

  try {
    input.res.setHeader('Content-Type', input.contentType);
    input.res.setHeader('Content-Disposition', buildContentDisposition(filename));
    input.res.send(input.buffer);

    // Success = server completed writing the response body (not browser save/open).
    await logAdminDataExport({
      actorUserId: input.actorUserId,
      domain: 'reservations',
      format: input.format,
      filters: input.normalized,
      expectedCount: input.count,
      exportedCount: input.exportedCount,
      success: true,
    });
  } catch (error) {
    await logAdminDataExport({
      actorUserId: input.actorUserId,
      domain: 'reservations',
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

export const streamAdminReservationsExport = async (input: {
  res: Response;
  filters: AdminReservationsExportDownloadQuery;
  actorUserId: string;
}) => {
  const { format, ...filters } = input.filters;
  const normalized = normalizeExportFilters(filters);
  const count = await repository.countAdminReservationsForExport(normalized);

  assertExportWithinLimit(count, format);

  if (format === 'xlsx') {
    const buffer = await exportAdminReservationsXlsx(normalized);
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

  if (format === 'pdf') {
    const buffer = await exportAdminReservationsPdf(normalized);
    await sendBufferedExport({
      res: input.res,
      actorUserId: input.actorUserId,
      format,
      normalized,
      count,
      buffer,
      contentType: 'application/pdf',
      exportedCount: count,
    });
    return;
  }

  // CSV streamed path with exactly-once terminal audit.
  const filename = buildExportFilename({
    domain: 'reservations',
    format: 'csv',
    dateFrom: normalized.dateFrom,
    dateTo: normalized.dateTo,
  });

  let exportedCount = 0;
  const audit = createStreamExportAuditGuard({
    actorUserId: input.actorUserId,
    domain: 'reservations',
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
    input.res.write(`${formatCsvHeaderRow([...RESERVATION_EXPORT_HEADERS])}\r\n`);

    for await (const batch of iterateKeysetChunks({
      take: getAdminExportChunkSize(),
      fetchPage: (cursor) =>
        repository.listAdminReservationsExportBatch({
          query: normalized,
          cursor,
          take: getAdminExportChunkSize(),
        }),
    })) {
      for (const reservation of batch) {
        const record = toReservationExportRecord(reservation);
        input.res.write(
          `${formatCsvRow(reservationExportRecordToCsvCells(record))}\r\n`,
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
