import { z } from 'zod';

export const ADMIN_EXPORT_FORMATS = ['xlsx', 'pdf', 'csv'] as const;

export const ADMIN_EXPORT_SPREADSHEET_FORMATS = ['xlsx', 'csv'] as const;

export const adminExportFormatSchema = z.enum(ADMIN_EXPORT_FORMATS);

export const adminExportSpreadsheetFormatSchema = z.enum(
  ADMIN_EXPORT_SPREADSHEET_FORMATS,
);

export type AdminExportFormat = z.infer<typeof adminExportFormatSchema>;

export type AdminExportSpreadsheetFormat = z.infer<
  typeof adminExportSpreadsheetFormatSchema
>;
