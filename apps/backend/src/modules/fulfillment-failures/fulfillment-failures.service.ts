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
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  return mapSupplierReservation(reservation);
};

const loadDriverDelivery = async (deliveryId: string) => {
  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: driverDeliveryInclude,
  });

  if (!delivery) {
    throw new AppError('Delivery not found.', 404, 'NOT_FOUND');
  }

  return mapDriverDeliveryForResponse(delivery);
};

const throwWindowNotExpired = (message: string) => {
  throw new AppError(message, 409, 'CONFLICT');
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
      throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
    case 'INVALID_STATUS':
      throw new AppError(
        'Only accepted reservations can be marked as no-show.',
        409,
        'CONFLICT',
      );
    case 'NOT_PICKUP':
      throw new AppError(
        'Learner no-show applies only to pickup reservations.',
        409,
        'CONFLICT',
      );
    case 'MISSING_WINDOW':
      throw new AppError('Pickup window is not set.', 409, 'CONFLICT');
    case 'WINDOW_NOT_EXPIRED':
      throwWindowNotExpired(pickupWindowNotExpiredMessage());
    case 'DUPLICATE':
      throw new AppError(
        'This reservation was already marked as a no-show.',
        409,
        'CONFLICT',
      );
    default:
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
      throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
    case 'INVALID_STATUS':
      throw new AppError(
        'Only accepted reservations can be updated.',
        409,
        'CONFLICT',
      );
    case 'NO_DELIVERY':
      throw new AppError('No delivery found for this reservation.', 404, 'NOT_FOUND');
    case 'INVALID_DELIVERY_STATUS':
      throw new AppError(
        'Delivery is not waiting for a driver.',
        409,
        'CONFLICT',
      );
    case 'DRIVER_ASSIGNED':
      throw new AppError(
        'Cannot mark expired while a driver is assigned.',
        409,
        'CONFLICT',
      );
    case 'MISSING_WINDOW':
      throw new AppError('Supplier pickup window is not set.', 409, 'CONFLICT');
    case 'WINDOW_NOT_EXPIRED':
      throwWindowNotExpired(supplierPickupWindowNotExpiredMessage());
    default:
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

  switch (result.outcome) {
    case 'NOT_FOUND':
      throw new AppError('Delivery not found.', 404, 'NOT_FOUND');
    case 'FORBIDDEN':
      throw new AppError('Delivery not found.', 404, 'NOT_FOUND');
    case 'INVALID_RESERVATION_STATUS':
      throw new AppError(
        'Only accepted reservations can be updated.',
        409,
        'CONFLICT',
      );
    case 'NOT_ASSIGNED':
      throw new AppError('Delivery has no assigned driver.', 409, 'CONFLICT');
    case 'INVALID_DELIVERY_STATUS':
      throw new AppError(
        'Driver no-show applies only before pickup.',
        409,
        'CONFLICT',
      );
    case 'MISSING_WINDOW':
      throw new AppError('Supplier pickup window is not set.', 409, 'CONFLICT');
    case 'WINDOW_NOT_EXPIRED':
      throwWindowNotExpired(supplierPickupWindowNotExpiredMessage());
    default:
      return loadSupplierReservation(ownerId, result.reservation.id);
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

  switch (result.outcome) {
    case 'NOT_FOUND':
      throw new AppError('Delivery not found.', 404, 'NOT_FOUND');
    case 'INVALID_RESERVATION_STATUS':
      throw new AppError(
        'Only active reservations can be updated.',
        409,
        'CONFLICT',
      );
    case 'INVALID_DELIVERY_STATUS':
      throw new AppError(
        'Pickup failed applies only before pickup.',
        409,
        'CONFLICT',
      );
    case 'MISSING_WINDOW':
      throw new AppError('Supplier pickup window is not set.', 409, 'CONFLICT');
    case 'WINDOW_NOT_EXPIRED':
      throwWindowNotExpired(supplierPickupWindowNotExpiredMessage());
    default:
      return loadDriverDelivery(result.delivery.id);
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

  switch (result.outcome) {
    case 'NOT_FOUND':
      throw new AppError('Delivery not found.', 404, 'NOT_FOUND');
    case 'INVALID_RESERVATION_STATUS':
      throw new AppError(
        'Completed reservations cannot be marked failed.',
        409,
        'CONFLICT',
      );
    case 'INVALID_DELIVERY_STATUS':
      throw new AppError(
        'Delivery failed applies only after pickup.',
        409,
        'CONFLICT',
      );
    case 'MISSING_WINDOW':
      throw new AppError('Delivery window is not set.', 409, 'CONFLICT');
    case 'WINDOW_NOT_EXPIRED':
      throwWindowNotExpired(deliveryWindowNotExpiredMessage());
    default:
      return loadDriverDelivery(result.delivery.id);
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

  switch (result.outcome) {
    case 'NOT_FOUND':
      throw new AppError('Delivery not found.', 404, 'NOT_FOUND');
    case 'INVALID_RESERVATION_STATUS':
      throw new AppError(
        'Completed reservations cannot be updated.',
        409,
        'CONFLICT',
      );
    case 'INVALID_DELIVERY_STATUS':
      throw new AppError(
        'Driver issue reports apply only after pickup.',
        409,
        'CONFLICT',
      );
    default:
      return loadDriverDelivery(result.delivery.id);
  }
};
