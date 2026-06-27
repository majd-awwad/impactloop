import { z } from 'zod';

export const searchMaterialTypesQuerySchema = z.object({
  categoryId: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).optional(),
});

export type SearchMaterialTypesQuery = z.infer<
  typeof searchMaterialTypesQuerySchema
>;

export const materialTypeIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});
