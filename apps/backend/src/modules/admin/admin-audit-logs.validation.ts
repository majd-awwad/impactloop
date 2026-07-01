import { z } from 'zod';

import { paginationQuerySchema } from '../../utils/zod-helpers.js';

import {
  ADMIN_ACTIVITY_ACTIONS,
  ADMIN_ACTIVITY_TARGET_TYPES,
} from './admin-activity-log.js';

const auditLogActionSchema = z.enum(
  Object.values(ADMIN_ACTIVITY_ACTIONS) as [
    AdminActivityActionValue,
    ...AdminActivityActionValue[],
  ],
);

const auditLogTargetTypeSchema = z.enum(
  Object.values(ADMIN_ACTIVITY_TARGET_TYPES) as [
    AdminActivityTargetTypeValue,
    ...AdminActivityTargetTypeValue[],
  ],
);

type AdminActivityActionValue =
  (typeof ADMIN_ACTIVITY_ACTIONS)[keyof typeof ADMIN_ACTIVITY_ACTIONS];
type AdminActivityTargetTypeValue =
  (typeof ADMIN_ACTIVITY_TARGET_TYPES)[keyof typeof ADMIN_ACTIVITY_TARGET_TYPES];

export const adminAuditLogsListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  action: auditLogActionSchema.optional(),
  targetType: auditLogTargetTypeSchema.optional(),
  actorId: z.string().trim().min(1).optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
});

export type AdminAuditLogsListQuery = z.infer<typeof adminAuditLogsListQuerySchema>;
