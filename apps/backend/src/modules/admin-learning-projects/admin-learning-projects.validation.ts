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

export const adminAiReviewBodySchema = z.object({
  locale: z.enum(['ar', 'en']).default('en'),
});

const nullableCategoryIdSchema = z.preprocess((value) => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  return value;
}, z.string().trim().min(1, 'Category id must be a valid category identifier.').nullable());

const splitKeywordEntries = (value: unknown) => {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.flatMap((entry) => {
    if (typeof entry !== 'string') {
      return [];
    }

    return entry
      .split(',')
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword.length > 0);
  });
};

const keywordListSchema = z.preprocess(
  splitKeywordEntries,
  z
    .array(
      z
        .string()
        .trim()
        .min(1, 'Keywords cannot be empty.')
        .max(80, 'Each keyword must be 80 characters or fewer.'),
    )
    .max(5, 'A component can have at most 5 keywords.')
    .optional(),
);

const componentRoleSchema = z.enum(
  [
    'REQUIRED_MATERIAL',
    'OPTIONAL_MATERIAL',
    'TOOL',
    'CONSUMABLE',
    'ALTERNATIVE',
  ],
  { message: 'Component role must be a valid value.' },
);

export const adminLearningProjectComponentParamsSchema = z.object({
  id: z.string().trim().uuid(),
  componentId: z.string().trim().uuid(),
});

export const updateAdminLearningProjectComponentSchema = z
  .object({
    componentName: z
      .string()
      .trim()
      .min(1, 'Component name is required.')
      .max(200, 'Component name must be 200 characters or fewer.')
      .optional(),
    quantity: z.coerce
      .number({ message: 'Quantity must be a number.' })
      .positive('Quantity must be greater than zero.')
      .optional(),
    unit: z
      .string()
      .trim()
      .min(1, 'Unit is required.')
      .max(50, 'Unit must be 50 characters or fewer.')
      .optional(),
    componentRole: componentRoleSchema.optional(),
    categoryId: nullableCategoryIdSchema.optional(),
    materialType: z
      .string()
      .trim()
      .max(200, 'Material type must be 200 characters or fewer.')
      .optional(),
    searchKeywords: keywordListSchema,
    alternativeKeywords: keywordListSchema,
    canBeSubstituted: z.boolean().optional(),
    isRequired: z.boolean().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
    reviewStatus: z
      .enum(['PENDING_REVIEW', 'ACCEPTED', 'REJECTED'], {
        message: 'Review status must be a valid value.',
      })
      .optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field is required.',
  });

export type AdminLearningProjectComponentParams = z.infer<
  typeof adminLearningProjectComponentParamsSchema
>;
export type UpdateAdminLearningProjectComponentInput = z.infer<
  typeof updateAdminLearningProjectComponentSchema
>;

export type AdminLearningProjectsListQuery = z.infer<
  typeof adminLearningProjectsListQuerySchema
>;
export type AdminLearningProjectIdParams = z.infer<
  typeof adminLearningProjectIdParamSchema
>;
export type ModerationReasonInput = z.infer<typeof moderationReasonSchema>;
export type AdminAiReviewBodyInput = z.infer<typeof adminAiReviewBodySchema>;
