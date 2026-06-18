import { z } from 'zod';

const materialConditionSchema = z.enum([
  'NEW',
  'LIKE_NEW',
  'GOOD',
  'USED',
  'NEEDS_REPAIR',
]);

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

export type PriceCheckInput = z.infer<typeof priceCheckSchema>;
