import type {
  MaterialStatus,
  ReservationStatus,
} from '../../generated/prisma/client.js';

export const CATEGORY_DEMAND_PERIOD_DAYS = 30;
export const CATEGORY_DEMAND_METHODOLOGY_VERSION = 'category-demand-v1';
export const CATEGORY_DEMAND_SOURCE = 'PLATFORM_LEARNER_ACTIVITY';

export const CATEGORY_DEMAND_MIN_ACTIVITY = 8;
export const CATEGORY_DEMAND_OMIT_BELOW_SCORE = 15;
export const CATEGORY_DEMAND_DEFAULT_LIMIT = 8;
export const CATEGORY_DEMAND_MAX_LIMIT = 15;

/** Public discovery visibility — request-time denominator. */
export const CATEGORY_DEMAND_PUBLIC_LISTING_STATUSES = [
  'AVAILABLE',
  'PENDING_RESERVATION',
  'RESERVED',
] as const satisfies readonly MaterialStatus[];

/**
 * Positive reservation statuses for category demand.
 * Negative terminals are intentionally excluded.
 * Any future ReservationStatus values must be mapped explicitly — do not count by default.
 */
export const CATEGORY_DEMAND_POSITIVE_RESERVATION_STATUSES = [
  'PENDING',
  'AWAITING_LEARNER_CONFIRMATION',
  'AWAITING_SUPPLIER_CONFIRMATION',
  'ACCEPTED',
  'AWAITING_RESOLUTION',
  'COMPLETED',
] as const satisfies readonly ReservationStatus[];

export type CategoryDemandLevel = 'HIGH' | 'MODERATE' | 'EMERGING';

export type CategoryDemandReasonCode =
  | 'STRONG_RESERVATION_ACTIVITY'
  | 'BALANCED_ENGAGEMENT'
  | 'LIKE_ENGAGEMENT'
  | 'VIEW_ENGAGEMENT'
  | 'LIMITED_RECENT_ACTIVITY';

export type CategoryDemandEmptyStateReason =
  | 'NO_RECENT_ACTIVITY'
  | 'NO_ACTIVE_CATEGORIES';

const SIGNAL_CONFIG = {
  views: { volumeSaturation: 200, rateCap: 20, weight: 0.15 },
  likes: { volumeSaturation: 40, rateCap: 5, weight: 0.3 },
  reservations: { volumeSaturation: 20, rateCap: 3, weight: 0.55 },
} as const;

const VOLUME_BLEND = 0.55;
const RATE_BLEND = 0.45;

export type CategoryDemandSignalCounts = {
  views: number;
  likes: number;
  reservations: number;
};

export type CategoryDemandScoreInput = CategoryDemandSignalCounts & {
  listingCount: number;
};

export type CategoryDemandScoreResult = {
  activityValue: number;
  eligible: boolean;
  viewStrength: number;
  likeStrength: number;
  reservationStrength: number;
  score: number;
  demandLevel: CategoryDemandLevel | null;
  primaryReason: CategoryDemandReasonCode;
  includeInResults: boolean;
};

export const computeCategoryDemandActivityValue = (
  signals: CategoryDemandSignalCounts,
): number =>
  signals.views + 5 * signals.likes + 10 * signals.reservations;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const computeSignalStrength = (input: {
  count: number;
  listingCount: number;
  volumeSaturation: number;
  rateCap: number;
}): number => {
  const count = Math.max(0, input.count);
  const volumeStrength = clamp01(
    Math.log1p(count) / Math.log1p(input.volumeSaturation),
  );
  const rate =
    input.listingCount > 0 ? count / input.listingCount : 0;
  const rateStrength = clamp01(rate / input.rateCap);
  return VOLUME_BLEND * volumeStrength + RATE_BLEND * rateStrength;
};

export const computeCategoryDemandScore = (
  input: CategoryDemandScoreInput,
): CategoryDemandScoreResult => {
  const views = Math.max(0, input.views);
  const likes = Math.max(0, input.likes);
  const reservations = Math.max(0, input.reservations);
  const listingCount = Math.max(0, input.listingCount);

  const activityValue = computeCategoryDemandActivityValue({
    views,
    likes,
    reservations,
  });
  const eligible = activityValue >= CATEGORY_DEMAND_MIN_ACTIVITY;

  const viewStrength = computeSignalStrength({
    count: views,
    listingCount,
    volumeSaturation: SIGNAL_CONFIG.views.volumeSaturation,
    rateCap: SIGNAL_CONFIG.views.rateCap,
  });
  const likeStrength = computeSignalStrength({
    count: likes,
    listingCount,
    volumeSaturation: SIGNAL_CONFIG.likes.volumeSaturation,
    rateCap: SIGNAL_CONFIG.likes.rateCap,
  });
  const reservationStrength = computeSignalStrength({
    count: reservations,
    listingCount,
    volumeSaturation: SIGNAL_CONFIG.reservations.volumeSaturation,
    rateCap: SIGNAL_CONFIG.reservations.rateCap,
  });

  const viewContribution = SIGNAL_CONFIG.views.weight * viewStrength;
  const likeContribution = SIGNAL_CONFIG.likes.weight * likeStrength;
  const reservationContribution =
    SIGNAL_CONFIG.reservations.weight * reservationStrength;
  const totalContribution =
    viewContribution + likeContribution + reservationContribution;

  const score = Math.round(
    Math.min(100, Math.max(0, 100 * totalContribution)),
  );

  const primaryReason = resolvePrimaryReason({
    views,
    likes,
    reservations,
    viewStrength,
    likeStrength,
    reservationStrength,
    viewContribution,
    likeContribution,
    reservationContribution,
    totalContribution,
  });

  const demandLevel = resolveDemandLevel(score, reservations);
  const includeInResults = eligible && score >= CATEGORY_DEMAND_OMIT_BELOW_SCORE;

  return {
    activityValue,
    eligible,
    viewStrength,
    likeStrength,
    reservationStrength,
    score,
    demandLevel: includeInResults ? demandLevel : null,
    primaryReason,
    includeInResults,
  };
};

export const resolveDemandLevel = (
  score: number,
  reservations: number,
): CategoryDemandLevel => {
  if (score >= 70 && reservations >= 2) {
    return 'HIGH';
  }
  if (score >= 40) {
    return 'MODERATE';
  }
  return 'EMERGING';
};

const resolvePrimaryReason = (input: {
  views: number;
  likes: number;
  reservations: number;
  viewStrength: number;
  likeStrength: number;
  reservationStrength: number;
  viewContribution: number;
  likeContribution: number;
  reservationContribution: number;
  totalContribution: number;
}): CategoryDemandReasonCode => {
  if (
    input.reservations >= 2 &&
    input.reservationStrength >= input.likeStrength &&
    input.reservationStrength >= input.viewStrength
  ) {
    return 'STRONG_RESERVATION_ACTIVITY';
  }

  const nonZeroSignals =
    Number(input.views > 0) +
    Number(input.likes > 0) +
    Number(input.reservations > 0);

  if (
    nonZeroSignals >= 2 &&
    input.totalContribution > 0 &&
    Math.max(
      input.viewContribution,
      input.likeContribution,
      input.reservationContribution,
    ) <=
      0.7 * input.totalContribution
  ) {
    return 'BALANCED_ENGAGEMENT';
  }

  if (
    input.likeContribution >= input.viewContribution &&
    input.likeContribution >= input.reservationContribution
  ) {
    return 'LIKE_ENGAGEMENT';
  }

  if (
    input.viewContribution >= input.likeContribution &&
    input.viewContribution >= input.reservationContribution
  ) {
    return 'VIEW_ENGAGEMENT';
  }

  return 'LIMITED_RECENT_ACTIVITY';
};

export type RankedCategoryDemandCandidate = {
  categoryId: string;
  activityValue: number;
  score: number;
  includeInResults: boolean;
};

export const compareCategoryDemandCandidates = (
  left: RankedCategoryDemandCandidate,
  right: RankedCategoryDemandCandidate,
): number => {
  if (right.score !== left.score) {
    return right.score - left.score;
  }
  if (right.activityValue !== left.activityValue) {
    return right.activityValue - left.activityValue;
  }
  return left.categoryId.localeCompare(right.categoryId);
};

export const rankAndLimitCategoryDemand = <T extends RankedCategoryDemandCandidate>(
  candidates: T[],
  limit: number,
): T[] =>
  [...candidates]
    .filter((candidate) => candidate.includeInResults)
    .sort(compareCategoryDemandCandidates)
    .slice(0, limit);
