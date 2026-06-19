import { z } from 'zod';

import { paginationQuerySchema } from '../../utils/zod-helpers.js';

const PROJECT_DIFFICULTIES = [
  'BEGINNER',
  'INTERMEDIATE',
  'ADVANCED',
] as const;

export const learningProjectsQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).max(120).optional(),
  categoryId: z.string().trim().min(1).optional(),
  difficulty: z.enum(PROJECT_DIFFICULTIES, {
    error:
      'difficulty must be one of BEGINNER, INTERMEDIATE, or ADVANCED',
  }).optional(),
  tag: z.string().trim().min(1).max(80).optional(),
});

export const learningProjectIdParamSchema = z.object({
  id: z.string().trim().uuid(),
});

export type LearningProjectsQuery = z.infer<typeof learningProjectsQuerySchema>;
