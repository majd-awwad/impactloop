import { COMMON_ERROR_CODES } from '../../contracts/errors/common-error-codes.js';
import { Prisma, type DeliveryStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { runSerializableTransaction, isPrismaCode } from '../../utils/transaction-retry.js';
import {
  buildDeliveryHandoverCodeData,
  createDeliveryId,
  deriveHandoverCode,
  ensureDeliveryHandoverCodesStored,
} from '../../utils/handover-codes.js';

import type { RequestDeliveryInput } from './deliveries.validation.js';
import {
  maybeSaveDropoffAddressAfterDeliveryRequest,
  resolveSavedDropoffAddressForDelivery,
} from '../saved-dropoff-addresses/saved-dropoff-addresses.service.js';
import { notifyNewDriverJob } from '../notifications/driver-notification-events.service.js';
import { escalateStaleAssignedDriverPickupsByIds } from '../reservations/reservations.stale-assigned-driver-auto-escalation.repository.js';
import { isAssignedDriverPickupOverdue } from '../reservations/reservation-assigned-driver-pickup-overdue.js';
import {
  calculateDeliveryPricing,
  DELIVERY_PRICING_CURRENCY,
} from '../delivery-pricing/delivery-pricing.service.js';
import { normalizeDropoffKey } from '../delivery-pricing/delivery-zone-cities.js';
import { ensureDeliveryFeePaymentOrder } from '../payments/payments.ensure.js';
import { isElectronicPaymentEnforced } from '../payments/payments.policy.js';
import { evaluateDeliveryGroupPaymentReadiness } from '../payments/payments.readiness.js';
import { isPositiveMoney, toMoneyDecimal } from '../payments/payments.money.js';
import { ensureDeliveryForAcceptedReservation } from '../delivery-groups/delivery-group-operations.service.js';
import { isTerminalDeliveryStatus } from './delivery-status.policy.js';
import {
  deriveUnconfirmedDeliveryWindow,
  isLiveDriverLocationStale,
} from './delivery-configuration.js';
export {
  DRIVER_IN_PROGRESS_ASSIGNED_STATUSES,
} from '../driver/driver-availability.js';
export { MAX_ACTIVE_DRIVER_DELIVERIES } from './delivery-configuration.js';
export { TERMINAL_DELIVERY_STATUSES } from './delivery-status.policy.js';
export { isTerminalDeliveryStatus };

export const ACTIVE_DELIVERY_STATUSES = [
  'WAITING_FOR_DRIVER',
  'DRIVER_ASSIGNED',
  'ARRIVED_PICKUP',
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
  'REDELIVERY_PENDING',
  'REDELIVERY_SCHEDULED',
  'RETURN_TO_SUPPLIER_REQUIRED',
] as const satisfies readonly DeliveryStatus[];

/** Driver may send location pings only after supplier pickup is confirmed. */
export const LOCATION_PING_ELIGIBLE_DELIVERY_STATUSES = [
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
  'REDELIVERY_PENDING',
  'REDELIVERY_SCHEDULED',
  'RETURN_TO_SUPPLIER_REQUIRED',
] as const satisfies readonly DeliveryStatus[];

/** @deprecated Use LOCATION_PING_ELIGIBLE_DELIVERY_STATUSES for pings. */
export const TRACKING_ELIGIBLE_DELIVERY_STATUSES =
  LOCATION_PING_ELIGIBLE_DELIVERY_STATUSES;

/** Learner may see driver coordinates only after material is picked up. */
export const LEARNER_DRIVER_COORDINATE_VISIBLE_STATUSES = [
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
  'REDELIVERY_PENDING',
  'REDELIVERY_SCHEDULED',
  'RETURN_TO_SUPPLIER_REQUIRED',
] as const satisfies readonly DeliveryStatus[];

export const canLearnerTrackDriver = (status: DeliveryStatus) =>
  (LEARNER_DRIVER_COORDINATE_VISIBLE_STATUSES as readonly DeliveryStatus[]).includes(
    status,
  );

export const learnerTrackingMessage = (status: DeliveryStatus) => {
  switch (status) {
    case 'WAITING_FOR_DRIVER':
      return 'Waiting for driver.';
    case 'DRIVER_ASSIGNED':
      return 'Driver is heading to supplier pickup.';
    case 'ARRIVED_PICKUP':
      return 'Driver is heading to supplier pickup.';
    case 'PICKED_UP':
      return 'Driver picked up the material and is heading your way.';
    case 'ON_THE_WAY':
      return 'Driver is on the way to your drop-off location.';
    case 'ARRIVED_DROPOFF':
      return 'Driver has arrived at your drop-off location.';
    case 'REDELIVERY_PENDING':
      return 'Delivery could not be completed. The driver is arranging another attempt.';
    case 'REDELIVERY_SCHEDULED':
      return 'Delivery has been rescheduled.';
    case 'RETURN_TO_SUPPLIER_REQUIRED':
      return 'Delivery could not be completed. The material is being returned to the supplier.';
    case 'RETURNED_TO_SUPPLIER':
      return 'The material was returned to the supplier and the case is under review.';
    case 'DELIVERED':
      return 'Delivery completed.';
    case 'CANCELLED':
      return 'Delivery cancelled.';
    case 'FAILED_PICKUP':
      return 'Pickup could not be completed.';
    case 'FAILED_DELIVERY':
      return 'Delivery could not be completed.';
    case 'DRIVER_NO_SHOW':
      return 'Driver did not complete the delivery.';
    case 'LEARNER_NO_SHOW':
      return 'Delivery could not be completed.';
    case 'AWAITING_RESOLUTION':
      return 'Delivery is awaiting resolution.';
    default:
      return 'Delivery status updated.';
  }
};

/** Assigned in-progress deliveries that count toward the driver active queue. */
const deliveryScalarSelect = {
  id: true,
  reservationId: true,
  status: true,
  requestedAt: true,
  assignedAt: true,
  arrivedPickupAt: true,
  pickedUpAt: true,
  onTheWayAt: true,
  arrivedDropoffAt: true,
  deliveredAt: true,
  cancelledAt: true,
  failedAt: true,
  learnerNote: true,
  driverNote: true,
  failureReason: true,
  supplierHandoverCodeHash: true,
  learnerDeliveryCodeHash: true,
  createdAt: true,
} satisfies Prisma.DeliverySelect;

const deliverySelect = {
  ...deliveryScalarSelect,
  reservation: {
    select: {
      id: true,
      status: true,
      pickupWindowStart: true,
      pickupWindowEnd: true,
      supplierPickupWindowStart: true,
      supplierPickupWindowEnd: true,
      confirmedDeliveryWindowStart: true,
      confirmedDeliveryWindowEnd: true,
      completedAt: true,
      material: {
        select: {
          id: true,
          title: true,
          status: true,
          unit: true,
        },
      },
      owner: {
        select: {
          id: true,
          displayName: true,
          supplierProfile: {
            select: {
              publicName: true,
              organizationProfile: {
                select: { organizationName: true },
              },
            },
          },
        },
      },
    },
  },
  pickupLocation: true,
  dropoffLocation: true,
  assignedDriverProfile: {
    select: {
      id: true,
      vehicleType: true,
      vehicleLabel: true,
      vehiclePlate: true,
      user: {
        select: {
          displayName: true,
          phone: true,
        },
      },
    },
  },
  statusHistory: {
    orderBy: { createdAt: 'asc' as const },
  },
  locationPings: {
    orderBy: { capturedAt: 'desc' as const },
    take: 1,
  },
} satisfies Prisma.DeliverySelect;

export type DeliveryRecord = Prisma.DeliveryGetPayload<{
  select: typeof deliverySelect;
}>;

const loadDeliveryRecord = async (
  deliveryId: string,
): Promise<DeliveryRecord> => {
  return prisma.delivery.findUniqueOrThrow({
    where: { id: deliveryId },
    select: deliverySelect,
  });
};

const resolveSupplierDisplayName = (
  owner: DeliveryRecord['reservation']['owner'],
) =>
  owner.supplierProfile?.organizationProfile?.organizationName ??
  owner.supplierProfile?.publicName ??
  owner.displayName;

const mapLocation = (location: DeliveryRecord['pickupLocation']) => ({
  id: location.id,
  country: location.country,
  city: location.city,
  area: location.area,
  addressLine: location.addressLine,
  latitude:
    location.latitude == null
      ? null
      : typeof location.latitude === 'number'
        ? location.latitude
        : location.latitude.toNumber(),
  longitude:
    location.longitude == null
      ? null
      : typeof location.longitude === 'number'
        ? location.longitude
        : location.longitude.toNumber(),
  visibility: location.visibility,
  isApproximate: location.isApproximate,
});

const mapLatestDriverPing = (
  delivery: DeliveryRecord,
  options: { includeTrackingCoordinates?: boolean } = {},
) => {
  if (
    options.includeTrackingCoordinates !== true ||
    !canLearnerTrackDriver(delivery.status)
  ) {
    return null;
  }

  const ping = delivery.locationPings[0];
  if (!ping) {
    return null;
  }

  return {
    latitude: Number(ping.latitude),
    longitude: Number(ping.longitude),
    capturedAt: ping.capturedAt.toISOString(),
    accuracyMeters:
      ping.accuracyMeters == null ? null : Number(ping.accuracyMeters),
    coordinatesVisible: true,
    trackingLockedReason: null,
  };
};

const mapLatestDriverLocation = (delivery: DeliveryRecord) => {
  if (!canLearnerTrackDriver(delivery.status)) {
    return null;
  }

  const ping = delivery.locationPings[0];
  if (!ping) {
    return null;
  }

  return {
    latitude: Number(ping.latitude),
    longitude: Number(ping.longitude),
    capturedAt: ping.capturedAt.toISOString(),
    accuracyMeters:
      ping.accuracyMeters == null ? null : Number(ping.accuracyMeters),
  };
};

export const mapLearnerDelivery = (
  delivery: DeliveryRecord,
  options: { includeTrackingCoordinates?: boolean } = {},
) => ({
  id: delivery.id,
  reservationId: delivery.reservationId,
  status: delivery.status,
  requestedAt: delivery.requestedAt.toISOString(),
  assignedAt: delivery.assignedAt?.toISOString() ?? null,
  arrivedPickupAt: delivery.arrivedPickupAt?.toISOString() ?? null,
  pickedUpAt: delivery.pickedUpAt?.toISOString() ?? null,
  onTheWayAt: delivery.onTheWayAt?.toISOString() ?? null,
  arrivedDropoffAt: delivery.arrivedDropoffAt?.toISOString() ?? null,
  deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
  cancelledAt: delivery.cancelledAt?.toISOString() ?? null,
  failedAt: delivery.failedAt?.toISOString() ?? null,
  learnerNote: delivery.learnerNote,
  driverNote: delivery.driverNote,
  failureReason: delivery.failureReason,
  reservation: {
    id: delivery.reservation.id,
    status: delivery.reservation.status,
    pickupWindowStart:
      delivery.reservation.pickupWindowStart?.toISOString() ?? null,
    pickupWindowEnd:
      delivery.reservation.pickupWindowEnd?.toISOString() ?? null,
    supplierPickupWindowStart:
      delivery.reservation.supplierPickupWindowStart?.toISOString() ?? null,
    supplierPickupWindowEnd:
      delivery.reservation.supplierPickupWindowEnd?.toISOString() ?? null,
    confirmedDeliveryWindowStart:
      delivery.reservation.confirmedDeliveryWindowStart?.toISOString() ?? null,
    confirmedDeliveryWindowEnd:
      delivery.reservation.confirmedDeliveryWindowEnd?.toISOString() ?? null,
    completedAt: delivery.reservation.completedAt?.toISOString() ?? null,
    material: delivery.reservation.material,
    supplier: {
      id: delivery.reservation.owner.id,
      displayName: resolveSupplierDisplayName(delivery.reservation.owner),
    },
  },
  pickupLocation: mapLocation(delivery.pickupLocation),
  dropoffLocation: mapLocation(delivery.dropoffLocation),
  driver: delivery.assignedDriverProfile
    ? {
        id: delivery.assignedDriverProfile.id,
        displayName: delivery.assignedDriverProfile.user.displayName,
        phone: delivery.assignedDriverProfile.user.phone,
        vehicleType: delivery.assignedDriverProfile.vehicleType,
        vehicleLabel: delivery.assignedDriverProfile.vehicleLabel,
        vehiclePlate: delivery.assignedDriverProfile.vehiclePlate,
      }
    : null,
  canTrack: canLearnerTrackDriver(delivery.status),
  assignedDriverPickupOverdue: isAssignedDriverPickupOverdue({
    supplierPickupWindowEnd: delivery.reservation.supplierPickupWindowEnd,
    pickupWindowEnd: delivery.reservation.pickupWindowEnd,
    deliveryStatus: delivery.status,
  }),
  trackingMessage: learnerTrackingMessage(delivery.status),
  latestDriverPing: mapLatestDriverPing(delivery, {
    includeTrackingCoordinates: options.includeTrackingCoordinates,
  }),
  history: delivery.statusHistory.map((item) => ({
    id: item.id,
    oldStatus: item.oldStatus,
    newStatus: item.newStatus,
    note: item.note,
    createdAt: item.createdAt.toISOString(),
  })),
  learnerDeliveryCode: isTerminalDeliveryStatus(delivery.status)
    ? null
    : deriveHandoverCode('learner-delivery', delivery.id),
});

const buildDeliveryAddressText = (dropoff: {
  country: string;
  city: string;
  area?: string | null;
  addressLine?: string | null;
}): string =>
  [
    dropoff.addressLine?.trim(),
    dropoff.area?.trim(),
    dropoff.city.trim(),
    dropoff.country.trim(),
  ]
    .filter((part): part is string => Boolean(part && part.length > 0))
    .join(', ');

const resolveDeliveryWindow = (reservation: {
  pickupWindowStart: Date | null;
  pickupWindowEnd: Date | null;
  confirmedDeliveryWindowStart: Date | null;
  confirmedDeliveryWindowEnd: Date | null;
}): { start: Date; end: Date } => {
  if (
    reservation.confirmedDeliveryWindowStart &&
    reservation.confirmedDeliveryWindowEnd
  ) {
    return {
      start: reservation.confirmedDeliveryWindowStart,
      end: reservation.confirmedDeliveryWindowEnd,
    };
  }

  return deriveUnconfirmedDeliveryWindow(reservation.pickupWindowEnd);
};

export type RequestDeliveryResult = ReturnType<typeof mapLearnerDelivery>;

/**
 * Convert an accepted PICKUP reservation into delivery fulfillment.
 *
 * Payment architecture:
 * - Creates/joins a DeliveryGroup and persists deliveryFee.
 * - Ensures one DELIVERY_FEE PaymentOrder when fee > 0 and enforcement is on.
 * - Creates WAITING_FOR_DRIVER Delivery only when the group is payment-ready
 *   (fee + materials + confirmation) or electronic payment enforcement is
 *   disabled (legacy).
 * - Throws DELIVERY_FEE_REQUIRED (no Delivery, no driver notify) when a
 *   payable fee/material order is outstanding so the learner can checkout.
 * - Throws DELIVERY_PAYMENT_NOT_READY when the group is not dispatchable for
 *   a non-checkout reason (e.g. awaiting confirmation).
 */
export const requestDeliveryForReservation = async (
  learnerId: string,
  reservationId: string,
  input: RequestDeliveryInput,
): Promise<RequestDeliveryResult> => {
  const resolvedDropoffLocation = input.savedDropoffAddressId
    ? await resolveSavedDropoffAddressForDelivery(
        learnerId,
        input.savedDropoffAddressId,
      )
    : input.dropoffLocation!;

  const deliveryAddressText = buildDeliveryAddressText(resolvedDropoffLocation);
  if (!deliveryAddressText.trim()) {
    throw new AppError(
      'A delivery drop-off address is required.',
      400,
      COMMON_ERROR_CODES.validationError,
      { field: 'dropoffLocation' },
    );
  }

  type TxOutcome =
    | {
        outcome: 'CREATED';
        deliveryId: string;
        freeDelivery: boolean;
      }
    | {
        outcome: 'PAYMENT_REQUIRED';
        reservationId: string;
        deliveryGroupId: string;
        paymentOrderId: string;
        amount: string;
        currency: string;
      }
    | {
        outcome: 'GROUP_PAYMENT_NOT_READY';
        deliveryGroupId: string;
        overallStatus: string;
        outstandingReservationIds: string[];
        awaitingConfirmationReservationIds: string[];
      }
    | {
        outcome:
          | 'NOT_FOUND'
          | 'INVALID_STATUS'
          | 'DELIVERY_NOT_ALLOWED'
          | 'ACTIVE_DELIVERY_EXISTS'
          | 'DELIVERY_PRICING_ERROR';
        message?: string;
      };

  let result: TxOutcome;

  try {
    result = await runSerializableTransaction(async (tx) => {
      const reservation = await tx.reservation.findFirst({
        where: {
          id: reservationId,
          requesterId: learnerId,
        },
        select: {
          id: true,
          status: true,
          fulfillmentMethod: true,
          paymentMethod: true,
          materialId: true,
          deliveryGroupId: true,
          materialSubtotal: true,
          deliveryFee: true,
          totalAmount: true,
          pricingCurrency: true,
          deliveryAddressText: true,
          dropoffCity: true,
          dropoffArea: true,
          deliveryNote: true,
          pickupWindowStart: true,
          pickupWindowEnd: true,
          confirmedDeliveryWindowStart: true,
          confirmedDeliveryWindowEnd: true,
          requesterId: true,
        },
      });

      if (!reservation) {
        return { outcome: 'NOT_FOUND' as const };
      }

      if (reservation.status !== 'ACCEPTED') {
        return { outcome: 'INVALID_STATUS' as const };
      }

      const material = await tx.material.findUnique({
        where: { id: reservation.materialId },
        select: {
          deliveryAllowed: true,
          locationId: true,
          supplierProfileId: true,
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
      });

      if (!material?.deliveryAllowed) {
        return { outcome: 'DELIVERY_NOT_ALLOWED' as const };
      }

      if (!material.location || !material.supplierProfileId) {
        return { outcome: 'NOT_FOUND' as const };
      }

      const activeDeliveryCount = await tx.delivery.count({
        where: {
          OR: [
            { reservationId: reservation.id },
            ...(reservation.deliveryGroupId
              ? [{ deliveryGroupId: reservation.deliveryGroupId }]
              : []),
          ],
          status: { in: [...ACTIVE_DELIVERY_STATUSES] },
        },
      });

      if (activeDeliveryCount > 0) {
        return { outcome: 'ACTIVE_DELIVERY_EXISTS' as const };
      }

      const dropoffCity = resolvedDropoffLocation.city.trim();
      const dropoffArea = resolvedDropoffLocation.area?.trim() || null;
      const dropoffKey = normalizeDropoffKey(dropoffCity, dropoffArea);
      const learnerNote = input.learnerNote?.trim() || null;
      const currency =
        reservation.pricingCurrency?.trim() || DELIVERY_PRICING_CURRENCY;

      let deliveryGroupId = reservation.deliveryGroupId;
      let deliveryFeeDecimal = toMoneyDecimal(reservation.deliveryFee ?? 0);
      let joinedExistingGroup = false;

      // Already converted to DELIVERY with a group: reuse fee order; never
      // create a second group/fee for retries.
      if (
        reservation.fulfillmentMethod === 'DELIVERY' &&
        reservation.deliveryGroupId
      ) {
        deliveryGroupId = reservation.deliveryGroupId;
        const group = await tx.deliveryGroup.findUnique({
          where: { id: deliveryGroupId },
          select: { deliveryFee: true, currency: true },
        });
        if (!group) {
          return { outcome: 'NOT_FOUND' as const };
        }
        deliveryFeeDecimal = toMoneyDecimal(group.deliveryFee);
        joinedExistingGroup = true;
      } else if (reservation.fulfillmentMethod === 'DELIVERY') {
        return { outcome: 'INVALID_STATUS' as const };
      } else {
        // PICKUP → DELIVERY conversion: price fee and create/join group.
        const pricing = calculateDeliveryPricing({
          supplierPickupCity: material.location.city,
          dropoffCity,
          dropoffArea,
        });

        if (!pricing.ok) {
          return {
            outcome: 'DELIVERY_PRICING_ERROR' as const,
            message: pricing.message,
          };
        }

        // Prefer joining an open group for the same learner + supplier +
        // dropoff city+area (normalized) so the shared fee is charged once.
        const candidateGroups = await tx.deliveryGroup.findMany({
          where: {
            learnerId,
            supplierProfileId: material.supplierProfileId,
            status: 'OPEN',
            assignedDriverProfileId: null,
            delivery: null,
            paymentMethod: reservation.paymentMethod,
            reservations: {
              some: {
                status: 'ACCEPTED',
                fulfillmentMethod: 'DELIVERY',
              },
            },
          },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            deliveryFee: true,
            currency: true,
            dropoffCity: true,
            dropoffArea: true,
          },
        });
        const compatibleGroup = candidateGroups.find(
          (group) =>
            normalizeDropoffKey(group.dropoffCity, group.dropoffArea) ===
            dropoffKey,
        );

        const window = resolveDeliveryWindow(reservation);

        if (compatibleGroup) {
          deliveryGroupId = compatibleGroup.id;
          deliveryFeeDecimal = toMoneyDecimal(0);
          joinedExistingGroup = true;

          await tx.reservation.update({
            where: { id: reservation.id },
            data: {
              fulfillmentMethod: 'DELIVERY',
              deliveryGroupId: compatibleGroup.id,
              deliveryAddressText,
              dropoffCity,
              dropoffArea,
              deliveryNote: learnerNote,
              deliveryFee: deliveryFeeDecimal,
              totalAmount: toMoneyDecimal(reservation.materialSubtotal ?? 0).add(
                deliveryFeeDecimal,
              ),
              pricingCurrency: compatibleGroup.currency || currency,
              confirmedDeliveryWindowStart: window.start,
              confirmedDeliveryWindowEnd: window.end,
            },
          });
        } else {
          deliveryFeeDecimal = toMoneyDecimal(pricing.deliveryFee);
          const createdGroup = await tx.deliveryGroup.create({
            data: {
              learnerId,
              supplierProfileId: material.supplierProfileId,
              dropoffCity,
              dropoffArea,
              deliveryAddressText,
              deliveryFee: deliveryFeeDecimal,
              currency,
              paymentMethod: reservation.paymentMethod,
              deliveryZone: pricing.zone,
              status: 'OPEN',
              windowStart: window.start,
              windowEnd: window.end,
            },
          });
          deliveryGroupId = createdGroup.id;

          await tx.reservation.update({
            where: { id: reservation.id },
            data: {
              fulfillmentMethod: 'DELIVERY',
              deliveryGroupId: createdGroup.id,
              deliveryAddressText,
              dropoffCity,
              dropoffArea,
              deliveryNote: learnerNote,
              deliveryFee: deliveryFeeDecimal,
              totalAmount: toMoneyDecimal(reservation.materialSubtotal ?? 0).add(
                deliveryFeeDecimal,
              ),
              pricingCurrency: currency,
              deliveryZone: pricing.zone,
              confirmedDeliveryWindowStart: window.start,
              confirmedDeliveryWindowEnd: window.end,
            },
          });
        }
      }

      if (!deliveryGroupId) {
        return { outcome: 'NOT_FOUND' as const };
      }

      // Refresh reservation fields after conversion for delivery ensure.
      const fresh = await tx.reservation.findUniqueOrThrow({
        where: { id: reservation.id },
        select: {
          id: true,
          requesterId: true,
          deliveryGroupId: true,
          deliveryAddressText: true,
          dropoffCity: true,
          dropoffArea: true,
          deliveryNote: true,
        },
      });

      const groupFee = await tx.deliveryGroup.findUniqueOrThrow({
        where: { id: deliveryGroupId },
        select: { deliveryFee: true, currency: true },
      });
      const groupFeeAmount = toMoneyDecimal(groupFee.deliveryFee);
      const freeDelivery = !isPositiveMoney(groupFeeAmount);

      const enforcement = isElectronicPaymentEnforced();

      if (enforcement) {
        if (isPositiveMoney(groupFeeAmount)) {
          const ensured = await ensureDeliveryFeePaymentOrder(
            deliveryGroupId,
            tx,
          );
          if (ensured.outcome === 'NOT_FOUND') {
            return { outcome: 'NOT_FOUND' as const };
          }

          if (
            (ensured.outcome === 'CREATED' ||
              ensured.outcome === 'EXISTING') &&
            ensured.order.paymentMethod === 'CARD' &&
            ensured.order.status !== 'PAID'
          ) {
            return {
              outcome: 'PAYMENT_REQUIRED' as const,
              reservationId: reservation.id,
              deliveryGroupId,
              paymentOrderId: ensured.order.id,
              amount: ensured.order.amount,
              currency: ensured.order.currency,
            };
          }
        }

        // Fee is zero or already PAID — still require full group readiness
        // (materials + confirmation) before opening WAITING_FOR_DRIVER.
        const readiness = await evaluateDeliveryGroupPaymentReadiness(
          deliveryGroupId,
          tx,
        );
        if (!readiness.overallReady) {
          const ownMaterial = readiness.materials.find(
            (row) => row.reservationId === reservation.id,
          );
          const preferredPayable =
            (ownMaterial &&
            !ownMaterial.ready &&
            ownMaterial.paymentOrderId
              ? ownMaterial
              : null) ??
            (!readiness.fee.ready && readiness.fee.paymentOrderId
              ? readiness.fee
              : null) ??
            readiness.materials.find(
              (row) => !row.ready && row.paymentOrderId,
            ) ??
            null;

          const paymentOrderId =
            preferredPayable?.paymentOrderId ??
            readiness.outstandingPaymentOrderIds[0] ??
            null;

          if (paymentOrderId) {
            const matchedMaterial = readiness.materials.find(
              (row) => row.paymentOrderId === paymentOrderId,
            );
            const amount =
              matchedMaterial?.amount ??
              (readiness.fee.paymentOrderId === paymentOrderId
                ? readiness.fee.amount
                : null) ??
              preferredPayable?.amount ??
              '0.00';
            const orderCurrency =
              matchedMaterial?.currency ??
              (readiness.fee.paymentOrderId === paymentOrderId
                ? readiness.fee.currency
                : null) ??
              preferredPayable?.currency ??
              currency;

            return {
              outcome: 'PAYMENT_REQUIRED' as const,
              reservationId: reservation.id,
              deliveryGroupId,
              paymentOrderId,
              amount,
              currency: orderCurrency,
            };
          }

          return {
            outcome: 'GROUP_PAYMENT_NOT_READY' as const,
            deliveryGroupId,
            overallStatus: readiness.overallStatus,
            outstandingReservationIds: readiness.outstandingReservationIds,
            awaitingConfirmationReservationIds:
              readiness.awaitingConfirmationReservationIds,
          };
        }
      }

      // Group payment-ready / enforcement off → create operational Delivery.
      const created = await ensureDeliveryForAcceptedReservation(tx, {
        reservation: {
          id: fresh.id,
          requesterId: fresh.requesterId,
          deliveryGroupId: fresh.deliveryGroupId,
          deliveryAddressText: fresh.deliveryAddressText,
          dropoffCity: fresh.dropoffCity,
          dropoffArea: fresh.dropoffArea,
          deliveryNote: fresh.deliveryNote ?? learnerNote,
          material: {
            location: material.location,
          },
        },
        changedByUserId: learnerId,
        statusHistoryNote: joinedExistingGroup
          ? 'Delivery opened after learner joined an existing delivery group'
          : 'Delivery requested by learner after pickup reservation',
      });

      return {
        outcome: 'CREATED' as const,
        deliveryId: created.id,
        freeDelivery,
      };
    });
  } catch (error) {
    if (isPrismaCode(error, 'P2002')) {
      throw new AppError(
        'This reservation already has an active delivery.',
        409,
        COMMON_ERROR_CODES.conflict,
      );
    }

    throw error;
  }

  switch (result.outcome) {
    case 'CREATED': {
      if (input.dropoffLocation && input.saveDropoffAddressLabel?.trim()) {
        await maybeSaveDropoffAddressAfterDeliveryRequest(learnerId, {
          label: input.saveDropoffAddressLabel.trim(),
          location: {
            country: resolvedDropoffLocation.country,
            city: resolvedDropoffLocation.city,
            area: resolvedDropoffLocation.area ?? null,
            addressLine: resolvedDropoffLocation.addressLine ?? null,
            latitude: resolvedDropoffLocation.latitude ?? null,
            longitude: resolvedDropoffLocation.longitude ?? null,
            isApproximate: resolvedDropoffLocation.isApproximate,
          },
        });
      }

      const delivery = await loadDeliveryRecord(result.deliveryId);
      await notifyNewDriverJob(delivery.id);

      return mapLearnerDelivery(delivery);
    }
    case 'PAYMENT_REQUIRED': {
      if (input.dropoffLocation && input.saveDropoffAddressLabel?.trim()) {
        await maybeSaveDropoffAddressAfterDeliveryRequest(learnerId, {
          label: input.saveDropoffAddressLabel.trim(),
          location: {
            country: resolvedDropoffLocation.country,
            city: resolvedDropoffLocation.city,
            area: resolvedDropoffLocation.area ?? null,
            addressLine: resolvedDropoffLocation.addressLine ?? null,
            latitude: resolvedDropoffLocation.latitude ?? null,
            longitude: resolvedDropoffLocation.longitude ?? null,
            isApproximate: resolvedDropoffLocation.isApproximate,
          },
        });
      }

      throw new AppError(
        'Delivery fee payment is required before fulfillment can start.',
        409,
        'DELIVERY_FEE_REQUIRED',
        {
          reservationId: result.reservationId,
          deliveryGroupId: result.deliveryGroupId,
          paymentOrderId: result.paymentOrderId,
          amount: result.amount,
          currency: result.currency,
          freeDelivery: false,
        },
      );
    }
    case 'GROUP_PAYMENT_NOT_READY':
      throw new AppError(
        'Delivery cannot start until all payment obligations for the group are satisfied.',
        409,
        'DELIVERY_PAYMENT_NOT_READY',
        {
          deliveryGroupId: result.deliveryGroupId,
          overallStatus: result.overallStatus,
          outstandingReservationIds: result.outstandingReservationIds,
          awaitingConfirmationReservationIds:
            result.awaitingConfirmationReservationIds,
        },
      );
    case 'NOT_FOUND':
      throw new AppError(
        'Reservation not found.',
        404,
        COMMON_ERROR_CODES.notFound,
      );
    case 'INVALID_STATUS':
      throw new AppError(
        'Delivery can only be requested after the supplier accepts the reservation.',
        409,
        COMMON_ERROR_CODES.conflict,
      );
    case 'DELIVERY_NOT_ALLOWED':
      throw new AppError(
        'Delivery is not enabled for this material.',
        400,
        COMMON_ERROR_CODES.validationError,
      );
    case 'ACTIVE_DELIVERY_EXISTS':
      throw new AppError(
        'This reservation already has an active delivery.',
        409,
        COMMON_ERROR_CODES.conflict,
      );
    case 'DELIVERY_PRICING_ERROR':
      throw new AppError(
        result.message ?? 'Delivery fee could not be calculated for this location.',
        400,
        'DELIVERY_PRICING_ERROR',
      );
    default:
      throw new AppError(
        'Unable to request delivery.',
        500,
        COMMON_ERROR_CODES.internalError,
      );
  }
};

export const listMyDeliveries = async (learnerId: string) => {
  let deliveries = await prisma.delivery.findMany({
    where: { requestedByUserId: learnerId },
    select: deliverySelect,
    orderBy: { createdAt: 'desc' },
  });

  const reservationIds = [
    ...new Set(deliveries.map((delivery) => delivery.reservationId)),
  ];

  if (reservationIds.length > 0) {
    await escalateStaleAssignedDriverPickupsByIds(reservationIds);
    deliveries = await prisma.delivery.findMany({
      where: { requestedByUserId: learnerId },
      select: deliverySelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  if (deliveries.length) {
    await prisma.$transaction(async (tx) => {
      for (const delivery of deliveries) {
        if (
          !delivery.supplierHandoverCodeHash ||
          !delivery.learnerDeliveryCodeHash
        ) {
          await ensureDeliveryHandoverCodesStored(tx, delivery.id);
        }
      }
    });
  }

  return deliveries.map((delivery) => mapLearnerDelivery(delivery));
};

export const getMyDelivery = async (learnerId: string, deliveryId: string) => {
  let delivery = await prisma.delivery.findFirst({
    where: {
      id: deliveryId,
      requestedByUserId: learnerId,
    },
    select: deliverySelect,
  });

  if (!delivery) {
    throw new AppError(
      'Delivery not found.',
      404,
      COMMON_ERROR_CODES.notFound,
    );
  }

  await escalateStaleAssignedDriverPickupsByIds([delivery.reservationId]);

  delivery = await prisma.delivery.findFirst({
    where: {
      id: deliveryId,
      requestedByUserId: learnerId,
    },
    select: deliverySelect,
  });

  if (!delivery) {
    throw new AppError(
      'Delivery not found.',
      404,
      COMMON_ERROR_CODES.notFound,
    );
  }

  if (
    !delivery.supplierHandoverCodeHash ||
    !delivery.learnerDeliveryCodeHash
  ) {
    await prisma.$transaction(async (tx) => {
      await ensureDeliveryHandoverCodesStored(tx, delivery.id);
    });
  }

  return mapLearnerDelivery(delivery, { includeTrackingCoordinates: true });
};

export const getLearnerDeliveryTracking = async (
  learnerId: string,
  deliveryId: string,
) => {
  const delivery = await prisma.delivery.findFirst({
    where: {
      id: deliveryId,
      requestedByUserId: learnerId,
    },
    select: deliverySelect,
  });

  if (!delivery) {
    throw new AppError(
      'Delivery not found.',
      404,
      COMMON_ERROR_CODES.notFound,
    );
  }

  const canTrack = canLearnerTrackDriver(delivery.status);
  const latestDriverLocation = canTrack
    ? mapLatestDriverLocation(delivery)
    : null;
  const locationRecordedAt = latestDriverLocation?.capturedAt
    ? new Date(latestDriverLocation.capturedAt)
    : null;
  const isLocationStale =
    canTrack &&
    locationRecordedAt != null &&
    isLiveDriverLocationStale(locationRecordedAt);

  const dropoffLat =
    delivery.dropoffLocation.latitude == null
      ? null
      : typeof delivery.dropoffLocation.latitude === 'number'
        ? delivery.dropoffLocation.latitude
        : delivery.dropoffLocation.latitude.toNumber();
  const dropoffLng =
    delivery.dropoffLocation.longitude == null
      ? null
      : typeof delivery.dropoffLocation.longitude === 'number'
        ? delivery.dropoffLocation.longitude
        : delivery.dropoffLocation.longitude.toNumber();

  let trackingMessage = learnerTrackingMessage(delivery.status);
  if (canTrack && latestDriverLocation == null) {
    trackingMessage = 'Waiting for driver location.';
  }

  return {
    deliveryId: delivery.id,
    reservationId: delivery.reservationId,
    materialTitle: delivery.reservation.material.title,
    status: delivery.status,
    canTrack,
    trackingMessage,
    driverDisplayName:
      delivery.assignedDriverProfile?.user.displayName ?? null,
    latestDriverLocation,
    isLocationStale,
    pickupCity: delivery.pickupLocation.city,
    pickupArea: delivery.pickupLocation.area,
    dropoffCity: delivery.dropoffLocation.city,
    dropoffArea: delivery.dropoffLocation.area,
    dropoffLatitude: dropoffLat,
    dropoffLongitude: dropoffLng,
  };
};
