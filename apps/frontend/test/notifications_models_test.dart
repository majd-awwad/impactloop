import 'package:flutter_test/flutter_test.dart';

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
      'pagination': {
        'page': 1,
        'limit': 20,
        'total': 1,
        'totalPages': 1,
      },
    });

    expect(page.items, hasLength(1));
    expect(page.items.first.notificationType, 'RESERVATION_ACCEPTED');
    expect(page.items.first.relatedEntityId, 'res-1');
    expect(page.unreadCount, 1);
  });
}
