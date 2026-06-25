import type { DeliveryStatus, Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { ACTIVE_DELIVERY_STATUSES } from '../deliveries/deliveries.service.js';

import type {
  CreateDeliveryLocationPingInput,
  UpdateDriverDeliveryStatusInput,
} from './driver.validation.js';

const terminalStatuses = [
  'DELIVERED',
  'CANCELLED',
  'FAILED_PICKUP',
  'FAILED_DELIVERY',
] as const satisfies readonly DeliveryStatus[];

const allowedTransitions: Partial<Record<DeliveryStatus, DeliveryStatus>> = {
  DRIVER_ASSIGNED: 'ARRIVED_PICKUP',
  ARRIVED_PICKUP: 'PICKED_UP',
  PICKED_UP: 'ON_THE_WAY',
  ON_THE_WAY: 'ARRIVED_DROPOFF',
  ARRIVED_DROPOFF: 'DELIVERED',
};

const driverDeliveryInclude = {
  reservation: {
    select: {
      id: true,
      status: true,
      pickupWindowStart: true,
      pickupWindowEnd: true,
      quantityRequested: true,
      material: {
        select: {
          id: true,
          title: true,
          unit: true,
        },
      },
      requester: {
        select: {
          id: true,
          displayName: true,
          phone: true,
        },
      },
      owner: {
        select: {
          id: true,
          displayName: true,
          phone: true,
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
  assignedDriverProfile: true,
} satisfies Prisma.DeliveryInclude;

type DriverDeliveryRecord = Prisma.DeliveryGetPayload<{
  include: typeof driverDeliveryInclude;
}>;

const resolveSupplierDisplayName = (
  owner: DriverDeliveryRecord['reservation']['owner'],
) =>
  owner.supplierProfile?.organizationProfile?.organizationName ??
  owner.supplierProfile?.publicName ??
  owner.displayName;

const mapSafeLocation = (location: DriverDeliveryRecord['pickupLocation']) => ({
  country: location.country,
  city: location.city,
  area: location.area,
});

const mapExactLocation = (location: DriverDeliveryRecord['pickupLocation']) => ({
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
  isApproximate: location.isApproximate,
});

const mapAvailableDelivery = (delivery: DriverDeliveryRecord) => ({
  id: delivery.id,
  reservationId: delivery.reservationId,
  status: delivery.status,
  requestedAt: delivery.requestedAt.toISOString(),
  pickupWindowStart:
    delivery.reservation.pickupWindowStart?.toISOString() ?? null,
  pickupWindowEnd: delivery.reservation.pickupWindowEnd?.toISOString() ?? null,
  material: {
    id: delivery.reservation.material.id,
    title: delivery.reservation.material.title,
    quantityRequested: Number(delivery.reservation.quantityRequested),
    unit: delivery.reservation.material.unit,
  },
  supplier: {
    displayName: resolveSupplierDisplayName(delivery.reservation.owner),
  },
  pickupLocation: mapSafeLocation(delivery.pickupLocation),
  dropoffLocation: mapSafeLocation(delivery.dropoffLocation),
});

const mapAssignedDelivery = (delivery: DriverDeliveryRecord) => ({
  ...mapAvailableDelivery(delivery),
  assignedAt: delivery.assignedAt?.toISOString() ?? null,
  arrivedPickupAt: delivery.arrivedPickupAt?.toISOString() ?? null,
  pickedUpAt: delivery.pickedUpAt?.toISOString() ?? null,
  onTheWayAt: delivery.onTheWayAt?.toISOString() ?? null,
  arrivedDropoffAt: delivery.arrivedDropoffAt?.toISOString() ?? null,
  deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
  learnerNote: delivery.learnerNote,
  driverNote: delivery.driverNote,
  learner: {
    id: delivery.reservation.requester.id,
    displayName: delivery.reservation.requester.displayName,
    phone: delivery.reservation.requester.phone,
  },
  supplier: {
    id: delivery.reservation.owner.id,
    displayName: resolveSupplierDisplayName(delivery.reservation.owner),
    phone: delivery.reservation.owner.phone,
  },
  pickupLocation: mapExactLocation(delivery.pickupLocation),
  dropoffLocation: mapExactLocation(delivery.dropoffLocation),
});

const findActiveDriverProfile = async (
  userId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) => {
  const profile = await tx.driverProfile.findUnique({
    where: { userId },
  });

  if (!profile || profile.status !== 'ACTIVE') {
    throw new AppError('Active driver profile required.', 403, 'FORBIDDEN');
  }

  return profile;
};

export const listAvailableDeliveries = async (driverUserId: string) => {
  await findActiveDriverProfile(driverUserId);

  const deliveries = await prisma.delivery.findMany({
    where: {
      status: 'WAITING_FOR_DRIVER',
      assignedDriverProfileId: null,
    },
    include: driverDeliveryInclude,
    orderBy: { requestedAt: 'asc' },
  });

  return deliveries.map(mapAvailableDelivery);
};

export const listActiveDriverDeliveries = async (driverUserId: string) => {
  const profile = await findActiveDriverProfile(driverUserId);

  const deliveries = await prisma.delivery.findMany({
    where: {
      assignedDriverProfileId: profile.id,
      status: { in: [...ACTIVE_DELIVERY_STATUSES] },
    },
    include: driverDeliveryInclude,
    orderBy: { updatedAt: 'desc' },
  });

  return deliveries.map(mapAssignedDelivery);
};

export const acceptDelivery = async (
  driverUserId: string,
  deliveryId: string,
) => {
  return prisma.$transaction(async (tx) => {
    const profile = await findActiveDriverProfile(driverUserId, tx);

    const driverAvailabilityUpdate = await tx.driverProfile.updateMany({
      where: {
        id: profile.id,
        status: 'ACTIVE',
        availability: 'AVAILABLE',
      },
      data: { availability: 'ON_DELIVERY' },
    });

    if (driverAvailabilityUpdate.count !== 1) {
      throw new AppError(
        'Driver must be available to accept a delivery.',
        409,
        'CONFLICT',
      );
    }

    const activeDriverDeliveryCount = await tx.delivery.count({
      where: {
        assignedDriverProfileId: profile.id,
        status: { in: [...ACTIVE_DELIVERY_STATUSES] },
      },
    });

    if (activeDriverDeliveryCount > 0) {
      throw new AppError(
        'Driver already has an active delivery.',
        409,
        'CONFLICT',
      );
    }

    const update = await tx.delivery.updateMany({
      where: {
        id: deliveryId,
        status: 'WAITING_FOR_DRIVER',
        assignedDriverProfileId: null,
      },
      data: {
        status: 'DRIVER_ASSIGNED',
        assignedDriverProfileId: profile.id,
        assignedAt: new Date(),
      },
    });

    if (update.count !== 1) {
      throw new AppError(
        'Delivery is no longer available.',
        409,
        'CONFLICT',
      );
    }

    await tx.deliveryAssignment.create({
      data: {
        deliveryId,
        driverProfileId: profile.id,
        assignedByUserId: driverUserId,
        status: 'ACTIVE',
      },
    });

    await tx.deliveryStatusHistory.create({
      data: {
        deliveryId,
        oldStatus: 'WAITING_FOR_DRIVER',
        newStatus: 'DRIVER_ASSIGNED',
        changedByUserId: driverUserId,
        note: 'Accepted by driver',
      },
    });

    const delivery = await tx.delivery.findUniqueOrThrow({
      where: { id: deliveryId },
      include: driverDeliveryInclude,
    });

    return mapAssignedDelivery(delivery);
  });
};

export const updateDriverDeliveryStatus = async (
  driverUserId: string,
  deliveryId: string,
  input: UpdateDriverDeliveryStatusInput,
) => {
  const result = await prisma.$transaction(async (tx) => {
    const profile = await findActiveDriverProfile(driverUserId, tx);
    const delivery = await tx.delivery.findFirst({
      where: {
        id: deliveryId,
        assignedDriverProfileId: profile.id,
      },
      include: {
        reservation: true,
      },
    });

    if (!delivery) {
      return { outcome: 'NOT_FOUND' as const };
    }

    if ((terminalStatuses as readonly DeliveryStatus[]).includes(delivery.status)) {
      return { outcome: 'TERMINAL' as const };
    }

    const expectedNextStatus = allowedTransitions[delivery.status];
    if (expectedNextStatus !== input.status) {
      return { outcome: 'INVALID_TRANSITION' as const };
    }

    const now = new Date();
    const statusData: Prisma.DeliveryUpdateInput = {
      status: input.status,
      driverNote: input.note?.trim() || delivery.driverNote,
    };

    if (input.status === 'ARRIVED_PICKUP') {
      statusData.arrivedPickupAt = now;
    } else if (input.status === 'PICKED_UP') {
      statusData.pickedUpAt = now;
    } else if (input.status === 'ON_THE_WAY') {
      statusData.onTheWayAt = now;
    } else if (input.status === 'ARRIVED_DROPOFF') {
      statusData.arrivedDropoffAt = now;
    } else if (input.status === 'DELIVERED') {
      statusData.deliveredAt = now;
    }

    await tx.delivery.update({
      where: { id: delivery.id },
      data: statusData,
    });

    if (input.status === 'DELIVERED') {
      await tx.reservation.update({
        where: { id: delivery.reservationId },
        data: {
          status: 'COMPLETED',
          completedAt: now,
        },
      });

      await tx.material.update({
        where: { id: delivery.reservation.materialId },
        data: {
          status: 'REUSED',
          reusedAt: now,
          reusedByReservationId: delivery.reservationId,
        },
      });

      await tx.driverProfile.update({
        where: { id: profile.id },
        data: { availability: 'AVAILABLE' },
      });

      await tx.reservationStatusHistory.create({
        data: {
          reservationId: delivery.reservationId,
          statusGroup: 'RESERVATION',
          oldStatus: delivery.reservation.status,
          newStatus: 'COMPLETED',
          changedBy: driverUserId,
          note: 'Delivery completed by driver',
        },
      });
    }

    await tx.deliveryStatusHistory.create({
      data: {
        deliveryId: delivery.id,
        oldStatus: delivery.status,
        newStatus: input.status,
        changedByUserId: driverUserId,
        note: input.note?.trim() || null,
      },
    });

    const updatedDelivery = await tx.delivery.findUniqueOrThrow({
      where: { id: delivery.id },
      include: driverDeliveryInclude,
    });

    return { outcome: 'UPDATED' as const, delivery: updatedDelivery };
  });

  switch (result.outcome) {
    case 'UPDATED':
      return mapAssignedDelivery(result.delivery);
    case 'NOT_FOUND':
      throw new AppError('Delivery not found.', 404, 'NOT_FOUND');
    case 'TERMINAL':
      throw new AppError(
        'Terminal deliveries cannot be updated.',
        409,
        'CONFLICT',
      );
    case 'INVALID_TRANSITION':
      throw new AppError('Invalid delivery status transition.', 409, 'CONFLICT');
    default:
      throw new AppError('Unable to update delivery.', 500, 'INTERNAL_ERROR');
  }
};

export const createDeliveryLocationPing = async (
  driverUserId: string,
  deliveryId: string,
  input: CreateDeliveryLocationPingInput,
) => {
  const profile = await findActiveDriverProfile(driverUserId);

  const delivery = await prisma.delivery.findFirst({
    where: {
      id: deliveryId,
      assignedDriverProfileId: profile.id,
      status: { in: [...ACTIVE_DELIVERY_STATUSES] },
    },
    select: { id: true },
  });

  if (!delivery) {
    throw new AppError('Active assigned delivery not found.', 404, 'NOT_FOUND');
  }

  const ping = await prisma.deliveryLocationPing.create({
    data: {
      deliveryId,
      driverProfileId: profile.id,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracyMeters: input.accuracyMeters ?? null,
      heading: input.heading ?? null,
      speed: input.speed ?? null,
      capturedAt: input.capturedAt ? new Date(input.capturedAt) : new Date(),
    },
  });

  return {
    id: ping.id,
    deliveryId: ping.deliveryId,
    latitude: Number(ping.latitude),
    longitude: Number(ping.longitude),
    accuracyMeters:
      ping.accuracyMeters == null ? null : Number(ping.accuracyMeters),
    heading: ping.heading == null ? null : Number(ping.heading),
    speed: ping.speed == null ? null : Number(ping.speed),
    capturedAt: ping.capturedAt.toISOString(),
    createdAt: ping.createdAt.toISOString(),
  };
};
