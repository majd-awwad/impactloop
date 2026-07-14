import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

import type { Response } from 'express';

import type { LogContext } from '../observability/log-types.js';
import { logger } from '../observability/logger.js';
import { mapUnhandledPrismaError } from '../observability/prisma-error-mapper.js';
import { getRequestId } from '../observability/request-context.js';
import {
  INVALID_JSON_ERROR_CODE,
  isInvalidJsonBodyError,
} from '../observability/invalid-json-error.js';
import { serializeUnknownError } from '../observability/safe-error.js';
import { AppError } from '../utils/app-error.js';
import { errorResponse } from '../utils/api-response.js';
import { markErrorLogged, hasErrorBeenLogged } from './request-context.middleware.js';

const INTERNAL_ERROR_MESSAGE = 'Internal server error';

const shouldLogAppError = (error: AppError): boolean => error.statusCode >= 500;

const logServerError = (
  res: Response,
  input: {
    statusCode: number;
    code: string;
    error: unknown;
    context?: Record<string, unknown>;
  },
): void => {
  if (hasErrorBeenLogged(res)) {
    return;
  }

  const { error: safeError, safeContext } = serializeUnknownError(input.error);

  const logContext: LogContext = {
    operation: 'http.request.error',
    statusCode: input.statusCode,
    errorCode: input.code,
    err: safeError,
    ...input.context,
  };

  if (
    typeof safeContext === 'object' &&
    safeContext !== null &&
    !Array.isArray(safeContext)
  ) {
    Object.assign(logContext, safeContext);
  }

  logger.error(logContext, 'Request failed with server error');

  markErrorLogged(res);
};

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, _next) => {
  const requestId = getRequestId() ?? resolveRequestIdFromResponse(res);

  if (error instanceof AppError) {
    if (shouldLogAppError(error)) {
      logServerError(res, {
        statusCode: error.statusCode,
        code: error.code,
        error: error.cause ?? error,
        context: error.context,
      });
    }

    res
      .status(error.statusCode)
      .json(
        errorResponse(error.message, error.code, error.details, requestId),
      );
    return;
  }

  if (isInvalidJsonBodyError(error)) {
    res.status(400).json(
      errorResponse(
        'Invalid JSON request body',
        INVALID_JSON_ERROR_CODE,
        undefined,
        requestId,
      ),
    );
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json(
      errorResponse(
        'Validation failed',
        'VALIDATION_ERROR',
        {
          issues: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        requestId,
      ),
    );
    return;
  }

  const mappedPrismaError = mapUnhandledPrismaError(error);

  if (mappedPrismaError) {
    res
      .status(mappedPrismaError.statusCode)
      .json(
        errorResponse(
          mappedPrismaError.message,
          mappedPrismaError.code,
          mappedPrismaError.details,
          requestId,
        ),
      );
    return;
  }

  logServerError(res, {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    error,
  });

  res
    .status(500)
    .json(
      errorResponse(INTERNAL_ERROR_MESSAGE, 'INTERNAL_ERROR', undefined, requestId),
    );
};

const resolveRequestIdFromResponse = (res: Response): string => {
  const header = res.getHeader('X-Request-Id');

  return typeof header === 'string' ? header : 'unknown';
};
