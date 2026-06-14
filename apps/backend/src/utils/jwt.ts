import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

export type AccessTokenPayload = {
  sub: string;
  roles: string[];
};

export type RefreshTokenPayload = {
  sub: string;
  jti: string;
};

export const signAccessToken = (payload: AccessTokenPayload): string => {
  const options: SignOptions = {
    expiresIn: env.jwtAccessExpiresIn as SignOptions['expiresIn'],
  };

  return jwt.sign(payload, env.jwtAccessSecret, options);
};

export const signRefreshToken = (payload: RefreshTokenPayload): string => {
  const options: SignOptions = {
    expiresIn: env.jwtRefreshExpiresIn as SignOptions['expiresIn'],
  };

  return jwt.sign(payload, env.jwtRefreshSecret, options);
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const decoded = jwt.verify(token, env.jwtAccessSecret);

  if (typeof decoded === 'string' || !decoded.sub) {
    throw new Error('Invalid access token payload');
  }

  return {
    sub: decoded.sub,
    roles: Array.isArray(decoded.roles)
      ? decoded.roles.filter((role): role is string => typeof role === 'string')
      : [],
  };
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  const decoded = jwt.verify(token, env.jwtRefreshSecret);

  if (
    typeof decoded === 'string' ||
    !decoded.sub ||
    typeof decoded.jti !== 'string'
  ) {
    throw new Error('Invalid refresh token payload');
  }

  return {
    sub: decoded.sub,
    jti: decoded.jti,
  };
};

export const getRefreshTokenExpiry = (): Date => {
  const duration = env.jwtRefreshExpiresIn;
  const match = duration.match(/^(\d+)([smhd])$/);

  if (!match) {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  const amount = Number(match[1]);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return new Date(Date.now() + amount * multipliers[unit]!);
};
