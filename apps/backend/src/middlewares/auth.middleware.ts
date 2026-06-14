import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/app-error.js';
import { verifyAccessToken } from '../utils/jwt.js';

export const authMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    next(new AppError('Authentication required', 401, 'UNAUTHENTICATED'));
    return;
  }

  const token = authorization.slice('Bearer '.length).trim();

  if (!token) {
    next(new AppError('Authentication required', 401, 'UNAUTHENTICATED'));
    return;
  }

  try {
    req.auth = verifyAccessToken(token);
    next();
  } catch {
    next(new AppError('Invalid or expired token', 401, 'UNAUTHENTICATED'));
  }
};
