import type { Request, Response } from 'express';

import { env } from '../../config/env.js';
import { COMMON_ERROR_CODES } from '../../contracts/errors/common-error-codes.js';

import { AppError } from '../../utils/app-error.js';

import { getRefreshTokenMaxAgeMs } from '../../utils/jwt.js';
import { hashToken } from '../../utils/token.js';

import type { AuthResult, RefreshResult } from './auth.service.js';

export const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';
export const CLIENT_PLATFORM_HEADER = 'x-client-platform';

const REFRESH_TOKEN_COOKIE_PATH = '/api/auth';

const parseCookieHeader = (
  cookieHeader: string | undefined,
): Record<string, string> => {
  if (!cookieHeader) {
    return {};
  }

  return Object.fromEntries(
    cookieHeader.split(';').flatMap((part) => {
      const separatorIndex = part.indexOf('=');

      if (separatorIndex === -1) {
        return [];
      }

      const name = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();

      if (!name) {
        return [];
      }

      return [[name, decodeURIComponent(value)]];
    }),
  );
};

export const isWebClient = (req: Request): boolean => {
  const platform = req.headers[CLIENT_PLATFORM_HEADER];

  if (typeof platform !== 'string') {
    return false;
  }

  return platform.trim().toLowerCase() === 'web';
};

export const getRefreshTokenFromRequest = (req: Request): string | undefined => {
  const cookieToken =
    parseCookieHeader(req.headers.cookie)[REFRESH_TOKEN_COOKIE_NAME];

  if (cookieToken) {
    return cookieToken;
  }

  const bodyRefreshToken = (req.body as { refreshToken?: string } | undefined)
    ?.refreshToken;

  return bodyRefreshToken?.trim() || undefined;
};

export const requireRefreshTokenFromRequest = (req: Request): string => {
  const refreshToken = getRefreshTokenFromRequest(req);

  if (!refreshToken) {
    throw new AppError(
      'Refresh token is required',
      401,
      COMMON_ERROR_CODES.unauthenticated,
    );
  }

  return refreshToken;
};

/** Hashed rate-limit key from cookie or body; never the raw refresh token. */
export const getRefreshTokenRateLimitKey = (req: Request): string => {
  const refreshToken = getRefreshTokenFromRequest(req);
  return refreshToken ? hashToken(refreshToken) : 'missing';
};

const refreshTokenCookieOptions = () => ({
  httpOnly: true,
  secure: env.nodeEnv === 'production',
  sameSite: 'lax' as const,
  path: REFRESH_TOKEN_COOKIE_PATH,
  maxAge: getRefreshTokenMaxAgeMs(),
});

export const setRefreshTokenCookie = (
  res: Response,
  refreshToken: string,
): void => {
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, refreshTokenCookieOptions());
};

export const clearRefreshTokenCookie = (res: Response): void => {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: REFRESH_TOKEN_COOKIE_PATH,
  });
};

export const sendAuthSessionResponse = (
  req: Request,
  res: Response,
  message: string,
  result: AuthResult,
  statusCode = 200,
): void => {
  if (isWebClient(req)) {
    setRefreshTokenCookie(res, result.refreshToken);

    res.status(statusCode).json({
      success: true,
      message,
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
    });
    return;
  }

  res.status(statusCode).json({
    success: true,
    message,
    data: {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    },
  });
};

export const sendRefreshSessionResponse = (
  req: Request,
  res: Response,
  message: string,
  result: RefreshResult,
): void => {
  if (isWebClient(req)) {
    setRefreshTokenCookie(res, result.refreshToken);

    res.json({
      success: true,
      message,
      data: {
        accessToken: result.accessToken,
      },
    });
    return;
  }

  res.json({
    success: true,
    message,
    data: {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    },
  });
};
