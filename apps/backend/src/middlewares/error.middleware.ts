import type { ErrorRequestHandler } from 'express';
import { env } from '../config/env.js';
import { errorResponse } from '../utils/api-response.js';

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, _next) => {
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
