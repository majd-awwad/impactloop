import type {
  DeliveryStatus,
  ReservationStatus,
} from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { runSerializableTransaction } from '../../utils/transaction-retry.js';

import {
  ensureDeliveryFeePaymentOrder,
  ensureMaterialPaymentOrder,
} from './payments.ensure.js';
import {
  cancelUnpaidPaymentOrder,
  evaluateMaterialRefundEligibility,
  flushPostCommitPaymentRefunds,
  handleDeliveryGroupPaymentLifecycleTransition,
  prepareFullRefundForPaidOrderInTransaction,
  type PostCommitRefundTask,
} from './payments.lifecycle.js';
import { classifyReservationPaymentLifecycle } from './payments.lifecycle.policy.js';
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
  unpaidCancelCandidates: string[];
  unpaidCancelled: string[];
  refundCandidates: string[];
  refundsPrepared: string[];
  materialResolutionRequiredSkipped: string[];
  materialFulfilledSkipped: string[];
  resolutionRequiredSkipped: string[];
  emptyGroupFeeCandidates: string[];
  emptyGroupFeesApplied: string[];
  missingCycleCandidates: string[];
  missingCyclesCreated: string[];
  cyclesCreatedAfterRefund: string[];
};

const TERMINAL_RESERVATION_STATUSES = [
  'REJECTED',
  'CANCELLED',
  'COMPLETED',
  'EXPIRED',
  'NO_SHOW',
  'FULFILLMENT_FAILED',
] as const satisfies readonly ReservationStatus[];

const FULFILLMENT_STARTED_DELIVERY_STATUSES = [
  'DRIVER_ASSIGNED',
  'ARRIVED_PICKUP',
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
  'REDELIVERY_PENDING',
  'REDELIVERY_SCHEDULED',
  'DELIVERED',
  'FAILED_PICKUP',
  'FAILED_DELIVERY',
  'DRIVER_NO_SHOW',
  'LEARNER_NO_SHOW',
  'AWAITING_RESOLUTION',
] as const satisfies readonly DeliveryStatus[];

const PRE_FULFILLMENT_TERMINAL = [
  'CANCELLED',
  'REJECTED',
  'EXPIRED',
  'NO_SHOW',
] as const;

/**
 * Explicit admin/dev reconciliation for payment obligations.
 * Does not create obligations merely by reading a reservation.
 * Does not invoke provider checkout inside the scan transaction.
 * Skips assigned/in-progress Delivery and resolution holds for auto-apply.
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
    unpaidCancelCandidates: [],
    unpaidCancelled: [],
    refundCandidates: [],
    refundsPrepared: [],
    materialResolutionRequiredSkipped: [],
    materialFulfilledSkipped: [],
    resolutionRequiredSkipped: [],
    emptyGroupFeeCandidates: [],
    emptyGroupFeesApplied: [],
    missingCycleCandidates: [],
    missingCyclesCreated: [],
    cyclesCreatedAfterRefund: [],
  };

  if (!isElectronicPaymentEnforced()) {
    return result;
  }

  const postCommitRefunds: PostCommitRefundTask[] = [];

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
  const createdMaterialOrderIds: string[] = [];
  const createdFeeOrderIds: string[] = [];
  const createdNewCycleOrderIds: string[] = [];

  for (const reservation of reservations) {
    if (
      TERMINAL_RESERVATION_STATUSES.some(
        (status) => status === reservation.status,
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
        },
        orderBy: { cycleNumber: 'desc' },
        select: { id: true, status: true, cycleNumber: true },
      });
      const subtotal = Number(reservation.materialSubtotal ?? 0);
      if (subtotal <= 0) {
        result.materialNotRequired.push(reservation.id);
      } else if (
        existingMaterial &&
        existingMaterial.status !== 'CANCELLED' &&
        existingMaterial.status !== 'REFUNDED'
      ) {
        result.materialExisting.push(reservation.id);
      } else if (
        existingMaterial &&
        (existingMaterial.status === 'CANCELLED' ||
          existingMaterial.status === 'REFUNDED')
      ) {
        result.missingCycleCandidates.push(reservation.id);
        result.materialWouldCreate.push(reservation.id);
      } else {
        result.materialWouldCreate.push(reservation.id);
      }
    } else {
      const material = await ensureMaterialPaymentOrder(reservation.id);
      if (material.outcome === 'CREATED') {
        result.materialCreated.push(reservation.id);
        if (material.order.cycleNumber > 1) {
          result.missingCyclesCreated.push(reservation.id);
          createdNewCycleOrderIds.push(material.order.id);
        } else {
          createdMaterialOrderIds.push(material.order.id);
        }
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
          },
          orderBy: { cycleNumber: 'desc' },
          select: { id: true, status: true, cycleNumber: true },
        });
        const fee = Number(group?.deliveryFee ?? 0);
        if (fee <= 0) {
          result.feeGroupsNotRequired.push(groupId);
        } else if (
          existingFee &&
          existingFee.status !== 'CANCELLED' &&
          existingFee.status !== 'REFUNDED'
        ) {
          result.feeGroupsExisting.push(groupId);
        } else if (
          existingFee &&
          (existingFee.status === 'CANCELLED' ||
            existingFee.status === 'REFUNDED')
        ) {
          result.missingCycleCandidates.push(groupId);
          result.feeGroupsWouldCreate.push(groupId);
        } else {
          result.feeGroupsWouldCreate.push(groupId);
        }
      } else {
        const fee = await ensureDeliveryFeePaymentOrder(groupId);
        if (fee.outcome === 'CREATED') {
          result.feeGroupsCreated.push(groupId);
          if (fee.order.cycleNumber > 1) {
            result.missingCyclesCreated.push(groupId);
            createdNewCycleOrderIds.push(fee.order.id);
          } else {
            createdFeeOrderIds.push(fee.order.id);
          }
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

  if (!dryRun) {
    const {
      notifyPaymentRequiredForCreatedOrders,
      notifyNewPaymentCycleRequired,
    } = await import('./payments.notifications.js');
    await notifyPaymentRequiredForCreatedOrders({
      materialOrderIds: createdMaterialOrderIds,
      feeOrderIds: createdFeeOrderIds,
    });
    for (const orderId of createdNewCycleOrderIds) {
      await notifyNewPaymentCycleRequired(orderId);
    }
  }

  // Terminal sources with active unpaid / paid-needing-refund material orders.
  const terminalReservations = await prisma.reservation.findMany({
    where: {
      status: { in: [...PRE_FULFILLMENT_TERMINAL] },
      ...(input?.reservationIds?.length
        ? { id: { in: input.reservationIds } }
        : {}),
    },
    select: { id: true, status: true },
  });

  for (const reservation of terminalReservations) {
    const classif = classifyReservationPaymentLifecycle(reservation.status);
    if (classif === 'RESOLUTION_REQUIRED') {
      result.resolutionRequiredSkipped.push(reservation.id);
      continue;
    }
    if (classif !== 'PRE_FULFILLMENT_TERMINAL') {
      continue;
    }

    const eligibility = await runSerializableTransaction(async (tx) =>
      evaluateMaterialRefundEligibility(tx, reservation.id),
    );

    if (
      eligibility.eligibility === 'FULFILLMENT_STARTED_RESOLUTION_REQUIRED' ||
      eligibility.eligibility === 'SOURCE_RESOLUTION_REQUIRED'
    ) {
      result.materialResolutionRequiredSkipped.push(reservation.id);
      continue;
    }

    if (eligibility.eligibility === 'FULFILLED_NO_REFUND') {
      result.materialFulfilledSkipped.push(reservation.id);
      continue;
    }

    if (eligibility.eligibility === 'CANCEL_UNPAID' && eligibility.orderId) {
      result.unpaidCancelCandidates.push(eligibility.orderId);
      if (!dryRun) {
        await runSerializableTransaction(async (tx) => {
          await cancelUnpaidPaymentOrder(tx, {
            orderId: eligibility.orderId!,
            reason: 'RECONCILE_TERMINAL_SOURCE_UNPAID',
          });
        });
        result.unpaidCancelled.push(eligibility.orderId);
      }
      continue;
    }

    if (eligibility.eligibility === 'REFUND_PAID' && eligibility.orderId) {
      result.refundCandidates.push(eligibility.orderId);
      if (!dryRun) {
        const prepared = await runSerializableTransaction(async (tx) =>
          prepareFullRefundForPaidOrderInTransaction(tx, {
            orderId: eligibility.orderId!,
            reason: 'RECONCILE_TERMINAL_SOURCE_REFUND',
          }),
        );
        if (prepared.postCommit) {
          postCommitRefunds.push(prepared.postCommit);
        }
        result.refundsPrepared.push(eligibility.orderId);
      }
    }
  }

  // Empty delivery groups retaining fee orders (safe auto-apply only).
  const scopedGroupIds =
    input?.reservationIds?.length
      ? (
          await prisma.reservation.findMany({
            where: { id: { in: input.reservationIds } },
            select: { deliveryGroupId: true },
          })
        )
          .map((row) => row.deliveryGroupId)
          .filter((id): id is string => id != null)
      : null;

  const feeOrders = await prisma.paymentOrder.findMany({
    where: {
      purpose: 'DELIVERY_FEE',
      status: {
        in: ['REQUIRES_PAYMENT', 'CHECKOUT_PENDING', 'PAID', 'REFUND_PENDING'],
      },
      deliveryGroupId: scopedGroupIds
        ? { in: scopedGroupIds }
        : { not: null },
    },
    select: { id: true, deliveryGroupId: true, status: true },
  });

  const seenEmptyGroups = new Set<string>();
  for (const feeOrder of feeOrders) {
    const groupId = feeOrder.deliveryGroupId;
    if (!groupId || seenEmptyGroups.has(groupId)) {
      continue;
    }
    seenEmptyGroups.add(groupId);

    const started = await prisma.delivery.findFirst({
      where: {
        deliveryGroupId: groupId,
        OR: [
          { assignedDriverProfileId: { not: null } },
          { status: { in: [...FULFILLMENT_STARTED_DELIVERY_STATUSES] } },
        ],
      },
      select: { id: true },
    });
    if (started) {
      result.resolutionRequiredSkipped.push(groupId);
      continue;
    }

    const activeMembers = await prisma.reservation.count({
      where: {
        deliveryGroupId: groupId,
        status: {
          in: [
            'ACCEPTED',
            'AWAITING_LEARNER_CONFIRMATION',
            'AWAITING_SUPPLIER_CONFIRMATION',
            'AWAITING_RESOLUTION',
            'FULFILLMENT_FAILED',
          ],
        },
        fulfillmentMethod: 'DELIVERY',
      },
    });
    if (activeMembers > 0) {
      continue;
    }

    result.emptyGroupFeeCandidates.push(groupId);
    if (!dryRun) {
      const groupResult = await runSerializableTransaction(async (tx) =>
        handleDeliveryGroupPaymentLifecycleTransition(tx, {
          deliveryGroupId: groupId,
          actorUserId: null,
          reason: 'RECONCILE_EMPTY_GROUP_FEE',
        }),
      );
      postCommitRefunds.push(...groupResult.postCommitRefunds);
      result.emptyGroupFeesApplied.push(groupId);
    }
  }

  if (!dryRun) {
    await flushPostCommitPaymentRefunds(postCommitRefunds);
  }

  return result;
};
