import type { LearnerMaterialRequestStatus } from '../../generated/prisma/client.js';

export const MAX_OPEN_LEARNER_MATERIAL_REQUESTS = 10;
export const DEFAULT_MATERIAL_REQUEST_TTL_DAYS = 30;
/** Category-only score is 150; below that without category is weak. */
export const WEAK_MATCH_SCORE_THRESHOLD = 150;

export const isTerminalRequestStatus = (
  status: LearnerMaterialRequestStatus,
): boolean =>
  status === 'FULFILLED' || status === 'CANCELLED' || status === 'EXPIRED';

export const endOfUtcDay = (value: Date): Date => {
  const result = new Date(value);
  result.setUTCHours(23, 59, 59, 999);
  return result;
};

export const computeExpiresAt = (
  createdAt: Date,
  neededBy?: Date | null,
): Date => {
  const defaultExpiry = new Date(
    createdAt.getTime() +
      DEFAULT_MATERIAL_REQUEST_TTL_DAYS * 24 * 60 * 60 * 1000,
  );
  if (!neededBy) {
    return defaultExpiry;
  }
  const neededByEnd = endOfUtcDay(neededBy);
  return neededByEnd.getTime() < defaultExpiry.getTime()
    ? neededByEnd
    : defaultExpiry;
};

export const shouldLazyExpire = (input: {
  status: LearnerMaterialRequestStatus;
  expiresAt: Date;
  now?: Date;
}): boolean => {
  const now = input.now ?? new Date();
  return input.status === 'OPEN' && input.expiresAt.getTime() <= now.getTime();
};

export const isWeakMatchScore = (input: {
  rankingScore: number;
  sameCategory: boolean;
}): boolean => {
  if (input.sameCategory) {
    return false;
  }
  return input.rankingScore < WEAK_MATCH_SCORE_THRESHOLD;
};
