import { z } from 'zod';

import { paginationQuerySchema } from '../../utils/zod-helpers.js';

export const adminNoShowReportsListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['PENDING_REVIEW', 'VERIFIED', 'REJECTED']).optional(),
});

export type AdminNoShowReportsListQuery = z.infer<
  typeof adminNoShowReportsListQuerySchema
>;

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
