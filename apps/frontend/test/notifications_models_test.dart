import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/notifications/application/notification_display.dart';
import 'package:frontend/features/notifications/data/models/app_notification.dart';

void main() {
  test('AppNotificationsPage parses list payload', () {
    final page = AppNotificationsPage.fromJson({
      'items': [
        {
          'id': 'notif-1',
          'notificationType': 'RESERVATION_ACCEPTED',
          'title': 'Reservation accepted',
          'body': 'Wood panels was accepted.',
          'relatedEntityType': 'RESERVATION',
          'relatedEntityId': 'res-1',
          'isRead': false,
          'createdAt': '2026-01-01T12:00:00.000Z',
        },
      ],
      'unreadCount': 1,
      'pagination': {'page': 1, 'limit': 20, 'total': 1, 'totalPages': 1},
    });

    expect(page.items, hasLength(1));
    expect(page.items.first.notificationType, 'RESERVATION_ACCEPTED');
    expect(page.items.first.relatedEntityId, 'res-1');
    expect(page.unreadCount, 1);
  });

  test('Learning Project moderation notifications are navigable', () {
    final notification = AppNotification(
      id: 'notif-learning',
      notificationType: 'LEARNING_PROJECT_MODERATION',
      title: 'Changes requested',
      body: 'Please update your project.',
      relatedEntityType: 'LEARNING_PROJECT',
      relatedEntityId: 'project-1',
      isRead: false,
      createdAt: DateTime.utc(2026),
    );

    expect(notificationHasNavigationTarget(notification), isTrue);
    expect(notificationActionLabel(notification), 'View submission');
  });
}
