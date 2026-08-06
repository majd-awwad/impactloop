import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { runSerializableTransaction } from '../../utils/transaction-retry.js';
import { notifyNewJobForReservationWaitingDelivery } from '../notifications/driver-notification-events.service.js';

import { ensureDeliveryForAcceptedReservationIfPaymentReady } from './payments.acceptance.js';
import { isElectronicPaymentEnforced } from './payments.policy.js';
import {
  evaluateDeliveryGroupPaymentReadiness,
  evaluatePickupPaymentReadiness,
} from './payments.readiness.js';
import {
  ensureNextPaymentCycleAfterVerifiedRefund,
  flushPostCommitPaymentRefunds,
} from './payments.lifecycle.js';
import {
  notifyFulfillmentUnlockedDelivery,
  notifyFulfillmentUnlockedPickup,
  notifyLatePaymentAutoRefund,
  notifyPaymentCompleted,
  notifyPaymentResolutionRequired,
  notifyRefundCompleted,
  notifyRefundFailed,
} from './payments.notifications.js';
import { LIFECYCLE_REFUND_REASONS } from './payments.lifecycle.policy.js';

const REOPENABLE_DELIVERY_STATUSES = [
  'AWAITING_RESOLUTION',
  'FAILED_PICKUP',
  'DRIVER_NO_SHOW',
  'CANCELLED',
] as const;

/**
 * After a PaymentOrder is transactionally PAID, reevaluate fulfillment.
 * Safe to call repeatedly (idempotent). Creates Delivery or reopens a
 * payment-deferred recovery Delivery when ready.
 */
export const reevaluateFulfillmentAfterPaymentOrderPaid = async (
  paymentOrderId: string,
): Promise<{
  evaluated: boolean;
  deliveryCreated: boolean;
  deliveryReopened: boolean;
  deliveryAlreadyDispatchable: boolean;
  deliveryGroupId: string | null;
  reservationId: string | null;
}> => {
  if (!isElectronicPaymentEnforced()) {
    return {
      evaluated: false,
      deliveryCreated: false,
      deliveryReopened: false,
      deliveryAlreadyDispatchable: false,
      deliveryGroupId: null,
      reservationId: null,
    };
  }

  const order = await prisma.paymentOrder.findUnique({
    where: { id: paymentOrderId },
    select: {
      id: true,
      status: true,
      purpose: true,
      reservationId: true,
      deliveryGroupId: true,
    },
  });

  if (!order || order.status !== 'PAID') {
    return {
      evaluated: false,
      deliveryCreated: false,
      deliveryReopened: false,
      deliveryAlreadyDispatchable: false,
      deliveryGroupId: null,
      reservationId: null,
    };
  }

  if (order.purpose === 'MATERIAL_SUBTOTAL' && order.reservationId) {
    const reservation = await prisma.reservation.findUnique({
      where: { id: order.reservationId },
      select: reservationFulfillmentSelect,
    });

    if (
      !reservation ||
      reservation.status !== 'ACCEPTED' ||
      reservation.fulfillmentMethod !== 'DELIVERY'
    ) {
      return {
        evaluated: true,
        deliveryCreated: false,
        deliveryReopened: false,
        deliveryAlreadyDispatchable: false,
        deliveryGroupId: reservation?.deliveryGroupId ?? null,
        reservationId: order.reservationId,
      };
    }

    return createOrReopenDeliveryIfReady(reservation);
  }

  if (order.purpose === 'DELIVERY_FEE' && order.deliveryGroupId) {
    const member = await prisma.reservation.findFirst({
      where: {
        deliveryGroupId: order.deliveryGroupId,
        status: 'ACCEPTED',
        fulfillmentMethod: 'DELIVERY',
      },
      orderBy: { acceptedAt: 'asc' },
      select: reservationFulfillmentSelect,
    });

    if (!member) {
      return {
        evaluated: true,
        deliveryCreated: false,
        deliveryReopened: false,
        deliveryAlreadyDispatchable: false,
        deliveryGroupId: order.deliveryGroupId,
        reservationId: null,
      };
    }

    return createOrReopenDeliveryIfReady(member);
  }

  return {
    evaluated: true,
    deliveryCreated: false,
    deliveryReopened: false,
    deliveryAlreadyDispatchable: false,
    deliveryGroupId: order.deliveryGroupId,
    reservationId: order.reservationId,
  };
};

const reservationFulfillmentSelect = {
  id: true,
  status: true,
  fulfillmentMethod: true,
  deliveryGroupId: true,
  requesterId: true,
  deliveryAddressText: true,
  dropoffCity: true,
  dropoffArea: true,
  deliveryNote: true,
  ownerId: true,
  material: {
    select: {
      location: {
        select: {
          country: true,
          city: true,
          area: true,
          addressLine: true,
          latitude: true,
          longitude: true,
          isApproximate: true,
        },
      },
    },
  },
} as const;

type FulfillmentReservation = {
  id: string;
  status: string;
  fulfillmentMethod: string;
  requesterId: string;
  deliveryGroupId: string | null;
  deliveryAddressText: string | null;
  dropoffCity: string | null;
  dropoffArea: string | null;
  deliveryNote: string | null;
  ownerId: string;
  material: {
    location: {
      country: string;
      city: string;
      area: string | null;
      addressLine: string | null;
      latitude: unknown;
      longitude: unknown;
      isApproximate: boolean;
    };
  };
};

const createOrReopenDeliveryIfReady = async (
  reservation: FulfillmentReservation,
) => {
  if (reservation.deliveryGroupId) {
    const readiness = await evaluateDeliveryGroupPaymentReadiness(
      reservation.deliveryGroupId,
    );
    if (!readiness.overallReady) {
      return {
        evaluated: true,
        deliveryCreated: false,
        deliveryReopened: false,
        deliveryAlreadyDispatchable: false,
        deliveryGroupId: reservation.deliveryGroupId,
        reservationId: reservation.id,
      };
    }
  } else {
    const material = await evaluatePickupPaymentReadiness(reservation.id);
    if (!material.ready) {
      return {
        evaluated: true,
        deliveryCreated: false,
        deliveryReopened: false,
        deliveryAlreadyDispatchable: false,
        deliveryGroupId: null,
        reservationId: reservation.id,
      };
    }
  }

  let deliveryCreated = false;
  let deliveryReopened = false;
  let deliveryAlreadyDispatchable = false;

  try {
    await runSerializableTransaction(async (tx) => {
      const fresh = await tx.reservation.findUnique({
        where: { id: reservation.id },
        select: {
          id: true,
          status: true,
          fulfillmentMethod: true,
          deliveryGroupId: true,
          requesterId: true,
          deliveryAddressText: true,
          dropoffCity: true,
          dropoffArea: true,
          deliveryNote: true,
          ownerId: true,
          material: {
            select: {
              location: {
                select: {
                  country: true,
                  city: true,
                  area: true,
                  addressLine: true,
                  latitude: true,
                  longitude: true,
                  isApproximate: true,
                },
              },
            },
          },
        },
      });

      if (
        !fresh ||
        fresh.status !== 'ACCEPTED' ||
        fresh.fulfillmentMethod !== 'DELIVERY' ||
        fresh.deliveryGroupId !== reservation.deliveryGroupId
      ) {
        return;
      }

      if (fresh.deliveryGroupId) {
        const readiness = await evaluateDeliveryGroupPaymentReadiness(
          fresh.deliveryGroupId,
          tx,
        );
        if (!readiness.overallReady) {
          return;
        }
      } else {
        const material = await evaluatePickupPaymentReadiness(fresh.id, tx);
        if (!material.ready) {
          return;
        }
      }

      const existing = fresh.deliveryGroupId
        ? await tx.delivery.findFirst({
            where: { deliveryGroupId: fresh.deliveryGroupId },
            select: {
              id: true,
              status: true,
              assignedDriverProfileId: true,
              deliveryGroupId: true,
            },
          })
        : await tx.delivery.findFirst({
            where: { reservationId: fresh.id },
            select: {
              id: true,
              status: true,
              assignedDriverProfileId: true,
              deliveryGroupId: true,
            },
          });

      if (existing) {
        if (existing.status === 'WAITING_FOR_DRIVER') {
          deliveryAlreadyDispatchable = true;
          return;
        }

        if (existing.assignedDriverProfileId != null) {
          return;
        }

        if (
          !(REOPENABLE_DELIVERY_STATUSES as readonly string[]).includes(
            existing.status,
          )
        ) {
          return;
        }

        const reopened = await tx.delivery.updateMany({
          where: {
            id: existing.id,
            status: existing.status,
            assignedDriverProfileId: null,
          },
          data: {
            status: 'WAITING_FOR_DRIVER',
            assignedDriverProfileId: null,
            assignedAt: null,
            failedAt: null,
            failureReason: null,
            cancelledAt: null,
          },
        });
        if (reopened.count !== 1) {
          return;
        }

        await tx.deliveryStatusHistory.create({
          data: {
            deliveryId: existing.id,
            oldStatus: existing.status,
            newStatus: 'WAITING_FOR_DRIVER',
            changedByUserId: fresh.ownerId,
            note: 'Delivery reopened after required payment obligations were paid',
          },
        });

        if (existing.deliveryGroupId) {
          await tx.deliveryGroup.updateMany({
            where: {
              id: existing.deliveryGroupId,
              status: 'CANCELLED',
              assignedDriverProfileId: null,
            },
            data: { status: 'OPEN', assignedDriverProfileId: null },
          });
        }

        deliveryReopened = true;
        return;
      }

      const result = await ensureDeliveryForAcceptedReservationIfPaymentReady(
        tx,
        {
          reservation: {
            id: fresh.id,
            requesterId: fresh.requesterId,
            deliveryGroupId: fresh.deliveryGroupId,
            deliveryAddressText: fresh.deliveryAddressText,
            dropoffCity: fresh.dropoffCity,
            dropoffArea: fresh.dropoffArea,
            deliveryNote: fresh.deliveryNote,
            material: {
              location: {
                country: fresh.material.location.country,
                city: fresh.material.location.city,
                area: fresh.material.location.area,
                addressLine: fresh.material.location.addressLine,
                latitude: fresh.material.location.latitude as never,
                longitude: fresh.material.location.longitude as never,
                isApproximate: fresh.material.location.isApproximate,
              },
            },
          },
          changedByUserId: fresh.ownerId,
          statusHistoryNote:
            'Delivery created after required payment obligations were paid',
        },
      );
      deliveryCreated = result.createdOrExisting && !result.deferred;
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes('Unique') ||
      message.includes('no longer available') ||
      (typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002')
    ) {
      return {
        evaluated: true,
        deliveryCreated: false,
        deliveryReopened: false,
        deliveryAlreadyDispatchable: false,
        deliveryGroupId: reservation.deliveryGroupId,
        reservationId: reservation.id,
      };
    }
    throw error;
  }

  if (deliveryCreated || deliveryReopened) {
    await notifyNewJobForReservationWaitingDelivery(reservation.id);
  }

  return {
    evaluated: true,
    deliveryCreated,
    deliveryReopened,
    deliveryAlreadyDispatchable,
    deliveryGroupId: reservation.deliveryGroupId,
    reservationId: reservation.id,
  };
};

/**
 * Post-commit hook for verified provider processing.
 * Re-runs for PROCESSED success and IGNORED_DUPLICATE when a PaymentOrder ID
 * is known, so transient Delivery orchestration failures remain retryable.
 */
export const afterVerifiedPaymentEventProcessed = async (input: {
  processingStatus: string;
  paymentOrderId?: string;
  postCommitAutoRefund?: boolean;
  reason?: string;
}): Promise<void> => {
  if (
    (input.processingStatus !== 'PROCESSED' &&
      input.processingStatus !== 'IGNORED_DUPLICATE') ||
    !input.paymentOrderId ||
    !isElectronicPaymentEnforced()
  ) {
    return;
  }

  if (input.postCommitAutoRefund) {
    await notifyLatePaymentAutoRefund(input.paymentOrderId);
    await flushPostCommitPaymentRefunds([
      {
        orderId: input.paymentOrderId,
        reason:
          input.reason ??
          LIFECYCLE_REFUND_REASONS.LATE_SUCCESS_AFTER_SOURCE_TERMINAL,
        actorUserId: 'payment-lifecycle',
      },
    ]);
    return;
  }

  if (
    input.reason === LIFECYCLE_REFUND_REASONS.LATE_SUCCESS_RESOLUTION_REQUIRED ||
    input.reason === 'LATE_SUCCESS_AFTER_FULFILLED_NO_REFUND'
  ) {
    const order = await prisma.paymentOrder.findUnique({
      where: { id: input.paymentOrderId },
      select: { reservationId: true, deliveryGroupId: true, purpose: true },
    });
    let reservationId = order?.reservationId ?? null;
    if (!reservationId && order?.deliveryGroupId) {
      const member = await prisma.reservation.findFirst({
        where: { deliveryGroupId: order.deliveryGroupId },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      reservationId = member?.id ?? null;
    }
    if (reservationId) {
      await notifyPaymentResolutionRequired({
        reservationId,
        paymentOrderId: input.paymentOrderId,
        episodeKey: input.paymentOrderId,
      });
    }
    return;
  }

  const order = await prisma.paymentOrder.findUnique({
    where: { id: input.paymentOrderId },
    select: {
      id: true,
      status: true,
      purpose: true,
      cycleNumber: true,
      reservationId: true,
      deliveryGroupId: true,
    },
  });

  if (!order) {
    return;
  }

  if (order.status === 'REFUNDED') {
    const cycle = await ensureNextPaymentCycleAfterVerifiedRefund(order.id);
    const newCycleCreated = cycle.outcome === 'CREATED';
    await notifyRefundCompleted({
      paymentOrderId: order.id,
      newCycleCreated,
      newCycleNumber: cycle.cycleNumber,
    });
    return;
  }

  if (order.status !== 'PAID') {
    return;
  }

  const existingRefund = await prisma.paymentRefund.findUnique({
    where: { paymentOrderId: order.id },
    select: { id: true, status: true },
  });
  if (existingRefund?.status === 'FAILED') {
    await notifyRefundFailed({
      paymentOrderId: order.id,
      refundId: existingRefund.id,
    });
    return;
  }
  if (
    existingRefund?.status === 'PENDING' ||
    existingRefund?.status === 'REQUESTED'
  ) {
    return;
  }

  await notifyPaymentCompleted(order.id);

  const fulfillment = await reevaluateFulfillmentAfterPaymentOrderPaid(
    order.id,
  );

  if (
    order.purpose === 'MATERIAL_SUBTOTAL' &&
    order.reservationId &&
    fulfillment.evaluated
  ) {
    const reservation = await prisma.reservation.findUnique({
      where: { id: order.reservationId },
      select: { fulfillmentMethod: true, status: true },
    });
    if (
      reservation?.fulfillmentMethod === 'PICKUP' &&
      reservation.status === 'ACCEPTED'
    ) {
      const pickup = await evaluatePickupPaymentReadiness(order.reservationId);
      if (pickup.ready) {
        await notifyFulfillmentUnlockedPickup({
          reservationId: order.reservationId,
          paymentOrderId: order.id,
          cycleNumber: order.cycleNumber,
        });
      }
    }
  }

  if (
    (fulfillment.deliveryCreated ||
      fulfillment.deliveryReopened ||
      fulfillment.deliveryAlreadyDispatchable) &&
    fulfillment.deliveryGroupId
  ) {
    await notifyFulfillmentUnlockedDelivery({
      deliveryGroupId: fulfillment.deliveryGroupId,
      paymentOrderId: order.id,
    });
  }
};
