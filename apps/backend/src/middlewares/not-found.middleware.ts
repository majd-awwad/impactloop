import type { Request, Response } from 'express';
import { COMMON_ERROR_CODES } from '../contracts/errors/common-error-codes.js';
import { errorResponse } from '../utils/api-response.js';
import { recordResponseErrorCode } from './request-context.middleware.js';

export const notFoundMiddleware = (req: Request, res: Response): void => {
  recordResponseErrorCode(res, COMMON_ERROR_CODES.notFound);
  res.status(404).json(
    errorResponse('Route not found', COMMON_ERROR_CODES.notFound, {
      path: req.path,
    }),
  );
};
