import { z } from 'zod';

import { paginationQuerySchema } from '../../utils/zod-helpers.js';

export const publicUserIdParamSchema = z.object({
  userId: z.string().trim().min(1).max(80),
});

export const publicUserProjectsQuerySchema = paginationQuerySchema;

export type PublicUserProjectsQuery = z.infer<
  typeof publicUserProjectsQuerySchema
>;
