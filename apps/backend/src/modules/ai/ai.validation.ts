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

const manualDraftCopilotComponentSchema = z.object({
  name: z.string().trim().max(200),
  quantity: z.string().trim().max(50).optional(),
  unit: z.string().trim().max(50).optional(),
  role: z.string().trim().max(50).optional(),
});

export const manualDraftCopilotContextSchema = z.object({
  title: z.string().trim().max(500).optional(),
  categoryLabel: z.string().trim().max(200).optional().nullable(),
  difficulty: z.string().trim().max(50).optional().nullable(),
  durationLabel: z.string().trim().max(50).optional().nullable(),
  shortDescription: z.string().trim().max(500).optional(),
  fullDescription: z.string().trim().max(12000).optional(),
  components: z.array(manualDraftCopilotComponentSchema).max(50).optional(),
  steps: z.array(z.string().trim().max(5000)).max(100).optional(),
  links: z.array(z.string().trim().max(500)).max(20).optional(),
  hasProjectImage: z.boolean().optional(),
});

const manualDraftCopilotHistorySchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string().trim().min(1).max(8000),
});

export const manualDraftCopilotMessageSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  locale: aiLocaleSchema,
  clientMessageId: aiClientMessageIdSchema,
  draftContext: manualDraftCopilotContextSchema,
  history: z.array(manualDraftCopilotHistorySchema).max(24).default([]),
});

export type ManualDraftCopilotMessageInput = z.infer<
  typeof manualDraftCopilotMessageSchema
>;

export const aiPendingActionIdParamSchema = z.object({
  pendingActionId: z.string().trim().min(1),
});

export const confirmAiPendingActionSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(128),
  locale: aiLocaleSchema.default('en'),
});

export const authoringProposalIdParamSchema = conversationIdParamSchema.extend({
  proposalId: z.string().trim().min(1).max(80),
});

export const authoringReviewStateIdParamSchema = conversationIdParamSchema.extend({
  reviewStateId: z.string().trim().min(1).max(80),
});

export const submitAuthoringProposalReviewSchema = z.object({
  target: z.enum([
    'title',
    'shortDescription',
    'description',
    'difficulty',
    'estimatedMinutes',
    'components',
    'steps',
  ]),
  decision: z.enum(['ACCEPT_PROPOSAL', 'KEEP_CURRENT', 'NEEDS_REVISION']),
  comment: z.string().trim().max(1000).optional().nullable(),
});

export const submitAuthoringProposalDiscussionSchema = z.object({
  reviewStateId: z.string().trim().min(1).max(80),
  target: z.enum([
    'title',
    'shortDescription',
    'description',
    'difficulty',
    'estimatedMinutes',
    'components',
    'steps',
  ]),
  comment: z.string().trim().min(8).max(2000),
  clientMessageId: z.string().trim().min(8).max(128),
});

export const reviseAuthoringProposalSchema = z.object({
  reviewStateId: z.string().trim().min(1).max(80),
});

export const authoringTurnIdParamSchema = z.object({
  conversationId: z.string().trim().min(1).max(80),
  turnId: z.string().trim().min(1).max(80),
});

const sequentialAuthoringComponentInputSchema = z.object({
  componentName: z.string().trim().min(1).max(200),
  materialType: z.string().trim().min(1).max(200),
  quantity: z.number().positive().max(99999),
  unit: z.string().trim().min(1).max(50),
  componentRole: z.enum(['REQUIRED_MATERIAL', 'TOOL', 'CONSUMABLE']),
  isRequired: z.boolean(),
  canBeSubstituted: z.boolean(),
  searchKeywords: z.array(z.string().trim().min(1).max(80)).max(5).optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

const sequentialAuthoringStepInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
});

export const sequentialAuthoringActionSchema = z.object({
  action: z.enum([
    'START',
    'COMPOSER_MESSAGE',
    'ACCEPT_TURN',
    'SUGGEST_ANOTHER',
    'SAVE_MANUAL',
    'CHOOSE_MODE',
    'FINISH',
    'REGENERATE_STALE',
    'REMOVE_ITEM',
    'ADD_ITEM',
    'BACK_ITEM',
    'EXPLAIN_STEP',
    'FINALIZE_SECTION',
    'CONTINUE_GUIDED',
  ]),
  turnId: z.string().trim().min(1).max(80).optional(),
  comment: z.string().trim().max(2000).optional(),
  clientMessageId: z.string().trim().min(8).max(128).optional(),
  manualValue: z
    .union([
      z.string(),
      z.number(),
      sequentialAuthoringComponentInputSchema,
      z.array(sequentialAuthoringComponentInputSchema).min(1).max(50),
      sequentialAuthoringStepInputSchema,
    ])
    .optional(),
  mode: z
    .enum([
      'COMPONENTS_FULL_LIST',
      'COMPONENTS_ONE_BY_ONE',
      'STEPS_FULL_PLAN',
      'STEP_BY_STEP',
    ])
    .optional(),
});

export const discussSequentialAuthoringTurnSchema = z.object({
  comment: z.string().trim().min(8).max(2000),
  clientMessageId: z.string().trim().min(8).max(128),
});
