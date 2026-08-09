import type { PaymentOrderStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';

import {
  isPaymentAdminActor,
  type PaymentActor,
} from './payments.actor.js';
import { isPayablePaymentOrderStatus } from './payments.constants.js';
import { moneyDecimalToString } from './payments.money.js';
import { isElectronicPaymentEnforced } from './payments.policy.js';
import {
  classifyReservationPaymentLifecycle,
  isTerminalPaymentOrderForNewCycle,
} from './payments.lifecycle.policy.js';
import {
  evaluateDeliveryGroupPaymentReadiness,
  evaluatePickupPaymentReadiness,
  type PaymentReadinessStatus,
} from './payments.readiness.js';
import { isPickupCodeVisibilityWindowOpen } from './payments.list-summary.js';

export type ReservationPaymentRequirementDto = {
  reservationId: string;
  reservationStatus: string;
  paymentEnforcementEnabled: boolean;
  overallStatus:
    | PaymentReadinessStatus
    | 'BLOCKED'
    | 'AWAITING_ACCEPTANCE'
    | 'CANCELLED'
    | 'REFUNDED'
    | 'NEW_PAYMENT_CYCLE_REQUIRED'
    | 'RESOLUTION_REQUIRED'
    | 'PAYMENT_FAILED';
  fulfillmentMethod: 'PICKUP' | 'DELIVERY';
  material: {
    required: boolean;
    status: PaymentReadinessStatus;
    paymentOrderId: string | null;
    amount: string | null;
    currency: string | null;
    cycleNumber: number | null;
    canStartCheckout: boolean;
  };
  deliveryFee: {
    applicable: boolean;
    deliveryGroupId: string | null;
    required: boolean;
    status: PaymentReadinessStatus;
    paymentOrderId: string | null;
    amount: string | null;
    currency: string | null;
    cycleNumber: number | null;
    canStartCheckout: boolean;
  } | null;
  orders: Array<{
    id: string;
    purpose: 'MATERIAL_SUBTOTAL' | 'DELIVERY_FEE';
    amount: string;
    currency: string;
    status: PaymentOrderStatus;
    cycleNumber: number;
    isCurrent: boolean;
    canStartCheckout: boolean;
    paidAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  paymentReady: boolean;
  fulfillmentReady: boolean;
  pickupCodeAvailable: boolean;
  deliveryExists: boolean;
  deliveryStatus: string | null;
  deliveryDispatchable: boolean;
  fulfillmentStarted: boolean;
  outstandingPaymentOrderIds: string[];
  evaluatedAt: string;
};

const DISPATCHABLE_DELIVERY_STATUSES = new Set(['WAITING_FOR_DRIVER']);

const FULFILLMENT_STARTED_STATUSES = new Set([
  'WAITING_FOR_DRIVER',
  'DRIVER_ASSIGNED',
  'ARRIVED_PICKUP',
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
  'DELIVERED',
]);

const assertLearnerOwnerOrAdmin = (
  reservationRequesterId: string,
  actor: PaymentActor,
) => {
  if (reservationRequesterId === actor.userId) {
    return;
  }
  if (isPaymentAdminActor(actor)) {
    return;
  }
  throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
};

const mapOrderRows = (
  materialOrders: Array<{
    id: string;
    amount: { toFixed?: (n: number) => string } | unknown;
    currency: string;
    status: PaymentOrderStatus;
    cycleNumber: number;
    paidAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>,
  feeOrders: Array<{
    id: string;
    amount: { toFixed?: (n: number) => string } | unknown;
    currency: string;
    status: PaymentOrderStatus;
    cycleNumber: number;
    paidAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>,
) => {
  const currentMaterialCycle = materialOrders[0]?.cycleNumber ?? null;
  const currentFeeCycle = feeOrders[0]?.cycleNumber ?? null;
  return [
    ...materialOrders.map((order) => ({
      id: order.id,
      purpose: 'MATERIAL_SUBTOTAL' as const,
      amount: moneyDecimalToString(order.amount as never),
      currency: order.currency,
      status: order.status,
      cycleNumber: order.cycleNumber,
      isCurrent: order.cycleNumber === currentMaterialCycle,
      canStartCheckout: isPayablePaymentOrderStatus(order.status),
      paidAt: order.paidAt?.toISOString() ?? null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    })),
    ...feeOrders.map((order) => ({
      id: order.id,
      purpose: 'DELIVERY_FEE' as const,
      amount: moneyDecimalToString(order.amount as never),
      currency: order.currency,
      status: order.status,
      cycleNumber: order.cycleNumber,
      isCurrent: order.cycleNumber === currentFeeCycle,
      canStartCheckout: isPayablePaymentOrderStatus(order.status),
      paidAt: order.paidAt?.toISOString() ?? null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    })),
  ];
};

export const getReservationPaymentRequirement = async (
  reservationId: string,
  actor: PaymentActor,
): Promise<ReservationPaymentRequirementDto> => {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      requesterId: true,
      status: true,
      fulfillmentMethod: true,
      deliveryGroupId: true,
      materialSubtotal: true,
      pricingCurrency: true,
      pickupWindowStart: true,
      pickupWindowEnd: true,
    },
  });

  if (!reservation) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  assertLearnerOwnerOrAdmin(reservation.requesterId, actor);

  const enforcement = isElectronicPaymentEnforced();
  const evaluatedAt = new Date().toISOString();

  const materialOrders = await prisma.paymentOrder.findMany({
    where: {
      purpose: 'MATERIAL_SUBTOTAL',
      reservationId: reservation.id,
    },
    orderBy: { cycleNumber: 'desc' },
  });

  const feeOrders =
    reservation.deliveryGroupId != null
      ? await prisma.paymentOrder.findMany({
          where: {
            purpose: 'DELIVERY_FEE',
            deliveryGroupId: reservation.deliveryGroupId,
          },
          orderBy: { cycleNumber: 'desc' },
        })
      : [];

  const currentMaterial = materialOrders[0] ?? null;
  const currentFee = feeOrders[0] ?? null;
  const mapCheckout = (order: { status: PaymentOrderStatus } | null) =>
    order != null && isPayablePaymentOrderStatus(order.status);

  const delivery = reservation.deliveryGroupId
    ? await prisma.delivery.findFirst({
        where: { deliveryGroupId: reservation.deliveryGroupId },
        select: {
          id: true,
          status: true,
          assignedDriverProfileId: true,
        },
        orderBy: { createdAt: 'desc' },
      })
    : await prisma.delivery.findFirst({
        where: { reservationId: reservation.id },
        select: {
          id: true,
          status: true,
          assignedDriverProfileId: true,
        },
        orderBy: { createdAt: 'desc' },
      });

  const deliveryExists = delivery != null;
  const deliveryStatus = delivery?.status ?? null;
  const fulfillmentStarted =
    delivery != null &&
    (FULFILLMENT_STARTED_STATUSES.has(delivery.status) ||
      delivery.assignedDriverProfileId != null);

  if (reservation.fulfillmentMethod === 'PICKUP') {
    const pickup = await evaluatePickupPaymentReadiness(reservation.id);
    const lifecycleClass = classifyReservationPaymentLifecycle(
      reservation.status,
    );
    let overallStatus: ReservationPaymentRequirementDto['overallStatus'] =
      pickup.status === 'INVARIANT_VIOLATION'
        ? 'BLOCKED'
        : pickup.status === 'NOT_YET_PAYABLE'
          ? 'AWAITING_ACCEPTANCE'
          : pickup.status;

    if (lifecycleClass === 'PRE_FULFILLMENT_TERMINAL') {
      overallStatus =
        currentMaterial?.status === 'REFUNDED'
          ? 'REFUNDED'
          : currentMaterial?.status === 'REFUND_PENDING'
            ? 'REFUND_PENDING'
            : currentMaterial?.status === 'CANCELLED'
              ? 'CANCELLED'
              : 'CANCELLED';
    } else if (lifecycleClass === 'RESOLUTION_REQUIRED') {
      overallStatus = 'RESOLUTION_REQUIRED';
    } else if (
      reservation.status === 'ACCEPTED' &&
      currentMaterial &&
      isTerminalPaymentOrderForNewCycle(currentMaterial.status)
    ) {
      overallStatus = 'NEW_PAYMENT_CYCLE_REQUIRED';
    }

    return {
      reservationId: reservation.id,
      reservationStatus: reservation.status,
      paymentEnforcementEnabled: enforcement,
      overallStatus,
      fulfillmentMethod: 'PICKUP',
      material: {
        required:
          pickup.status !== 'NOT_REQUIRED' &&
          pickup.status !== 'PAYMENT_DISABLED' &&
          pickup.status !== 'NOT_YET_PAYABLE',
        status: pickup.status,
        paymentOrderId: pickup.paymentOrderId,
        amount: pickup.amount,
        currency: pickup.currency,
        cycleNumber: pickup.cycleNumber,
        canStartCheckout:
          reservation.status === 'ACCEPTED' && mapCheckout(currentMaterial),
      },
      deliveryFee: null,
      orders: mapOrderRows(materialOrders, []),
      paymentReady: pickup.ready,
      fulfillmentReady:
        reservation.status === 'ACCEPTED' && pickup.ready,
      pickupCodeAvailable:
        reservation.status === 'ACCEPTED' &&
        pickup.ready &&
        isPickupCodeVisibilityWindowOpen(
          reservation.pickupWindowStart,
          reservation.pickupWindowEnd,
        ),
      deliveryExists: false,
      deliveryStatus: null,
      deliveryDispatchable: false,
      fulfillmentStarted: false,
      outstandingPaymentOrderIds: pickup.ready
        ? []
        : pickup.paymentOrderId
          ? [pickup.paymentOrderId]
          : [],
      evaluatedAt,
    };
  }

  const groupReadiness =
    reservation.deliveryGroupId != null
      ? await evaluateDeliveryGroupPaymentReadiness(reservation.deliveryGroupId)
      : null;

  const materialPickup = await evaluatePickupPaymentReadiness(reservation.id);
  const materialReady = materialPickup.ready;
  const feeApplicable = reservation.deliveryGroupId != null;
  const feeStatus = groupReadiness?.fee.status ?? 'NOT_REQUIRED';
  const feeReady = groupReadiness?.fee.ready ?? true;

  const paymentReady = groupReadiness
    ? groupReadiness.overallReady
    : materialReady && feeReady;

  const lifecycleClass = classifyReservationPaymentLifecycle(reservation.status);
  let overallStatus: ReservationPaymentRequirementDto['overallStatus'] =
    groupReadiness?.invariantViolations.length ||
    materialPickup.status === 'INVARIANT_VIOLATION'
      ? 'BLOCKED'
      : materialPickup.status === 'NOT_YET_PAYABLE'
        ? 'AWAITING_ACCEPTANCE'
        : groupReadiness
          ? groupReadiness.overallStatus === 'INVARIANT_VIOLATION'
            ? 'BLOCKED'
            : groupReadiness.overallStatus
          : materialPickup.status;

  if (lifecycleClass === 'PRE_FULFILLMENT_TERMINAL') {
    overallStatus =
      currentMaterial?.status === 'REFUNDED'
        ? 'REFUNDED'
        : currentMaterial?.status === 'REFUND_PENDING'
          ? 'REFUND_PENDING'
          : currentMaterial?.status === 'CANCELLED'
            ? 'CANCELLED'
            : 'CANCELLED';
  } else if (lifecycleClass === 'RESOLUTION_REQUIRED') {
    overallStatus = 'RESOLUTION_REQUIRED';
  } else if (
    reservation.status === 'ACCEPTED' &&
    ((currentMaterial &&
      isTerminalPaymentOrderForNewCycle(currentMaterial.status)) ||
      (currentFee && isTerminalPaymentOrderForNewCycle(currentFee.status)))
  ) {
    overallStatus = 'NEW_PAYMENT_CYCLE_REQUIRED';
  }

  const fulfillmentReady =
    reservation.status === 'ACCEPTED' && paymentReady;

  const deliveryDispatchable =
    fulfillmentReady &&
    delivery != null &&
    delivery.assignedDriverProfileId == null &&
    DISPATCHABLE_DELIVERY_STATUSES.has(delivery.status);

  return {
    reservationId: reservation.id,
    reservationStatus: reservation.status,
    paymentEnforcementEnabled: enforcement,
    overallStatus,
    fulfillmentMethod: 'DELIVERY',
    material: {
      required:
        materialPickup.status !== 'NOT_REQUIRED' &&
        materialPickup.status !== 'PAYMENT_DISABLED' &&
        materialPickup.status !== 'NOT_YET_PAYABLE',
      status: materialPickup.status,
      paymentOrderId: materialPickup.paymentOrderId,
      amount: materialPickup.amount,
      currency: materialPickup.currency,
      cycleNumber: materialPickup.cycleNumber,
      canStartCheckout:
        reservation.status === 'ACCEPTED' && mapCheckout(currentMaterial),
    },
    deliveryFee: feeApplicable
      ? {
          applicable: true,
          deliveryGroupId: reservation.deliveryGroupId,
          required:
            feeStatus !== 'NOT_REQUIRED' && feeStatus !== 'PAYMENT_DISABLED',
          status: feeStatus,
          paymentOrderId: groupReadiness?.fee.paymentOrderId ?? null,
          amount: groupReadiness?.fee.amount ?? null,
          currency: groupReadiness?.fee.currency ?? null,
          cycleNumber: groupReadiness?.fee.cycleNumber ?? null,
          canStartCheckout:
            reservation.status === 'ACCEPTED' && mapCheckout(currentFee),
        }
      : {
          applicable: false,
          deliveryGroupId: null,
          required: false,
          status: 'NOT_REQUIRED',
          paymentOrderId: null,
          amount: null,
          currency: null,
          cycleNumber: null,
          canStartCheckout: false,
        },
    orders: mapOrderRows(materialOrders, feeOrders),
    paymentReady,
    fulfillmentReady,
    pickupCodeAvailable: false,
    deliveryExists,
    deliveryStatus,
    deliveryDispatchable,
    fulfillmentStarted,
    outstandingPaymentOrderIds:
      groupReadiness?.outstandingPaymentOrderIds ??
      (materialReady
        ? []
        : materialPickup.paymentOrderId
          ? [materialPickup.paymentOrderId]
          : []),
    evaluatedAt,
  };
};
