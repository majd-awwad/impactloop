import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../data/notifications_api.dart';
import '../data/models/app_notification.dart';

final notificationsApiProvider = Provider<NotificationsApi>((ref) {
  return NotificationsApi(ref.watch(apiClientProvider));
});

final myNotificationsProvider =
    FutureProvider.autoDispose<AppNotificationsPage>((ref) async {
      return ref.read(notificationsApiProvider).fetchNotifications();
    });

final myNotificationUnreadCountProvider = FutureProvider.autoDispose<int>((
  ref,
) async {
  return ref.read(notificationsApiProvider).fetchUnreadCount();
});

Future<void> markNotificationRead(WidgetRef ref, String notificationId) async {
  await ref.read(notificationsApiProvider).markRead(notificationId);
  ref.invalidate(myNotificationsProvider);
  ref.invalidate(myNotificationUnreadCountProvider);
}

Future<void> markAllNotificationsRead(WidgetRef ref) async {
  await ref.read(notificationsApiProvider).markAllRead();
  ref.invalidate(myNotificationsProvider);
  ref.invalidate(myNotificationUnreadCountProvider);
}
