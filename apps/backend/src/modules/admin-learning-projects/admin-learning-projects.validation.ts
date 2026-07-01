import { z } from 'zod';

import { paginationQuerySchema } from '../../utils/zod-helpers.js';

const learningProjectStatusSchema = z.enum([
  'DRAFT',
  'PENDING_REVIEW',
  'PUBLISHED',
  'CHANGES_REQUESTED',
  'REJECTED',
  'HIDDEN',
  'ARCHIVED',
]);

const projectDifficultySchema = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']);

export const adminLearningProjectsListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  status: learningProjectStatusSchema.optional(),
  categoryId: z.string().trim().min(1).optional(),
  difficulty: projectDifficultySchema.optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
});

export const adminLearningProjectIdParamSchema = z.object({
  id: z.string().trim().uuid(),
});

export const moderationReasonSchema = z.object({
  reason: z.string().trim().min(3, 'Reason is required.').max(2000),
});

export type AdminLearningProjectsListQuery = z.infer<
  typeof adminLearningProjectsListQuerySchema
>;
export type AdminLearningProjectIdParams = z.infer<
  typeof adminLearningProjectIdParamSchema
>;
export type ModerationReasonInput = z.infer<typeof moderationReasonSchema>;
