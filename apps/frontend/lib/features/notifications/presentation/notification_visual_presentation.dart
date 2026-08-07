import '../../../shared/widgets/app_status_badge.dart';
import '../application/notification_display.dart';
import '../application/payment_notification_presentation.dart';
import '../data/models/app_notification.dart';

/// Maps notification categories to the app-wide semantic tone contract.
AppStatusTone notificationVisualTone(NotificationVisualCategory category) {
  return switch (category) {
    NotificationVisualCategory.job => AppStatusTone.primary,
    NotificationVisualCategory.reminder => AppStatusTone.warning,
    NotificationVisualCategory.deliveryUpdate => AppStatusTone.info,
    NotificationVisualCategory.reservation => AppStatusTone.primary,
    NotificationVisualCategory.payment => AppStatusTone.warning,
    NotificationVisualCategory.refund => AppStatusTone.info,
    NotificationVisualCategory.material => AppStatusTone.info,
    NotificationVisualCategory.learning => AppStatusTone.success,
    NotificationVisualCategory.materialRequest => AppStatusTone.warning,
    NotificationVisualCategory.account => AppStatusTone.info,
    NotificationVisualCategory.general => AppStatusTone.neutral,
  };
}

/// Tone for a concrete notification, with payment-specific overrides.
AppStatusTone toneForNotification(AppNotification notification) {
  if (isPaymentNotification(notification)) {
    return paymentNotificationTone(notification);
  }
  return notificationVisualTone(categoryForNotification(notification));
}
