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

export const ACTIVE_DELIVERY_STATUSES = [
  'WAITING_FOR_DRIVER',
  'DRIVER_ASSIGNED',
  'ARRIVED_PICKUP',
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
] as const satisfies readonly DeliveryStatus[];

export const TERMINAL_DELIVERY_STATUSES = [
  'DELIVERED',
  'CANCELLED',
  'FAILED_PICKUP',
  'FAILED_DELIVERY',
  'DRIVER_NO_SHOW',
  'LEARNER_NO_SHOW',
  'AWAITING_RESOLUTION',
] as const satisfies readonly DeliveryStatus[];

/** Driver may send location pings only after supplier pickup is confirmed. */
export const LOCATION_PING_ELIGIBLE_DELIVERY_STATUSES = [
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
] as const satisfies readonly DeliveryStatus[];

/** @deprecated Use LOCATION_PING_ELIGIBLE_DELIVERY_STATUSES for pings. */
export const TRACKING_ELIGIBLE_DELIVERY_STATUSES =
  LOCATION_PING_ELIGIBLE_DELIVERY_STATUSES;

/** Learner may see driver coordinates only after material is picked up. */
export const LEARNER_DRIVER_COORDINATE_VISIBLE_STATUSES = [
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
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
export const DRIVER_IN_PROGRESS_ASSIGNED_STATUSES = [
  'DRIVER_ASSIGNED',
  'ARRIVED_PICKUP',
  ...LOCATION_PING_ELIGIBLE_DELIVERY_STATUSES,
] as const satisfies readonly DeliveryStatus[];

export const MAX_ACTIVE_DRIVER_DELIVERIES = 3;

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
      displayName: true,
      phone: true,
      vehicleType: true,
      vehicleLabel: true,
      vehiclePlate: true,
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
    completedAt: delivery.reservation.completedAt?.toISOString() ?? null,
    material: delivery.reservation.material,
    supplier: {
      id: delivery.reservation.owner.id,
      displayName: resolveSupplierDisplayName(delivery.reservation.owner),
    },
  },
  pickupLocation: mapLocation(delivery.pickupLocation),
  dropoffLocation: mapLocation(delivery.dropoffLocation),
  driver: delivery.assignedDriverProfile,
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
  learnerDeliveryCode: (TERMINAL_DELIVERY_STATUSES as readonly DeliveryStatus[]).includes(
    delivery.status,
  )
    ? null
    : deriveHandoverCode('learner-delivery', delivery.id),
});

export const requestDeliveryForReservation = async (
  learnerId: string,
  reservationId: string,
  input: RequestDeliveryInput,
) => {
  const resolvedDropoffLocation = input.savedDropoffAddressId
    ? await resolveSavedDropoffAddressForDelivery(
        learnerId,
        input.savedDropoffAddressId,
      )
    : input.dropoffLocation!;

  let result: Awaited<ReturnType<typeof runSerializableTransaction<{
    outcome:
      | 'CREATED'
      | 'NOT_FOUND'
      | 'INVALID_STATUS'
      | 'DELIVERY_NOT_ALLOWED'
      | 'ACTIVE_DELIVERY_EXISTS';
    delivery?: DeliveryRecord;
  }>>>;

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
          material: {
            select: {
              deliveryAllowed: true,
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

      if (!reservation) {
        return { outcome: 'NOT_FOUND' as const };
      }

      if (reservation.status !== 'ACCEPTED') {
        return { outcome: 'INVALID_STATUS' as const };
      }

      if (reservation.fulfillmentMethod === 'DELIVERY') {
        return { outcome: 'INVALID_STATUS' as const };
      }

      if (!reservation.material.deliveryAllowed) {
        return { outcome: 'DELIVERY_NOT_ALLOWED' as const };
      }

      const activeDeliveryCount = await tx.delivery.count({
        where: {
          reservationId: reservation.id,
          status: { in: [...ACTIVE_DELIVERY_STATUSES] },
        },
      });

      if (activeDeliveryCount > 0) {
        return { outcome: 'ACTIVE_DELIVERY_EXISTS' as const };
      }

      const pickupLocation = await tx.location.create({
        data: {
          country: reservation.material.location.country,
          city: reservation.material.location.city,
          area: reservation.material.location.area,
          addressLine: reservation.material.location.addressLine,
          latitude: reservation.material.location.latitude,
          longitude: reservation.material.location.longitude,
          visibility: 'PRIVATE',
          isApproximate: reservation.material.location.isApproximate,
          locationType: 'DELIVERY_PICKUP',
        },
      });

      const dropoffLocation = await tx.location.create({
        data: {
          country: resolvedDropoffLocation.country,
          city: resolvedDropoffLocation.city,
          area: resolvedDropoffLocation.area ?? null,
          addressLine: resolvedDropoffLocation.addressLine ?? null,
          latitude: resolvedDropoffLocation.latitude ?? null,
          longitude: resolvedDropoffLocation.longitude ?? null,
          visibility: 'PRIVATE',
          isApproximate: resolvedDropoffLocation.isApproximate,
          locationType: 'DELIVERY_DROPOFF',
        },
      });

      const deliveryId = createDeliveryId();
      const handoverCodes = await buildDeliveryHandoverCodeData(deliveryId);

      const delivery = await tx.delivery.create({
        data: {
          id: deliveryId,
          ...handoverCodes.data,
          reservationId: reservation.id,
          pickupLocationId: pickupLocation.id,
          dropoffLocationId: dropoffLocation.id,
          requestedByUserId: learnerId,
          status: 'WAITING_FOR_DRIVER',
          learnerNote: input.learnerNote?.trim() || null,
          statusHistory: {
            create: {
              oldStatus: null,
              newStatus: 'WAITING_FOR_DRIVER',
              changedByUserId: learnerId,
              note: 'Delivery requested by learner',
            },
          },
        },
        select: deliverySelect,
      });

      return { outcome: 'CREATED' as const, delivery };
    });
  } catch (error) {
    if (isPrismaCode(error, 'P2002')) {
      throw new AppError(
        'This reservation already has an active delivery.',
        409,
        'CONFLICT',
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
            country: input.dropoffLocation.country,
            city: input.dropoffLocation.city,
            area: input.dropoffLocation.area ?? null,
            addressLine: input.dropoffLocation.addressLine ?? null,
            latitude: input.dropoffLocation.latitude ?? null,
            longitude: input.dropoffLocation.longitude ?? null,
            isApproximate: input.dropoffLocation.isApproximate,
          },
        });
      }

      await notifyNewDriverJob(result.delivery!.id);

      return mapLearnerDelivery(result.delivery!);
    }
    case 'NOT_FOUND':
      throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
    case 'INVALID_STATUS':
      throw new AppError(
        'Delivery can only be requested after the supplier accepts the reservation.',
        409,
        'CONFLICT',
      );
    case 'DELIVERY_NOT_ALLOWED':
      throw new AppError(
        'Delivery is not enabled for this material.',
        400,
        'VALIDATION_ERROR',
      );
    case 'ACTIVE_DELIVERY_EXISTS':
      throw new AppError(
        'This reservation already has an active delivery.',
        409,
        'CONFLICT',
      );
    default:
      throw new AppError('Unable to request delivery.', 500, 'INTERNAL_ERROR');
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
    throw new AppError('Delivery not found.', 404, 'NOT_FOUND');
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
    throw new AppError('Delivery not found.', 404, 'NOT_FOUND');
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
    throw new AppError('Delivery not found.', 404, 'NOT_FOUND');
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
    Date.now() - locationRecordedAt.getTime() > 90_000;

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
    driverDisplayName: delivery.assignedDriverProfile?.displayName ?? null,
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
