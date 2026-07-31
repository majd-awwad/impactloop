import { z } from 'zod';

import { profileImageUrlSchema } from '../../utils/profile-image-url.js';
import { optionalLearnerInterestsFieldSchema } from '../learner-home/learner-interests.validation.js';

const learnerProfileUpdateSchema = z.object({
  learnerType: z.string().trim().min(1).max(100),
  skillLevel: z.string().trim().min(1).max(100),
  interests: optionalLearnerInterestsFieldSchema,
  bio: z.string().trim().max(2000).optional().nullable(),
});

const normalizeOptionalPhoneInput = (value: unknown): unknown => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  return value;
};

const optionalPhoneSchema = z.preprocess(
  normalizeOptionalPhoneInput,
  z.union([z.string().min(5).max(30), z.null()]).optional(),
);

export const updateProfileSchema = z
  .object({
    displayName: z.string().trim().min(2).max(100).optional(),
    phone: optionalPhoneSchema,
    profileImageUrl: profileImageUrlSchema.nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.displayName === undefined &&
      data.phone === undefined &&
      data.profileImageUrl === undefined
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'At least one profile field is required.',
        path: [],
      });
    }
  });

export const updateLearnerProfileSchema = learnerProfileUpdateSchema;

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateLearnerProfileInput = z.infer<
  typeof updateLearnerProfileSchema
>;
