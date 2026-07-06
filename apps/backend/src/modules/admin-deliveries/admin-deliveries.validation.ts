import { z } from 'zod';

import { paginationQuerySchema } from '../../utils/zod-helpers.js';

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
]);

export const adminDeliveriesListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  status: deliveryStatusSchema.optional(),
  assignment: z.enum(['ASSIGNED', 'UNASSIGNED']).optional(),
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
