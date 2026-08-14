import { prisma } from '../../database/prisma.js';
import { createNotificationIfMissing } from '../notifications/notifications.repository.js';
import { DRIVER_NOTIFICATION_TYPES } from '../notifications/driver-delivery-notification-types.js';

export const notifyDeliveryReturnRequired = async (
  deliveryId: string,
  reason: 'FINAL_ATTEMPT_FAILED' | 'RETRY_DEADLINE_EXPIRED',
) => {
  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    select: {
      reservation: { select: { requesterId: true, ownerId: true } },
      assignedDriverProfile: { select: { userId: true } },
    },
  });
  if (!delivery?.assignedDriverProfile) return;
  const event = `delivery-return-required:${deliveryId}:${reason}`;
  await Promise.all([
    createNotificationIfMissing({
      userId: delivery.assignedDriverProfile.userId,
      notificationType:
        DRIVER_NOTIFICATION_TYPES.DRIVER_DELIVERY_RETURN_REQUIRED,
      title: 'Return to supplier required',
      body: 'Return the material to the supplier and wait for receipt confirmation.',
      relatedEntityType: 'DELIVERY',
      relatedEntityId: deliveryId,
      eventKey: `${event}:driver`,
    }),
    createNotificationIfMissing({
      userId: delivery.reservation.ownerId,
      notificationType: 'DELIVERY_RETURN_INCOMING',
      title: 'Material return incoming',
      body: 'The delivery could not be completed. Confirm receipt when the driver returns the material.',
      relatedEntityType: 'DELIVERY',
      relatedEntityId: deliveryId,
      eventKey: `${event}:supplier`,
    }),
    createNotificationIfMissing({
      userId: delivery.reservation.requesterId,
      notificationType: 'DELIVERY_RETURN_REQUIRED',
      title: 'Delivery under review',
      body: 'The delivery could not be completed and the material is being returned to the supplier. The case will be reviewed.',
      relatedEntityType: 'DELIVERY',
      relatedEntityId: deliveryId,
      eventKey: `${event}:learner`,
    }),
  ]);
};

export const notifyDeliveryReturnConfirmed = async (deliveryId: string) => {
  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    select: {
      reservation: { select: { requesterId: true } },
      returnCustodyDriverProfile: { select: { userId: true } },
    },
  });
  if (!delivery) return;
  const driverUserId = delivery.returnCustodyDriverProfile?.userId;
  await Promise.all([
    createNotificationIfMissing({
        userId: delivery.reservation.requesterId,
        notificationType: 'DELIVERY_RETURN_CONFIRMED',
        title: 'Material return confirmed',
        body: 'The supplier confirmed the material was returned. The case is awaiting administrative resolution.',
        relatedEntityType: 'DELIVERY',
        relatedEntityId: deliveryId,
        eventKey: `delivery-return-confirmed:${deliveryId}:${delivery.reservation.requesterId}`,
      }),
    ...(driverUserId
      ? [
          createNotificationIfMissing({
            userId: driverUserId,
            notificationType:
              DRIVER_NOTIFICATION_TYPES.DRIVER_DELIVERY_RETURN_CONFIRMED,
            title: 'Material return confirmed',
            body: 'The supplier confirmed receipt. Your custody and assignment have ended.',
            relatedEntityType: 'DELIVERY',
            relatedEntityId: deliveryId,
            eventKey: `delivery-return-confirmed:${deliveryId}:${driverUserId}`,
          }),
        ]
      : []),
  ]);
};
