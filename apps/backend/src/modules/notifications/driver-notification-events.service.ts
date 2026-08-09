import type { DeliveryStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import {
  MAX_ACTIVE_DRIVER_DELIVERIES,
} from '../driver/driver-availability.js';
import { DRIVER_NOTIFICATION_TYPES } from './driver-delivery-notification-types.js';
import { createNotificationIfMissing } from './notifications.repository.js';
import {
  isTerminalDeliveryStatus,
  TERMINAL_DELIVERY_STATUSES,
} from '../deliveries/delivery-status.policy.js';

/** Reminder fires within this window before pickup/drop-off start. */
const REMINDER_LOOKAHEAD_MS = 15 * 60 * 1000;
const REMINDER_SYNC_THROTTLE_MS = 5_000;

type ReminderSyncEntry = {
  lastCompletedAt: number;
  inFlight?: Promise<void>;
};

const reminderSyncByUser = new Map<string, ReminderSyncEntry>();

const deliveryContextSelect = {
  id: true,
  status: true,
  reservationId: true,
  assignedDriverProfileId: true,
  reservation: {
    select: {
      id: true,
      supplierPickupWindowStart: true,
      supplierPickupWindowEnd: true,
      confirmedDeliveryWindowStart: true,
      confirmedDeliveryWindowEnd: true,
      material: { select: { title: true } },
    },
  },
  pickupLocation: {
    select: { city: true, area: true },
  },
  dropoffLocation: {
    select: { city: true, area: true },
  },
  assignedDriverProfile: {
    select: { userId: true },
  },
} as const;

type DeliveryContext = {
  id: string;
  status: DeliveryStatus;
  reservationId: string;
  assignedDriverProfileId: string | null;
  reservation: {
    id: string;
    supplierPickupWindowStart: Date | null;
    supplierPickupWindowEnd: Date | null;
    confirmedDeliveryWindowStart: Date | null;
    confirmedDeliveryWindowEnd: Date | null;
    material: { title: string };
  };
  pickupLocation: { city: string | null; area: string | null };
  dropoffLocation: { city: string | null; area: string | null };
  assignedDriverProfile: { userId: string } | null;
};

const beforePickupStatuses = new Set<DeliveryStatus>([
  'DRIVER_ASSIGNED',
  'ARRIVED_PICKUP',
]);

const inTransitStatuses = new Set<DeliveryStatus>([
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
]);

const notifySafely = async (task: () => Promise<unknown>) => {
  try {
    await task();
  } catch (error) {
    console.error('[notifications] driver notification event failed', error);
  }
};

const isInternalTestLabel = (value: string) =>
  /\[test[^\]]*\]/i.test(value) ||
  value.includes('@impactloop.test') ||
  /\b(seed|mock|test-driver)\b/i.test(value);

const materialLabel = (delivery: DeliveryContext) => {
  const raw = delivery.reservation.material.title.trim() || 'Material';
  if (isInternalTestLabel(raw)) {
    return null;
  }

  const cleaned = raw.replace(/\[test[^\]]*\]/gi, '').trim();
  return cleaned || null;
};

const placeLabel = (city: string | null, area: string | null) => {
  const parts = [city, area]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value && !isInternalTestLabel(value)));

  return parts.length > 0 ? parts.join(', ') : null;
};

type DriverNotificationMetadata = {
  materialTitle: string;
  pickupLabel?: string;
  dropoffLabel?: string;
};

const driverNotificationMetadata = (
  delivery: DeliveryContext,
  materialTitleOverride?: string | null,
): DriverNotificationMetadata => {
  const material =
    materialTitleOverride?.trim() ||
    materialLabel(delivery) ||
    'Material';

  const metadata: DriverNotificationMetadata = { materialTitle: material };

  const pickup = placeLabel(
    delivery.pickupLocation.city,
    delivery.pickupLocation.area,
  );
  const dropoff = placeLabel(
    delivery.dropoffLocation.city,
    delivery.dropoffLocation.area,
  );

  if (pickup) {
    metadata.pickupLabel = pickup;
  }
  if (dropoff) {
    metadata.dropoffLabel = dropoff;
  }

  return metadata;
};

const driverMaterialMetadata = (
  materialTitle: string,
  fallback = 'Material',
): DriverNotificationMetadata => ({
  materialTitle: materialTitle.trim() || fallback,
});

const isTestDelivery = (delivery: DeliveryContext) => {
  const material = delivery.reservation.material.title.trim();
  return isInternalTestLabel(material);
};

const loadDeliveryContext = async (deliveryId: string) =>
  prisma.delivery.findUnique({
    where: { id: deliveryId },
    select: deliveryContextSelect,
  });

export const listEligibleDriverUserIds = async () => {
  const rows = await prisma.$queryRaw<Array<{ user_id: string }>>`
    SELECT dp."user_id"
    FROM "driver_profiles" dp
    INNER JOIN "users" u ON u."id" = dp."user_id"
    LEFT JOIN (
      SELECT
        d."assigned_driver_profile_id" AS driver_profile_id,
        COUNT(*)::int AS active_count
      FROM "deliveries" d
      WHERE d."assigned_driver_profile_id" IS NOT NULL
        AND d."status" IN (
          'DRIVER_ASSIGNED'::"DeliveryStatus",
          'ARRIVED_PICKUP'::"DeliveryStatus",
          'PICKED_UP'::"DeliveryStatus",
          'ON_THE_WAY'::"DeliveryStatus",
          'ARRIVED_DROPOFF'::"DeliveryStatus"
        )
      GROUP BY d."assigned_driver_profile_id"
    ) active ON active.driver_profile_id = dp."id"
    WHERE dp."status" = 'ACTIVE'::"DriverProfileStatus"
      AND dp."accepting_new_jobs" = true
      AND u."account_status" = 'ACTIVE'::"AccountStatus"
      AND COALESCE(active.active_count, 0) < ${MAX_ACTIVE_DRIVER_DELIVERIES}
  `;

  return rows.map((row) => row.user_id);
};

const isReminderDue = (windowStart: Date, windowEnd: Date | null, now: Date) => {
  const startsSoonAt = new Date(windowStart.getTime() - REMINDER_LOOKAHEAD_MS);
  const endsAt = windowEnd ?? windowStart;
  return now >= startsSoonAt && now < endsAt;
};

/**
 * Event: delivery created or entered WAITING_FOR_DRIVER.
 * Never call from GET/list endpoints.
 */
export const notifyNewDriverJob = async (deliveryId: string) =>
  notifySafely(async () => {
    const delivery = await loadDeliveryContext(deliveryId);
    if (!delivery || delivery.status !== 'WAITING_FOR_DRIVER') {
      return;
    }

    if (isTestDelivery(delivery)) {
      return;
    }

    const material = materialLabel(delivery);
    if (!material) {
      return;
    }

    const pickup = placeLabel(
      delivery.pickupLocation.city,
      delivery.pickupLocation.area,
    );
    const dropoff = placeLabel(
      delivery.dropoffLocation.city,
      delivery.dropoffLocation.area,
    );

    const route =
      pickup && dropoff
        ? `from ${pickup} to ${dropoff}`
        : pickup
          ? `from ${pickup}`
          : dropoff
            ? `to ${dropoff}`
            : '';

    const body = route
      ? `${material} is ready for delivery ${route}.`
      : `${material} is ready for delivery.`;

    const driverUserIds = await listEligibleDriverUserIds();
    if (driverUserIds.length === 0) {
      return;
    }

    await Promise.all(
      driverUserIds.map((userId) =>
        createNotificationIfMissing({
          userId,
          notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_NEW_JOB,
          title: 'New delivery job',
          body,
          relatedEntityType: 'DELIVERY',
          relatedEntityId: delivery.id,
          metadata: driverNotificationMetadata(delivery, material),
        }),
      ),
    );
  });

/**
 * Event hook: call after any flow that creates or re-opens a WAITING_FOR_DRIVER delivery.
 * Resolves the latest unassigned waiting delivery for the reservation.
 */
export const notifyNewJobForReservationWaitingDelivery = async (
  reservationId: string,
) =>
  notifySafely(async () => {
    const delivery = await prisma.delivery.findFirst({
      where: {
        reservationId,
        status: 'WAITING_FOR_DRIVER',
        assignedDriverProfileId: null,
      },
      orderBy: { requestedAt: 'desc' },
      select: { id: true },
    });

    if (!delivery) {
      return;
    }

    await notifyNewDriverJob(delivery.id);
  });

/**
 * Pickup time reminder for assigned driver when window is due.
 */
export const notifyDriverPickupTime = async (deliveryId: string) =>
  notifySafely(async () => {
    const delivery = await loadDeliveryContext(deliveryId);
    const driverUserId = delivery?.assignedDriverProfile?.userId;

    if (
      !delivery ||
      !driverUserId ||
      isTerminalDeliveryStatus(delivery.status)
    ) {
      return;
    }

    if (!beforePickupStatuses.has(delivery.status)) {
      return;
    }

    const windowStart = delivery.reservation.supplierPickupWindowStart;
    const windowEnd = delivery.reservation.supplierPickupWindowEnd;
    if (!windowStart) {
      return;
    }

    if (!isReminderDue(windowStart, windowEnd, new Date())) {
      return;
    }

    const material = materialLabel(delivery) ?? 'Material';

    await createNotificationIfMissing({
      userId: driverUserId,
      notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_PICKUP_TIME,
      title: 'Pickup time',
      body: `Pickup for ${material} starts soon.`,
      relatedEntityType: 'DELIVERY',
      relatedEntityId: delivery.id,
      metadata: driverNotificationMetadata(delivery, material),
    });
  });

/**
 * Drop-off time reminder for assigned driver when confirmed window is due.
 * Uses reservation.confirmedDeliveryWindowStart/End.
 */
export const notifyDriverDropoffTime = async (deliveryId: string) =>
  notifySafely(async () => {
    const delivery = await loadDeliveryContext(deliveryId);
    const driverUserId = delivery?.assignedDriverProfile?.userId;

    if (
      !delivery ||
      !driverUserId ||
      isTerminalDeliveryStatus(delivery.status)
    ) {
      return;
    }

    if (!inTransitStatuses.has(delivery.status)) {
      return;
    }

    const windowStart = delivery.reservation.confirmedDeliveryWindowStart;
    const windowEnd = delivery.reservation.confirmedDeliveryWindowEnd;
    if (!windowStart) {
      return;
    }

    if (!isReminderDue(windowStart, windowEnd, new Date())) {
      return;
    }

    const material = materialLabel(delivery) ?? 'Material';

    await createNotificationIfMissing({
      userId: driverUserId,
      notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_DROPOFF_TIME,
      title: 'Drop-off time',
      body: `Drop-off for ${material} starts soon.`,
      relatedEntityType: 'DELIVERY',
      relatedEntityId: delivery.id,
      metadata: driverNotificationMetadata(delivery, material),
    });
  });

export const notifyDriverDeliveryUnassignedByAdmin = async (input: {
  deliveryId: string;
  driverUserId: string;
  materialTitle: string;
}) =>
  notifySafely(async () => {
    const material = input.materialTitle.trim() || 'Delivery';
    const delivery = await loadDeliveryContext(input.deliveryId);
    const metadata = delivery
      ? driverNotificationMetadata(delivery, material)
      : driverMaterialMetadata(material, 'Delivery');

    await createNotificationIfMissing({
      userId: input.driverUserId,
      notificationType:
        DRIVER_NOTIFICATION_TYPES.DRIVER_DELIVERY_UNASSIGNED_BY_ADMIN,
      title: 'Delivery assignment removed',
      body: `${material} was reopened to the driver pool by an admin.`,
      relatedEntityType: 'DELIVERY',
      relatedEntityId: input.deliveryId,
      metadata,
    });
  });

/**
 * Idempotent due-only sync for pickup/drop-off reminders.
 * Safe to call from GET /api/notifications — never creates NEW JOB rows.
 */
export const syncDueDriverTimeRemindersForUser = async (userId: string) => {
  const existing = reminderSyncByUser.get(userId);
  if (existing?.inFlight) {
    await existing.inFlight;
    return;
  }
  if (
    existing &&
    Date.now() - existing.lastCompletedAt < REMINDER_SYNC_THROTTLE_MS
  ) {
    return;
  }

  const inFlight = notifySafely(async () => {
    const profile = await prisma.driverProfile.findFirst({
      where: { userId, status: 'ACTIVE' },
      select: { id: true },
    });

    if (!profile) {
      return;
    }

    const assignedDeliveries = await prisma.delivery.findMany({
      where: {
        assignedDriverProfileId: profile.id,
        status: { notIn: [...TERMINAL_DELIVERY_STATUSES] },
      },
      select: { id: true },
    });

    for (const { id } of assignedDeliveries) {
      await notifyDriverPickupTime(id);
      await notifyDriverDropoffTime(id);
    }
  }).finally(() => {
    reminderSyncByUser.set(userId, { lastCompletedAt: Date.now() });
  });

  reminderSyncByUser.set(userId, {
    lastCompletedAt: existing?.lastCompletedAt ?? 0,
    inFlight,
  });
  await inFlight;
};

/** Remove stale unread job alerts once a delivery is accepted. */
export const clearUnreadNewJobNotificationsForDelivery = async (
  deliveryId: string,
) => {
  await prisma.notification.deleteMany({
    where: {
      notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_NEW_JOB,
      relatedEntityType: 'DELIVERY',
      relatedEntityId: deliveryId,
      isRead: false,
    },
  });
};

export const notifyDriverDeliveryMovedToAdminReview = async (input: {
  deliveryId: string;
  driverUserId: string;
}) =>
  notifySafely(async () => {
    const delivery = await loadDeliveryContext(input.deliveryId);
    const metadata = delivery
      ? driverNotificationMetadata(delivery)
      : driverMaterialMetadata('Material');

    await createNotificationIfMissing({
      userId: input.driverUserId,
      notificationType:
        DRIVER_NOTIFICATION_TYPES.DRIVER_DELIVERY_MOVED_TO_ADMIN_REVIEW,
      title: 'Delivery moved to admin review',
      body: 'Delivery moved to admin review because pickup was not completed within the pickup window.',
      relatedEntityType: 'DELIVERY',
      relatedEntityId: input.deliveryId,
      metadata,
    });
  });

export const resetDriverDeliveryReminderSyncThrottleForTests = () => {
  reminderSyncByUser.clear();
};
