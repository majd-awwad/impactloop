/**
 * @deprecated Import from driver-notification-events.service.js instead.
 * Re-exports kept for backward compatibility during migration.
 */
export {
  notifyNewDriverJob,
  notifyNewJobForReservationWaitingDelivery,
  notifyDriverPickupTime,
  notifyDriverDropoffTime,
  syncDueDriverTimeRemindersForUser,
  clearUnreadNewJobNotificationsForDelivery,
  notifyDriverDeliveryMovedToAdminReview,
  resetDriverDeliveryReminderSyncThrottleForTests,
} from './driver-notification-events.service.js';

export {
  isAllowedDriverNotificationType,
  isDriverDeliveryNotificationType,
} from './driver-delivery-notification-types.js';

/** @deprecated Use notifyNewDriverJob */
export { notifyNewDriverJob as notifyNewDeliveryJobAvailable } from './driver-notification-events.service.js';

/** @deprecated Use notifyNewDriverJob */
export { notifyNewDriverJob as notifyDriverDeliveryRequestCreated } from './driver-notification-events.service.js';

/** @deprecated Use clearUnreadNewJobNotificationsForDelivery */
export { clearUnreadNewJobNotificationsForDelivery as removeJobAvailableNotificationsForDelivery } from './driver-notification-events.service.js';

/** @deprecated Use notifyDriverPickupTime */
export { notifyDriverPickupTime as syncPickupReminderForDelivery } from './driver-notification-events.service.js';

/** @deprecated Use notifyDriverDropoffTime */
export { notifyDriverDropoffTime as syncDropoffReminderForDelivery } from './driver-notification-events.service.js';

/** @deprecated Use syncDueDriverTimeRemindersForUser */
export { syncDueDriverTimeRemindersForUser as syncDueDriverDeliveryRemindersForUser } from './driver-notification-events.service.js';

/** @deprecated Disabled */
export const ensureDriverJobAvailableNotifications = async (
  _driverUserId: string,
  _waitingDeliveryIds: string[],
) => {};

/** @deprecated Disabled */
export const syncDriverDeliveryRemindersForUser = async (
  _userId: string,
  _options: { force?: boolean } = {},
) => {};
