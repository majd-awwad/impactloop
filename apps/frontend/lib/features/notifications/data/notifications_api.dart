import 'package:dio/dio.dart';

import '../../../core/network/api_response.dart';
import 'models/app_notification.dart';

class NotificationsApi {
  const NotificationsApi(this._client);

  final Dio _client;

  Future<AppNotificationsPage> fetchNotifications({
    int page = 1,
    int limit = 20,
    bool? isRead,
  }) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/notifications',
        queryParameters: {
          'page': page,
          'limit': limit,
          if (isRead != null) 'isRead': isRead.toString(),
        },
      ),
      AppNotificationsPage.fromJson,
    );
  }

  Future<int> fetchUnreadCount() {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('/api/notifications/unread-count'),
      (json) => (json['unreadCount'] as num?)?.toInt() ?? 0,
    );
  }

  Future<AppNotification> markRead(String notificationId) {
    return unwrapApiResponse(
      _client.patch<Map<String, dynamic>>(
        '/api/notifications/$notificationId/read',
      ),
      (json) {
        final notification = json['notification'];
        if (notification is Map<String, dynamic>) {
          return AppNotification.fromJson(notification);
        }

        return AppNotification.fromJson(const {});
      },
    );
  }

  Future<void> markAllRead() {
    return unwrapApiResponse(
      _client.patch<Map<String, dynamic>>('/api/notifications/read-all'),
      (_) {},
    );
  }
}
