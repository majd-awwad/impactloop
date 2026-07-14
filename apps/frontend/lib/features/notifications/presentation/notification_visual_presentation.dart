import '../../../shared/widgets/app_status_badge.dart';
import '../application/notification_display.dart';

/// Maps notification categories to the app-wide semantic tone contract.
AppStatusTone notificationVisualTone(NotificationVisualCategory category) {
  return switch (category) {
    NotificationVisualCategory.job => AppStatusTone.primary,
    NotificationVisualCategory.reminder => AppStatusTone.warning,
    NotificationVisualCategory.deliveryUpdate => AppStatusTone.info,
    NotificationVisualCategory.account => AppStatusTone.info,
    NotificationVisualCategory.general => AppStatusTone.neutral,
  };
}
