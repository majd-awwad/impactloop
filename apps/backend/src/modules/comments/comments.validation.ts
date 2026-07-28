import { z } from 'zod';

import { paginationQuerySchema } from '../../utils/zod-helpers.js';

export const commentTargetParamSchema = z.object({
  id: z.string().trim().min(1),
});

export const commentIdParamSchema = z.object({
  commentId: z.string().trim().min(1),
});

export const adminCommentIdParamSchema = z.object({
  id: z.string().trim().min(1),
});

export const commentTargetAndIdParamSchema = commentTargetParamSchema.merge(
  commentIdParamSchema,
);

export const commentsListQuerySchema = paginationQuerySchema;

export const createCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Comment cannot be empty.')
    .max(1000, 'Comment must be at most 1000 characters.'),
  parentCommentId: z.string().trim().min(1).optional(),
  replyToCommentId: z.string().trim().min(1).optional(),
});

export const updateCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Comment cannot be empty.')
    .max(1000, 'Comment must be at most 1000 characters.'),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type CommentsListQuery = z.infer<typeof commentsListQuerySchema>;
