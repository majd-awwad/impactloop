import { z } from 'zod';

import { paginationQuerySchema } from '../../utils/zod-helpers.js';
import { adminExportSpreadsheetFormatSchema } from '../admin-export/admin-export.validation.js';

export const adminNoShowReportsListQuerySchema = paginationQuerySchema.extend({
  status: z
    .enum(['PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'RESOLVED_NO_STRIKE'])
    .optional(),
  search: z.string().trim().max(200).optional(),
  workflow: z
    .enum([
      'ACCOUNTABILITY',
      'SYSTEM_RECOVERY',
      'ACCOUNTABILITY_AND_RECOVERY',
    ])
    .optional(),
  targetRole: z.enum(['LEARNER', 'SUPPLIER', 'DRIVER', 'SYSTEM']).optional(),
  operationalState: z
    .enum(['NOT_REQUIRED', 'REQUIRES_RESOLUTION', 'RESOLVED'])
    .optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
});

export type AdminNoShowReportsListQuery = z.infer<
  typeof adminNoShowReportsListQuerySchema
>;

export const adminNoShowReportsExportFiltersSchema =
  adminNoShowReportsListQuerySchema.omit({
    page: true,
    limit: true,
  });

export const adminNoShowReportsExportDownloadQuerySchema =
  adminNoShowReportsExportFiltersSchema.extend({
    format: adminExportSpreadsheetFormatSchema.default('xlsx'),
  });

export type AdminNoShowReportsExportFilters = z.infer<
  typeof adminNoShowReportsExportFiltersSchema
>;
export type AdminNoShowReportsExportDownloadQuery = z.infer<
  typeof adminNoShowReportsExportDownloadQuerySchema
>;

/** Shared list/export filter fields (no pagination). */
export type AdminNoShowReportsFilterInput = AdminNoShowReportsExportFilters;

export const adminNoShowReportIdParamSchema = z.object({
  id: z.string().trim().min(1),
});

export type AdminNoShowReportIdParams = z.infer<
  typeof adminNoShowReportIdParamSchema
>;

export const reviewNoShowReportSchema = z.object({
  reviewNote: z.string().trim().max(1000).optional(),
});

export type ReviewNoShowReportInput = z.infer<typeof reviewNoShowReportSchema>;

export const requestSupplierRescheduleSchema = z.object({
  adminNote: z.string().trim().max(1000).optional(),
});

export type RequestSupplierRescheduleInput = z.infer<
  typeof requestSupplierRescheduleSchema
>;

export const cancelReleaseHoldSchema = z.object({
  adminNote: z.string().trim().max(1000).optional(),
});

export type CancelReleaseHoldInput = z.infer<typeof cancelReleaseHoldSchema>;
