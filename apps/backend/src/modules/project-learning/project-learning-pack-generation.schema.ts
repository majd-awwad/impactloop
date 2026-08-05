import { z } from 'zod';

export const PROJECT_LEARNING_PACK_GENERATOR_SCHEMA_VERSION = 1;
export const PROJECT_LEARNING_PACK_PROMPT_VERSION = 'lh15-v1';

export const generatedLearningPackOptionSchema = z.object({
  optionKey: z.string().trim().min(1).max(40),
  textEn: z.string().trim().min(1).max(300),
  textAr: z.string().trim().min(1).max(300),
  displayOrder: z.number().int().min(1).max(6),
});

export const generatedLearningPackQuestionSchema = z.object({
  stage: z.enum(['START', 'STEP', 'FINAL']),
  projectStepId: z.string().trim().min(1).nullable().optional(),
  questionType: z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'BEST_ACTION']),
  conceptKey: z.string().trim().min(3).max(80),
  relativeDifficulty: z.number().int().min(1).max(5),
  promptEn: z.string().trim().min(8).max(500),
  promptAr: z.string().trim().min(8).max(500),
  explanationEn: z.string().trim().min(8).max(1000),
  explanationAr: z.string().trim().min(8).max(1000),
  hintEn: z.string().trim().min(4).max(300),
  hintAr: z.string().trim().min(4).max(300),
  packDisplayOrder: z.number().int().min(1).max(10),
  correctOptionKey: z.string().trim().min(1).max(40),
  options: z.array(generatedLearningPackOptionSchema).min(2).max(4),
});

export const generatedLearningPackSchema = z
  .object({
    schemaVersion: z.literal(PROJECT_LEARNING_PACK_GENERATOR_SCHEMA_VERSION),
    questions: z.array(generatedLearningPackQuestionSchema).min(1).max(80),
  })
  .strict();

export type GeneratedLearningPack = z.infer<typeof generatedLearningPackSchema>;
export type GeneratedLearningPackQuestion = z.infer<
  typeof generatedLearningPackQuestionSchema
>;
