import { AppError } from '../../utils/app-error.js';

import {
  getAdminExportMaxRows,
  getAdminExportMaxRowsForFormat,
  getAdminExportPdfMaxRows,
} from './admin-export.config.js';
import type {
  AdminExportFormat,
  AdminExportSpreadsheetFormat,
} from './admin-export.validation.js';
import {
  ADMIN_EXPORT_FORMATS,
  ADMIN_EXPORT_SPREADSHEET_FORMATS,
} from './admin-export.validation.js';

export type AdminExportFormatEligibility = {
  maxAllowed: number;
  exceedsLimit: boolean;
  allowed: boolean;
};

export type AdminExportPreflightResult<TFilters extends Record<string, unknown>> =
  {
    count: number;
    filters: TFilters;
    formats: Record<AdminExportFormat, AdminExportFormatEligibility>;
  };

export type AdminExportSpreadsheetPreflightResult<
  TFilters extends Record<string, unknown>,
> = {
  count: number;
  filters: TFilters;
  formats: Record<AdminExportSpreadsheetFormat, AdminExportFormatEligibility>;
};

const eligibilityFor = (
  count: number,
  maxAllowed: number,
): AdminExportFormatEligibility => {
  const exceedsLimit = count > maxAllowed;
  return {
    maxAllowed,
    exceedsLimit,
    allowed: !exceedsLimit,
  };
};

export const buildExportPreflightResult = <
  TFilters extends Record<string, unknown>,
>(
  count: number,
  filters: TFilters,
): AdminExportPreflightResult<TFilters> => {
  const spreadsheetMax = getAdminExportMaxRows();
  const pdfMax = getAdminExportPdfMaxRows();

  return {
    count,
    filters,
    formats: {
      xlsx: eligibilityFor(count, spreadsheetMax),
      csv: eligibilityFor(count, spreadsheetMax),
      pdf: eligibilityFor(count, pdfMax),
    },
  };
};

/** Preflight for domains that support Excel + CSV only (no PDF). */
export const buildSpreadsheetExportPreflightResult = <
  TFilters extends Record<string, unknown>,
>(
  count: number,
  filters: TFilters,
): AdminExportSpreadsheetPreflightResult<TFilters> => {
  const spreadsheetMax = getAdminExportMaxRows();

  return {
    count,
    filters,
    formats: {
      xlsx: eligibilityFor(count, spreadsheetMax),
      csv: eligibilityFor(count, spreadsheetMax),
    },
  };
};

export const isAdminExportSpreadsheetFormat = (
  value: string,
): value is AdminExportSpreadsheetFormat =>
  (ADMIN_EXPORT_SPREADSHEET_FORMATS as readonly string[]).includes(value);

export const assertExportWithinLimit = (
  count: number,
  format: AdminExportFormat,
): void => {
  const maxAllowed = getAdminExportMaxRowsForFormat(format);
  if (count > maxAllowed) {
    throw new AppError(
      `Export exceeds the maximum of ${maxAllowed} rows for format ${format}.`,
      400,
      'EXPORT_LIMIT_EXCEEDED',
      { count, maxAllowed, format },
    );
  }
};

export const normalizeExportFilters = <T extends Record<string, unknown>>(
  filters: T,
): T =>
  Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined),
  ) as T;

export const isAdminExportFormat = (
  value: string,
): value is AdminExportFormat =>
  (ADMIN_EXPORT_FORMATS as readonly string[]).includes(value);
