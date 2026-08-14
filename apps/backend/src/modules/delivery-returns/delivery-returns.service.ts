import { AppError } from '../../utils/app-error.js';
import {
  confirmReturnedDelivery,
  listDueRetryReturnDeliveryIds,
  transitionDeliveryToReturnRequired,
} from './delivery-returns.repository.js';
import {
  notifyDeliveryReturnConfirmed,
  notifyDeliveryReturnRequired,
} from './delivery-return-notifications.js';

export const confirmSupplierDeliveryReturn = async (
  supplierUserId: string,
  deliveryId: string,
) => {
  const result = await confirmReturnedDelivery({ supplierUserId, deliveryId });
  if (result.outcome === 'NOT_FOUND') {
    throw new AppError('Delivery not found.', 404, 'NOT_FOUND');
  }
  if (result.outcome === 'INVALID_STATUS') {
    throw new AppError(
      'This delivery is not awaiting supplier return confirmation.',
      409,
      'DELIVERY_RETURN_CONFIRMATION_NOT_ALLOWED',
    );
  }
  if (result.outcome === 'CONFIRMED') {
    await notifyDeliveryReturnConfirmed(deliveryId);
  }
  return result;
};

export const expireDueDeliveryRetriesBatch = async (
  limit: number,
  now = new Date(),
) => {
  const candidates = await listDueRetryReturnDeliveryIds(limit, now);
  const transitioned: string[] = [];
  for (const candidate of candidates) {
    const result = await transitionDeliveryToReturnRequired({
      deliveryId: candidate.id,
      expectedStatuses: ['REDELIVERY_PENDING', 'REDELIVERY_SCHEDULED'],
      reason: 'RETRY_DEADLINE_EXPIRED',
      now,
    });
    if (result.outcome === 'UPDATED') {
      transitioned.push(candidate.id);
      await notifyDeliveryReturnRequired(candidate.id, 'RETRY_DEADLINE_EXPIRED');
    }
  }
  return { dueCount: candidates.length, transitioned };
};
