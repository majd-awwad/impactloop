import { z } from 'zod';

import { paginationQuerySchema } from '../../utils/zod-helpers.js';
import { adminExportSpreadsheetFormatSchema } from '../admin-export/admin-export.validation.js';

const materialStatusSchema = z.enum([
  'AVAILABLE',
  'PENDING_RESERVATION',
  'RESERVED',
  'REUSED',
  'UNAVAILABLE',
]);

const verificationStatusSchema = z.enum([
  'NOT_REQUIRED',
  'PENDING',
  'VERIFIED',
  'REJECTED',
  'CHANGES_REQUESTED',
]);

export const adminMaterialsListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  status: materialStatusSchema.optional(),
  categoryId: z.string().trim().min(1).optional(),
  supplierId: z.string().trim().min(1).optional(),
  city: z.string().trim().max(120).optional(),
  isFree: z
    .preprocess((value) => {
      if (value === 'true') return true;
      if (value === 'false') return false;
      return value;
    }, z.boolean().optional()),
  verificationStatus: verificationStatusSchema.optional(),
  reportStatus: z.enum(['PENDING', 'HAS_REPORTS', 'NONE']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminMaterialIdParamSchema = z.object({
  id: z.string().trim().min(1),
});

export const hideMaterialSchema = z.object({
  reason: z.string().trim().min(3).max(2000),
});

export const markUnavailableSchema = z.object({
  reason: z.string().trim().max(2000).optional(),
});

export const materialReportReasonSchema = z.enum([
  'MISLEADING_INFORMATION',
  'WRONG_CATEGORY',
  'WRONG_PRICE',
  'INAPPROPRIATE',
  'ITEM_NOT_AVAILABLE',
  'SUSPICIOUS_SUPPLIER',
  'OTHER',
]);

export const submitMaterialReportSchema = z
  .object({
    reason: materialReportReasonSchema,
    note: z.string().trim().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.reason === 'OTHER' && !data.note?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Please describe the issue when selecting Other.',
        path: ['note'],
      });
    }
  });

export const adminMaterialReportsListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['PENDING', 'RESOLVED', 'REJECTED']).optional(),
  reason: materialReportReasonSchema.optional(),
  search: z.string().trim().max(200).optional(),
  materialId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminMaterialReportIdParamSchema = z.object({
  id: z.string().trim().min(1),
});

export const resolveMaterialReportSchema = z.object({
  adminNote: z.string().trim().max(2000).optional(),
});

export const rejectMaterialReportSchema = z.object({
  adminNote: z.string().trim().min(3).max(2000),
});

export const hideMaterialFromReportSchema = z.object({
  adminNote: z.string().trim().min(3).max(2000),
});

export type AdminMaterialsListQuery = z.infer<typeof adminMaterialsListQuerySchema>;
export type AdminMaterialIdParams = z.infer<typeof adminMaterialIdParamSchema>;
export type HideMaterialInput = z.infer<typeof hideMaterialSchema>;
export type MarkUnavailableInput = z.infer<typeof markUnavailableSchema>;
export type SubmitMaterialReportInput = z.infer<typeof submitMaterialReportSchema>;
export type AdminMaterialReportsListQuery = z.infer<
  typeof adminMaterialReportsListQuerySchema
>;
export type AdminMaterialReportIdParams = z.infer<
  typeof adminMaterialReportIdParamSchema
>;
export type ResolveMaterialReportInput = z.infer<typeof resolveMaterialReportSchema>;
export type RejectMaterialReportInput = z.infer<typeof rejectMaterialReportSchema>;
export type HideMaterialFromReportInput = z.infer<typeof hideMaterialFromReportSchema>;

export const adminMaterialsExportFiltersSchema = adminMaterialsListQuerySchema.omit({
  page: true,
  limit: true,
});

export const adminMaterialsExportDownloadQuerySchema =
  adminMaterialsExportFiltersSchema.extend({
    format: adminExportSpreadsheetFormatSchema.default('xlsx'),
  });

export type AdminMaterialsExportFilters = z.infer<
  typeof adminMaterialsExportFiltersSchema
>;
export type AdminMaterialsExportDownloadQuery = z.infer<
  typeof adminMaterialsExportDownloadQuerySchema
>;
