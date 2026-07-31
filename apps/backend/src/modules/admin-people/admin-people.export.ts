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
  USER_EXPORT_CREATED_AT_COLUMN,
  USER_EXPORT_HEADERS,
  USER_EXPORT_LAST_LOGIN_AT_COLUMN,
  USER_EXPORT_ROLES_COLUMN,
  toAdminUserExportRecord,
  userExportRecordToCsvCells,
  userExportRecordToDetailedCells,
  type AdminUserExportRecord,
} from './admin-people.export-mapper.js';
import * as repository from './admin-people.repository.js';
import type {
  AdminPeopleExportDownloadQuery,
  AdminPeopleExportFilters,
} from './admin-people.validation.js';

const AUDIT_DOMAIN = 'users';
const FILENAME_DOMAIN = 'users';

/**
 * Per chunk (default take 500):
 * 1 user keyset findMany + 7 parallel metric groupBys = 8 queries.
 * (strikes, materials, reservations×2, learning projects, builds, deliveries)
 */
const enrichBatch = async (
  batch: repository.AdminPeopleExportUserRecord[],
): Promise<AdminUserExportRecord[]> => {
  const userIds = batch.map((item) => item.id);
  const driverProfileIdByUserId = new Map(
    batch
      .filter((item) => item.driverProfile?.id)
      .map((item) => [item.id, item.driverProfile!.id]),
  );
  const driverProfileIds = [...new Set(driverProfileIdByUserId.values())];

  const [
    strikeCounts,
    materialsCounts,
    requesterReservationCounts,
    ownerReservationCounts,
    submittedLearningProjectsCounts,
    projectBuildsCounts,
    assignedDeliveryCountsByDriverProfileId,
  ] = await Promise.all([
    repository.countVerifiedStrikesForUserIds(userIds),
    repository.countMaterialsByOwnerIds(userIds),
    repository.countReservationsByRequesterIds(userIds),
    repository.countReservationsByOwnerIds(userIds),
    repository.countSubmittedLearningProjectsByCreatorIds(userIds),
    repository.countProjectBuildsByLearnerIds(userIds),
    repository.countAssignedDeliveriesByDriverProfileIds(driverProfileIds),
  ]);

  return batch.map((user) => {
    const driverProfileId = driverProfileIdByUserId.get(user.id);
    return toAdminUserExportRecord(user, {
      verifiedStrikeCount: strikeCounts.get(user.id) ?? 0,
      materialsCount: materialsCounts.get(user.id) ?? 0,
      reservationsAsRequesterCount:
        requesterReservationCounts.get(user.id) ?? 0,
      reservationsAsOwnerCount: ownerReservationCounts.get(user.id) ?? 0,
      submittedLearningProjectsCount:
        submittedLearningProjectsCounts.get(user.id) ?? 0,
      projectBuildsCount: projectBuildsCounts.get(user.id) ?? 0,
      assignedDeliveriesCount: driverProfileId
        ? (assignedDeliveryCountsByDriverProfileId.get(driverProfileId) ?? 0)
        : 0,
    });
  });
};

export const preflightAdminPeopleExport = async (
  filters: AdminPeopleExportFilters,
) => {
  const normalized = normalizeExportFilters(filters);
  const count = await repository.countAdminPeopleForExport(normalized);
  return buildSpreadsheetExportPreflightResult(count, normalized);
};

const collectUserExportRecords = async (
  filters: AdminPeopleExportFilters,
): Promise<AdminUserExportRecord[]> => {
  const records: AdminUserExportRecord[] = [];

  for await (const batch of iterateKeysetChunks({
    take: getAdminExportChunkSize(),
    fetchPage: (cursor) =>
      repository.listAdminPeopleExportBatch({
        query: filters,
        cursor,
        take: getAdminExportChunkSize(),
      }),
  })) {
    records.push(...(await enrichBatch(batch)));
  }

  return records;
};

export const exportAdminPeopleCsv = async (
  filters: AdminPeopleExportFilters,
) => {
  const normalized = normalizeExportFilters(filters);
  const count = await repository.countAdminPeopleForExport(normalized);
  assertExportWithinLimit(count, 'csv');
  const records = await collectUserExportRecords(normalized);
  const { buildCsvBuffer } = await import('../admin-export/admin-export.csv.js');
  return buildCsvBuffer(
    [...USER_EXPORT_HEADERS],
    records.map(userExportRecordToCsvCells),
  );
};

export const exportAdminPeopleXlsx = async (
  filters: AdminPeopleExportFilters,
) => {
  const normalized = normalizeExportFilters(filters);
  const count = await repository.countAdminPeopleForExport(normalized);
  assertExportWithinLimit(count, 'xlsx');
  const records = await collectUserExportRecords(normalized);
  return buildXlsxBuffer({
    sheetName: 'Users',
    headers: [...USER_EXPORT_HEADERS],
    rows: records.map(userExportRecordToDetailedCells),
    dateColumnIndexes: [
      USER_EXPORT_CREATED_AT_COLUMN,
      USER_EXPORT_LAST_LOGIN_AT_COLUMN,
    ],
    wrapColumnIndexes: [USER_EXPORT_ROLES_COLUMN],
  });
};

const sendBufferedExport = async (input: {
  res: Response;
  actorUserId: string;
  format: AdminExportSpreadsheetFormat;
  normalized: AdminPeopleExportFilters;
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

export const streamAdminPeopleExport = async (input: {
  res: Response;
  filters: AdminPeopleExportDownloadQuery;
  actorUserId: string;
}) => {
  const { format, ...filters } = input.filters;
  const normalized = normalizeExportFilters(filters);
  const count = await repository.countAdminPeopleForExport(normalized);

  assertExportWithinLimit(count, format);

  if (format === 'xlsx') {
    const buffer = await exportAdminPeopleXlsx(normalized);
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
    input.res.write(`${formatCsvHeaderRow([...USER_EXPORT_HEADERS])}\r\n`);

    for await (const batch of iterateKeysetChunks({
      take: getAdminExportChunkSize(),
      fetchPage: (cursor) =>
        repository.listAdminPeopleExportBatch({
          query: normalized,
          cursor,
          take: getAdminExportChunkSize(),
        }),
    })) {
      const records = await enrichBatch(batch);
      for (const record of records) {
        input.res.write(
          `${formatCsvRow(userExportRecordToCsvCells(record))}\r\n`,
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
