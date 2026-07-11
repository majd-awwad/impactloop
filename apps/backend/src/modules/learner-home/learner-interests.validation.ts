import { z } from 'zod';

import {
  normalizeLearnerInterestKeys,
  resolveInterestKey,
} from './learner-interest-taxonomy.js';

export const learnerInterestsFieldSchema = z
  .array(z.string().trim().min(1).max(100))
  .superRefine((interests, ctx) => {
    const invalid = interests.filter((interest) => resolveInterestKey(interest) == null);
    if (invalid.length > 0) {
      ctx.addIssue({
        code: 'custom',
        message: `Unsupported learner interests: ${invalid.join(', ')}`,
        path: [],
      });
    }
  })
  .transform((interests) => normalizeLearnerInterestKeys(interests));

export const optionalLearnerInterestsFieldSchema =
  learnerInterestsFieldSchema.optional();

export const normalizeOptionalLearnerInterests = (
  interests: string[] | undefined,
) => {
  if (interests === undefined) {
    return undefined;
  }

  return normalizeLearnerInterestKeys(interests);
};
