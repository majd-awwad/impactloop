import type { Request, Response } from 'express';
import { errorResponse } from '../utils/api-response.js';

export const notFoundMiddleware = (req: Request, res: Response): void => {
  res.status(404).json(
    errorResponse('Route not found', 'NOT_FOUND', {
      path: req.originalUrl,
    }),
  );
};
