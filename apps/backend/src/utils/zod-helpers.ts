import { z } from 'zod';

/**
 * Email fields from JSON request bodies: trim, validate, then lowercase.
 * Zod 4: use z.email() via pipe instead of deprecated z.string().email().
 */
export const bodyEmailSchema = () =>
  z.string().trim().pipe(z.email()).transform((value) => value.toLowerCase());

/**
 * Route/query values from Express arrive as strings — use z.coerce for numbers.
 * Example: GET /users/:id with validate(idParamSchema, 'params')
 */
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
