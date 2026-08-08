import { z } from 'zod';

import { paginationQuerySchema } from '../../utils/zod-helpers.js';

export const supplierProfileIdParamSchema = z.object({
  supplierProfileId: z.string().trim().min(1),
});

export type SupplierProfileIdParams = z.infer<
  typeof supplierProfileIdParamSchema
>;

export const publicSupplierMaterialsQuerySchema = paginationQuerySchema;

export type PublicSupplierMaterialsQuery = z.infer<
  typeof publicSupplierMaterialsQuerySchema
>;
