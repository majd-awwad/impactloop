import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/notifications/application/notification_display.dart';
import 'package:frontend/features/notifications/data/models/app_notification.dart';

AppNotification _deliveryNotification({
  required String notificationType,
  String deliveryId = 'delivery-1',
}) {
  return AppNotification(
    id: 'notif-1',
    notificationType: notificationType,
    title: 'Delivery moved to admin review',
    body:
        'Delivery moved to admin review because pickup was not completed within the pickup window.',
    relatedEntityType: 'DELIVERY',
    relatedEntityId: deliveryId,
    isRead: false,
    createdAt: DateTime.utc(2026),
  );
}

AppNotification _materialRequestNotification({
  required String notificationType,
  String requestId = 'req-1',
}) {
  return AppNotification(
    id: 'notif-mr-1',
    notificationType: notificationType,
    title: 'Material request update',
    body: 'A supplier suggested a material for your request.',
    relatedEntityType: 'MATERIAL_REQUEST',
    relatedEntityId: requestId,
    isRead: false,
    createdAt: DateTime.utc(2026),
  );
}

void main() {
  group('driver moved-to-admin-review notification display', () {
    test('renders friendly delivery-update category instead of raw enum', () {
      final notification = _deliveryNotification(
        notificationType: 'DRIVER_DELIVERY_MOVED_TO_ADMIN_REVIEW',
      );
      final sanitized = sanitizeNotification(notification);

      expect(
        categoryForNotification(notification),
        NotificationVisualCategory.deliveryUpdate,
      );
      expect(
        notificationTypeChipLabel(categoryForNotification(notification)),
        'Delivery update',
      );
      expect(sanitized.title, 'Delivery moved to admin review');
      expect(sanitized.body, contains('pickup was not completed'));
      expect(sanitized.title, isNot(contains('DRIVER_DELIVERY_MOVED')));
    });

    test(
      'uses inactive delivery detail route for moved-to-admin-review tap',
      () {
        final notification = _deliveryNotification(
          notificationType: 'DRIVER_DELIVERY_MOVED_TO_ADMIN_REVIEW',
          deliveryId: 'delivery-42',
        );

        expect(notificationHasNavigationTarget(notification), isTrue);
        expect(notificationActionLabel(notification), 'View details');
        expect(
          driverDeliveryNotificationRoute(notification),
          '/driver/deliveries/delivery-42',
        );
      },
    );

    test('new job notifications still route to jobs board', () {
      final notification = _deliveryNotification(
        notificationType: 'DRIVER_NEW_JOB',
        deliveryId: 'delivery-99',
      );

      expect(notificationActionLabel(notification), 'View jobs');
      expect(driverDeliveryNotificationRoute(notification), '/driver/jobs');
    });

    test('unknown notification types keep safe fallback labels', () {
      final notification = AppNotification(
        id: 'notif-unknown',
        notificationType: 'LEGACY_UNKNOWN_EVENT',
        title: 'Something happened',
        body: 'Please check your account.',
        isRead: false,
        createdAt: DateTime.utc(2026),
      );

      expect(
        categoryForNotification(notification),
        NotificationVisualCategory.general,
      );
      expect(
        notificationTypeChipLabel(NotificationVisualCategory.general),
        'Update',
      );
      expect(notificationActionLabel(notification), 'Open');
      expect(notificationHasNavigationTarget(notification), isFalse);
      expect(driverDeliveryNotificationRoute(notification), isNull);
    });
  });

  group('learner material request notification display', () {
    test('suggestion notification routes to request details', () {
      final notification = _materialRequestNotification(
        notificationType: 'MATERIAL_REQUEST_SUGGESTION',
        requestId: 'req-abc',
      );

      expect(notificationHasNavigationTarget(notification), isTrue);
      expect(notificationActionLabel(notification), 'View request');
      expect(
        materialRequestNotificationRoute(notification),
        '/learner/material-requests/req-abc',
      );
    });

    test('unavailable-match notification routes to the same request details', () {
      final notification = _materialRequestNotification(
        notificationType: 'MATERIAL_REQUEST_MATCH_UNAVAILABLE',
        requestId: 'req-xyz',
      );

      expect(notificationHasNavigationTarget(notification), isTrue);
      expect(
        materialRequestNotificationRoute(notification),
        '/learner/material-requests/req-xyz',
      );
    });

    test('reservation navigation remains unchanged', () {
      final notification = AppNotification(
        id: 'notif-res',
        notificationType: 'RESERVATION_ACCEPTED',
        title: 'Reservation accepted',
        body: 'Your reservation was accepted.',
        relatedEntityType: 'RESERVATION',
        relatedEntityId: 'res-1',
        isRead: false,
        createdAt: DateTime.utc(2026),
      );

      expect(notificationHasNavigationTarget(notification), isTrue);
      expect(notificationActionLabel(notification), 'View reservation');
      expect(materialRequestNotificationRoute(notification), isNull);
      expect(driverDeliveryNotificationRoute(notification), isNull);
    });
  });
}
