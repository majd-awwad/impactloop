import type { DeliveryStatus, Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { formatDistanceLabel, haversineDistanceKm } from '../../utils/haversine.js';
import {
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
  UpdateDriverAvailabilityInput,
  UpdateDriverDeliveryStatusInput,
  UpdateDriverProfileInput,
} from './driver.validation.js';
import {
  countActiveDriverDeliveries,
  DRIVER_IN_PROGRESS_ASSIGNED_STATUSES,
  MAX_ACTIVE_DRIVER_DELIVERIES,
  reconcileDriverAvailability,
} from './driver-availability.js';
import { resolveDriverReferencePoint } from './driver-location.js';
import {
  completeReservationsForDeliveredDelivery,
  syncDeliveryGroupOnDriverAssign,
} from '../delivery-groups/delivery-group-operations.service.js';
import { invalidateLearnerHomeForReservationTransition } from '../learner-home/learner-home.service.js';
import { runSerializableTransaction } from '../../utils/transaction-retry.js';
import {
  assertAvailableJobsCursorCompatible,
  availableJobMatchesCursorPosition,
  buildAvailableJobsCursorFilters,
  buildNextAvailableJobsCursor,
  compareAvailableJobs,
  decodeAvailableJobsCursor,
  isAvailableJobAfterCursor,
  rejectInvalidAvailableJobsCursor,
} from './driver-available-jobs-cursor.js';
import {
  applyPartialPickupSplit,
  validatePartialPickupSelection,
  type PartialPickupUnpickedItem,
} from './driver-partial-pickup.js';

const notifyMaterialRequestsFulfilledByReservations = async (
  reservationIds: string[],
) => {
  if (reservationIds.length === 0) {
    return;
  }

  const { fulfillRequestFromCompletedReservation } = await import(
    '../learner-material-requests/learner-material-requests.service.js'
  );
  const { createNotificationIfMissing } = await import(
    '../notifications/notifications.repository.js'
  );

  for (const reservationId of reservationIds) {
    const fulfilled = await fulfillRequestFromCompletedReservation(reservationId);
    if (!fulfilled) {
      continue;
    }

    await createNotificationIfMissing({
      userId: fulfilled.learnerId,
      notificationType: 'MATERIAL_REQUEST_FULFILLED',
      title: 'Material request fulfilled',
      body: `Your request "${fulfilled.requestedItemName}" was marked fulfilled after a completed reservation.`,
      relatedEntityType: 'MATERIAL_REQUEST',
      relatedEntityId: fulfilled.id,
      eventKey: `mr:fulfilled:${fulfilled.id}`,
      entityType: 'MATERIAL_REQUEST',
      entityId: fulfilled.id,
      actionType: 'OPEN_ENTITY',
    });
  }
};

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
      // Keep user-entered content verbatim; the client owns localized group labels.
      title: delivery.reservation.material.title,
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
  canShareLocation: (
    LOCATION_PING_ELIGIBLE_DELIVERY_STATUSES as readonly DeliveryStatus[]
  ).includes(delivery.status),
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

const buildDriverJobsMeta = (
  profile: {
    city: string;
    area: string;
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    availability: 'OFFLINE' | 'AVAILABLE' | 'ON_DELIVERY';
    acceptingNewJobs: boolean;
  },
  activeDeliveryCount: number,
  referencePoint: Awaited<ReturnType<typeof resolveDriverReferencePoint>>,
) => ({
  activeDeliveryCount,
  maxActiveDeliveries: MAX_ACTIVE_DRIVER_DELIVERIES,
  canAcceptMore:
    profile.status === 'ACTIVE' &&
    profile.acceptingNewJobs &&
    activeDeliveryCount < MAX_ACTIVE_DRIVER_DELIVERIES,
  canBrowseAvailableJobs:
    profile.status === 'ACTIVE' && profile.acceptingNewJobs,
  status: profile.status,
  availability: profile.availability,
  acceptingNewJobs: profile.acceptingNewJobs,
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

const findDriverProfile = async (userId: string) => {
  const profile = await prisma.driverProfile.findUnique({ where: { userId } });
  if (!profile) {
    throw new AppError('Driver profile required.', 404, 'NOT_FOUND');
  }
  return profile;
};

const mapDriverProfileResponse = async (
  profile: Awaited<ReturnType<typeof findDriverProfile>>,
) => {
  const activeDeliveryCount = await countActiveDriverDeliveries(
    prisma,
    profile.id,
  );
  return {
    status: profile.status,
    availability: profile.availability,
    acceptingNewJobs: profile.acceptingNewJobs,
    activeDeliveryCount,
    maxActiveDeliveries: MAX_ACTIVE_DRIVER_DELIVERIES,
    canAcceptMore:
      profile.status === 'ACTIVE' &&
      profile.acceptingNewJobs &&
      activeDeliveryCount < MAX_ACTIVE_DRIVER_DELIVERIES,
    city: profile.city,
    area: profile.area,
    transportationType: profile.transportationType,
    vehicleLabel: profile.vehicleLabel,
    vehiclePlate: profile.vehiclePlate,
    capacityNotes: profile.capacityNotes,
    updatedAt: profile.updatedAt.toISOString(),
  };
};

export const getDriverProfile = async (driverUserId: string) =>
  mapDriverProfileResponse(await findDriverProfile(driverUserId));

export const updateDriverProfile = async (
  driverUserId: string,
  input: UpdateDriverProfileInput,
) => {
  const profile = await findActiveDriverProfile(driverUserId);
  await prisma.driverProfile.update({
    where: { id: profile.id },
    data: {
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.area !== undefined ? { area: input.area } : {}),
      ...(input.transportationType !== undefined
        ? {
            transportationType: input.transportationType,
            vehicleType: input.transportationType,
          }
        : {}),
      ...(input.vehicleLabel !== undefined
        ? { vehicleLabel: input.vehicleLabel }
        : {}),
      ...(input.vehiclePlate !== undefined
        ? { vehiclePlate: input.vehiclePlate }
        : {}),
      ...(input.capacityNotes !== undefined
        ? { capacityNotes: input.capacityNotes }
        : {}),
    },
  });
  return getDriverProfile(driverUserId);
};

export const updateDriverAvailability = async (
  driverUserId: string,
  input: UpdateDriverAvailabilityInput,
) => {
  await runSerializableTransaction(async (tx) => {
    const profile = await findActiveDriverProfile(driverUserId, tx);
    await tx.driverProfile.update({
      where: { id: profile.id },
      data: { acceptingNewJobs: input.acceptingNewJobs },
    });
    await reconcileDriverAvailability(tx, profile.id);
  });
  return getDriverProfile(driverUserId);
};

export const listAvailableDeliveries = async (
  driverUserId: string,
  query: ListAvailableDeliveriesQuery = { limit: 20 },
) => {
  const profile = await findActiveDriverProfile(driverUserId);
  const referencePoint = await resolveDriverReferencePoint(profile.id);
  const activeDeliveryCount = await countActiveDriverDeliveries(
    prisma,
    profile.id,
  );

  if (!profile.acceptingNewJobs) {
    return {
      deliveries: [],
      nearbyAvailableCount: 0,
      totalAvailableCount: 0,
      pagination: {
        limit: query.limit ?? 20,
        hasMore: false,
        nextCursor: null,
      },
      ...buildDriverJobsMeta(profile, activeDeliveryCount, referencePoint),
    };
  }

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
  if (effectiveMaxDistanceKm != null) {
    filtered = filtered.filter(
      (item) =>
        item.distanceKm != null &&
        item.distanceKm <= effectiveMaxDistanceKm,
    );
  }

  filtered.sort((left, right) => compareAvailableJobs(left, right, sortBy));

  const cursorFilters = buildAvailableJobsCursorFilters(query, sortBy);
  let pageSource = filtered;

  if (query.cursor) {
    const cursor = decodeAvailableJobsCursor(query.cursor);
    if (!cursor) {
      rejectInvalidAvailableJobsCursor();
    } else {
      assertAvailableJobsCursorCompatible(cursor, cursorFilters);

      const cursorItem = filtered.find(
        (item) => item.delivery.id === cursor.id,
      );
      if (!cursorItem || !availableJobMatchesCursorPosition(cursorItem, cursor)) {
        rejectInvalidAvailableJobsCursor();
      }

      pageSource = filtered.filter((item) =>
        isAvailableJobAfterCursor(item, cursor, sortBy),
      );
    }
  }

  const pageLimit = query.limit ?? 20;
  const page = pageSource.slice(0, pageLimit);
  const hasMore = page.length < pageSource.length;
  const lastPageItem = page.at(-1);

  return {
    deliveries: page.map((item) =>
      mapAvailableDelivery(item.delivery, { distanceKm: item.distanceKm }),
    ),
    nearbyAvailableCount: filtered.length,
    totalAvailableCount: withDistance.length,
    pagination: {
      limit: pageLimit,
      hasMore,
      nextCursor:
        hasMore && lastPageItem
          ? buildNextAvailableJobsCursor(lastPageItem, cursorFilters)
          : null,
    },
    ...buildDriverJobsMeta(profile, activeDeliveryCount, referencePoint),
  };
};

export const listActiveDriverDeliveries = async (driverUserId: string) => {
  await syncDueDriverTimeRemindersForUser(driverUserId);

  const profile = await findActiveDriverProfile(driverUserId);
  const referencePoint = await resolveDriverReferencePoint(profile.id);
  const activeDeliveryCount = await countActiveDriverDeliveries(
    prisma,
    profile.id,
  );

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

const mapInactiveDriverDelivery = (delivery: DriverDeliveryRecord) => ({
  ...mapAvailableDelivery(delivery),
  learnerNote: null,
  confirmedDeliveryWindowStart:
    delivery.reservation.confirmedDeliveryWindowStart?.toISOString() ?? null,
  confirmedDeliveryWindowEnd:
    delivery.reservation.confirmedDeliveryWindowEnd?.toISOString() ?? null,
  assignedAt: delivery.assignedAt?.toISOString() ?? null,
  arrivedPickupAt: delivery.arrivedPickupAt?.toISOString() ?? null,
  pickedUpAt: delivery.pickedUpAt?.toISOString() ?? null,
  onTheWayAt: delivery.onTheWayAt?.toISOString() ?? null,
  arrivedDropoffAt: delivery.arrivedDropoffAt?.toISOString() ?? null,
  deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
  canDriverReportPickupFailed: false,
  canDriverReportDeliveryFailed: false,
  canDriverReportDriverIssue: false,
  canShareLocation: false,
});

/**
 * Privacy-safe detail contract. Exact addresses and contact details are exposed
 * only while this driver currently owns an active delivery. A previous
 * assignment may still resolve notification deep links, but only to safe data.
 */
export const getDriverDeliveryDetail = async (
  driverUserId: string,
  deliveryId: string,
) => {
  const profile = await findActiveDriverProfile(driverUserId);
  const assignment = await prisma.deliveryAssignment.findFirst({
    where: { deliveryId, driverProfileId: profile.id },
    orderBy: { acceptedAt: 'desc' },
    select: { id: true },
  });

  if (!assignment) {
    throw new AppError('Delivery not found.', 404, 'NOT_FOUND');
  }

  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: driverDeliveryInclude,
  });

  if (!delivery) {
    throw new AppError('Delivery not found.', 404, 'NOT_FOUND');
  }

  const isActive =
    delivery.assignedDriverProfileId === profile.id &&
    (DRIVER_IN_PROGRESS_ASSIGNED_STATUSES as readonly DeliveryStatus[]).includes(
      delivery.status,
    );

  return {
    isActive,
    delivery: isActive
      ? mapAssignedDelivery(delivery)
      : mapInactiveDriverDelivery(delivery),
    inactiveContext: isActive
      ? null
      : {
          closureReason:
            delivery.status === 'AWAITING_RESOLUTION'
              ? ('MOVED_TO_ADMIN_REVIEW' as const)
              : ('NO_LONGER_ACTIVE' as const),
        },
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
  await runSerializableTransaction(async (tx) => {
    const profile = await findActiveDriverProfile(driverUserId, tx);

    if (!profile.acceptingNewJobs) {
      throw new AppError(
        'You are not accepting new delivery jobs.',
        409,
        'DRIVER_NOT_ACCEPTING_NEW_JOBS',
      );
    }

    const activeDriverDeliveryCount = await countActiveDriverDeliveries(
      tx,
      profile.id,
    );

    if (activeDriverDeliveryCount >= MAX_ACTIVE_DRIVER_DELIVERIES) {
      throw new AppError(
        'You have reached the active delivery limit.',
        409,
        'DRIVER_ACTIVE_LIMIT_REACHED',
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
        'DELIVERY_NOT_AVAILABLE',
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

    await reconcileDriverAvailability(tx, profile.id);
  });

  const delivery = await prisma.delivery.findUniqueOrThrow({
    where: { id: deliveryId },
    include: driverDeliveryInclude,
  });

  await notifyDriverPickupTime(deliveryId);
  await clearUnreadNewJobNotificationsForDelivery(deliveryId);

  return mapAssignedDelivery(delivery);
};

export const updateDriverDeliveryStatus = async (
  driverUserId: string,
  deliveryId: string,
  input: UpdateDriverDeliveryStatusInput,
) => {
  const hasPartialSelection =
    input.pickedReservationIds != null && input.unpicked != null;

  const result = await runSerializableTransaction(async (tx) => {
    const profile = await findActiveDriverProfile(driverUserId, tx);
    const delivery = await tx.delivery.findFirst({
      where: {
        id: deliveryId,
        assignedDriverProfileId: profile.id,
      },
      select: {
        id: true,
        status: true,
        reservationId: true,
        deliveryGroupId: true,
        assignedDriverProfileId: true,
        driverNote: true,
        reservation: {
          select: {
            status: true,
            materialId: true,
            material: {
              select: { title: true, unit: true, condition: true },
            },
            ownerId: true,
            quantityRequested: true,
            supplierPickupWindowStart: true,
            supplierPickupWindowEnd: true,
            confirmedDeliveryWindowStart: true,
            confirmedDeliveryWindowEnd: true,
          },
        },
        deliveryGroup: {
          select: {
            id: true,
            status: true,
            assignedDriverProfileId: true,
            supplierProfile: {
              select: { userId: true },
            },
            reservations: {
              select: {
                id: true,
                status: true,
                fulfillmentMethod: true,
                materialId: true,
                material: {
                  select: { title: true, unit: true, condition: true },
                },
                quantityRequested: true,
                ownerId: true,
                supplierPickupWindowStart: true,
                supplierPickupWindowEnd: true,
              },
            },
          },
        },
        assignments: {
          where: { status: 'ACTIVE' },
          select: { driverProfileId: true },
        },
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
    const isGroupedPickup =
      input.status === 'PICKED_UP' && delivery.deliveryGroupId != null;

    if (isGroupedPickup) {
      const group = delivery.deliveryGroup;
      const expectedSupplierUserId = group?.supplierProfile.userId;
      const memberIds = new Set(
        group?.reservations.map((reservation) => reservation.id) ?? [],
      );

      if (
        !group ||
        group.id !== delivery.deliveryGroupId ||
        !memberIds.has(delivery.reservationId) ||
        group.status !== 'ASSIGNED' ||
        group.assignedDriverProfileId !== profile.id ||
        delivery.assignedDriverProfileId !== profile.id ||
        delivery.status !== 'ARRIVED_PICKUP' ||
        delivery.assignments.length !== 1 ||
        delivery.assignments[0]?.driverProfileId !== profile.id ||
        !expectedSupplierUserId ||
        group.reservations.length === 0 ||
        group.reservations.some(
          (reservation) =>
            reservation.fulfillmentMethod !== 'DELIVERY' ||
            reservation.status !== 'ACCEPTED' ||
            reservation.ownerId !== expectedSupplierUserId,
        )
      ) {
        return { outcome: 'SPLIT_CONFLICT' as const };
      }
    }

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

    if (input.status === 'PICKED_UP' && hasPartialSelection) {
      const groupMembers = delivery.deliveryGroup?.reservations ?? [];

      const members =
        delivery.deliveryGroupId && groupMembers.length > 0
          ? groupMembers
          : [
              {
                id: delivery.reservationId,
                status: delivery.reservation.status,
                fulfillmentMethod: 'DELIVERY',
                materialId: delivery.reservation.materialId,
                material: delivery.reservation.material,
                quantityRequested: delivery.reservation.quantityRequested,
                ownerId: delivery.reservation.ownerId,
                supplierPickupWindowStart:
                  delivery.reservation.supplierPickupWindowStart,
                supplierPickupWindowEnd:
                  delivery.reservation.supplierPickupWindowEnd,
              },
            ];

      if (
        delivery.assignedDriverProfileId !== profile.id ||
        delivery.status !== 'ARRIVED_PICKUP' ||
        delivery.assignments.length !== 1 ||
        delivery.assignments[0]?.driverProfileId !== profile.id
      ) {
        return { outcome: 'SPLIT_CONFLICT' as const };
      }

      const selection = validatePartialPickupSelection({
        members,
        pickedReservationIds: input.pickedReservationIds!,
        unpicked: input.unpicked as PartialPickupUnpickedItem[],
      });

      if (!selection.ok) {
        if (selection.code === 'EMPTY_PICKED') {
          return { outcome: 'EMPTY_PICKED' as const };
        }

        return { outcome: 'SELECTION_INVALID' as const };
      }

      const pickedIdSet = new Set(selection.pickedIds);
      const unpickedById = new Map(
        selection.unpicked.map((item) => [item.reservationId, item]),
      );
      await tx.deliveryPickupItem.createMany({
        data: members.map((member) => {
          const unpickedItem = unpickedById.get(member.id);
          return {
            deliveryId: delivery.id,
            reservationId: member.id,
            materialId: member.materialId,
            materialTitle: member.material.title,
            quantity: member.quantityRequested,
            unit: member.material.unit,
            condition: member.material.condition,
            wasPicked: pickedIdSet.has(member.id),
            unpickedReason: unpickedItem?.reason ?? null,
            driverNote: unpickedItem?.note?.trim() || null,
            recordedAt: now,
          };
        }),
        skipDuplicates: true,
      });

      if (selection.unpicked.length > 0) {
        if (!delivery.deliveryGroupId) {
          return { outcome: 'SELECTION_INVALID' as const };
        }

        await applyPartialPickupSplit(tx, {
          deliveryId: delivery.id,
          deliveryGroupId: delivery.deliveryGroupId,
          currentReservationId: delivery.reservationId,
          driverUserId,
          driverProfileId: profile.id,
          pickedIds: selection.pickedIds,
          unpicked: selection.unpicked,
          members,
        });
      }
    }

    if (input.status === 'PICKED_UP' && !hasPartialSelection) {
      const members = delivery.deliveryGroup?.reservations.length
        ? delivery.deliveryGroup.reservations
        : [
            {
              id: delivery.reservationId,
              materialId: delivery.reservation.materialId,
              material: delivery.reservation.material,
              quantityRequested: delivery.reservation.quantityRequested,
            },
          ];

      await tx.deliveryPickupItem.createMany({
        data: members.map((member) => ({
          deliveryId: delivery.id,
          reservationId: member.id,
          materialId: member.materialId,
          materialTitle: member.material.title,
          quantity: member.quantityRequested,
          unit: member.material.unit,
          condition: member.material.condition,
          wasPicked: true,
          recordedAt: now,
        })),
        skipDuplicates: true,
      });
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

    if (
      input.status === 'PICKED_UP' &&
      (hasPartialSelection || delivery.deliveryGroupId != null)
    ) {
      const deliveryUpdate = await tx.delivery.updateMany({
        where: {
          id: delivery.id,
          status: delivery.status,
          assignedDriverProfileId: profile.id,
          deliveryGroupId: delivery.deliveryGroupId,
        },
        data: statusData,
      });

      if (deliveryUpdate.count !== 1) {
        throw new AppError(
          'Grouped delivery state changed during partial pickup.',
          409,
          'DRIVER_GROUPED_DELIVERY_SPLIT_CONFLICT',
        );
      }
    } else {
      await tx.delivery.update({
        where: { id: delivery.id },
        data: statusData,
      });
    }

    if (input.status === 'DELIVERED') {
      const latestDelivery = await tx.delivery.findUniqueOrThrow({
        where: { id: delivery.id },
        select: {
          id: true,
          reservationId: true,
          deliveryGroupId: true,
          reservation: {
            select: {
              status: true,
              materialId: true,
              quantityRequested: true,
            },
          },
        },
      });

      await completeReservationsForDeliveredDelivery(tx, {
        delivery: latestDelivery,
        driverUserId,
        completedAt: now,
      });

      await reconcileDriverAvailability(tx, profile.id);
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

    return {
      outcome: 'UPDATED' as const,
      deliveryId: delivery.id,
      completedReservationIds,
    };
  });

  switch (result.outcome) {
    case 'UPDATED': {
      const updatedDelivery = await prisma.delivery.findUniqueOrThrow({
        where: { id: result.deliveryId },
        include: driverDeliveryInclude,
      });

      if (input.status === 'PICKED_UP') {
        await notifyDriverDropoffTime(deliveryId);
      }
      if (input.status === 'DELIVERED') {
        invalidateLearnerHomeForReservationTransition('ACCEPTED', 'COMPLETED');
        await notifyMaterialRequestsFulfilledByReservations(
          result.completedReservationIds,
        );
      }
      return mapAssignedDelivery(updatedDelivery);
    }
    case 'NOT_FOUND':
      throw new AppError('Delivery not found.', 404, 'NOT_FOUND');
    case 'TERMINAL':
      throw new AppError(
        'Terminal deliveries cannot be updated.',
        409,
        'DELIVERY_TERMINAL',
      );
    case 'INVALID_TRANSITION':
      throw new AppError(
        'Invalid delivery status transition.',
        409,
        'INVALID_DELIVERY_TRANSITION',
      );
    case 'INVALID_CODE':
      throw new AppError(
        'The confirmation code is incorrect.',
        400,
        'INVALID_CONFIRMATION_CODE',
      );
    case 'WINDOW_NOT_STARTED':
      throw new AppError(
        input.status === 'PICKED_UP'
          ? supplierPickupWindowNotStartedMessage()
          : deliveryWindowNotStartedMessage(),
        400,
        'HANDOVER_WINDOW_NOT_STARTED',
      );
    case 'WINDOW_EXPIRED':
      throw new AppError(
        input.status === 'PICKED_UP'
          ? supplierPickupWindowPassedMessage()
          : deliveryWindowPassedMessage(),
        400,
        'HANDOVER_WINDOW_EXPIRED',
      );
    case 'EMPTY_PICKED':
      throw new AppError(
        'Empty picked set is not allowed on partial pickup; use pickup failure.',
        409,
        'DRIVER_PARTIAL_PICKUP_SELECTION_INVALID',
      );
    case 'SELECTION_INVALID':
      throw new AppError(
        'Partial pickup selection is invalid for this grouped delivery.',
        409,
        'DRIVER_PARTIAL_PICKUP_SELECTION_INVALID',
      );
    case 'SPLIT_CONFLICT':
      throw new AppError(
        'Grouped delivery state changed during partial pickup.',
        409,
        'DRIVER_GROUPED_DELIVERY_SPLIT_CONFLICT',
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
    },
    select: { id: true, status: true },
  });

  if (!delivery) {
    throw new AppError('Active assigned delivery not found.', 404, 'NOT_FOUND');
  }

  if (
    !(LOCATION_PING_ELIGIBLE_DELIVERY_STATUSES as readonly DeliveryStatus[]).includes(
      delivery.status,
    )
  ) {
    throw new AppError(
      'Location sharing is not available for this delivery status.',
      409,
      'DELIVERY_LOCATION_PING_NOT_ALLOWED',
    );
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
