import 'package:flutter/material.dart';

import '../application/notification_display.dart';
import '../data/models/app_notification.dart';

/// Comfortable desktop reading width for the shared notifications inbox.
const double notificationsContentMaxWidth = 720;

/// Decorative type icon for notification cards (not an interactive control).
IconData iconForNotification(AppNotification notification) {
  switch (categoryForNotification(notification)) {
    case NotificationVisualCategory.job:
      return Icons.work_outline_rounded;
    case NotificationVisualCategory.reminder:
      return Icons.schedule_outlined;
    case NotificationVisualCategory.deliveryUpdate:
      return Icons.local_shipping_outlined;
    case NotificationVisualCategory.reservation:
      return Icons.event_available_outlined;
    case NotificationVisualCategory.material:
      return Icons.inventory_2_outlined;
    case NotificationVisualCategory.learning:
      return Icons.school_outlined;
    case NotificationVisualCategory.materialRequest:
      return Icons.handshake_outlined;
    case NotificationVisualCategory.account:
      return Icons.manage_accounts_outlined;
    case NotificationVisualCategory.general:
      return Icons.info_outline_rounded;
  }
}
