import { z } from 'zod';

export const projectLearningBuildParamSchema = z.object({
  id: z.string().trim().min(1),
});

export const projectLearningBuildStepParamSchema = z.object({
  id: z.string().trim().min(1),
  stepId: z.string().trim().min(1),
});

export const projectLearningAssignmentParamSchema = z.object({
  id: z.string().trim().min(1),
  assignmentId: z.string().trim().min(1),
});

export const setupLearningSessionBodySchema = z
  .object({
    learningGoal: z.string().trim().max(500).nullable().optional(),
    confidenceBefore: z.number().int().min(1).max(5).nullable().optional(),
  })
  .strict();

export const updateLearningSessionBodySchema = z
  .object({
    learningGoal: z.string().trim().max(500).nullable().optional(),
    confidenceBefore: z.number().int().min(1).max(5).nullable().optional(),
  })
  .strict();

export const submitLearningAnswerBodySchema = z
  .object({
    selectedOptionKey: z.string().trim().min(1).max(40),
  })
  .strict();

export const completionReflectionBodySchema = z
  .object({
    goalOutcome: z
      .enum(['ACHIEVED', 'PARTIALLY_ACHIEVED', 'NOT_YET_ACHIEVED'])
      .nullable()
      .optional(),
    confidenceAfter: z.number().int().min(1).max(5).nullable().optional(),
    finalReflection: z.string().max(1500).nullable().optional(),
  })
  .strict();

export type SetupLearningSessionBody = z.infer<typeof setupLearningSessionBodySchema>;
export type UpdateLearningSessionBody = z.infer<typeof updateLearningSessionBodySchema>;
export type SubmitLearningAnswerBody = z.infer<typeof submitLearningAnswerBodySchema>;
export type CompletionReflectionBody = z.infer<typeof completionReflectionBodySchema>;
