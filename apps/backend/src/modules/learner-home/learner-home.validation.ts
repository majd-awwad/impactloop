import { z } from 'zod';

import { COMMON_ERROR_CODES } from '../../contracts/errors/common-error-codes.js';
import { AppError } from '../../utils/app-error.js';

import type { LearnerHomeSectionKey } from './learner-home.types.js';

export const LEARNER_HOME_SECTION_KEYS = [
  'suggested_materials',
  'materials_for_saved_projects',
  'free_materials_near_you',
  'suggested_projects',
  'saved_projects',
  'continue_projects',
  'popular_projects',
] as const satisfies readonly LearnerHomeSectionKey[];

const sectionKeySchema = z.enum(LEARNER_HOME_SECTION_KEYS);

const sectionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const parseLearnerHomeSectionKey = (value: string): LearnerHomeSectionKey => {
  const parsed = sectionKeySchema.safeParse(value);
  if (!parsed.success) {
    throw new AppError(
      'Unsupported learner home section.',
      400,
      'INVALID_SECTION_KEY',
      { sectionKey: value },
    );
  }

  return parsed.data;
};

export const parseLearnerHomeSectionQuery = (query: unknown) => {
  const parsed = sectionQuerySchema.safeParse(query);
  if (!parsed.success) {
    throw new AppError(
      'Invalid section query.',
      400,
      COMMON_ERROR_CODES.validationError,
    );
  }

  return {
    limit: parsed.data.limit ?? 20,
    offset: parsed.data.offset ?? 0,
  };
};
