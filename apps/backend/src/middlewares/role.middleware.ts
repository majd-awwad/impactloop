import type { NextFunction, Request, Response } from 'express';
import { COMMON_ERROR_CODES } from '../contracts/errors/common-error-codes.js';
import type { UserRole } from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';

export const requireRoles =
  (...allowedRoles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(
        new AppError(
          'Authentication required',
          401,
          COMMON_ERROR_CODES.unauthenticated,
        ),
      );
      return;
    }

    const hasRole = req.auth.roles.some((role) => allowedRoles.includes(role));

    if (!hasRole) {
      next(
        new AppError(
          'Insufficient permissions',
          403,
          COMMON_ERROR_CODES.forbidden,
        ),
      );
      return;
    }

    next();
  };
