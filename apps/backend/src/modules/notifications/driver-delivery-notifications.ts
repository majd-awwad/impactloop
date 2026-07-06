import type { DeliveryStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';

import { DRIVER_DELIVERY_NOTIFICATION_TYPES } from './driver-delivery-notification-types.js';
import { createNotificationIfMissing } from './notifications.repository.js';

const REMINDER_LOOKAHEAD_MS = 30 * 60 * 1000;

const deliveryContextSelect = {
  id: true,
  status: true,
  reservationId: true,
  assignedDriverProfileId: true,
  reservation: {
    select: {
      id: true,
      requesterId: true,
      ownerId: true,
      supplierPickupWindowStart: true,
      supplierPickupWindowEnd: true,
      confirmedDeliveryWindowStart: true,
      confirmedDeliveryWindowEnd: true,
      material: { select: { title: true } },
    },
  },
  pickupLocation: {
    select: {
      city: true,
      area: true,
      addressLine: true,
    },
  },
  assignedDriverProfile: {
    select: { userId: true },
  },
} as const;

type DeliveryNotificationContext = {
  id: string;
  status: DeliveryStatus;
  reservationId: string;
  assignedDriverProfileId: string | null;
  reservation: {
    id: string;
    requesterId: string;
    ownerId: string;
    supplierPickupWindowStart: Date | null;
    supplierPickupWindowEnd: Date | null;
    confirmedDeliveryWindowStart: Date | null;
    confirmedDeliveryWindowEnd: Date | null;
    material: { title: string };
  };
  pickupLocation: {
    city: string | null;
    area: string | null;
    addressLine: string | null;
  };
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

const pickedUpOrLaterStatuses = new Set<DeliveryStatus>([
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
  'DELIVERED',
]);

const SYNC_THROTTLE_MS = 60_000;

const lastReminderSyncAtByUser = new Map<string, number>();

const notifySafely = async (task: () => Promise<unknown>) => {
  try {
    await task();
  } catch (error) {
    console.error('[notifications] driver delivery notification failed', error);
  }
};

const isInternalTestLabel = (value: string) =>
  /\[test[^\]]*\]/i.test(value) || value.includes('@impactloop.test');

const materialLabel = (delivery: DeliveryNotificationContext) => {
  const raw = delivery.reservation.material.title.trim() || 'the material';
  if (isInternalTestLabel(raw)) {
    return 'the material';
  }

  const cleaned = raw.replace(/\[test[^\]]*\]/gi, '').trim();
  return cleaned || 'the material';
};

const safeAreaLabel = (delivery: DeliveryNotificationContext) => {
  const parts = [delivery.pickupLocation.city, delivery.pickupLocation.area]
    .map((value) => value?.trim())
    .filter((value): value is string => {
      if (!value) {
        return false;
      }

      return !isInternalTestLabel(value);
    });

  return parts.length > 0 ? parts.join(', ') : 'your area';
};

const formatNotificationTime = (value: Date) => {
  const hour = value.getHours().toString().padStart(2, '0');
  const minute = value.getMinutes().toString().padStart(2, '0');
  return `${hour}:${minute}`;
};

const loadDeliveryContext = async (deliveryId: string) =>
  prisma.delivery.findUnique({
    where: { id: deliveryId },
    select: deliveryContextSelect,
  });

const listActiveDriverUserIds = async () => {
  const profiles = await prisma.driverProfile.findMany({
    where: { status: 'ACTIVE' },
    select: { userId: true },
  });

  return profiles.map((profile) => profile.userId);
};

export const notifyNewDeliveryJobAvailable = async (deliveryId: string) =>
  notifySafely(async () => {
    const delivery = await loadDeliveryContext(deliveryId);
    if (!delivery || delivery.status !== 'WAITING_FOR_DRIVER') {
      return;
    }

    const driverUserIds = await listActiveDriverUserIds();
    const material = materialLabel(delivery);
    const area = safeAreaLabel(delivery);

    await Promise.all(
      driverUserIds.map((userId) =>
        createNotificationIfMissing({
          userId,
          notificationType:
            DRIVER_DELIVERY_NOTIFICATION_TYPES.DRIVER_DELIVERY_AVAILABLE,
          title: 'New delivery job available',
          body: `${material} is ready for delivery in ${area}.`,
          relatedEntityType: 'DELIVERY',
          relatedEntityId: delivery.id,
        }),
      ),
    );
  });

export const notifyDriverDeliveryAccepted = async (deliveryId: string) =>
  notifySafely(async () => {
    const delivery = await loadDeliveryContext(deliveryId);
    if (!delivery?.assignedDriverProfile?.userId) {
      return;
    }

    const material = materialLabel(delivery);
    const driverUserId = delivery.assignedDriverProfile.userId;

    await createNotificationIfMissing({
      userId: driverUserId,
      notificationType: DRIVER_DELIVERY_NOTIFICATION_TYPES.DRIVER_DELIVERY_ACCEPTED,
      title: 'Delivery accepted',
      body: `You accepted delivery for ${material}. Check pickup details and timing.`,
      relatedEntityType: 'DELIVERY',
      relatedEntityId: delivery.id,
    });

    await createNotificationIfMissing({
      userId: delivery.reservation.requesterId,
      notificationType: 'DELIVERY_DRIVER_ASSIGNED',
      title: 'Driver assigned',
      body: 'A driver accepted your delivery request.',
      relatedEntityType: 'RESERVATION',
      relatedEntityId: delivery.reservation.id,
    });

    await createNotificationIfMissing({
      userId: delivery.reservation.ownerId,
      notificationType: 'DELIVERY_DRIVER_ASSIGNED',
      title: 'Driver assigned',
      body: `A driver accepted delivery for ${material}.`,
      relatedEntityType: 'RESERVATION',
      relatedEntityId: delivery.reservation.id,
    });
  });

const nextStepMessage = (
  status: DeliveryStatus,
  material: string,
): { title: string; body: string } | null => {
  switch (status) {
    case 'PICKED_UP':
      return {
        title: 'Material picked up',
        body: `Head to the learner drop-off location for ${material}.`,
      };
    case 'ON_THE_WAY':
      return {
        title: 'Delivery in progress',
        body: 'Continue to the learner drop-off location.',
      };
    case 'ARRIVED_DROPOFF':
      return {
        title: 'Confirm delivery',
        body: 'Confirm delivery with the learner handover code.',
      };
    default:
      return null;
  }
};

export const notifyDriverDeliveryNextStep = async (
  deliveryId: string,
  newStatus: DeliveryStatus,
) =>
  notifySafely(async () => {
    const delivery = await loadDeliveryContext(deliveryId);
    if (!delivery?.assignedDriverProfile?.userId) {
      return;
    }

    const message = nextStepMessage(newStatus, materialLabel(delivery));
    if (!message) {
      return;
    }

    await createNotificationIfMissing({
      userId: delivery.assignedDriverProfile.userId,
      notificationType:
        DRIVER_DELIVERY_NOTIFICATION_TYPES.DRIVER_DELIVERY_NEXT_STEP,
      title: message.title,
      body: message.body,
      relatedEntityType: 'DELIVERY',
      relatedEntityId: `${delivery.id}:${newStatus}`,
    });
  });

const syncPickupReminders = async (
  delivery: DeliveryNotificationContext,
  driverUserId: string,
  now: Date,
) => {
  if (!beforePickupStatuses.has(delivery.status)) {
    return;
  }

  const windowStart = delivery.reservation.supplierPickupWindowStart;
  const windowEnd = delivery.reservation.supplierPickupWindowEnd;
  const material = materialLabel(delivery);

  if (windowStart) {
    const startsSoonAt = new Date(windowStart.getTime() - REMINDER_LOOKAHEAD_MS);
    if (now >= startsSoonAt && now < windowStart) {
      await createNotificationIfMissing({
        userId: driverUserId,
        notificationType:
          DRIVER_DELIVERY_NOTIFICATION_TYPES.DRIVER_PICKUP_STARTING_SOON,
        title: 'Pickup starts soon',
        body: `Pickup for ${material} starts at ${formatNotificationTime(windowStart)}.`,
        relatedEntityType: 'DELIVERY',
        relatedEntityId: delivery.id,
      });
    }

    if (now >= windowStart && !pickedUpOrLaterStatuses.has(delivery.status)) {
      await createNotificationIfMissing({
        userId: driverUserId,
        notificationType:
          DRIVER_DELIVERY_NOTIFICATION_TYPES.DRIVER_PICKUP_WINDOW_STARTED,
        title: 'Pickup window started',
        body: `Pickup window for ${material} is now open.`,
        relatedEntityType: 'DELIVERY',
        relatedEntityId: delivery.id,
      });
    }
  }

  if (
    windowEnd &&
    now > windowEnd &&
    !pickedUpOrLaterStatuses.has(delivery.status)
  ) {
    await createNotificationIfMissing({
      userId: driverUserId,
      notificationType: DRIVER_DELIVERY_NOTIFICATION_TYPES.DRIVER_PICKUP_OVERDUE,
      title: 'Pickup overdue',
      body: `Pickup window for ${material} has passed. Please update the delivery status or report an issue.`,
      relatedEntityType: 'DELIVERY',
      relatedEntityId: delivery.id,
    });
  }
};

const syncDropoffReminders = async (
  delivery: DeliveryNotificationContext,
  driverUserId: string,
  now: Date,
) => {
  if (!inTransitStatuses.has(delivery.status)) {
    return;
  }

  const windowStart = delivery.reservation.confirmedDeliveryWindowStart;
  const windowEnd = delivery.reservation.confirmedDeliveryWindowEnd;
  if (!windowStart || !windowEnd) {
    return;
  }

  const material = materialLabel(delivery);
  const startsSoonAt = new Date(windowStart.getTime() - REMINDER_LOOKAHEAD_MS);

  if (now >= startsSoonAt && now < windowStart) {
    await createNotificationIfMissing({
      userId: driverUserId,
      notificationType:
        DRIVER_DELIVERY_NOTIFICATION_TYPES.DRIVER_DROPOFF_STARTING_SOON,
      title: 'Drop-off starts soon',
      body: `Drop-off for ${material} starts at ${formatNotificationTime(windowStart)}.`,
      relatedEntityType: 'DELIVERY',
      relatedEntityId: delivery.id,
    });
  }

  if (now >= windowStart && delivery.status !== 'DELIVERED') {
    await createNotificationIfMissing({
      userId: driverUserId,
      notificationType:
        DRIVER_DELIVERY_NOTIFICATION_TYPES.DRIVER_DROPOFF_WINDOW_STARTED,
      title: 'Drop-off window started',
      body: `Drop-off window for ${material} is now open.`,
      relatedEntityType: 'DELIVERY',
      relatedEntityId: delivery.id,
    });
  }

  if (now > windowEnd && delivery.status !== 'DELIVERED') {
    await createNotificationIfMissing({
      userId: driverUserId,
      notificationType: DRIVER_DELIVERY_NOTIFICATION_TYPES.DRIVER_DROPOFF_OVERDUE,
      title: 'Drop-off overdue',
      body: `Drop-off window for ${material} has passed. Please update the delivery status.`,
      relatedEntityType: 'DELIVERY',
      relatedEntityId: delivery.id,
    });
  }
};

const syncDeliveryReminders = async (
  delivery: DeliveryNotificationContext,
  driverUserId: string,
  now: Date,
) => {
  await syncPickupReminders(delivery, driverUserId, now);
  await syncDropoffReminders(delivery, driverUserId, now);
};

export const resetDriverDeliveryReminderSyncThrottleForTests = () => {
  lastReminderSyncAtByUser.clear();
};

export const syncDriverDeliveryRemindersForUser = async (
  userId: string,
  options: { force?: boolean } = {},
) =>
  notifySafely(async () => {
    const syncStartedAt = Date.now();
    const lastSyncAt = lastReminderSyncAtByUser.get(userId) ?? 0;
    if (!options.force && syncStartedAt - lastSyncAt < SYNC_THROTTLE_MS) {
      return;
    }
    lastReminderSyncAtByUser.set(userId, syncStartedAt);

    const profile = await prisma.driverProfile.findFirst({
      where: { userId, status: 'ACTIVE' },
      select: { id: true },
    });

    if (!profile) {
      return;
    }

    const referenceTime = new Date();
    const deliveries = await prisma.delivery.findMany({
      where: {
        assignedDriverProfileId: profile.id,
        status: {
          in: [
            'DRIVER_ASSIGNED',
            'ARRIVED_PICKUP',
            'PICKED_UP',
            'ON_THE_WAY',
            'ARRIVED_DROPOFF',
          ],
        },
      },
      select: deliveryContextSelect,
    });

    await Promise.all(
      deliveries.map((delivery) =>
        syncDeliveryReminders(delivery, userId, referenceTime),
      ),
    );
  });
