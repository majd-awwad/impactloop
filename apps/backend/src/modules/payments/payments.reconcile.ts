import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';

import {
  ensureDeliveryFeePaymentOrder,
  ensureMaterialPaymentOrder,
} from './payments.ensure.js';
import { isElectronicPaymentEnforced } from './payments.policy.js';

export type ReconcilePaymentObligationsResult = {
  dryRun: boolean;
  paymentEnforcementEnabled: boolean;
  scannedAcceptedReservations: number;
  materialWouldCreate: string[];
  materialCreated: string[];
  materialExisting: string[];
  materialNotRequired: string[];
  feeGroupsWouldCreate: string[];
  feeGroupsCreated: string[];
  feeGroupsExisting: string[];
  feeGroupsNotRequired: string[];
  skippedTerminal: number;
  skippedFulfillmentStarted: string[];
};

const TERMINAL_RESERVATION_STATUSES = [
  'REJECTED',
  'CANCELLED',
  'COMPLETED',
  'EXPIRED',
  'NO_SHOW',
  'FULFILLMENT_FAILED',
] as const;

const FULFILLMENT_STARTED_DELIVERY_STATUSES = [
  'DRIVER_ASSIGNED',
  'ARRIVED_PICKUP',
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
  'DELIVERED',
] as const;

/**
 * Explicit admin/dev reconciliation for already-ACCEPTED rows.
 * Does not create obligations merely by reading a reservation.
 * Does not invoke provider checkout.
 * Skips reservations whose Delivery is already assigned/in progress.
 * Prefer reseeding local demo DBs when practical.
 */
export const reconcileAcceptedPaymentObligations = async (input?: {
  dryRun?: boolean;
  reservationIds?: string[];
}): Promise<ReconcilePaymentObligationsResult> => {
  const dryRun = input?.dryRun !== false;

  const result: ReconcilePaymentObligationsResult = {
    dryRun,
    paymentEnforcementEnabled: isElectronicPaymentEnforced(),
    scannedAcceptedReservations: 0,
    materialWouldCreate: [],
    materialCreated: [],
    materialExisting: [],
    materialNotRequired: [],
    feeGroupsWouldCreate: [],
    feeGroupsCreated: [],
    feeGroupsExisting: [],
    feeGroupsNotRequired: [],
    skippedTerminal: 0,
    skippedFulfillmentStarted: [],
  };

  if (!isElectronicPaymentEnforced()) {
    return result;
  }

  const reservations = await prisma.reservation.findMany({
    where: {
      status: 'ACCEPTED',
      ...(input?.reservationIds?.length
        ? { id: { in: input.reservationIds } }
        : {}),
    },
    select: {
      id: true,
      status: true,
      fulfillmentMethod: true,
      deliveryGroupId: true,
      materialSubtotal: true,
    },
  });

  result.scannedAcceptedReservations = reservations.length;
  const seenFeeGroups = new Set<string>();

  for (const reservation of reservations) {
    if (
      (TERMINAL_RESERVATION_STATUSES as readonly string[]).includes(
        reservation.status,
      )
    ) {
      result.skippedTerminal += 1;
      continue;
    }

    const startedDelivery = await prisma.delivery.findFirst({
      where: reservation.deliveryGroupId
        ? {
            deliveryGroupId: reservation.deliveryGroupId,
            OR: [
              { assignedDriverProfileId: { not: null } },
              {
                status: {
                  in: [...FULFILLMENT_STARTED_DELIVERY_STATUSES],
                },
              },
            ],
          }
        : {
            reservationId: reservation.id,
            OR: [
              { assignedDriverProfileId: { not: null } },
              {
                status: {
                  in: [...FULFILLMENT_STARTED_DELIVERY_STATUSES],
                },
              },
            ],
          },
      select: { id: true },
    });

    if (startedDelivery) {
      result.skippedFulfillmentStarted.push(reservation.id);
      continue;
    }

    if (dryRun) {
      const existingMaterial = await prisma.paymentOrder.findFirst({
        where: {
          purpose: 'MATERIAL_SUBTOTAL',
          reservationId: reservation.id,
          cycleNumber: 1,
        },
        select: { id: true },
      });
      const subtotal = Number(reservation.materialSubtotal ?? 0);
      if (subtotal <= 0) {
        result.materialNotRequired.push(reservation.id);
      } else if (existingMaterial) {
        result.materialExisting.push(reservation.id);
      } else {
        result.materialWouldCreate.push(reservation.id);
      }
    } else {
      const material = await ensureMaterialPaymentOrder(reservation.id);
      if (material.outcome === 'CREATED') {
        result.materialCreated.push(reservation.id);
      } else if (material.outcome === 'EXISTING') {
        result.materialExisting.push(reservation.id);
      } else if (material.outcome === 'NOT_REQUIRED') {
        result.materialNotRequired.push(reservation.id);
      } else {
        throw new AppError(
          'Reservation disappeared during payment reconciliation.',
          500,
          'PAYMENT_SOURCE_INVARIANT_VIOLATION',
          { reservationId: reservation.id },
        );
      }
    }

    if (
      reservation.fulfillmentMethod === 'DELIVERY' &&
      reservation.deliveryGroupId &&
      !seenFeeGroups.has(reservation.deliveryGroupId)
    ) {
      seenFeeGroups.add(reservation.deliveryGroupId);
      const groupId = reservation.deliveryGroupId;

      if (dryRun) {
        const group = await prisma.deliveryGroup.findUnique({
          where: { id: groupId },
          select: { deliveryFee: true },
        });
        const existingFee = await prisma.paymentOrder.findFirst({
          where: {
            purpose: 'DELIVERY_FEE',
            deliveryGroupId: groupId,
            cycleNumber: 1,
          },
          select: { id: true },
        });
        const fee = Number(group?.deliveryFee ?? 0);
        if (fee <= 0) {
          result.feeGroupsNotRequired.push(groupId);
        } else if (existingFee) {
          result.feeGroupsExisting.push(groupId);
        } else {
          result.feeGroupsWouldCreate.push(groupId);
        }
      } else {
        const fee = await ensureDeliveryFeePaymentOrder(groupId);
        if (fee.outcome === 'CREATED') {
          result.feeGroupsCreated.push(groupId);
        } else if (fee.outcome === 'EXISTING') {
          result.feeGroupsExisting.push(groupId);
        } else if (fee.outcome === 'NOT_REQUIRED') {
          result.feeGroupsNotRequired.push(groupId);
        } else {
          throw new AppError(
            'Delivery group disappeared during payment reconciliation.',
            500,
            'PAYMENT_SOURCE_INVARIANT_VIOLATION',
            { deliveryGroupId: groupId },
          );
        }
      }
    }
  }

  return result;
};
