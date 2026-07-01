import { z } from 'zod';

import { listingDraftJsonSchema } from '../category-requests/category-requests.validation.js';

const materialConditionSchema = z.enum([
  'NEW',
  'LIKE_NEW',
  'GOOD',
  'USED',
  'NEEDS_REPAIR',
]);

export const createPriceRuleRequestSchema = z
  .object({
    materialTypeId: z.string().trim().min(1).optional().nullable(),
    materialName: z.string().trim().min(1).max(200).optional().nullable(),
    categoryId: z.string().trim().min(1).optional().nullable(),
    condition: materialConditionSchema.optional().nullable(),
    quantity: z.number().positive().optional().nullable(),
    unit: z.string().trim().min(1).max(40).optional().nullable(),
    supplierPriceNis: z.number().nonnegative().optional().nullable(),
    listingDraftJson: listingDraftJsonSchema.optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const hasKnownMaterial = Boolean(data.materialTypeId?.trim());
    const hasCategoryId = Boolean(data.categoryId?.trim());

    if (!hasCategoryId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Please select a valid category before submitting price review.',
        path: ['categoryId'],
      });
    }

    if (hasKnownMaterial) {
      return;
    }

    const hasUnknownMaterial =
      Boolean(data.materialName?.trim()) && Boolean(data.unit?.trim());

    if (!hasUnknownMaterial) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Provide materialTypeId or materialName with categoryId and unit.',
        path: ['materialTypeId'],
      });
    }
  });

export type CreatePriceRuleRequestInput = z.infer<
  typeof createPriceRuleRequestSchema
>;

export const priceRuleRequestIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export type PriceRuleRequestIdParams = z.infer<
  typeof priceRuleRequestIdParamsSchema
>;
