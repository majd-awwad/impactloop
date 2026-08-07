import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';

export type RateLimitPolicy = {
  name: string;
  windowMs: number;
  max: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
  lastAccessAt: number;
};

export type RateLimitStoreConfig = {
  maxEntries: number;
  sweepIntervalMs: number;
};

const getBucketKey = (key: string, policy: RateLimitPolicy): string =>
  `${policy.name}:${key}`;

class BoundedRateLimitStore {
  private readonly buckets = new Map<string, RateLimitBucket>();
  private readonly config: RateLimitStoreConfig;
  private sweepTimer: ReturnType<typeof setInterval> | undefined;

  constructor(
    config: RateLimitStoreConfig,
    options?: { enablePeriodicSweep?: boolean },
  ) {
    this.config = config;

    if (options?.enablePeriodicSweep) {
      this.sweepTimer = setInterval(
        () => this.sweepExpired(),
        config.sweepIntervalMs,
      );
      this.sweepTimer.unref?.();
    }
  }

  clear(): void {
    this.buckets.clear();
  }

  stopPeriodicSweep(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = undefined;
    }
  }

  sweepExpired(): number {
    const now = Date.now();
    let removed = 0;

    for (const [bucketKey, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(bucketKey);
        removed += 1;
      }
    }

    return removed;
  }

  size(): number {
    return this.buckets.size;
  }

  private evictOneIfNeeded(): void {
    if (this.buckets.size < this.config.maxEntries) {
      return;
    }

    this.sweepExpired();

    if (this.buckets.size < this.config.maxEntries) {
      return;
    }

    let oldestKey: string | undefined;
    let oldestAccessAt = Infinity;

    for (const [bucketKey, bucket] of this.buckets) {
      if (bucket.lastAccessAt < oldestAccessAt) {
        oldestAccessAt = bucket.lastAccessAt;
        oldestKey = bucketKey;
      }
    }

    if (oldestKey) {
      this.buckets.delete(oldestKey);
    }
  }

  check(key: string, policy: RateLimitPolicy): void {
    const now = Date.now();
    const bucketKey = getBucketKey(key, policy);
    const current = this.buckets.get(bucketKey);

    if (!current || current.resetAt <= now) {
      this.evictOneIfNeeded();
      this.buckets.set(bucketKey, {
        count: 1,
        resetAt: now + policy.windowMs,
        lastAccessAt: now,
      });
      return;
    }

    current.lastAccessAt = now;

    if (current.count >= policy.max) {
      throw new AppError(
        'Too many requests. Please try again later.',
        429,
        'RATE_LIMITED',
      );
    }

    current.count += 1;
  }
}

const defaultStore = new BoundedRateLimitStore(
  {
    maxEntries: env.rateLimitMaxEntries,
    sweepIntervalMs: env.rateLimitSweepIntervalMs,
  },
  { enablePeriodicSweep: env.nodeEnv !== 'test' },
);

export const checkRateLimit = (
  key: string,
  policy: RateLimitPolicy,
): void => {
  defaultStore.check(key, policy);
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
  defaultStore.clear();
};

export const createRateLimitStoreForTests = (
  config: RateLimitStoreConfig,
): BoundedRateLimitStore => new BoundedRateLimitStore(config);
