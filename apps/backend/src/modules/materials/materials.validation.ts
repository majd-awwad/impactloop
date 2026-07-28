import { z } from 'zod';

import { paginationQuerySchema } from '../../utils/zod-helpers.js';

const materialConditionSchema = z.enum([
  'NEW',
  'LIKE_NEW',
  'GOOD',
  'USED',
  'NEEDS_REPAIR',
]);

const MATERIAL_STATUSES = [
  'AVAILABLE',
  'PENDING_RESERVATION',
  'RESERVED',
] as const;

const PRICE_TYPES = ['FREE', 'PAID', 'ANY'] as const;

const MATERIAL_SORT_OPTIONS = ['newest', 'popular', 'nearest'] as const;

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

export const materialsQuerySchema = paginationQuerySchema
  .extend({
    q: z.string().trim().min(1).max(120).optional(),
    categoryId: z.string().trim().min(1).optional(),
    condition: materialConditionSchema.optional(),
    status: z.enum(MATERIAL_STATUSES, {
      error:
        'Status must be one of AVAILABLE, PENDING_RESERVATION, or RESERVED for public discovery',
    }).default('AVAILABLE'),
    priceType: z.enum(PRICE_TYPES, {
      error: 'priceType must be FREE, PAID, or ANY',
    }).default('ANY'),
    deliveryAvailable: z.preprocess(
      (value) => {
        const parsed = parseOptionalBoolean(value);

        return parsed === undefined ? value : parsed;
      },
      z.boolean({
        error: 'deliveryAvailable must be true or false',
      }).optional(),
    ),
    city: z.string().trim().min(1).max(120).optional(),
    area: z.string().trim().min(1).max(120).optional(),
    pickupAllowed: z.preprocess(
      (value) => {
        const parsed = parseOptionalBoolean(value);

        return parsed === undefined ? value : parsed;
      },
      z.boolean({
        error: 'pickupAllowed must be true or false',
      }).optional(),
    ),
    sort: z.enum(MATERIAL_SORT_OPTIONS, {
      error: 'sort must be newest, popular, or nearest',
    }).default('newest'),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    savedLocationId: z.string().trim().min(1).optional(),
  })
  .superRefine((query, ctx) => {
    const hasLatitude = query.latitude !== undefined;
    const hasLongitude = query.longitude !== undefined;
    const hasCoordinates = hasLatitude || hasLongitude;

    if (hasLatitude !== hasLongitude) {
      ctx.addIssue({
        code: 'custom',
        path: hasLatitude ? ['longitude'] : ['latitude'],
        message: 'latitude and longitude must be provided together',
      });
    }

    if (query.savedLocationId && hasCoordinates) {
      ctx.addIssue({
        code: 'custom',
        path: ['savedLocationId'],
        message: 'Use either savedLocationId or latitude/longitude, not both',
      });
    }

    if (
      query.sort === 'nearest' &&
      !query.savedLocationId &&
      !(hasLatitude && hasLongitude)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['sort'],
        message:
          'sort=nearest requires latitude/longitude or an authenticated savedLocationId',
      });
    }
  });

export const materialIdParamSchema = z.object({
  id: z.string().trim().min(1),
});

export const relatedMaterialsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(8).default(4),
});

export type RelatedMaterialsQuery = z.infer<typeof relatedMaterialsQuerySchema>;

export const priceCheckSchema = z.object({
  isFree: z.boolean(),
  categoryId: z.string().trim().min(1),
  materialName: z.string().trim().min(1).optional().nullable(),
  materialTypeId: z.string().trim().min(1).optional().nullable(),
  customMaterialType: z.string().trim().min(1).optional().nullable(),
  condition: materialConditionSchema,
  quantity: z.number().positive(),
  unit: z.string().trim().min(1),
  price: z.number().nonnegative().optional().nullable(),
  currency: z.string().trim().min(1).default('NIS'),
});

export type MaterialsQuery = z.infer<typeof materialsQuerySchema>;
export type PriceCheckInput = z.infer<typeof priceCheckSchema>;
