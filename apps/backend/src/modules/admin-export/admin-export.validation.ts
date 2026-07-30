import { z } from 'zod';

export const ADMIN_EXPORT_FORMATS = ['xlsx', 'pdf', 'csv'] as const;

export const adminExportFormatSchema = z.enum(ADMIN_EXPORT_FORMATS);

export type AdminExportFormat = z.infer<typeof adminExportFormatSchema>;

export const adminExportDownloadQuerySchema = z.object({
  format: adminExportFormatSchema.default('xlsx'),
});
