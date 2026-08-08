import type { ReviewTargetType } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';

export type ReservationReviewRecord = {
  id: string;
  reservationId: string;
  reviewerId: string;
  reviewedUserId: string | null;
  targetType: ReviewTargetType;
  rating: number;
  comment: string | null;
  createdAt: Date;
};

const reviewSelect = {
  id: true,
  reservationId: true,
  reviewerId: true,
  reviewedUserId: true,
  targetType: true,
  rating: true,
  comment: true,
  createdAt: true,
} as const;

export const findReservationReviewsByReservationIds = async (
  reservationIds: string[],
  reviewerId: string,
) => {
  if (reservationIds.length === 0) {
    return new Map<string, ReservationReviewRecord[]>();
  }

  const reviews = await prisma.review.findMany({
    where: {
      reservationId: { in: reservationIds },
      reviewerId,
      targetType: { in: ['SUPPLIER', 'DRIVER'] },
    },
    select: reviewSelect,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });

  const grouped = new Map<string, ReservationReviewRecord[]>();

  for (const review of reviews) {
    const existing = grouped.get(review.reservationId) ?? [];
    existing.push(review);
    grouped.set(review.reservationId, existing);
  }

  return grouped;
};

export const upsertReservationReview = async (input: {
  reservationId: string;
  reviewerId: string;
  reviewedUserId: string;
  targetType: ReviewTargetType;
  rating: number;
  comment: string | null;
}) => {
  const existing = await prisma.review.findFirst({
    where: {
      reservationId: input.reservationId,
      reviewerId: input.reviewerId,
      targetType: input.targetType,
    },
    select: { id: true },
  });

  if (existing) {
    return prisma.review.update({
      where: { id: existing.id },
      data: {
        rating: input.rating,
        comment: input.comment,
        reviewedUserId: input.reviewedUserId,
      },
      select: reviewSelect,
    });
  }

  return prisma.review.create({
    data: {
      reservationId: input.reservationId,
      reviewerId: input.reviewerId,
      reviewedUserId: input.reviewedUserId,
      targetType: input.targetType,
      rating: input.rating,
      comment: input.comment,
    },
    select: reviewSelect,
  });
};

export const deleteReservationReview = async (input: {
  reservationId: string;
  reviewerId: string;
  targetType: ReviewTargetType;
}) => {
  await prisma.review.deleteMany({
    where: {
      reservationId: input.reservationId,
      reviewerId: input.reviewerId,
      targetType: input.targetType,
    },
  });
};

export const summarizeSupplierReviewsByUserIds = async (userIds: string[]) => {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];

  if (uniqueUserIds.length === 0) {
    return new Map<string, { average: number; count: number }>();
  }

  const groups = await prisma.review.groupBy({
    by: ['reviewedUserId'],
    where: {
      reviewedUserId: { in: uniqueUserIds },
      targetType: 'SUPPLIER',
    },
    _avg: { rating: true },
    _count: { _all: true },
  });

  return new Map(
    groups
      .filter(
        (group): group is typeof group & { reviewedUserId: string } =>
          group.reviewedUserId != null,
      )
      .map((group) => [
        group.reviewedUserId,
        {
          average: group._avg.rating ?? 0,
          count: group._count._all,
        },
      ]),
  );
};
