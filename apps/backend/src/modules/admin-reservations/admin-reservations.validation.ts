import { z } from 'zod';

import { paginationQuerySchema } from '../../utils/zod-helpers.js';

const reservationStatusSchema = z.enum([
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'CANCELLED',
  'COMPLETED',
  'EXPIRED',
]);

export const adminReservationsListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  status: reservationStatusSchema.optional(),
  hasDelivery: z.enum(['YES', 'NO']).optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
});

export const adminReservationIdParamSchema = z.object({
  id: z.string().trim().min(1),
});

export type AdminReservationsListQuery = z.infer<
  typeof adminReservationsListQuerySchema
>;
export type AdminReservationIdParams = z.infer<
  typeof adminReservationIdParamSchema
>;
