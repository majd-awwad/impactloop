import { z } from 'zod';

export const aiTextBlockSchema = z.object({
  type: z.literal('text'),
  text: z.string().trim().min(1),
  purpose: z.enum(['answer', 'refusal', 'clarification', 'safety']),
});

export const aiErrorBlockSchema = z.object({
  type: z.literal('error'),
  code: z.string().trim().min(1),
  message: z.string().trim().min(1),
  retryable: z.boolean(),
});

export const aiContentBlockSchema = z.discriminatedUnion('type', [
  aiTextBlockSchema,
  aiErrorBlockSchema,
]);

export const aiContentBlocksSchema = z
  .array(aiContentBlockSchema)
  .min(1)
  .max(8);

export type AiTextBlock = z.infer<typeof aiTextBlockSchema>;
export type AiErrorBlock = z.infer<typeof aiErrorBlockSchema>;
export type AiContentBlock = z.infer<typeof aiContentBlockSchema>;

export const aiProviderAnswerSchema = z.object({
  blocks: aiContentBlocksSchema,
});

export const aiScopeClassifierSchema = z.object({
  classification: z.enum([
    'DOMAIN_KNOWLEDGE',
    'OUT_OF_SCOPE',
    'DANGEROUS_REQUEST',
    'UNCLEAR',
    'MIXED',
  ]),
  confidence: z.number().min(0).max(1),
  reason: z.string().trim().min(1).max(500),
});

export type AiProviderAnswer = z.infer<typeof aiProviderAnswerSchema>;
export type AiScopeClassifierResult = z.infer<typeof aiScopeClassifierSchema>;
