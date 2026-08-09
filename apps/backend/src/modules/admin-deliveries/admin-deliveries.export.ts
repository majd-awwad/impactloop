import type { Response } from 'express';
import type { NoShowReportStatus } from '../../generated/prisma/client.js';

import { AppError } from '../../utils/app-error.js';
import {
  createStreamExportAuditGuard,
  logAdminDataExport,
} from '../admin-export/admin-export.audit.js';
import { getAdminExportChunkSize } from '../admin-export/admin-export.config.js';
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
import { classifyAdminReportContract } from '../admin-no-show-reports/admin-no-show-reports.classifier.js';

import {
  composeAdminDeliveryContract,
  type DeliveryIncidentContract,
} from './admin-deliveries.classifier.js';
import {
  DELIVERY_EXPORT_ASSIGNED_AT_COLUMN,
  DELIVERY_EXPORT_DELIVERED_AT_COLUMN,
  DELIVERY_EXPORT_HEADERS,
  DELIVERY_EXPORT_MATERIAL_TITLE_COLUMN,
  DELIVERY_EXPORT_PICKED_UP_AT_COLUMN,
  DELIVERY_EXPORT_REQUESTED_AT_COLUMN,
  deliveryExportRecordToCsvCells,
  deliveryExportRecordToDetailedCells,
  type DeliveryExportRecord,
} from './admin-deliveries.export-mapper.js';
import * as repository from './admin-deliveries.repository.js';
import type {
  AdminDeliveriesExportDownloadQuery,
  AdminDeliveriesExportFilters,
} from './admin-deliveries.validation.js';

const AUDIT_DOMAIN = 'deliveries';
const FILENAME_DOMAIN = 'deliveries';

const resolveSupplierDisplayName = (
  owner: repository.AdminDeliveryExportRecord['reservation']['owner'],
) =>
  owner.supplierProfile?.organizationProfile?.organizationName?.trim() ||
  owner.supplierProfile?.publicName?.trim() ||
  owner.displayName;

const formatLocationLabel = (
  location:
    | repository.AdminDeliveryExportRecord['pickupLocation']
    | null
    | undefined,
) => {
  if (!location) return '';
  const parts = [location.area, location.city, location.country]
    .map((part) => part?.trim())
    .filter((part) => part && part.length > 0);
  return parts.length > 0 ? parts.join(', ') : '';
};

const mapPrimaryIncidentContract = (
  delivery: repository.AdminDeliveryExportRecord,
  report: repository.AdminDeliveryPrimaryIncident,
): DeliveryIncidentContract & {
  status: NoShowReportStatus;
  reasonCode: string;
} => {
  const contract = classifyAdminReportContract({
    report,
    reservation: delivery.reservation,
    delivery: {
      id: delivery.id,
      status: delivery.status,
      assignedDriverProfileId: delivery.assignedDriverProfileId,
      deliveryGroupId: delivery.deliveryGroupId,
    },
    isGroupedDelivery: delivery.deliveryGroupId != null,
    isGroupRecoverySupported: false,
  });
  return {
    id: report.id,
    ...contract,
    status: report.status,
    reasonCode: report.reasonCode,
  };
};

const toExportRecord = (
  delivery: repository.AdminDeliveryExportRecord,
  primaryIncident: repository.AdminDeliveryPrimaryIncident | null | undefined,
): DeliveryExportRecord => {
  const canReopen =
    delivery.status === 'DRIVER_ASSIGNED' &&
    delivery.assignedDriverProfileId != null &&
    delivery.deliveryGroupId == null &&
    delivery.assignments.some(
      (assignment) =>
        assignment.status === 'ACTIVE' &&
        assignment.driverProfile.id === delivery.assignedDriverProfileId,
    );

  const mappedPrimary = primaryIncident
    ? mapPrimaryIncidentContract(delivery, primaryIncident)
    : null;

  const contract = composeAdminDeliveryContract({
    delivery: {
      id: delivery.id,
      status: delivery.status,
      deliveryGroupId: delivery.deliveryGroupId,
      assignedDriverProfileId: delivery.assignedDriverProfileId,
    },
    reservation: {
      id: delivery.reservation.id,
      status: delivery.reservation.status,
      pendingRescheduleRequestedBy:
        delivery.reservation.pendingRescheduleRequestedBy,
      pendingRescheduleReason: delivery.reservation.pendingRescheduleReason,
    },
    primaryIncident: mappedPrimary,
    hasExpectedRecoveryIncident:
      !['AWAITING_RESOLUTION', 'DRIVER_NO_SHOW', 'FAILED_PICKUP'].includes(
        delivery.status,
      ) || delivery._count.incidentReports > 0,
    canReopenDriverAssignment: canReopen,
    assignments: delivery.assignments.map((assignment) => ({
      id: assignment.id,
      status: assignment.status,
      acceptedAt: assignment.acceptedAt,
      releasedAt: assignment.releasedAt,
      driver: assignment.driverProfile
        ? {
            id: assignment.driverProfile.id,
            displayName: assignment.driverProfile.displayName,
            email: assignment.driverProfile.user.email,
          }
        : null,
    })),
  });

  return {
    deliveryId: delivery.id,
    deliveryStatus: delivery.status,
    scope: contract.scope,
    lifecyclePhase: contract.lifecyclePhase,
    adminAttentionState: contract.adminAttentionState,
    assignmentState: contract.assignmentState,
    incidentCount: delivery._count.incidentReports,
    primaryIncidentStatus: mappedPrimary?.status ?? null,
    primaryIncidentReason: mappedPrimary?.reasonCode ?? null,
    requestedAt: delivery.requestedAt,
    assignedAt: delivery.assignedAt,
    pickedUpAt: delivery.pickedUpAt,
    deliveredAt: delivery.deliveredAt,
    reservationId: delivery.reservation.id,
    materialId: delivery.reservation.material.id,
    materialTitle: delivery.reservation.material.title,
    learnerName: delivery.reservation.requester.displayName,
    learnerEmail: delivery.reservation.requester.email,
    supplierName: resolveSupplierDisplayName(delivery.reservation.owner),
    supplierEmail: delivery.reservation.owner.email,
    driverName: delivery.assignedDriverProfile?.displayName ?? null,
    driverEmail: delivery.assignedDriverProfile?.user.email ?? null,
    pickupArea: formatLocationLabel(delivery.pickupLocation),
    dropoffArea: formatLocationLabel(delivery.dropoffLocation),
    groupId: delivery.deliveryGroup?.id ?? null,
    groupStatus: delivery.deliveryGroup?.status ?? null,
  };
};

/**
 * Domain-local keyset on requestedAt+id (shared iterateKeysetChunks is
 * hardcoded to createdAt).
 */
async function* iterateDeliveryExportChunks(input: {
  filters: AdminDeliveriesExportFilters;
  take: number;
}): AsyncGenerator<repository.AdminDeliveryExportRecord[], void, undefined> {
  let cursor: repository.AdminDeliveryExportKeysetCursor | undefined;

  while (true) {
    const batch = await repository.listAdminDeliveriesExportBatch({
      query: input.filters,
      cursor,
      take: input.take,
    });
    if (batch.length === 0) {
      return;
    }

    yield batch;

    if (batch.length < input.take) {
      return;
    }

    const last = batch[batch.length - 1]!;
    cursor = { requestedAt: last.requestedAt, id: last.id };
  }
}

export const preflightAdminDeliveriesExport = async (
  filters: AdminDeliveriesExportFilters,
) => {
  const normalized = normalizeExportFilters(filters);
  const count = await repository.countAdminDeliveriesForExport(normalized);
  return buildSpreadsheetExportPreflightResult(count, normalized);
};

const collectDeliveryExportRecords = async (
  filters: AdminDeliveriesExportFilters,
): Promise<DeliveryExportRecord[]> => {
  const records: DeliveryExportRecord[] = [];
  const take = getAdminExportChunkSize();

  for await (const batch of iterateDeliveryExportChunks({ filters, take })) {
    const primaryByDelivery =
      await repository.findPrimaryIncidentsForDeliveryIds(
        batch.map((item) => item.id),
      );
    for (const delivery of batch) {
      records.push(
        toExportRecord(delivery, primaryByDelivery.get(delivery.id) ?? null),
      );
    }
  }

  return records;
};

const filenameOptions = (filters: AdminDeliveriesExportFilters) => ({
  domain: FILENAME_DOMAIN,
  dateFrom: filters.dateFrom,
  dateTo: filters.dateTo,
});

export const exportAdminDeliveriesCsv = async (
  filters: AdminDeliveriesExportFilters,
) => {
  const normalized = normalizeExportFilters(filters);
  const count = await repository.countAdminDeliveriesForExport(normalized);
  assertExportWithinLimit(count, 'csv');
  const records = await collectDeliveryExportRecords(normalized);
  const { buildCsvBuffer } = await import('../admin-export/admin-export.csv.js');
  return buildCsvBuffer(
    [...DELIVERY_EXPORT_HEADERS],
    records.map(deliveryExportRecordToCsvCells),
  );
};

export const exportAdminDeliveriesXlsx = async (
  filters: AdminDeliveriesExportFilters,
) => {
  const normalized = normalizeExportFilters(filters);
  const count = await repository.countAdminDeliveriesForExport(normalized);
  assertExportWithinLimit(count, 'xlsx');
  const records = await collectDeliveryExportRecords(normalized);
  return buildXlsxBuffer({
    sheetName: 'Deliveries',
    headers: [...DELIVERY_EXPORT_HEADERS],
    rows: records.map(deliveryExportRecordToDetailedCells),
    dateColumnIndexes: [
      DELIVERY_EXPORT_REQUESTED_AT_COLUMN,
      DELIVERY_EXPORT_ASSIGNED_AT_COLUMN,
      DELIVERY_EXPORT_PICKED_UP_AT_COLUMN,
      DELIVERY_EXPORT_DELIVERED_AT_COLUMN,
    ],
    wrapColumnIndexes: [DELIVERY_EXPORT_MATERIAL_TITLE_COLUMN],
  });
};

const sendBufferedExport = async (input: {
  res: Response;
  actorUserId: string;
  format: AdminExportSpreadsheetFormat;
  normalized: AdminDeliveriesExportFilters;
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

export const streamAdminDeliveriesExport = async (input: {
  res: Response;
  filters: AdminDeliveriesExportDownloadQuery;
  actorUserId: string;
}) => {
  const { format, ...filters } = input.filters;
  const normalized = normalizeExportFilters(filters);
  const count = await repository.countAdminDeliveriesForExport(normalized);

  assertExportWithinLimit(count, format);

  if (format === 'xlsx') {
    const buffer = await exportAdminDeliveriesXlsx(normalized);
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
    input.res.write(`${formatCsvHeaderRow([...DELIVERY_EXPORT_HEADERS])}\r\n`);

    const take = getAdminExportChunkSize();
    for await (const batch of iterateDeliveryExportChunks({
      filters: normalized,
      take,
    })) {
      const primaryByDelivery =
        await repository.findPrimaryIncidentsForDeliveryIds(
          batch.map((item) => item.id),
        );
      for (const delivery of batch) {
        const record = toExportRecord(
          delivery,
          primaryByDelivery.get(delivery.id) ?? null,
        );
        input.res.write(
          `${formatCsvRow(deliveryExportRecordToCsvCells(record))}\r\n`,
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
