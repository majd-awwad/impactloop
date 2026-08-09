import { z } from 'zod';

import { paginationQuerySchema } from '../../utils/zod-helpers.js';
import {
  adminExportFormatSchema,
} from '../admin-export/admin-export.validation.js';
import {
  ADMIN_FILTERABLE_RESERVATION_STATUSES,
} from './admin-reservations.status.js';

const reservationStatusSchema = z.enum(ADMIN_FILTERABLE_RESERVATION_STATUSES);

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

export const adminReservationsExportFiltersSchema =
  adminReservationsListQuerySchema.omit({
    page: true,
    limit: true,
  });

export const adminReservationsExportDownloadQuerySchema =
  adminReservationsExportFiltersSchema.extend({
    format: adminExportFormatSchema.default('xlsx'),
  });

export type AdminReservationsExportFilters = z.infer<
  typeof adminReservationsExportFiltersSchema
>;
export type AdminReservationsExportDownloadQuery = z.infer<
  typeof adminReservationsExportDownloadQuerySchema
>;
