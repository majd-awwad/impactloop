import type { NextFunction, Request, Response } from 'express';
import { COMMON_ERROR_CODES } from '../contracts/errors/common-error-codes.js';
import { prisma } from '../database/prisma.js';
import { updateRequestContext } from '../observability/request-context.js';
import { AppError } from '../utils/app-error.js';
import { verifyAccessToken } from '../utils/jwt.js';

const suspendedAccountMessage =
  'Your account has been suspended after repeated verified reports. Contact admin.';

const enrichAuthenticatedRequestContext = (userId: string): void => {
  updateRequestContext({ userId });
};

const assertActiveAccount = async (userId: string): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountStatus: true },
  });

  if (!user) {
    throw new AppError(
      'Authentication required',
      401,
      COMMON_ERROR_CODES.unauthenticated,
    );
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
    next(
      new AppError(
        'Authentication required',
        401,
        COMMON_ERROR_CODES.unauthenticated,
      ),
    );
    return;
  }

  const token = authorization.slice('Bearer '.length).trim();

  if (!token) {
    next(
      new AppError(
        'Authentication required',
        401,
        COMMON_ERROR_CODES.unauthenticated,
      ),
    );
    return;
  }

  try {
    req.auth = verifyAccessToken(token);
    enrichAuthenticatedRequestContext(req.auth.sub);
    await assertActiveAccount(req.auth.sub);
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    next(
      new AppError(
        'Invalid or expired token',
        401,
        COMMON_ERROR_CODES.unauthenticated,
      ),
    );
  }
};

export const optionalAuthMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
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
    enrichAuthenticatedRequestContext(req.auth.sub);
    await assertActiveAccount(req.auth.sub);
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    // Ignore invalid tokens on public routes; treat the request as anonymous.
  }

  next();
};

export const strictOptionalAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  if (!req.headers.authorization) {
    next();
    return;
  }

  await authMiddleware(req, res, next);
};
