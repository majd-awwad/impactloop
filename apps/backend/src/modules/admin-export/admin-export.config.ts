import { env } from '../../config/env.js';

import type { AdminExportFormat } from './admin-export.validation.js';

export const getAdminExportMaxRows = (): number => env.adminExportMaxRows;

export const getAdminExportChunkSize = (): number => env.adminExportChunkSize;

export const getAdminExportPdfMaxRows = (): number => env.adminExportPdfMaxRows;

export const getAdminExportMaxRowsForFormat = (
  format: AdminExportFormat,
): number => {
  if (format === 'pdf') {
    return getAdminExportPdfMaxRows();
  }
  return getAdminExportMaxRows();
};
