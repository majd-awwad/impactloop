import { z } from 'zod';

import { paginationQuerySchema } from '../../utils/zod-helpers.js';

const PROJECT_DIFFICULTIES = [
  'BEGINNER',
  'INTERMEDIATE',
  'ADVANCED',
] as const;

const PROJECT_BUILD_ITEM_STATUSES = [
  'MISSING',
  'ALREADY_OWNED',
  'AVAILABLE',
  'RESERVED',
  'ALTERNATIVE',
] as const;

const LEARNING_PROJECT_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'PUBLISHED',
  'CHANGES_REQUESTED',
  'REJECTED',
  'HIDDEN',
  'ARCHIVED',
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

export const myLearningProjectsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(LEARNING_PROJECT_STATUSES).optional(),
});

export const learningProjectIdParamSchema = z.object({
  id: z.string().trim().uuid(),
});

export const projectBuildItemParamSchema = learningProjectIdParamSchema.extend({
  itemId: z.string().trim().min(1),
});

export const projectReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z
    .string()
    .trim()
    .max(1200)
    .optional()
    .nullable()
    .transform((value) => {
      if (!value) {
        return null;
      }

      return value.length === 0 ? null : value;
    }),
});

const LEARNER_SUBMIT_COMPONENT_ROLES = [
  'REQUIRED_MATERIAL',
  'TOOL',
  'CONSUMABLE',
] as const;

const componentCategoryIdSchema = z.preprocess((value) => {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.toLowerCase() === 'none' ||
    trimmed.toLowerCase() === 'null'
  ) {
    return undefined;
  }

  return trimmed;
}, z.string().trim().min(1).optional());

const submitComponentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  quantity: z.number().positive().max(99999).optional(),
  unit: z.string().trim().min(1).max(50).optional(),
  notes: z.string().trim().max(1000).optional(),
  isRequired: z.boolean().optional(),
  componentRole: z.enum(LEARNER_SUBMIT_COMPONENT_ROLES).optional(),
  materialType: z.string().trim().min(1).max(200).optional(),
  categoryId: componentCategoryIdSchema,
  searchKeywords: z
    .array(z.string().trim().min(1).max(80))
    .max(5)
    .optional(),
  canBeSubstituted: z.boolean().optional(),
});

const updateSubmissionComponentSchema = submitComponentSchema.extend({
  id: z.string().trim().uuid().optional(),
});

const submitStepSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
});

const submitLinkSchema = z.object({
  url: z.string().trim().url(),
  title: z.string().trim().max(200).optional(),
});

export const submitLearningProjectSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    shortDescription: z.string().trim().min(10).max(500),
    description: z.string().trim().min(10).max(10000),
    categoryId: z.string().trim().min(1),
    difficulty: z.enum(PROJECT_DIFFICULTIES),
    estimatedDurationMinutes: z.number().int().positive().max(10000).optional(),
    coverImageUrl: z.string().trim().url().optional().nullable(),
    requiredComponents: z.array(submitComponentSchema).max(50).optional(),
    steps: z.array(submitStepSchema).max(100).optional(),
    links: z.array(submitLinkSchema).max(20).optional(),
  })
  .superRefine((value, context) => {
    const components = value.requiredComponents ?? [];
    const seen = new Set<string>();

    for (const [index, component] of components.entries()) {
      const key = component.name.trim().toLowerCase();
      if (seen.has(key)) {
        context.addIssue({
          code: 'custom',
          message: 'Each required component must have a unique name.',
          path: ['requiredComponents', index, 'name'],
        });
        continue;
      }

      seen.add(key);
    }
  });

export const updateMyLearningProjectSubmissionSchema = submitLearningProjectSchema
  .safeExtend({
    requiredComponents: z
      .array(updateSubmissionComponentSchema)
      .max(50)
      .optional(),
  })
  .superRefine((value, context) => {
    const components = value.requiredComponents ?? [];
    const seen = new Set<string>();

    for (const [index, component] of components.entries()) {
      const key = component.name.trim().toLowerCase();
      if (seen.has(key)) {
        context.addIssue({
          code: 'custom',
          message: 'Each required component must have a unique name.',
          path: ['requiredComponents', index, 'name'],
        });
        continue;
      }

      seen.add(key);
    }
  });

export const updateProjectBuildItemSchema = z.object({
  status: z.enum(PROJECT_BUILD_ITEM_STATUSES, {
    error:
      'status must be one of MISSING, ALREADY_OWNED, AVAILABLE, RESERVED, or ALTERNATIVE',
  }),
  learnerNote: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .nullable()
    .transform((value) => {
      if (!value) {
        return null;
      }

      return value.length === 0 ? null : value;
    }),
});

export const linkBuildItemMaterialSchema = z.object({
  materialId: z.string().trim().min(1),
});

export const linkBuildItemReservationSchema = z.object({
  reservationId: z.string().trim().min(1),
});

export type LearningProjectsQuery = z.infer<typeof learningProjectsQuerySchema>;
export type MyLearningProjectsQuery = z.infer<typeof myLearningProjectsQuerySchema>;
export type ProjectReviewInput = z.infer<typeof projectReviewSchema>;
export type SubmitLearningProjectInput = z.infer<
  typeof submitLearningProjectSchema
>;
export type UpdateMyLearningProjectSubmissionInput = z.infer<
  typeof updateMyLearningProjectSubmissionSchema
>;
export type UpdateProjectBuildItemInput = z.infer<
  typeof updateProjectBuildItemSchema
>;
