import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { AppError } from '../utils/app-error.js';

export type RateLimitPolicy = {
  name: string;
  windowMs: number;
  max: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

const getBucketKey = (key: string, policy: RateLimitPolicy): string =>
  `${policy.name}:${key}`;

export const checkRateLimit = (
  key: string,
  policy: RateLimitPolicy,
): void => {
  const now = Date.now();
  const bucketKey = getBucketKey(key, policy);
  const current = buckets.get(bucketKey);

  if (!current || current.resetAt <= now) {
    buckets.set(bucketKey, {
      count: 1,
      resetAt: now + policy.windowMs,
    });
    return;
  }

  if (current.count >= policy.max) {
    throw new AppError(
      'Too many requests. Please try again later.',
      429,
      'RATE_LIMITED',
    );
  }

  current.count += 1;
};

export const createRateLimitMiddleware = (options: {
  policy: RateLimitPolicy;
  keyGenerator: (req: Request) => string | null;
}): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const key = options.keyGenerator(req);

      if (key) {
        checkRateLimit(key, options.policy);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const resetRateLimitersForTests = (): void => {
  buckets.clear();
};
