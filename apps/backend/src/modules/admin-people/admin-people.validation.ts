import { z } from 'zod';

import { paginationQuerySchema } from '../../utils/zod-helpers.js';
import { adminExportSpreadsheetFormatSchema } from '../admin-export/admin-export.validation.js';

export const adminPeopleListQuerySchema = paginationQuerySchema.extend({
  tab: z
    .enum(['ALL', 'LEARNERS', 'SUPPLIERS', 'DRIVERS', 'MODERATORS', 'ADMINS'])
    .default('ALL'),
  search: z.string().trim().max(200).optional(),
  status: z
    .enum(['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DISABLED'])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminPeopleUserIdParamSchema = z.object({
  id: z.string().trim().min(1),
});

export const adminPeopleBuildLearningParamSchema = z.object({
  id: z.string().trim().min(1),
  buildId: z.string().trim().min(1),
});

export const suspendUserSchema = z.object({
  reason: z.string().trim().min(3, 'Suspension reason is required.').max(2000),
});

export type AdminPeopleListQuery = z.infer<typeof adminPeopleListQuerySchema>;
export type AdminPeopleUserIdParams = z.infer<typeof adminPeopleUserIdParamSchema>;
export type AdminPeopleBuildLearningParams = z.infer<
  typeof adminPeopleBuildLearningParamSchema
>;
export type SuspendUserInput = z.infer<typeof suspendUserSchema>;

export const adminPeopleExportFiltersSchema = adminPeopleListQuerySchema.omit({
  page: true,
  limit: true,
});

export const adminPeopleExportDownloadQuerySchema =
  adminPeopleExportFiltersSchema.extend({
    format: adminExportSpreadsheetFormatSchema.default('xlsx'),
  });

export type AdminPeopleExportFilters = z.infer<
  typeof adminPeopleExportFiltersSchema
>;
export type AdminPeopleExportDownloadQuery = z.infer<
  typeof adminPeopleExportDownloadQuerySchema
>;
