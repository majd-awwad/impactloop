import { z } from 'zod';

const parseOptionalBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (normalized === 'true') {
      return true;
    }

    if (normalized === 'false') {
      return false;
    }
  }

  return undefined;
};

export const categoriesQuerySchema = z.object({
  type: z
    .enum(['MATERIAL', 'PROJECT'], {
      error: 'type must be MATERIAL or PROJECT',
    })
    .optional(),
  rootOnly: z.preprocess(
    (value) => {
      const parsed = parseOptionalBoolean(value);

      return parsed === undefined ? value : parsed;
    },
    z.boolean({
      error: 'rootOnly must be true or false',
    }).default(false),
  ),
  discoveryOnly: z.preprocess(
    (value) => {
      const parsed = parseOptionalBoolean(value);

      return parsed === undefined ? value : parsed;
    },
    z.boolean({
      error: 'discoveryOnly must be true or false',
    }).default(false),
  ),
});

export type CategoriesQuery = z.infer<typeof categoriesQuerySchema>;
