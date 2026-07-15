import { z } from 'zod';

import {
  SUPPLIER_SCHEDULE_CATEGORIES,
} from './supplier-reservations-schedule.classifier.js';

const queryBoolean = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => value === true || value === 'true');

const parseMilliseconds = (value: string) => new Date(value).getTime();
const MAX_RANGE_DAYS = 31;

export const listSupplierScheduleQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    scope: z.enum(['ACTIVE', 'HISTORY', 'ALL']).default('ALL'),
    category: z.enum(SUPPLIER_SCHEDULE_CATEGORIES).optional(),
    needsAttention: queryBoolean.optional(),
    fulfillmentMethod: z.enum(['PICKUP', 'DELIVERY']).optional(),
    search: z.string().trim().min(1).max(120).optional(),
    materialId: z.string().trim().min(1).max(191).optional(),
    rangeStart: z.iso.datetime().optional(),
    rangeEnd: z.iso.datetime().optional(),
    dayStart: z.iso.datetime().optional(),
    dayEnd: z.iso.datetime().optional(),
  })
  .superRefine((value, ctx) => {
    const addPairIssue = (path: 'rangeEnd' | 'dayEnd', message: string) =>
      ctx.addIssue({ code: 'custom', message, path: [path] });

    if ((value.rangeStart == null) !== (value.rangeEnd == null)) {
      addPairIssue('rangeEnd', 'rangeStart and rangeEnd must be provided together.');
    }
    if ((value.dayStart == null) !== (value.dayEnd == null)) {
      addPairIssue('dayEnd', 'dayStart and dayEnd must be provided together.');
    }

    if (value.rangeStart && value.rangeEnd) {
      const start = parseMilliseconds(value.rangeStart);
      const end = parseMilliseconds(value.rangeEnd);
      if (start >= end) {
        addPairIssue('rangeEnd', 'rangeEnd must be after rangeStart.');
      }
      if (end - start > MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) {
        addPairIssue('rangeEnd', 'Schedule ranges may not exceed 31 days.');
      }
    }

    if (value.dayStart && value.dayEnd) {
      const start = parseMilliseconds(value.dayStart);
      const end = parseMilliseconds(value.dayEnd);
      if (start >= end) {
        addPairIssue('dayEnd', 'dayEnd must be after dayStart.');
      }
      if (end - start > MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) {
        addPairIssue('dayEnd', 'Day boundaries may not exceed 31 days.');
      }
    }

    const needsDayBoundaries =
      value.scope !== 'HISTORY' ||
      value.category === 'TODAY' ||
      value.category === 'UPCOMING';
    if (needsDayBoundaries && (!value.dayStart || !value.dayEnd)) {
      addPairIssue(
        'dayEnd',
        'dayStart and dayEnd are required for active schedule classification.',
      );
    }
  });

export type ListSupplierScheduleQuery = z.infer<
  typeof listSupplierScheduleQuerySchema
>;
