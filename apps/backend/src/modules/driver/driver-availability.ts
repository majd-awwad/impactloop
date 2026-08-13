import type {
  DeliveryStatus,
  DriverAvailabilityStatus,
  Prisma,
  PrismaClient,
} from '../../generated/prisma/client.js';

import { MAX_ACTIVE_DRIVER_DELIVERIES } from '../deliveries/delivery-configuration.js';

export { MAX_ACTIVE_DRIVER_DELIVERIES };

export const DRIVER_IN_PROGRESS_ASSIGNED_STATUSES = [
  'DRIVER_ASSIGNED',
  'ARRIVED_PICKUP',
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
  'REDELIVERY_PENDING',
  'REDELIVERY_SCHEDULED',
] as const satisfies readonly DeliveryStatus[];

export const countActiveDriverDeliveries = async (
  tx: Prisma.TransactionClient | PrismaClient,
  driverProfileId: string,
  options: { excludeDeliveryId?: string } = {},
) =>
  tx.delivery.count({
    where: {
      assignedDriverProfileId: driverProfileId,
      status: { in: [...DRIVER_IN_PROGRESS_ASSIGNED_STATUSES] },
      ...(options.excludeDeliveryId
        ? { id: { not: options.excludeDeliveryId } }
        : {}),
    },
  });

export const effectiveDriverAvailability = (
  activeDeliveryCount: number,
  acceptingNewJobs: boolean,
): DriverAvailabilityStatus => {
  if (activeDeliveryCount > 0) {
    return 'ON_DELIVERY';
  }

  return acceptingNewJobs ? 'AVAILABLE' : 'OFFLINE';
};

export const reconcileDriverAvailability = async (
  tx: Prisma.TransactionClient,
  driverProfileId: string,
  options: { excludeDeliveryId?: string } = {},
) => {
  const [profile, activeDeliveryCount] = await Promise.all([
    tx.driverProfile.findUniqueOrThrow({
      where: { id: driverProfileId },
      select: { acceptingNewJobs: true },
    }),
    countActiveDriverDeliveries(tx, driverProfileId, options),
  ]);

  const availability = effectiveDriverAvailability(
    activeDeliveryCount,
    profile.acceptingNewJobs,
  );

  await tx.driverProfile.update({
    where: { id: driverProfileId },
    data: { availability },
  });

  return { availability, activeDeliveryCount };
};
