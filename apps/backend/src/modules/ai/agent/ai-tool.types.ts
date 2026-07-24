import { z } from 'zod';

import type { AiToolExecutionContext } from './ai-agent.types.js';

export type AiToolKind = 'read' | 'write_prepare';

export type AiToolDefinition<TInput extends z.ZodTypeAny> = {
  name: string;
  kind: AiToolKind;
  description: string;
  inputSchema: TInput;
  timeoutMs: number;
  maxOutputBytes: number;
  handler: (
    input: z.infer<TInput>,
    context: AiToolExecutionContext,
  ) => Promise<unknown>;
};

export type AiToolCallRequest = {
  name: string;
  input: unknown;
};

export type AiToolCallResult = {
  name: string;
  ok: boolean;
  data?: unknown;
  errorCode?: string;
  errorMessage?: string;
  durationMs: number;
};

export const emptyObjectSchema = z.object({}).strict();

export const searchAvailableMaterialsInputSchema = z
  .object({
    query: z.string().trim().min(1).max(120).optional(),
    categoryId: z.string().trim().min(1).optional(),
    categoryText: z.string().trim().min(1).max(80).optional(),
    materialType: z.string().trim().min(1).optional(),
    condition: z.string().trim().min(1).optional(),
    isFree: z.boolean().optional(),
    minPrice: z.number().nonnegative().optional(),
    maxPrice: z.number().nonnegative().optional(),
    city: z.string().trim().min(1).max(80).optional(),
    area: z.string().trim().min(1).max(80).optional(),
    nearLearner: z.boolean().optional(),
    maxDistanceKm: z.number().positive().max(100).optional(),
    pickupAllowed: z.boolean().optional(),
    deliveryAllowed: z.boolean().optional(),
    limit: z.number().int().min(1).max(10).optional(),
    sort: z.enum(['newest', 'popular', 'nearest', 'price_asc', 'price_desc']).optional(),
  })
  .strict();

export const idInputSchema = z.object({ id: z.string().trim().min(1) }).strict();
export const materialIdInputSchema = z
  .object({ materialId: z.string().trim().min(1) })
  .strict();
export const projectIdInputSchema = z
  .object({ projectId: z.string().trim().min(1) })
  .strict();
export const buildIdInputSchema = z.object({ buildId: z.string().trim().min(1) }).strict();
export const componentIdInputSchema = z
  .object({
    componentId: z.string().trim().min(1),
    buildId: z.string().trim().min(1).optional(),
    isFree: z.boolean().optional(),
    maxPrice: z.number().nonnegative().optional(),
    nearLearner: z.boolean().optional(),
    maxDistanceKm: z.number().positive().max(100).optional(),
    limit: z.number().int().min(1).max(10).optional(),
  })
  .strict();

export const findMaterialsForProjectInputSchema = z
  .object({
    projectId: z.string().trim().min(1),
    buildId: z.string().trim().min(1).optional(),
    onlyMissing: z.boolean().optional(),
    isFree: z.boolean().optional(),
    maxTotalPrice: z.number().nonnegative().optional(),
    nearLearner: z.boolean().optional(),
    maxDistanceKm: z.number().positive().max(100).optional(),
    limitPerComponent: z.number().int().min(1).max(5).optional(),
  })
  .strict();

export const compareMaterialIdsInputSchema = z
  .object({
    materialIds: z.array(z.string().trim().min(1)).min(2).max(4),
  })
  .strict();

export const compareProjectIdsInputSchema = z
  .object({
    projectIds: z.array(z.string().trim().min(1)).min(2).max(4),
  })
  .strict();

export const personalizedRecommendationsInputSchema = z
  .object({
    type: z.enum(['MATERIALS', 'PROJECTS', 'NEXT_ACTIONS', 'MIXED']),
    limit: z.number().int().min(1).max(10).optional(),
  })
  .strict();

export const searchLearningProjectsInputSchema = z
  .object({
    query: z.string().trim().min(1).max(120).optional(),
    interests: z.array(z.string().trim().min(1)).max(8).optional(),
    difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
    category: z.string().trim().min(1).optional(),
    estimatedTime: z.string().trim().min(1).optional(),
    limit: z.number().int().min(1).max(10).optional(),
  })
  .strict();

export const matchProjectsByOwnedMaterialsInputSchema = z
  .object({
    materials: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
    category: z.string().trim().min(1).max(80).optional(),
    difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
    limit: z.number().int().min(1).max(10).optional(),
  })
  .strict();

export const matchAvailableMaterialsForProjectInputSchema = z
  .object({
    projectId: z.string().trim().min(1).optional(),
    projectQuery: z.string().trim().min(1).max(120).optional(),
    limitPerComponent: z.number().int().min(1).max(5).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.projectId && !value.projectQuery) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'projectId or projectQuery is required',
      });
    }
  });

export const estimateProjectMaterialBudgetInputSchema =
  matchAvailableMaterialsForProjectInputSchema;
