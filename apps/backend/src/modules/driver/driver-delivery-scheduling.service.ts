import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { runSerializableTransaction } from '../../utils/transaction-retry.js';
import {
  applyOperationalWindowToCarriedReservations,
  assertValidOperationalWindow,
  updateDeliveryScheduleOccurrence,
} from '../deliveries/delivery-operational-window.js';
import { notifyDriverDropoffTime } from '../notifications/driver-notification-events.service.js';
import { createNotificationIfMissing } from '../notifications/notifications.repository.js';
import {
  driverDeliveryInclude,
  mapDriverDeliveryForResponse,
} from './driver.service.js';
import type { SetDriverDeliveryWindowInput } from './driver.validation.js';

export const setDriverDeliveryWindow = async (
  driverUserId: string,
  deliveryId: string,
  input: SetDriverDeliveryWindowInput,
) => {
  const start = new Date(input.start);
  const end = new Date(input.end);
  const now = new Date();

  const result = await runSerializableTransaction(async (tx) => {
    const profile = await tx.driverProfile.findFirst({
      where: { userId: driverUserId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!profile) return { outcome: 'NOT_FOUND' as const };

    const delivery = await tx.delivery.findFirst({
      where: { id: deliveryId, assignedDriverProfileId: profile.id },
      select: {
        id: true,
        status: true,
        scheduleOccurrence: true,
        reservation: {
          select: {
            requesterId: true,
            confirmedDeliveryWindowStart: true,
            confirmedDeliveryWindowEnd: true,
          },
        },
        assignments: {
          where: { status: 'ACTIVE' },
          select: { driverProfileId: true },
        },
        attempts: {
          orderBy: { attemptNumber: 'asc' },
          select: {
            id: true,
            attemptNumber: true,
            retryDeadline: true,
          },
        },
      },
    });
    if (!delivery) return { outcome: 'NOT_FOUND' as const };
    if (
      delivery.assignments.length !== 1 ||
      delivery.assignments[0]?.driverProfileId !== profile.id
    ) {
      return { outcome: 'NOT_FOUND' as const };
    }

    const isRetry = delivery.status === 'REDELIVERY_PENDING';
    if (delivery.status !== 'PICKED_UP' && !isRetry) {
      return { outcome: 'INVALID_STATUS' as const };
    }

    const firstAttempt = delivery.attempts[0] ?? null;
    if (isRetry && (!firstAttempt || firstAttempt.attemptNumber !== 1)) {
      return { outcome: 'INVALID_STATUS' as const };
    }

    assertValidOperationalWindow({
      start,
      end,
      now,
      requireFutureStart: isRetry,
      retryDeadline: isRetry ? firstAttempt?.retryDeadline : null,
    });

    const isSameWindow =
      delivery.reservation.confirmedDeliveryWindowStart?.getTime() ===
        start.getTime() &&
      delivery.reservation.confirmedDeliveryWindowEnd?.getTime() ===
        end.getTime();
    if (isSameWindow && !isRetry) {
      return {
        outcome: 'SCHEDULED' as const,
        learnerId: delivery.reservation.requesterId,
        occurrence: delivery.scheduleOccurrence,
        isRetry: false,
      };
    }

    await applyOperationalWindowToCarriedReservations(tx, {
      deliveryId,
      start,
      end,
    });

    if (isRetry) {
      const changed = await tx.deliveryAttempt.updateMany({
        where: {
          id: firstAttempt!.id,
          deliveryId,
          attemptNumber: 1,
          retryWindowStart: null,
          retryWindowEnd: null,
        },
        data: { retryWindowStart: start, retryWindowEnd: end },
      });
      if (changed.count !== 1) {
        throw new AppError(
          'Redelivery was already scheduled.',
          409,
          'REDELIVERY_ALREADY_SCHEDULED',
        );
      }
    }

    const schedule = await updateDeliveryScheduleOccurrence(tx, {
      deliveryId,
      driverProfileId: profile.id,
      expectedStatus: delivery.status,
      nextStatus: isRetry ? 'REDELIVERY_SCHEDULED' : undefined,
    });

    if (isRetry) {
      await tx.deliveryStatusHistory.create({
        data: {
          deliveryId,
          oldStatus: 'REDELIVERY_PENDING',
          newStatus: 'REDELIVERY_SCHEDULED',
          changedByUserId: driverUserId,
          note: input.note?.trim() || 'Redelivery window scheduled',
        },
      });
    }

    return {
      outcome: 'SCHEDULED' as const,
      learnerId: delivery.reservation.requesterId,
      occurrence: schedule.scheduleOccurrence,
      isRetry,
    };
  });

  if (result.outcome === 'NOT_FOUND') {
    throw new AppError('Delivery not found.', 404, 'NOT_FOUND');
  }
  if (result.outcome === 'INVALID_STATUS') {
    throw new AppError(
      'The delivery window can only be set after pickup or while redelivery is pending.',
      409,
      'DELIVERY_WINDOW_NOT_ALLOWED',
    );
  }

  await createNotificationIfMissing({
    userId: result.learnerId,
    notificationType: result.isRetry
      ? 'DELIVERY_WINDOW_RESCHEDULED'
      : 'DELIVERY_WINDOW_SCHEDULED',
    title: result.isRetry ? 'Delivery rescheduled' : 'Delivery scheduled',
    body: result.isRetry
      ? `Your delivery has been rescheduled to ${input.start}–${input.end}.`
      : `Your delivery window has been scheduled for ${input.start}–${input.end}.`,
    relatedEntityType: 'DELIVERY',
    relatedEntityId: deliveryId,
    eventKey: `delivery-window:${deliveryId}:${result.occurrence}:${result.learnerId}`,
    metadata: {
      scheduleOccurrence: result.occurrence,
      windowStart: input.start,
      windowEnd: input.end,
      isRetry: result.isRetry,
    },
  });
  await notifyDriverDropoffTime(deliveryId);

  const updated = await prisma.delivery.findUniqueOrThrow({
    where: { id: deliveryId },
    include: driverDeliveryInclude,
  });
  return mapDriverDeliveryForResponse(updated);
};
