import '../data/models/app_notification.dart';

final RegExp _testTagPattern = RegExp(r'\[test[^\]]*\]', caseSensitive: false);

String sanitizeNotificationText(String value) {
  var result = value.replaceAll(_testTagPattern, '');
  result = result.replaceAll(RegExp(r',\s*,+'), ',');
  result = result.replaceAll(RegExp(r'\s{2,}'), ' ');
  result = result.replaceAll(RegExp(r'\s+,'), ',');
  result = result.replaceAll(RegExp(r',\s*$'), '');
  result = result.replaceAll(RegExp(r'^\s*,\s*'), '');
  return result.trim();
}

AppNotification sanitizeNotification(AppNotification notification) {
  return notification.copyWith(
    title: sanitizeNotificationText(notification.title).isEmpty
        ? 'Notification'
        : sanitizeNotificationText(notification.title),
    body: sanitizeNotificationText(notification.body),
  );
}

enum NotificationVisualCategory {
  job,
  reminder,
  deliveryUpdate,
  account,
  general,
}

NotificationVisualCategory categoryForNotification(AppNotification notification) {
  switch (notification.notificationType) {
    case 'DRIVER_DELIVERY_AVAILABLE':
      return NotificationVisualCategory.job;
    case 'DRIVER_PICKUP_STARTING_SOON':
    case 'DRIVER_PICKUP_WINDOW_STARTED':
    case 'DRIVER_PICKUP_OVERDUE':
    case 'DRIVER_DROPOFF_STARTING_SOON':
    case 'DRIVER_DROPOFF_WINDOW_STARTED':
    case 'DRIVER_DROPOFF_OVERDUE':
      return NotificationVisualCategory.reminder;
    case 'DRIVER_DELIVERY_ACCEPTED':
    case 'DRIVER_DELIVERY_NEXT_STEP':
    case 'DELIVERY_DRIVER_ASSIGNED':
      return NotificationVisualCategory.deliveryUpdate;
    default:
      if (notification.notificationType.contains('VERIFICATION') ||
          notification.notificationType.contains('ACCOUNT')) {
        return NotificationVisualCategory.account;
      }
      return NotificationVisualCategory.general;
  }
}

String notificationTypeChipLabel(NotificationVisualCategory category) {
  switch (category) {
    case NotificationVisualCategory.job:
      return 'Job';
    case NotificationVisualCategory.reminder:
      return 'Reminder';
    case NotificationVisualCategory.deliveryUpdate:
      return 'Delivery update';
    case NotificationVisualCategory.account:
      return 'Account';
    case NotificationVisualCategory.general:
      return 'Update';
  }
}

String notificationActionLabel(AppNotification notification) {
  if (notification.relatedEntityType == 'DELIVERY') {
    if (notification.notificationType == 'DRIVER_DELIVERY_AVAILABLE') {
      return 'View jobs';
    }
    return 'View delivery';
  }
  if (notification.relatedEntityType == 'RESERVATION') {
    return 'View reservation';
  }
  return 'Open';
}

bool notificationHasNavigationTarget(AppNotification notification) {
  return (notification.relatedEntityType == 'DELIVERY' ||
          notification.relatedEntityType == 'RESERVATION') &&
      notification.relatedEntityId != null &&
      notification.relatedEntityId!.isNotEmpty;
}
