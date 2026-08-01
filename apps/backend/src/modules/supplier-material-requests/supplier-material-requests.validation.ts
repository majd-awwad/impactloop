import { z } from 'zod';

import { paginationQuerySchema } from '../../utils/zod-helpers.js';

const optionalBooleanQuery = z
  .enum(['true', 'false'])
  .optional()
  .transform((value): boolean | undefined =>
    value === undefined ? undefined : value === 'true',
  );

export const listSupplierMaterialRequestsQuerySchema = paginationQuerySchema
  .extend({
    categoryId: z.string().trim().min(1).optional(),
    city: z.string().trim().min(1).max(120).optional(),
    area: z.string().trim().min(1).max(120).optional(),
    alternativesAllowed: optionalBooleanQuery,
    unansweredByMe: optionalBooleanQuery,
    neededByBefore: z.coerce.date().optional(),
  })
  .transform((value) => ({
    ...value,
    limit: Math.min(value.limit, 50),
  }));

export type ListSupplierMaterialRequestsQuery = z.infer<
  typeof listSupplierMaterialRequestsQuerySchema
>;

export const supplierMaterialRequestIdParamSchema = z.object({
  id: z.string().trim().min(1),
});

export const supplierCandidateMaterialsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(30).default(12),
});

export type SupplierCandidateMaterialsQuery = z.infer<
  typeof supplierCandidateMaterialsQuerySchema
>;

export const suggestMaterialForRequestSchema = z.object({
  materialId: z.string().trim().min(1),
  confirmWeakMatch: z.boolean().optional(),
});

export type SuggestMaterialForRequestInput = z.infer<
  typeof suggestMaterialForRequestSchema
>;
