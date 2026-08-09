import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

import { COMMON_ERROR_CODES } from '../contracts/errors/common-error-codes.js';
import { AppError } from '../utils/app-error.js';

type RequestSource = 'body' | 'query' | 'params';

const mapValidationIssueCode = (path: string) => {
  switch (path) {
    case 'categoryId':
      return 'INVALID_COMPONENT_CATEGORY';
    case 'componentRole':
      return 'INVALID_COMPONENT_ROLE';
    case 'quantity':
      return 'INVALID_QUANTITY';
    case 'searchKeywords':
    case 'alternativeKeywords':
      return 'INVALID_KEYWORDS';
    default:
      return COMMON_ERROR_CODES.validationError;
  }
};

/**
 * Validates req.body, req.query, or req.params.
 * For query/params, prefer z.coerce.* in schemas because Express values are strings.
 *
 * Express 5 exposes read-only req.query/req.params, so parsed values are stored on
 * req.validatedQuery / req.validatedParams instead of mutating the originals.
 */
export const validate =
  <T>(schema: ZodType<T>, source: RequestSource = 'body') =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      next(
        new AppError(
          'Validation failed',
          400,
          COMMON_ERROR_CODES.validationError,
          {
            issues: result.error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
              code: mapValidationIssueCode(issue.path.join('.')),
            })),
          },
        ),
      );
      return;
    }

    if (source === 'query') {
      req.validatedQuery = result.data;
    } else if (source === 'params') {
      req.validatedParams = result.data;
    } else {
      req.body = result.data;
    }

    next();
  };

export const readValidatedQuery = <T>(req: Request): T =>
  req.validatedQuery as T;

export const readValidatedParams = <T>(req: Request): T =>
  req.validatedParams as T;
