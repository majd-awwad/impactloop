import { z } from 'zod';

import { paginationQuerySchema } from '../../utils/zod-helpers.js';

const MATERIAL_CONDITIONS = [
  'NEW',
  'LIKE_NEW',
  'GOOD',
  'USED',
  'NEEDS_REPAIR',
] as const;

const MATERIAL_STATUSES = [
  'AVAILABLE',
  'PENDING_RESERVATION',
  'RESERVED',
] as const;

const PRICE_TYPES = ['FREE', 'PAID', 'ANY'] as const;

const parseOptionalBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (normalized === 'true' || normalized === '1') {
      return true;
    }

    if (normalized === 'false' || normalized === '0') {
      return false;
    }
  }

  return undefined;
};

export const materialsQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).max(120).optional(),
  categoryId: z.string().trim().min(1).optional(),
  condition: z.enum(MATERIAL_CONDITIONS, {
    error: 'Condition must be one of NEW, LIKE_NEW, GOOD, USED, NEEDS_REPAIR',
  }).optional(),
  status: z.enum(MATERIAL_STATUSES, {
    error:
      'Status must be one of AVAILABLE, PENDING_RESERVATION, or RESERVED for public discovery',
  }).default('AVAILABLE'),
  priceType: z.enum(PRICE_TYPES, {
    error: 'priceType must be FREE, PAID, or ANY',
  }).default('ANY'),
  deliveryAvailable: z
    .preprocess(
      (value) => {
        const parsed = parseOptionalBoolean(value);

        return parsed === undefined ? value : parsed;
      },
      z.boolean({
        error: 'deliveryAvailable must be true or false',
      }).optional(),
    ),
  city: z.string().trim().min(1).max(120).optional(),
});

export const materialIdParamSchema = z.object({
  id: z.string().trim().min(1),
});

export type MaterialsQuery = z.infer<typeof materialsQuerySchema>;
