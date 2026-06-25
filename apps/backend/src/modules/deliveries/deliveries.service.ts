import { Prisma, type DeliveryStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';

import type { RequestDeliveryInput } from './deliveries.validation.js';

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
] as const satisfies readonly DeliveryStatus[];

const isPrismaCode = (error: unknown, code: string) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: unknown }).code === code;

const runSerializableTransaction = async <T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
) => {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (attempt < maxAttempts && isPrismaCode(error, 'P2034')) {
        continue;
      }

      throw error;
    }
  }

  throw new AppError('Unable to complete transaction.', 500, 'INTERNAL_ERROR');
};

const deliveryInclude = {
  reservation: {
    select: {
      id: true,
      status: true,
      pickupWindowStart: true,
      pickupWindowEnd: true,
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
} satisfies Prisma.DeliveryInclude;

export type DeliveryRecord = Prisma.DeliveryGetPayload<{
  include: typeof deliveryInclude;
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

const mapLatestDriverPing = (delivery: DeliveryRecord) => {
  const ping = delivery.locationPings[0];
  if (!ping) {
    return null;
  }

  return {
    capturedAt: ping.capturedAt.toISOString(),
    accuracyMeters:
      ping.accuracyMeters == null ? null : Number(ping.accuracyMeters),
  };
};

export const mapLearnerDelivery = (delivery: DeliveryRecord) => ({
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
  latestDriverPing: mapLatestDriverPing(delivery),
  history: delivery.statusHistory.map((item) => ({
    id: item.id,
    oldStatus: item.oldStatus,
    newStatus: item.newStatus,
    note: item.note,
    createdAt: item.createdAt.toISOString(),
  })),
});

export const requestDeliveryForReservation = async (
  learnerId: string,
  reservationId: string,
  input: RequestDeliveryInput,
) => {
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
        include: {
          material: {
            include: {
              location: true,
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
          country: input.dropoffLocation.country,
          city: input.dropoffLocation.city,
          area: input.dropoffLocation.area ?? null,
          addressLine: input.dropoffLocation.addressLine ?? null,
          latitude: input.dropoffLocation.latitude ?? null,
          longitude: input.dropoffLocation.longitude ?? null,
          visibility: 'PRIVATE',
          isApproximate: input.dropoffLocation.isApproximate,
          locationType: 'DELIVERY_DROPOFF',
        },
      });

      const delivery = await tx.delivery.create({
        data: {
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
        include: deliveryInclude,
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
    case 'CREATED':
      return mapLearnerDelivery(result.delivery!);
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
  const deliveries = await prisma.delivery.findMany({
    where: { requestedByUserId: learnerId },
    include: deliveryInclude,
    orderBy: { createdAt: 'desc' },
  });

  return deliveries.map(mapLearnerDelivery);
};

export const getMyDelivery = async (learnerId: string, deliveryId: string) => {
  const delivery = await prisma.delivery.findFirst({
    where: {
      id: deliveryId,
      requestedByUserId: learnerId,
    },
    include: deliveryInclude,
  });

  if (!delivery) {
    throw new AppError('Delivery not found.', 404, 'NOT_FOUND');
  }

  return mapLearnerDelivery(delivery);
};
