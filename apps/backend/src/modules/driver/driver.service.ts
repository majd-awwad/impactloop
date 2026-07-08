import type { DeliveryStatus, Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { formatDistanceLabel, haversineDistanceKm } from '../../utils/haversine.js';
import {
  DRIVER_IN_PROGRESS_ASSIGNED_STATUSES,
  MAX_ACTIVE_DRIVER_DELIVERIES,
  LOCATION_PING_ELIGIBLE_DELIVERY_STATUSES,
} from '../deliveries/deliveries.service.js';
import {
  escalateStaleAssignedDriverPickupsByIds,
} from '../reservations/reservations.stale-assigned-driver-auto-escalation.repository.js';
import { isAssignedDriverPickupOverdue } from '../reservations/reservation-assigned-driver-pickup-overdue.js';
import {
  canDriverMarkDeliveryFailed,
  canDriverMarkPickupFailed,
  canDriverReportDriverIssue,
} from '../fulfillment-failures/fulfillment-failures.eligibility.js';
import {
  ensureDeliveryHandoverCodesStored,
  verifyHandoverCode,
} from '../../utils/handover-codes.js';
import {
  deliveryWindowNotStartedMessage,
  deliveryWindowPassedMessage,
  evaluateHandoverWindow,
  supplierPickupWindowNotStartedMessage,
  supplierPickupWindowPassedMessage,
} from '../../utils/handover-timing.js';
import {
  clearUnreadNewJobNotificationsForDelivery,
  notifyDriverDropoffTime,
  notifyDriverPickupTime,
  syncDueDriverTimeRemindersForUser,
} from '../notifications/driver-notification-events.service.js';

import type {
  CreateDeliveryLocationPingInput,
  ListAvailableDeliveriesQuery,
  UpdateDriverDeliveryStatusInput,
} from './driver.validation.js';
import { resolveDriverReferencePoint } from './driver-location.js';
import {
  completeReservationsForDeliveredDelivery,
  syncDeliveryGroupOnDriverAssign,
} from '../delivery-groups/delivery-group-operations.service.js';

const terminalStatuses = [
  'DELIVERED',
  'CANCELLED',
  'FAILED_PICKUP',
  'FAILED_DELIVERY',
  'DRIVER_NO_SHOW',
  'LEARNER_NO_SHOW',
  'AWAITING_RESOLUTION',
] as const satisfies readonly DeliveryStatus[];

const allowedTransitions: Partial<Record<DeliveryStatus, DeliveryStatus>> = {
  DRIVER_ASSIGNED: 'ARRIVED_PICKUP',
  ARRIVED_PICKUP: 'PICKED_UP',
  PICKED_UP: 'ON_THE_WAY',
  ON_THE_WAY: 'ARRIVED_DROPOFF',
  ARRIVED_DROPOFF: 'DELIVERED',
};

export const driverDeliveryInclude = {
  deliveryGroup: {
    select: {
      id: true,
      deliveryFee: true,
      currency: true,
      reservations: {
        where: {
          status: 'ACCEPTED',
          fulfillmentMethod: 'DELIVERY',
        },
        select: {
          id: true,
          quantityRequested: true,
          materialSubtotal: true,
          material: {
            select: {
              id: true,
              title: true,
              unit: true,
              condition: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' as const },
      },
    },
  },
  reservation: {
    select: {
      id: true,
      status: true,
      fulfillmentMethod: true,
      pickupWindowStart: true,
      pickupWindowEnd: true,
      supplierPickupWindowStart: true,
      supplierPickupWindowEnd: true,
      confirmedDeliveryWindowStart: true,
      confirmedDeliveryWindowEnd: true,
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

const locationCoordinate = (
  location: DriverDeliveryRecord['pickupLocation'],
): number | null => {
  if (location.latitude == null) {
    return null;
  }

  return typeof location.latitude === 'number'
    ? location.latitude
    : location.latitude.toNumber();
};

const locationLongitude = (
  location: DriverDeliveryRecord['pickupLocation'],
): number | null => {
  if (location.longitude == null) {
    return null;
  }

  return typeof location.longitude === 'number'
    ? location.longitude
    : location.longitude.toNumber();
};

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

const buildDriverDeliveryItems = (delivery: DriverDeliveryRecord) => {
  if (delivery.deliveryGroup?.reservations.length) {
    return delivery.deliveryGroup.reservations.map((reservation) => ({
      reservationId: reservation.id,
      materialId: reservation.material.id,
      title: reservation.material.title,
      quantity: Number(reservation.quantityRequested),
      unit: reservation.material.unit,
      condition: reservation.material.condition,
      materialSubtotal:
        reservation.materialSubtotal != null
          ? Number(reservation.materialSubtotal)
          : null,
    }));
  }

  return [
    {
      reservationId: delivery.reservation.id,
      materialId: delivery.reservation.material.id,
      title: delivery.reservation.material.title,
      quantity: Number(delivery.reservation.quantityRequested),
      unit: delivery.reservation.material.unit,
      condition: null as string | null,
      materialSubtotal: null as number | null,
    },
  ];
};

const mapAvailableDelivery = (
  delivery: DriverDeliveryRecord,
  options?: { distanceKm?: number | null },
) => {
  const distanceKm = options?.distanceKm ?? null;
  const items = buildDriverDeliveryItems(delivery);
  const groupedDelivery = delivery.deliveryGroupId != null;

  return {
    id: delivery.id,
    reservationId: delivery.reservationId,
    deliveryGroupId: delivery.deliveryGroupId,
    groupedDelivery,
    itemCount: items.length,
    items,
    groupDeliveryFee:
      delivery.deliveryGroup != null
        ? Number(delivery.deliveryGroup.deliveryFee)
        : null,
    groupCurrency: delivery.deliveryGroup?.currency ?? null,
    status: delivery.status,
    requestedAt: delivery.requestedAt.toISOString(),
    pickupWindowStart:
      delivery.reservation.pickupWindowStart?.toISOString() ?? null,
    pickupWindowEnd:
      delivery.reservation.pickupWindowEnd?.toISOString() ?? null,
    supplierPickupWindowStart:
      delivery.reservation.supplierPickupWindowStart?.toISOString() ?? null,
    supplierPickupWindowEnd:
      delivery.reservation.supplierPickupWindowEnd?.toISOString() ?? null,
    learnerNote: delivery.learnerNote,
    material: {
      id: delivery.reservation.material.id,
      title: groupedDelivery
        ? `${items.length} items from this supplier`
        : delivery.reservation.material.title,
      quantityRequested: Number(delivery.reservation.quantityRequested),
      unit: delivery.reservation.material.unit,
    },
    supplier: {
      displayName: resolveSupplierDisplayName(delivery.reservation.owner),
    },
    pickupCity: delivery.pickupLocation.city,
    pickupArea: delivery.pickupLocation.area,
    dropoffCity: delivery.dropoffLocation.city,
    dropoffArea: delivery.dropoffLocation.area,
    distanceKm,
    distanceLabel: formatDistanceLabel(distanceKm),
    pickupLocation: mapSafeLocation(delivery.pickupLocation),
    dropoffLocation: mapSafeLocation(delivery.dropoffLocation),
  };
};

const mapAssignedDelivery = (delivery: DriverDeliveryRecord) => ({
  ...mapAvailableDelivery(delivery),
  supplierPickupWindowStart:
    delivery.reservation.supplierPickupWindowStart?.toISOString() ?? null,
  supplierPickupWindowEnd:
    delivery.reservation.supplierPickupWindowEnd?.toISOString() ?? null,
  confirmedDeliveryWindowStart:
    delivery.reservation.confirmedDeliveryWindowStart?.toISOString() ?? null,
  confirmedDeliveryWindowEnd:
    delivery.reservation.confirmedDeliveryWindowEnd?.toISOString() ?? null,
  canDriverReportPickupFailed: canDriverMarkPickupFailed({
    reservationStatus: delivery.reservation.status,
    deliveryStatus: delivery.status,
    supplierPickupWindowEnd: delivery.reservation.supplierPickupWindowEnd,
  }),
  assignedDriverPickupOverdue: isAssignedDriverPickupOverdue({
    supplierPickupWindowEnd: delivery.reservation.supplierPickupWindowEnd,
    pickupWindowEnd: delivery.reservation.pickupWindowEnd,
    deliveryStatus: delivery.status,
  }),
  canDriverReportDeliveryFailed: canDriverMarkDeliveryFailed({
    reservationStatus: delivery.reservation.status,
    deliveryStatus: delivery.status,
    confirmedDeliveryWindowEnd:
      delivery.reservation.confirmedDeliveryWindowEnd,
  }),
  canDriverReportDriverIssue: canDriverReportDriverIssue({
    reservationStatus: delivery.reservation.status,
    deliveryStatus: delivery.status,
  }),
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

export const mapDriverDeliveryForResponse = (delivery: DriverDeliveryRecord) =>
  mapAssignedDelivery(delivery);

const countActiveAssignedDeliveries = async (
  driverProfileId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) =>
  tx.delivery.count({
    where: {
      assignedDriverProfileId: driverProfileId,
      status: { in: [...DRIVER_IN_PROGRESS_ASSIGNED_STATUSES] },
    },
  });

const buildDriverJobsMeta = (
  profile: { city: string; area: string },
  activeDeliveryCount: number,
  referencePoint: Awaited<ReturnType<typeof resolveDriverReferencePoint>>,
) => ({
  activeDeliveryCount,
  maxActiveDeliveries: MAX_ACTIVE_DRIVER_DELIVERIES,
  canAcceptMore: activeDeliveryCount < MAX_ACTIVE_DRIVER_DELIVERIES,
  driverProfileCity: profile.city,
  driverProfileArea: profile.area,
  driverHasRecentLocation:
    referencePoint.source === 'recent_ping' &&
    referencePoint.latitude != null &&
    referencePoint.longitude != null,
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

export const listAvailableDeliveries = async (
  driverUserId: string,
  query: ListAvailableDeliveriesQuery = {},
) => {
  await syncDueDriverTimeRemindersForUser(driverUserId);

  const profile = await findActiveDriverProfile(driverUserId);
  const referencePoint = await resolveDriverReferencePoint(profile.id);
  const activeDeliveryCount = await countActiveAssignedDeliveries(profile.id);

  const explicitCity = query.city?.trim();
  const explicitArea = query.area?.trim();

  const hasDriverCoordinates =
    referencePoint.latitude != null && referencePoint.longitude != null;

  let sortBy = query.sortBy;
  if (!sortBy) {
    sortBy = hasDriverCoordinates ? 'nearest' : 'newest';
  }

  const effectiveMaxDistanceKm = query.maxDistanceKm;

  const deliveries = await prisma.delivery.findMany({
    where: {
      status: 'WAITING_FOR_DRIVER',
      assignedDriverProfileId: null,
      ...(explicitCity
        ? {
            pickupLocation: {
              city: { equals: explicitCity, mode: 'insensitive' },
            },
          }
        : {}),
      ...(explicitArea
        ? {
            pickupLocation: {
              area: { equals: explicitArea, mode: 'insensitive' },
            },
          }
        : {}),
    },
    include: driverDeliveryInclude,
  });

  const withDistance = deliveries.map((delivery) => {
    const pickupLat = locationCoordinate(delivery.pickupLocation);
    const pickupLng = locationLongitude(delivery.pickupLocation);
    let distanceKm: number | null = null;

    if (
      hasDriverCoordinates &&
      pickupLat != null &&
      pickupLng != null &&
      referencePoint.latitude != null &&
      referencePoint.longitude != null
    ) {
      distanceKm = haversineDistanceKm(
        referencePoint.latitude,
        referencePoint.longitude,
        pickupLat,
        pickupLng,
      );
    }

    return { delivery, distanceKm };
  });

  let filtered = withDistance;
  if (effectiveMaxDistanceKm != null && hasDriverCoordinates) {
    filtered = filtered.filter(
      (item) =>
        item.distanceKm == null ||
        item.distanceKm <= effectiveMaxDistanceKm,
    );
  }

  filtered.sort((left, right) => {
    if (sortBy === 'nearest') {
      if (left.distanceKm == null && right.distanceKm == null) {
        return (
          left.delivery.requestedAt.getTime() -
          right.delivery.requestedAt.getTime()
        );
      }

      if (left.distanceKm == null) {
        return 1;
      }

      if (right.distanceKm == null) {
        return -1;
      }

      const distanceDiff = left.distanceKm - right.distanceKm;
      if (distanceDiff !== 0) {
        return distanceDiff;
      }
    }

    return (
      left.delivery.requestedAt.getTime() - right.delivery.requestedAt.getTime()
    );
  });

  return {
    deliveries: filtered.map((item) =>
      mapAvailableDelivery(item.delivery, { distanceKm: item.distanceKm }),
    ),
    nearbyAvailableCount: filtered.length,
    totalAvailableCount: withDistance.length,
    ...buildDriverJobsMeta(profile, activeDeliveryCount, referencePoint),
  };
};

export const listActiveDriverDeliveries = async (driverUserId: string) => {
  await syncDueDriverTimeRemindersForUser(driverUserId);

  const profile = await findActiveDriverProfile(driverUserId);
  const referencePoint = await resolveDriverReferencePoint(profile.id);
  const activeDeliveryCount = await countActiveAssignedDeliveries(profile.id);

  let deliveries = await prisma.delivery.findMany({
    where: {
      assignedDriverProfileId: profile.id,
      status: { in: [...DRIVER_IN_PROGRESS_ASSIGNED_STATUSES] },
    },
    include: driverDeliveryInclude,
    orderBy: { updatedAt: 'desc' },
  });

  const reservationIds = [
    ...new Set(deliveries.map((delivery) => delivery.reservationId)),
  ];

  if (reservationIds.length > 0) {
    await escalateStaleAssignedDriverPickupsByIds(reservationIds);
    deliveries = await prisma.delivery.findMany({
      where: {
        assignedDriverProfileId: profile.id,
        status: { in: [...DRIVER_IN_PROGRESS_ASSIGNED_STATUSES] },
      },
      include: driverDeliveryInclude,
      orderBy: { updatedAt: 'desc' },
    });
  }

  return {
    deliveries: deliveries.map(mapAssignedDelivery),
    ...buildDriverJobsMeta(profile, activeDeliveryCount, referencePoint),
  };
};

const driverInactiveDeliveryMessage = (status: DeliveryStatus) => {
  if (status === 'AWAITING_RESOLUTION') {
    return 'This delivery is no longer active. It was moved to admin review because pickup was not completed within the pickup window.';
  }

  return 'This delivery is no longer active.';
};

export const getDriverDeliveryInactiveContext = async (
  driverUserId: string,
  deliveryId: string,
) => {
  const profile = await findActiveDriverProfile(driverUserId);

  const assignment = await prisma.deliveryAssignment.findFirst({
    where: {
      deliveryId,
      driverProfileId: profile.id,
    },
    orderBy: { acceptedAt: 'desc' },
    include: {
      delivery: {
        select: {
          id: true,
          status: true,
          assignedDriverProfileId: true,
        },
      },
    },
  });

  if (!assignment) {
    throw new AppError('Delivery not found.', 404, 'NOT_FOUND');
  }

  const delivery = assignment.delivery;
  const isActive =
    delivery.assignedDriverProfileId === profile.id &&
    (DRIVER_IN_PROGRESS_ASSIGNED_STATUSES as readonly DeliveryStatus[]).includes(
      delivery.status,
    );

  if (isActive) {
    return {
      deliveryId: delivery.id,
      isActive: true as const,
      status: delivery.status,
      closureReason: null,
      message: null,
    };
  }

  if (delivery.status === 'AWAITING_RESOLUTION') {
    return {
      deliveryId: delivery.id,
      isActive: false as const,
      status: delivery.status,
      closureReason: 'MOVED_TO_ADMIN_REVIEW' as const,
      message: driverInactiveDeliveryMessage(delivery.status),
    };
  }

  return {
    deliveryId: delivery.id,
    isActive: false as const,
    status: delivery.status,
    closureReason: 'NO_LONGER_ACTIVE' as const,
    message: driverInactiveDeliveryMessage(delivery.status),
  };
};

export const acceptDelivery = async (
  driverUserId: string,
  deliveryId: string,
) => {
  const delivery = await prisma.$transaction(async (tx) => {
    const profile = await findActiveDriverProfile(driverUserId, tx);

    const activeDriverDeliveryCount = await countActiveAssignedDeliveries(
      profile.id,
      tx,
    );

    if (activeDriverDeliveryCount >= MAX_ACTIVE_DRIVER_DELIVERIES) {
      throw new AppError(
        'You have reached the active delivery limit.',
        409,
        'CONFLICT',
      );
    }

    if (
      profile.availability === 'OFFLINE' ||
      profile.availability === 'AVAILABLE'
    ) {
      const driverAvailabilityUpdate = await tx.driverProfile.updateMany({
        where: {
          id: profile.id,
          status: 'ACTIVE',
          availability: { in: ['OFFLINE', 'AVAILABLE'] },
        },
        data: { availability: 'ON_DELIVERY' },
      });

      if (driverAvailabilityUpdate.count !== 1) {
        const refreshedProfile = await tx.driverProfile.findUnique({
          where: { id: profile.id },
          select: { availability: true },
        });

        if (refreshedProfile?.availability !== 'ON_DELIVERY') {
          throw new AppError(
            'Driver is not available to accept a delivery.',
            409,
            'CONFLICT',
          );
        }
      }
    } else if (profile.availability !== 'ON_DELIVERY') {
      throw new AppError(
        'Driver is not available to accept a delivery.',
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

    const assignedDelivery = await tx.delivery.findUniqueOrThrow({
      where: { id: deliveryId },
      select: { deliveryGroupId: true },
    });

    await syncDeliveryGroupOnDriverAssign(tx, {
      deliveryGroupId: assignedDelivery.deliveryGroupId,
      driverProfileId: profile.id,
    });

    const delivery = await tx.delivery.findUniqueOrThrow({
      where: { id: deliveryId },
      include: driverDeliveryInclude,
    });

    return mapAssignedDelivery(delivery);
  });

  await notifyDriverPickupTime(deliveryId);
  await clearUnreadNewJobNotificationsForDelivery(deliveryId);

  return delivery;
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
      // deliveryGroupId is on delivery row
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

    if (input.status === 'PICKED_UP' || input.status === 'DELIVERED') {
      await ensureDeliveryHandoverCodesStored(tx, delivery.id);

      const deliveryWithCodes = await tx.delivery.findUniqueOrThrow({
        where: { id: delivery.id },
        select: {
          supplierHandoverCodeHash: true,
          learnerDeliveryCodeHash: true,
        },
      });

      const codeHash =
        input.status === 'PICKED_UP'
          ? deliveryWithCodes.supplierHandoverCodeHash
          : deliveryWithCodes.learnerDeliveryCodeHash;

      const codeValid = await verifyHandoverCode(
        input.confirmationCode ?? '',
        codeHash,
      );

      if (!codeValid) {
        return { outcome: 'INVALID_CODE' as const };
      }

      if (input.status === 'PICKED_UP') {
        const timing = evaluateHandoverWindow(
          now,
          delivery.reservation.supplierPickupWindowStart,
          delivery.reservation.supplierPickupWindowEnd,
        );

        if (!timing.ok) {
          if (timing.reason === 'NOT_STARTED') {
            return { outcome: 'WINDOW_NOT_STARTED' as const };
          }

          return { outcome: 'WINDOW_EXPIRED' as const };
        }
      }

      if (input.status === 'DELIVERED') {
        const timing = evaluateHandoverWindow(
          now,
          delivery.reservation.confirmedDeliveryWindowStart,
          delivery.reservation.confirmedDeliveryWindowEnd,
        );

        if (!timing.ok) {
          if (timing.reason === 'NOT_STARTED') {
            return { outcome: 'WINDOW_NOT_STARTED' as const };
          }

          return { outcome: 'WINDOW_EXPIRED' as const };
        }
      }
    }

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
      await completeReservationsForDeliveredDelivery(tx, {
        delivery: {
          id: delivery.id,
          reservationId: delivery.reservationId,
          deliveryGroupId: delivery.deliveryGroupId,
          reservation: delivery.reservation,
        },
        driverUserId,
        completedAt: now,
      });

      const remainingActive = await countActiveAssignedDeliveries(
        profile.id,
        tx,
      );

      if (remainingActive === 0) {
        await tx.driverProfile.update({
          where: { id: profile.id },
          data: { availability: 'AVAILABLE' },
        });
      }
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
      if (input.status === 'PICKED_UP') {
        await notifyDriverDropoffTime(deliveryId);
      }
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
    case 'INVALID_CODE':
      throw new AppError(
        'The confirmation code is incorrect.',
        400,
        'VALIDATION_ERROR',
      );
    case 'WINDOW_NOT_STARTED':
      throw new AppError(
        input.status === 'PICKED_UP'
          ? supplierPickupWindowNotStartedMessage()
          : deliveryWindowNotStartedMessage(),
        400,
        'VALIDATION_ERROR',
      );
    case 'WINDOW_EXPIRED':
      throw new AppError(
        input.status === 'PICKED_UP'
          ? supplierPickupWindowPassedMessage()
          : deliveryWindowPassedMessage(),
        400,
        'VALIDATION_ERROR',
      );
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
      status: { in: [...LOCATION_PING_ELIGIBLE_DELIVERY_STATUSES] },
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
