import {
  createNotificationIfMissing,
  type CreateNotificationInput,
} from '../notifications/notifications.repository.js';

export type MaterialRequestFulfillmentNotificationInput = {
  requestId: string;
  learnerId: string;
  requestedItemName: string;
};

export const buildMaterialRequestFulfilledNotification = (
  input: MaterialRequestFulfillmentNotificationInput,
): CreateNotificationInput => ({
  userId: input.learnerId,
  notificationType: 'MATERIAL_REQUEST_FULFILLED',
  title: 'Material request fulfilled',
  body: `Your request "${input.requestedItemName}" was marked fulfilled after a completed reservation.`,
  relatedEntityType: 'MATERIAL_REQUEST',
  relatedEntityId: input.requestId,
  eventKey: `mr:fulfilled:${input.requestId}`,
  entityType: 'MATERIAL_REQUEST',
  entityId: input.requestId,
  actionType: 'OPEN_ENTITY',
  metadata: { requestedItemName: input.requestedItemName },
});

export const notifyMaterialRequestFulfilled = (
  input: MaterialRequestFulfillmentNotificationInput,
) => createNotificationIfMissing(buildMaterialRequestFulfilledNotification(input));
