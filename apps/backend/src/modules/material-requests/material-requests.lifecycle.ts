import type { LearnerMaterialRequestStatus } from '../../generated/prisma/client.js';

export const MAX_OPEN_LEARNER_MATERIAL_REQUESTS = 10;
export const DEFAULT_MATERIAL_REQUEST_TTL_DAYS = 30;
/** Category-only evidence scores 150 and is still a weak match. */
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

/** Read-only OPEN→EXPIRED view for list/detail responses without mutating rows. */
export const effectiveRequestStatus = (input: {
  status: LearnerMaterialRequestStatus;
  expiresAt: Date;
  now?: Date;
}): LearnerMaterialRequestStatus => {
  if (
    shouldLazyExpire({
      status: input.status,
      expiresAt: input.expiresAt,
      now: input.now,
    })
  ) {
    return 'EXPIRED';
  }
  return input.status;
};

export const isWeakMatchScore = (input: {
  rankingScore: number;
}): boolean => input.rankingScore <= WEAK_MATCH_SCORE_THRESHOLD;
