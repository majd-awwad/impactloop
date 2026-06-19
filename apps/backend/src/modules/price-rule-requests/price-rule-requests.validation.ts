import { z } from 'zod';

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
  })
  .superRefine((data, ctx) => {
    const hasKnownMaterial = Boolean(data.materialTypeId?.trim());
    const hasUnknownMaterial =
      Boolean(data.materialName?.trim()) &&
      Boolean(data.categoryId?.trim()) &&
      Boolean(data.unit?.trim());

    if (!hasKnownMaterial && !hasUnknownMaterial) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Provide materialTypeId or materialName with categoryId and unit.',
        path: ['materialTypeId'],
      });
    }

    if (hasKnownMaterial && hasUnknownMaterial) {
      ctx.addIssue({
        code: 'custom',
        message: 'Provide either materialTypeId or unknown material fields.',
        path: ['materialTypeId'],
      });
    }
  });

export type CreatePriceRuleRequestInput = z.infer<
  typeof createPriceRuleRequestSchema
>;
