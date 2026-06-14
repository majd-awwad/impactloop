import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import { errorResponse } from '../utils/api-response.js';

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    res
      .status(error.statusCode)
      .json(errorResponse(error.message, error.code, error.details));
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json(
      errorResponse('Validation failed', 'VALIDATION_ERROR', {
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      }),
    );
    return;
  }

  const details =
    env.nodeEnv === 'production'
      ? undefined
      : {
          message: error instanceof Error ? error.message : String(error),
        };

  res
    .status(500)
    .json(errorResponse('Internal server error', 'INTERNAL_ERROR', details));
};
