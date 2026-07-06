import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_client.dart';
import '../../auth/application/auth_controller.dart';
import '../data/notifications_api.dart';
import '../data/models/app_notification.dart';
import 'notification_display.dart';

const notificationsPageSize = 20;

enum NotificationReadFilter { all, unread, read }

bool? isReadQueryForFilter(NotificationReadFilter filter) {
  switch (filter) {
    case NotificationReadFilter.all:
      return null;
    case NotificationReadFilter.unread:
      return false;
    case NotificationReadFilter.read:
      return true;
  }
}

typedef _AuthListWatchKey = (AuthStatus status, String? userId);

_AuthListWatchKey _authListWatchKey(AuthState authState) {
  return (authState.status, authState.user?.id);
}

class NotificationsListState {
  const NotificationsListState({
    required this.items,
    required this.page,
    required this.totalPages,
    required this.total,
    required this.unreadCount,
    required this.isLoadingMore,
    required this.filter,
  });

  final List<AppNotification> items;
  final int page;
  final int totalPages;
  final int total;
  final int unreadCount;
  final bool isLoadingMore;
  final NotificationReadFilter filter;

  bool get hasMore => page < totalPages;

  NotificationsListState copyWith({
    List<AppNotification>? items,
    int? page,
    int? totalPages,
    int? total,
    int? unreadCount,
    bool? isLoadingMore,
    NotificationReadFilter? filter,
  }) {
    return NotificationsListState(
      items: items ?? this.items,
      page: page ?? this.page,
      totalPages: totalPages ?? this.totalPages,
      total: total ?? this.total,
      unreadCount: unreadCount ?? this.unreadCount,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      filter: filter ?? this.filter,
    );
  }
}

final notificationsApiProvider = Provider<NotificationsApi>((ref) {
  return NotificationsApi(ref.read(apiClientProvider));
});

final notificationReadFilterProvider =
    NotifierProvider.autoDispose<
      NotificationReadFilterNotifier,
      NotificationReadFilter
    >(NotificationReadFilterNotifier.new);

class NotificationReadFilterNotifier extends Notifier<NotificationReadFilter> {
  @override
  NotificationReadFilter build() => NotificationReadFilter.all;

  void setFilter(NotificationReadFilter filter) {
    if (state == filter) {
      return;
    }
    state = filter;
  }
}

final notificationsListProvider =
    AsyncNotifierProvider.autoDispose<
      NotificationsListNotifier,
      NotificationsListState
    >(NotificationsListNotifier.new);

class NotificationsListNotifier extends AsyncNotifier<NotificationsListState> {
  @override
  Future<NotificationsListState> build() async {
    final authKey = ref.watch(
      authControllerProvider.select(_authListWatchKey),
    );
    final filter = ref.watch(notificationReadFilterProvider);

    if (authKey.$1 == AuthStatus.unknown) {
      throw const ApiException(
        message: 'Checking your session…',
        code: 'AUTH_PENDING',
      );
    }

    if (authKey.$1 != AuthStatus.authenticated || authKey.$2 == null) {
      throw const ApiException(
        message: 'Sign in to view notifications.',
        code: 'UNAUTHENTICATED',
      );
    }

    return _fetchPage(filter, page: 1);
  }

  Future<NotificationsListState> _fetchPage(
    NotificationReadFilter filter, {
    required int page,
  }) async {
    final result = await ref.read(notificationsApiProvider).fetchNotifications(
      page: page,
      limit: notificationsPageSize,
      isRead: isReadQueryForFilter(filter),
    );

    if (!ref.mounted) {
      throw const ApiException(
        message: 'Notifications request cancelled.',
        code: 'CANCELLED',
      );
    }

    return NotificationsListState(
      items: result.items.map(sanitizeNotification).toList(growable: false),
      page: result.page,
      totalPages: result.totalPages,
      total: result.total,
      unreadCount: result.unreadCount,
      isLoadingMore: false,
      filter: filter,
    );
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || !current.hasMore || current.isLoadingMore) {
      return;
    }

    state = AsyncData(current.copyWith(isLoadingMore: true));

    try {
      final nextPage = await _fetchPage(current.filter, page: current.page + 1);
      if (!ref.mounted) {
        return;
      }

      final latest = state.value ?? current;
      state = AsyncData(
        latest.copyWith(
          items: [...latest.items, ...nextPage.items],
          page: nextPage.page,
          totalPages: nextPage.totalPages,
          total: nextPage.total,
          unreadCount: nextPage.unreadCount,
          isLoadingMore: false,
        ),
      );
    } catch (error) {
      if (!ref.mounted) {
        return;
      }

      final latest = state.value;
      if (latest != null) {
        state = AsyncData(latest.copyWith(isLoadingMore: false));
      }
      rethrow;
    }
  }

  void applyReadLocal(String notificationId) {
    if (!ref.mounted) {
      return;
    }

    final current = state.value;
    if (current == null) {
      return;
    }

    final wasUnread = current.items.any(
      (item) => item.id == notificationId && !item.isRead,
    );
    final updatedItems = current.filter == NotificationReadFilter.unread
        ? current.items
              .where((item) => item.id != notificationId)
              .toList(growable: false)
        : current.items
              .map(
                (item) => item.id == notificationId
                    ? item.copyWith(isRead: true)
                    : item,
              )
              .toList(growable: false);

    state = AsyncData(
      current.copyWith(
        items: updatedItems,
        unreadCount: wasUnread
            ? (current.unreadCount - 1).clamp(0, current.unreadCount)
            : current.unreadCount,
      ),
    );
  }

  Future<void> markReadLocal(String notificationId) async {
    final current = state.value;
    final wasUnread =
        current?.items.any(
          (item) => item.id == notificationId && !item.isRead,
        ) ??
        false;

    await ref.read(notificationsApiProvider).markRead(notificationId);

    if (!ref.mounted) {
      return;
    }

    applyReadLocal(notificationId);

    if (wasUnread) {
      ref.read(myNotificationUnreadCountProvider.notifier).adjustBy(-1);
    }
  }

  void markAllReadLocal() {
    if (!ref.mounted) {
      return;
    }

    final current = state.value;
    if (current == null) {
      return;
    }

    state = AsyncData(
      current.copyWith(
        items: current.items
            .map((item) => item.copyWith(isRead: true))
            .toList(growable: false),
        unreadCount: 0,
      ),
    );
  }
}

final myNotificationUnreadCountProvider =
    AsyncNotifierProvider<NotificationUnreadCountNotifier, int>(
      NotificationUnreadCountNotifier.new,
    );

class NotificationUnreadCountNotifier extends AsyncNotifier<int> {
  @override
  Future<int> build() async {
    final authKey = ref.watch(
      authControllerProvider.select(_authListWatchKey),
    );

    if (authKey.$1 == AuthStatus.unknown) {
      return 0;
    }

    if (authKey.$1 != AuthStatus.authenticated || authKey.$2 == null) {
      return 0;
    }

    return ref.read(notificationsApiProvider).fetchUnreadCount();
  }

  void adjustBy(int delta) {
    final current = state.value;
    if (current == null) {
      return;
    }

    state = AsyncData((current + delta).clamp(0, 999999));
  }

  void setCount(int count) {
    state = AsyncData(count.clamp(0, 999999));
  }
}

Future<void> refreshNotifications(WidgetRef ref) async {
  if (ref.exists(notificationsListProvider)) {
    ref.invalidate(notificationsListProvider);
  }
  ref.invalidate(myNotificationUnreadCountProvider);
}

Future<void> setNotificationReadFilter(
  WidgetRef ref,
  NotificationReadFilter filter,
) async {
  ref.read(notificationReadFilterProvider.notifier).setFilter(filter);
}

Future<void> markNotificationRead(WidgetRef ref, String notificationId) async {
  if (ref.exists(notificationsListProvider)) {
    await ref.read(notificationsListProvider.notifier).markReadLocal(
      notificationId,
    );
    return;
  }

  await markNotificationReadWithoutList(ref, notificationId);
}

Future<void> markNotificationReadWithoutList(
  WidgetRef ref,
  String notificationId,
) async {
  await ref.read(notificationsApiProvider).markRead(notificationId);
  ref.read(myNotificationUnreadCountProvider.notifier).adjustBy(-1);
}

Future<void> markAllNotificationsRead(WidgetRef ref) async {
  await ref.read(notificationsApiProvider).markAllRead();
  ref.read(myNotificationUnreadCountProvider.notifier).setCount(0);

  if (ref.exists(notificationsListProvider)) {
    ref.read(notificationsListProvider.notifier).markAllReadLocal();
  }
}

bool isAuthPendingNotificationError(Object error) {
  return error is ApiException && error.code == 'AUTH_PENDING';
}

bool isCancelledNotificationError(Object error) {
  return error is ApiException && error.code == 'CANCELLED';
}
