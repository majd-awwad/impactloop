import type { Request, Response } from 'express';
import { COMMON_ERROR_CODES } from '../contracts/errors/common-error-codes.js';
import { errorResponse } from '../utils/api-response.js';

export const notFoundMiddleware = (req: Request, res: Response): void => {
  res.status(404).json(
    errorResponse('Route not found', COMMON_ERROR_CODES.notFound, {
      path: req.path,
    }),
  );
};
