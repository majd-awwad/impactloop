import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/app-error.js';

export const requireRoles =
  (...allowedRoles: string[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new AppError('Authentication required', 401, 'UNAUTHENTICATED'));
      return;
    }

    const hasRole = req.auth.roles.some((role) => allowedRoles.includes(role));

    if (!hasRole) {
      next(new AppError('Insufficient permissions', 403, 'FORBIDDEN'));
      return;
    }

    next();
  };
