import { z } from 'zod';

import { paginationQuerySchema } from '../../utils/zod-helpers.js';
import { adminExportSpreadsheetFormatSchema } from '../admin-export/admin-export.validation.js';

const deliveryStatusSchema = z.enum([
  'WAITING_FOR_DRIVER',
  'DRIVER_ASSIGNED',
  'ARRIVED_PICKUP',
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
  'DELIVERED',
  'CANCELLED',
  'FAILED_PICKUP',
  'FAILED_DELIVERY',
  'DRIVER_NO_SHOW',
  'LEARNER_NO_SHOW',
  'AWAITING_RESOLUTION',
]);

export const adminDeliveriesListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  status: deliveryStatusSchema.optional(),
  assignment: z
    .enum(['ASSIGNED', 'UNASSIGNED', 'ACTIVE', 'RELEASED', 'HISTORICAL'])
    .optional(),
  scope: z.enum(['SINGLE', 'GROUPED']).optional(),
  incidentState: z
    .enum(['PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'RESOLVED_NO_STRIKE'])
    .optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
});

export const adminDeliveryIdParamSchema = z.object({
  id: z.string().trim().min(1),
});

export type AdminDeliveriesListQuery = z.infer<
  typeof adminDeliveriesListQuerySchema
>;
export type AdminDeliveryIdParams = z.infer<typeof adminDeliveryIdParamSchema>;

export const adminDeliveriesExportFiltersSchema =
  adminDeliveriesListQuerySchema.omit({
    page: true,
    limit: true,
  });

export const adminDeliveriesExportDownloadQuerySchema =
  adminDeliveriesExportFiltersSchema.extend({
    format: adminExportSpreadsheetFormatSchema.default('xlsx'),
  });

export type AdminDeliveriesExportFilters = z.infer<
  typeof adminDeliveriesExportFiltersSchema
>;
export type AdminDeliveriesExportDownloadQuery = z.infer<
  typeof adminDeliveriesExportDownloadQuerySchema
>;
