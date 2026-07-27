import { z } from 'zod';

import {
  SUPPLIER_NOTIFICATION_CATEGORIES,
  SUPPLIER_NOTIFICATION_STATES,
} from './supplier-notification-classifier.js';

const dateQuery = z.coerce.date().refine((value) => !Number.isNaN(value.getTime()), 'Invalid date');
const booleanQuery = z.preprocess(
  (value) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  },
  z.boolean(),
);

export const supplierNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  state: z.enum(SUPPLIER_NOTIFICATION_STATES).optional(),
  category: z.enum(SUPPLIER_NOTIFICATION_CATEGORIES).optional(),
  isRead: booleanQuery.optional(),
  search: z.string().trim().min(1).max(100).optional(),
  dateFrom: dateQuery.optional(),
  dateTo: dateQuery.optional(),
  entityType: z.string().trim().min(1).max(50).optional(),
}).superRefine((value, context) => {
  if (value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) {
    context.addIssue({
      code: 'custom',
      path: ['dateTo'],
      message: 'dateTo must be on or after dateFrom',
    });
  }
});

export type SupplierNotificationsQuery = z.infer<typeof supplierNotificationsQuerySchema>;
