import { z } from 'zod';

import { paginationQuerySchema } from '../../utils/zod-helpers.js';

export const learnerBuildIdParamSchema = z.object({
  buildId: z.string().cuid(),
});

export const learnerBuildPhotoIdParamSchema = learnerBuildIdParamSchema.extend({
  photoId: z.string().cuid(),
});

export const listLearnerBuildsQuerySchema = paginationQuerySchema.extend({
  status: z
    .enum(['ACTIVE', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'ARCHIVED'])
    .optional(),
});

export const updateCompletionStorySchema = z
  .object({
    reflection: z.string().max(3000).nullable().optional(),
    caption: z.string().max(120).nullable().optional(),
  })
  .refine(
    (value) => value.reflection !== undefined || value.caption !== undefined,
    { message: 'Provide reflection or caption to update.' },
  );

export const completionPhotoCaptionSchema = z.object({
  caption: z.string().max(120).nullable().optional(),
});

export type ListLearnerBuildsQuery = z.infer<typeof listLearnerBuildsQuerySchema>;
export type UpdateCompletionStoryInput = z.infer<typeof updateCompletionStorySchema>;
