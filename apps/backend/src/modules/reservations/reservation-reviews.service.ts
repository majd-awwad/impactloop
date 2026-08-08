import type { ReviewTargetType } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';

import type { ReservationReviewRecord } from './reservation-reviews.repository.js';
import * as reservationReviewsRepository from './reservation-reviews.repository.js';

export type ReservationReviewDto = {
  id: string;
  targetType: ReviewTargetType;
  rating: number;
  comment: string | null;
  createdAt: string;
};

export type ReservationReviewTargetStateDto = {
  canReview: boolean;
  label: string;
  review: ReservationReviewDto | null;
};

export type ReservationReviewsStateDto = {
  supplier: ReservationReviewTargetStateDto;
  driver: ReservationReviewTargetStateDto | null;
};

type ReservationReviewContext = {
  id: string;
  status: string;
  ownerId: string;
  fulfillmentMethod: string;
  owner: {
    displayName: string | null;
    supplierProfile: {
      publicName: string | null;
      organizationProfile: {
        organizationName: string;
      } | null;
    } | null;
  };
  deliveries: Array<{
    status: string;
    assignedDriverProfileId: string | null;
    assignedDriverProfile: {
      userId: string;
      displayName: string;
    } | null;
  }>;
};

type LearnerReservationReviewContext = ReservationReviewContext;

const mapReservationReview = (
  review: ReservationReviewRecord,
): ReservationReviewDto => ({
  id: review.id,
  targetType: review.targetType,
  rating: review.rating,
  comment: review.comment,
  createdAt: review.createdAt.toISOString(),
});

const resolveSupplierDisplayName = (
  owner: LearnerReservationReviewContext['owner'],
) => {
  return (
    owner.supplierProfile?.organizationProfile?.organizationName?.trim() ||
    owner.supplierProfile?.publicName?.trim() ||
    owner.displayName?.trim() ||
    'Supplier'
  );
};

const resolveDeliveredDriver = (
  reservation: LearnerReservationReviewContext,
) => {
  const delivery = reservation.deliveries.find(
    (entry) =>
      entry.status === 'DELIVERED' && entry.assignedDriverProfile != null,
  );

  if (!delivery?.assignedDriverProfile) {
    return null;
  }

  return delivery.assignedDriverProfile;
};

export const resolveReservationReviewTargets = (
  reservation: LearnerReservationReviewContext,
) => {
  const isCompleted = reservation.status === 'COMPLETED';
  const deliveredDriver = resolveDeliveredDriver(reservation);

  return {
    supplierReviewedUserId: reservation.ownerId,
    supplierLabel: resolveSupplierDisplayName(reservation.owner),
    canReviewSupplier: isCompleted,
    driverReviewedUserId: deliveredDriver?.userId ?? null,
    driverLabel: deliveredDriver?.displayName?.trim() || 'Driver',
    canReviewDriver: isCompleted && deliveredDriver != null,
  };
};

export const buildReservationReviewsState = (
  reservation: LearnerReservationReviewContext,
  reviews: ReservationReviewRecord[],
): ReservationReviewsStateDto => {
  const targets = resolveReservationReviewTargets(reservation);
  const supplierReview =
    reviews.find((review) => review.targetType === 'SUPPLIER') ?? null;
  const driverReview =
    reviews.find((review) => review.targetType === 'DRIVER') ?? null;

  return {
    supplier: {
      canReview: targets.canReviewSupplier,
      label: targets.supplierLabel,
      review: supplierReview ? mapReservationReview(supplierReview) : null,
    },
    driver: targets.canReviewDriver
      ? {
          canReview: true,
          label: targets.driverLabel,
          review: driverReview ? mapReservationReview(driverReview) : null,
        }
      : null,
  };
};

const assertLearnerCanReviewReservation = async (
  requesterId: string,
  reservationId: string,
) => {
  const reservation = await prisma.reservation.findFirst({
    where: {
      id: reservationId,
      requesterId,
    },
    select: {
      id: true,
      status: true,
      requesterId: true,
      ownerId: true,
      fulfillmentMethod: true,
      owner: {
        select: {
          displayName: true,
          supplierProfile: {
            select: {
              publicName: true,
              organizationProfile: {
                select: {
                  organizationName: true,
                },
              },
            },
          },
        },
      },
      deliveries: {
        select: {
          status: true,
          assignedDriverProfileId: true,
          assignedDriverProfile: {
            select: {
              userId: true,
              displayName: true,
            },
          },
        },
        orderBy: { requestedAt: 'desc' },
      },
    },
  });

  if (!reservation) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  if (reservation.status !== 'COMPLETED') {
    throw new AppError(
      'Only completed reservations can be reviewed.',
      409,
      'RESERVATION_NOT_REVIEWABLE',
    );
  }

  return reservation;
};

const resolveReviewedUserId = (
  reservation: Awaited<ReturnType<typeof assertLearnerCanReviewReservation>>,
  targetType: ReviewTargetType,
) => {
  const targets = resolveReservationReviewTargets(reservation);

  if (targetType === 'SUPPLIER') {
    if (!targets.canReviewSupplier) {
      throw new AppError(
        'This reservation cannot be reviewed for the supplier.',
        409,
        'REVIEW_TARGET_NOT_ALLOWED',
      );
    }

    return targets.supplierReviewedUserId;
  }

  if (targetType === 'DRIVER') {
    if (!targets.canReviewDriver || !targets.driverReviewedUserId) {
      throw new AppError(
        'This reservation cannot be reviewed for the driver.',
        409,
        'REVIEW_TARGET_NOT_ALLOWED',
      );
    }

    return targets.driverReviewedUserId;
  }

  throw new AppError('Unsupported review target.', 400, 'VALIDATION_ERROR');
};

export const upsertReservationReviewForLearner = async (
  requesterId: string,
  reservationId: string,
  input: {
    targetType: ReviewTargetType;
    rating: number;
    comment: string | null;
  },
) => {
  const reservation = await assertLearnerCanReviewReservation(
    requesterId,
    reservationId,
  );
  const reviewedUserId = resolveReviewedUserId(reservation, input.targetType);

  if (reviewedUserId === requesterId) {
    throw new AppError('You cannot review yourself.', 409, 'SELF_REVIEW_NOT_ALLOWED');
  }

  const review = await reservationReviewsRepository.upsertReservationReview({
    reservationId,
    reviewerId: requesterId,
    reviewedUserId,
    targetType: input.targetType,
    rating: input.rating,
    comment: input.comment,
  });

  const reviewsState = buildReservationReviewsState(reservation, [review]);

  return {
    reservationId,
    review: mapReservationReview(review),
    reviews: reviewsState,
  };
};

export const deleteReservationReviewForLearner = async (
  requesterId: string,
  reservationId: string,
  targetType: ReviewTargetType,
) => {
  const reservation = await assertLearnerCanReviewReservation(
    requesterId,
    reservationId,
  );

  resolveReviewedUserId(reservation, targetType);

  await reservationReviewsRepository.deleteReservationReview({
    reservationId,
    reviewerId: requesterId,
    targetType,
  });

  const reviewsState = buildReservationReviewsState(reservation, []);

  return {
    reservationId,
    reviews: reviewsState,
  };
};

export const loadReservationReviewsStateForLearner = async (
  requesterId: string,
  reservations: ReservationReviewContext[],
) => {
  const completedReservationIds = reservations
    .filter((reservation) => reservation.status === 'COMPLETED')
    .map((reservation) => reservation.id);

  const reviewsByReservationId =
    await reservationReviewsRepository.findReservationReviewsByReservationIds(
      completedReservationIds,
      requesterId,
    );

  return new Map(
    reservations.map((reservation) => [
      reservation.id,
      reservation.status === 'COMPLETED'
        ? buildReservationReviewsState(
            reservation,
            reviewsByReservationId.get(reservation.id) ?? [],
          )
        : {
            supplier: {
              canReview: false,
              label: resolveSupplierDisplayName(reservation.owner),
              review: null,
            },
            driver: null,
          },
    ]),
  );
};
