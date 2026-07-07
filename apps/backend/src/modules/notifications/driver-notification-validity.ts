import {
  isAllowedDriverNotificationType,
  isDriverDeliveryNotificationType,
} from './driver-delivery-notification-types.js';

/** Filters disallowed driver notification types from API responses (read-only). */
export const filterNotificationsForDisplay = <
  T extends { notificationType: string },
>(
  items: T[],
) =>
  items.filter((item) => {
    if (!isDriverDeliveryNotificationType(item.notificationType)) {
      return true;
    }

    return isAllowedDriverNotificationType(item.notificationType);
  });
