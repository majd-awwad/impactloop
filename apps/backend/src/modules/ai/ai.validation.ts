import { z } from 'zod';

import { paginationQuerySchema } from '../../utils/zod-helpers.js';

export const AI_SUPPORTED_LOCALES = ['en', 'ar'] as const;

export const aiLocaleSchema = z.enum(AI_SUPPORTED_LOCALES);

export const aiClientMessageIdSchema = z
  .string()
  .trim()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/);

export const assistantConversationModeSchema = z.enum([
  'LEARNER_ASSISTANT',
  'GENERAL_LEARNING',
]);

export const createAiConversationSchema = z.object({
  mode: assistantConversationModeSchema,
  locale: aiLocaleSchema.default('en'),
  title: z.string().trim().min(1).max(120).optional(),
});

export const listAiConversationsQuerySchema = paginationQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(['ACTIVE', 'ARCHIVED']).default('ACTIVE'),
});

export const listAiMessagesQuerySchema = paginationQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const conversationIdParamSchema = z.object({
  conversationId: z.string().trim().min(1),
});

export const sendAiMessageSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  locale: aiLocaleSchema,
  clientMessageId: aiClientMessageIdSchema,
});

export type CreateAiConversationInput = z.infer<
  typeof createAiConversationSchema
>;
export type SendAiMessageInput = z.infer<typeof sendAiMessageSchema>;
