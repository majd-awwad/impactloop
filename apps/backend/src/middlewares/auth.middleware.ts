import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../database/prisma.js';
import { AppError } from '../utils/app-error.js';
import { verifyAccessToken } from '../utils/jwt.js';

const suspendedAccountMessage =
  'Your account has been suspended after repeated verified reports. Contact admin.';

const assertActiveAccount = async (userId: string): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountStatus: true },
  });

  if (!user) {
    throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
  }

  if (user.accountStatus === 'SUSPENDED' || user.accountStatus === 'DISABLED') {
    throw new AppError(suspendedAccountMessage, 403, 'ACCOUNT_SUSPENDED');
  }
};

export const authMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
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
    await assertActiveAccount(req.auth.sub);
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    next(new AppError('Invalid or expired token', 401, 'UNAUTHENTICATED'));
  }
};

export const optionalAuthMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authorization.slice('Bearer '.length).trim();

  if (!token) {
    next();
    return;
  }

  try {
    req.auth = verifyAccessToken(token);
  } catch {
    // Ignore invalid tokens on public routes; treat the request as anonymous.
  }

  next();
};
