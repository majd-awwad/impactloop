import { z } from 'zod';

import { paginationQuerySchema } from '../../utils/zod-helpers.js';

const optionalNullableString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value && value.length > 0 ? value : null));

export const createLearnerMaterialRequestSchema = z
  .object({
    requestedItemName: z.string().trim().min(2).max(120),
    categoryId: z.string().trim().min(1),
    description: optionalNullableString(2000),
    quantity: z.number().positive(),
    unit: z.string().trim().min(1).max(40),
    alternativesAllowed: z.boolean().default(true),
    sourceSavedLocationId: z.string().trim().min(1).optional().nullable(),
    locationCountry: z.string().trim().min(1).max(120).optional(),
    locationCity: z.string().trim().min(1).max(120).optional(),
    locationArea: optionalNullableString(120),
    neededBy: z.coerce.date().optional().nullable(),
    projectId: z.string().trim().min(1).optional().nullable(),
    projectBuildId: z.string().trim().min(1).optional().nullable(),
    projectBuildItemId: z.string().trim().min(1).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    const hasSaved = Boolean(value.sourceSavedLocationId);
    const hasCity = Boolean(value.locationCity?.trim());
    if (!hasSaved && !hasCity) {
      ctx.addIssue({
        code: 'custom',
        path: ['locationCity'],
        message: 'Provide sourceSavedLocationId or locationCity',
      });
    }
    if (value.neededBy && value.neededBy.getTime() < Date.now() - 60_000) {
      ctx.addIssue({
        code: 'custom',
        path: ['neededBy'],
        message: 'neededBy must be in the future',
      });
    }
  });

export const updateLearnerMaterialRequestSchema = z
  .object({
    requestedItemName: z.string().trim().min(2).max(120).optional(),
    categoryId: z.string().trim().min(1).optional(),
    description: optionalNullableString(2000),
    quantity: z.number().positive().optional(),
    unit: z.string().trim().min(1).max(40).optional(),
    alternativesAllowed: z.boolean().optional(),
    sourceSavedLocationId: z.string().trim().min(1).optional().nullable(),
    locationCountry: z.string().trim().min(1).max(120).optional(),
    locationCity: z.string().trim().min(1).max(120).optional(),
    locationArea: optionalNullableString(120),
    neededBy: z.coerce.date().optional().nullable(),
  })
  .strict();

export const listLearnerMaterialRequestsQuerySchema = paginationQuerySchema
  .extend({
    status: z
      .enum(['OPEN', 'FULFILLED', 'CANCELLED', 'EXPIRED'])
      .optional(),
  })
  .transform((value) => ({
    ...value,
    limit: Math.min(value.limit, 50),
  }));

export const learnerMaterialRequestIdParamSchema = z.object({
  id: z.string().trim().min(1),
});

export const learnerMaterialRequestMatchIdParamSchema = z.object({
  matchId: z.string().trim().min(1),
});

export type CreateLearnerMaterialRequestInput = z.infer<
  typeof createLearnerMaterialRequestSchema
>;
export type UpdateLearnerMaterialRequestInput = z.infer<
  typeof updateLearnerMaterialRequestSchema
>;
export type ListLearnerMaterialRequestsQuery = z.infer<
  typeof listLearnerMaterialRequestsQuerySchema
>;
