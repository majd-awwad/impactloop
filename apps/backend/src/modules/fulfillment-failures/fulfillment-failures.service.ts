import { COMMON_ERROR_CODES } from '../../contracts/errors/common-error-codes.js';
import { AppError } from '../../utils/app-error.js';
import {
  deliveryWindowNotExpiredMessage,
  pickupWindowNotExpiredMessage,
  supplierPickupWindowNotExpiredMessage,
} from '../../utils/handover-timing.js';
import { mapSupplierReservation } from '../supplier-reservations/supplier-reservations.service.js';
import * as supplierReservationsRepository from '../supplier-reservations/supplier-reservations.repository.js';
import { mapDriverDeliveryForResponse, driverDeliveryInclude } from '../driver/driver.service.js';
import { prisma } from '../../database/prisma.js';
import {
  invalidateLearnerHomeCache,
  invalidateLearnerHomeForReservationTransition,
} from '../learner-home/learner-home.service.js';
import { notifyDriverDeliveryMovedToAdminReview } from '../notifications/driver-notification-events.service.js';

import * as fulfillmentFailuresRepository from './fulfillment-failures.repository.js';
import type {
  MarkDriverDeliveryFailedInput,
  MarkDriverIssueAfterPickupInput,
  MarkDriverNoShowInput,
  MarkDriverPickupFailedInput,
  MarkLearnerNoShowInput,
} from './fulfillment-failures.validation.js';

const loadSupplierReservation = async (
  ownerId: string,
  reservationId: string,
) => {
  const reservation =
    await supplierReservationsRepository.findSupplierReservationForOwner(
      ownerId,
      reservationId,
    );

  if (!reservation) {
    throw new AppError(
      'Reservation not found.',
      404,
      COMMON_ERROR_CODES.notFound,
    );
  }

  return mapSupplierReservation(reservation);
};

const loadDriverDelivery = async (deliveryId: string) => {
  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: driverDeliveryInclude,
  });

  if (!delivery) {
    throw new AppError('Delivery not found.', 404, COMMON_ERROR_CODES.notFound);
  }

  return mapDriverDeliveryForResponse(delivery);
};

const throwWindowNotExpired = (message: string): never => {
  throw new AppError(message, 409, COMMON_ERROR_CODES.conflict);
};

export const markSupplierLearnerNoShow = async (
  ownerId: string,
  reservationId: string,
  input: MarkLearnerNoShowInput,
) => {
  const result = await fulfillmentFailuresRepository.markLearnerPickupNoShow({
    ownerId,
    reservationId,
    reasonCode: input.reason,
    note: input.note,
  });

  switch (result.outcome) {
    case 'NOT_FOUND':
      throw new AppError(
        'Reservation not found.',
        404,
        COMMON_ERROR_CODES.notFound,
      );
    case 'INVALID_STATUS':
      throw new AppError(
        'Only accepted reservations can be marked as no-show.',
        409,
        COMMON_ERROR_CODES.conflict,
      );
    case 'NOT_PICKUP':
      throw new AppError(
        'Learner no-show applies only to pickup reservations.',
        409,
        COMMON_ERROR_CODES.conflict,
      );
    case 'MISSING_WINDOW':
      throw new AppError(
        'Pickup window is not set.',
        409,
        COMMON_ERROR_CODES.conflict,
      );
    case 'WINDOW_NOT_EXPIRED':
      throwWindowNotExpired(pickupWindowNotExpiredMessage());
    case 'DUPLICATE':
      throw new AppError(
        'This reservation was already marked as a no-show.',
        409,
        COMMON_ERROR_CODES.conflict,
      );
    default:
      invalidateLearnerHomeForReservationTransition('ACCEPTED', 'NO_SHOW');
      return loadSupplierReservation(ownerId, reservationId);
  }
};

export const markSupplierDeliveryPickupExpired = async (
  ownerId: string,
  reservationId: string,
) => {
  const result =
    await fulfillmentFailuresRepository.markDeliveryPickupWindowExpired({
      ownerId,
      reservationId,
    });

  switch (result.outcome) {
    case 'NOT_FOUND':
      throw new AppError(
        'Reservation not found.',
        404,
        COMMON_ERROR_CODES.notFound,
      );
    case 'INVALID_STATUS':
      throw new AppError(
        'Only accepted reservations can be updated.',
        409,
        COMMON_ERROR_CODES.conflict,
      );
    case 'NO_DELIVERY':
      throw new AppError(
        'No delivery found for this reservation.',
        404,
        COMMON_ERROR_CODES.notFound,
      );
    case 'INVALID_DELIVERY_STATUS':
      throw new AppError(
        'Delivery is not waiting for a driver.',
        409,
        COMMON_ERROR_CODES.conflict,
      );
    case 'DRIVER_ASSIGNED':
      throw new AppError(
        'Cannot mark expired while a driver is assigned.',
        409,
        COMMON_ERROR_CODES.conflict,
      );
    case 'MISSING_WINDOW':
      throw new AppError(
        'Supplier pickup window is not set.',
        409,
        COMMON_ERROR_CODES.conflict,
      );
    case 'WINDOW_NOT_EXPIRED':
      throwWindowNotExpired(supplierPickupWindowNotExpiredMessage());
    default:
      invalidateLearnerHomeForReservationTransition(
        'ACCEPTED',
        'AWAITING_RESOLUTION',
      );
      return loadSupplierReservation(ownerId, reservationId);
  }
};

export const markSupplierDriverNoShow = async (
  ownerId: string,
  deliveryId: string,
  input: MarkDriverNoShowInput,
) => {
  const result = await fulfillmentFailuresRepository.markDriverNoShow({
    ownerId,
    deliveryId,
    note: input.note,
  });

  if (result.outcome === 'UPDATED') {
    invalidateLearnerHomeForReservationTransition(
      'ACCEPTED',
      'AWAITING_RESOLUTION',
    );
    return loadSupplierReservation(ownerId, result.reservation.id);
  }

  switch (result.outcome) {
    case 'NOT_FOUND':
      throw new AppError(
        'Delivery not found.',
        404,
        COMMON_ERROR_CODES.notFound,
      );
    case 'FORBIDDEN':
      throw new AppError(
        'Delivery not found.',
        404,
        COMMON_ERROR_CODES.notFound,
      );
    case 'INVALID_RESERVATION_STATUS':
      throw new AppError(
        'Only accepted reservations can be updated.',
        409,
        COMMON_ERROR_CODES.conflict,
      );
    case 'NOT_ASSIGNED':
      throw new AppError(
        'Delivery has no assigned driver.',
        409,
        COMMON_ERROR_CODES.conflict,
      );
    case 'INVALID_DELIVERY_STATUS':
      throw new AppError(
        'Driver no-show applies only before pickup.',
        409,
        COMMON_ERROR_CODES.conflict,
      );
    case 'MISSING_WINDOW':
      throw new AppError(
        'Supplier pickup window is not set.',
        409,
        COMMON_ERROR_CODES.conflict,
      );
    case 'WINDOW_NOT_EXPIRED':
      throwWindowNotExpired(supplierPickupWindowNotExpiredMessage());
    default:
      throw new AppError(
        'Unexpected driver no-show result.',
        500,
        COMMON_ERROR_CODES.internalError,
      );
  }
};

export const markDriverPickupFailed = async (
  driverUserId: string,
  deliveryId: string,
  input: MarkDriverPickupFailedInput,
) => {
  const result = await fulfillmentFailuresRepository.markDriverPickupFailed({
    driverUserId,
    deliveryId,
    reason: input.reason,
    note: input.note,
  });

  if (result.outcome === 'UPDATED') {
    await notifyDriverDeliveryMovedToAdminReview({
      deliveryId,
      driverUserId,
    });
    invalidateLearnerHomeForReservationTransition(
      'ACCEPTED',
      'AWAITING_RESOLUTION',
    );
    return loadDriverDelivery(deliveryId);
  }

  switch (result.outcome) {
    case 'NOT_FOUND':
      throw new AppError(
        'Delivery not found.',
        404,
        COMMON_ERROR_CODES.notFound,
      );
    case 'INVALID_RESERVATION_STATUS':
      throw new AppError(
        'Only active reservations can be updated.',
        409,
        'DRIVER_PICKUP_FAILURE_NOT_ALLOWED',
      );
    case 'INVALID_DELIVERY_STATUS':
      throw new AppError(
        'Pickup failed applies only before pickup.',
        409,
        'DRIVER_PICKUP_FAILURE_NOT_ALLOWED',
      );
    case 'MISSING_WINDOW':
      throw new AppError(
        'Supplier pickup window is not set.',
        409,
        'DRIVER_PICKUP_FAILURE_NOT_ALLOWED',
      );
    case 'WINDOW_NOT_EXPIRED':
      throwWindowNotExpired(supplierPickupWindowNotExpiredMessage());
    default:
      throw new AppError(
        'Unexpected pickup failed result.',
        500,
        COMMON_ERROR_CODES.internalError,
      );
  }
};

export const markDriverDeliveryFailed = async (
  driverUserId: string,
  deliveryId: string,
  input: MarkDriverDeliveryFailedInput,
) => {
  const result = await fulfillmentFailuresRepository.markDriverDeliveryFailed({
    driverUserId,
    deliveryId,
    reason: input.reason,
    note: input.note,
  });

  if (result.outcome === 'UPDATED') {
    await notifyDriverDeliveryMovedToAdminReview({
      deliveryId,
      driverUserId,
    });
    // FAILED_DELIVERY keeps the material in custody, so the shared hold is
    // unchanged. Only the affected learner's reservation behavior is freshened.
    invalidateLearnerHomeCache(result.reservation.requesterId);
    return loadDriverDelivery(deliveryId);
  }

  switch (result.outcome) {
    case 'NOT_FOUND':
      throw new AppError(
        'Delivery not found.',
        404,
        COMMON_ERROR_CODES.notFound,
      );
    case 'INVALID_RESERVATION_STATUS':
      throw new AppError(
        'Completed reservations cannot be marked failed.',
        409,
        'DRIVER_DELIVERY_FAILURE_NOT_ALLOWED',
      );
    case 'INVALID_DELIVERY_STATUS':
      throw new AppError(
        'Delivery failed applies only after pickup.',
        409,
        'DRIVER_DELIVERY_FAILURE_NOT_ALLOWED',
      );
    case 'MISSING_WINDOW':
      throw new AppError(
        'Delivery window is not set.',
        409,
        'DRIVER_DELIVERY_FAILURE_NOT_ALLOWED',
      );
    case 'WINDOW_NOT_EXPIRED':
      throwWindowNotExpired(deliveryWindowNotExpiredMessage());
    default:
      throw new AppError(
        'Unexpected delivery failed result.',
        500,
        COMMON_ERROR_CODES.internalError,
      );
  }
};

export const markDriverIssueAfterPickup = async (
  driverUserId: string,
  deliveryId: string,
  input: MarkDriverIssueAfterPickupInput,
) => {
  const result = await fulfillmentFailuresRepository.markDriverIssueAfterPickup({
    driverUserId,
    deliveryId,
    note: input.note,
  });

  if (result.outcome === 'UPDATED') {
    await notifyDriverDeliveryMovedToAdminReview({
      deliveryId,
      driverUserId,
    });
  }

  switch (result.outcome) {
    case 'NOT_FOUND':
      throw new AppError(
        'Delivery not found.',
        404,
        COMMON_ERROR_CODES.notFound,
      );
    case 'INVALID_RESERVATION_STATUS':
      throw new AppError(
        'Completed reservations cannot be updated.',
        409,
        'DRIVER_ISSUE_NOT_ALLOWED',
      );
    case 'INVALID_DELIVERY_STATUS':
      throw new AppError(
        'Driver issue reports apply only after pickup.',
        409,
        'DRIVER_ISSUE_NOT_ALLOWED',
      );
    default:
      invalidateLearnerHomeForReservationTransition(
        'ACCEPTED',
        'AWAITING_RESOLUTION',
      );
      return loadDriverDelivery(result.delivery.id);
  }
};
