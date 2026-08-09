import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_client.dart';
import '../../auth/application/auth_controller.dart';
import '../../deliveries/application/learner_deliveries_provider.dart';
import '../../payments/application/learner_checkout_controller.dart';
import '../../reservations/application/learner_reservation_cache.dart';
import '../data/notifications_api.dart';
import '../data/models/app_notification.dart';
import 'notification_display.dart';
import 'payment_notification_presentation.dart';

const notificationsPageSize = 20;
const notificationsPollInterval = Duration(seconds: 30);

/// Number of open notification list screens. Badge polling pauses while > 0.
final notificationsListPageVisibleProvider =
    NotifierProvider<NotificationsListPageVisibleNotifier, int>(
      NotificationsListPageVisibleNotifier.new,
    );

class NotificationsListPageVisibleNotifier extends Notifier<int> {
  @override
  int build() => 0;

  void increment() => state++;

  void decrement() {
    if (state > 0) {
      state--;
    }
  }
}

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
    this.categoryFilter = PaymentNotificationCategoryFilter.all,
    this.isBackgroundRefreshing = false,
  });

  final List<AppNotification> items;
  final int page;
  final int totalPages;
  final int total;
  final int unreadCount;
  final bool isLoadingMore;
  final NotificationReadFilter filter;
  final PaymentNotificationCategoryFilter categoryFilter;
  final bool isBackgroundRefreshing;

  bool get hasMore => page < totalPages;

  List<AppNotification> get visibleItems {
    if (categoryFilter == PaymentNotificationCategoryFilter.all) {
      return items;
    }
    return items
        .where(
          (item) => notificationMatchesCategoryFilter(item, categoryFilter),
        )
        .toList(growable: false);
  }

  NotificationsListState copyWith({
    List<AppNotification>? items,
    int? page,
    int? totalPages,
    int? total,
    int? unreadCount,
    bool? isLoadingMore,
    NotificationReadFilter? filter,
    PaymentNotificationCategoryFilter? categoryFilter,
    bool? isBackgroundRefreshing,
  }) {
    return NotificationsListState(
      items: items ?? this.items,
      page: page ?? this.page,
      totalPages: totalPages ?? this.totalPages,
      total: total ?? this.total,
      unreadCount: unreadCount ?? this.unreadCount,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      filter: filter ?? this.filter,
      categoryFilter: categoryFilter ?? this.categoryFilter,
      isBackgroundRefreshing:
          isBackgroundRefreshing ?? this.isBackgroundRefreshing,
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

final notificationCategoryFilterProvider =
    NotifierProvider.autoDispose<
      NotificationCategoryFilterNotifier,
      PaymentNotificationCategoryFilter
    >(NotificationCategoryFilterNotifier.new);

class NotificationCategoryFilterNotifier
    extends Notifier<PaymentNotificationCategoryFilter> {
  @override
  PaymentNotificationCategoryFilter build() =>
      PaymentNotificationCategoryFilter.all;

  void setFilter(PaymentNotificationCategoryFilter filter) {
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
    final authKey = ref.watch(authControllerProvider.select(_authListWatchKey));
    final filter = ref.watch(notificationReadFilterProvider);
    final categoryFilter = ref.watch(notificationCategoryFilterProvider);

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

    final page = await _fetchPage(
      filter,
      categoryFilter: categoryFilter,
      page: 1,
    );
    return page.copyWith(categoryFilter: categoryFilter);
  }

  void applyCategoryFilter(PaymentNotificationCategoryFilter filter) {
    if (!ref.mounted) {
      return;
    }
    final current = state.value;
    if (current == null || current.categoryFilter == filter) {
      return;
    }
    state = AsyncData(current.copyWith(categoryFilter: filter));
  }

  Future<NotificationsListState> _fetchPage(
    NotificationReadFilter filter, {
    required int page,
    PaymentNotificationCategoryFilter? categoryFilter,
  }) async {
    final PaymentNotificationCategoryFilter resolvedCategory =
        categoryFilter ?? ref.read(notificationCategoryFilterProvider);
    final result = await ref
        .read(notificationsApiProvider)
        .fetchNotifications(
          page: page,
          limit: notificationsPageSize,
          isRead: isReadQueryForFilter(filter),
          category: apiCategoryForFilter(resolvedCategory),
        );

    if (!ref.mounted) {
      throw const ApiException(
        message: 'Notifications request cancelled.',
        code: 'CANCELLED',
      );
    }

    return NotificationsListState(
      items: dedupeNotificationsById(
        result.items.map(sanitizeNotification),
      ),
      page: result.page,
      totalPages: result.totalPages,
      total: result.total,
      unreadCount: result.unreadCount,
      isLoadingMore: false,
      filter: filter,
      categoryFilter: resolvedCategory,
    );
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || !current.hasMore || current.isLoadingMore) {
      return;
    }

    state = AsyncData(current.copyWith(isLoadingMore: true));

    try {
      final nextPage = await _fetchPage(
        current.filter,
        categoryFilter: current.categoryFilter,
        page: current.page + 1,
      );
      if (!ref.mounted) {
        return;
      }

      final latest = state.value ?? current;
      state = AsyncData(
        latest.copyWith(
          items: dedupeNotificationsById([
            ...latest.items,
            ...nextPage.items,
          ]),
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

  /// Background refresh that preserves the currently rendered list.
  Future<void> refreshInBackground() async {
    final current = state.value;
    if (current == null) {
      if (ref.exists(notificationsListProvider)) {
        ref.invalidateSelf();
      }
      return;
    }

    state = AsyncData(current.copyWith(isBackgroundRefreshing: true));

    try {
      final next = await _fetchPage(
        current.filter,
        categoryFilter: current.categoryFilter,
        page: 1,
      );
      if (!ref.mounted) {
        return;
      }

      state = AsyncData(
        next.copyWith(
          categoryFilter: current.categoryFilter,
          isBackgroundRefreshing: false,
        ),
      );
      ref
          .read(myNotificationUnreadCountProvider.notifier)
          .setCount(next.unreadCount);
    } catch (_) {
      if (!ref.mounted) {
        return;
      }
      final latest = state.value;
      if (latest != null) {
        state = AsyncData(latest.copyWith(isBackgroundRefreshing: false));
      }
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

    // Already-read taps must not issue a redundant mark-read mutation.
    if (!wasUnread) {
      return;
    }

    // Optimistic local + badge update so the list reflects read state
    // immediately, independent of navigation outcome.
    applyReadLocal(notificationId);
    ref.read(myNotificationUnreadCountProvider.notifier).adjustBy(-1);

    try {
      await ref.read(notificationsApiProvider).markRead(notificationId);
    } catch (_) {
      // Keep optimistic UI; a later refresh reconciles with the server.
      rethrow;
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
    final authKey = ref.watch(authControllerProvider.select(_authListWatchKey));
    final notificationsPageVisible =
        ref.watch(notificationsListPageVisibleProvider) > 0;

    if (authKey.$1 == AuthStatus.unknown) {
      return 0;
    }

    if (authKey.$1 != AuthStatus.authenticated || authKey.$2 == null) {
      return 0;
    }

    // Light polling so the bell badge updates without opening /notifications.
    // Reuses the existing unread-count endpoint — no new WebSocket system.
    // Pauses while the notifications list is open to avoid duplicate 30s timers.
    if (!notificationsPageVisible) {
      final timer = Timer.periodic(notificationsPollInterval, (_) {
        if (!ref.mounted) {
          return;
        }
        ref.invalidateSelf();
      });
      ref.onDispose(timer.cancel);
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
    final hasData = ref.read(notificationsListProvider).hasValue;
    if (hasData) {
      await ref
          .read(notificationsListProvider.notifier)
          .refreshInBackground();
      return;
    }
    ref.invalidate(notificationsListProvider);
  }
  ref.invalidate(myNotificationUnreadCountProvider);
}

Future<void> setNotificationReadFilter(
  WidgetRef ref,
  NotificationReadFilter filter,
) async {
  ref.read(notificationReadFilterProvider.notifier).setFilter(filter);
  if (ref.exists(notificationsListProvider)) {
    ref.invalidate(notificationsListProvider);
  }
}

Future<void> setNotificationCategoryFilter(
  WidgetRef ref,
  PaymentNotificationCategoryFilter filter,
) async {
  final previous = ref.read(notificationCategoryFilterProvider);
  ref.read(notificationCategoryFilterProvider.notifier).setFilter(filter);
  if (previous == filter) {
    return;
  }
  // Category is now watched by the list provider — invalidate for a truthful
  // server-side refetch of the selected family.
  if (ref.exists(notificationsListProvider)) {
    ref.invalidate(notificationsListProvider);
  }
}

Future<void> markNotificationRead(WidgetRef ref, String notificationId) async {
  if (ref.exists(notificationsListProvider)) {
    await ref
        .read(notificationsListProvider.notifier)
        .markReadLocal(notificationId);
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

/// Refresh related learner payment/reservation caches after opening a
/// payment notification.
void invalidateCachesAfterPaymentNotificationOpen(
  WidgetRef ref, {
  String? reservationId,
}) {
  refreshNotifications(ref);
  invalidateLearnerReservationCaches(ref, reservationId: reservationId);
  if (reservationId != null && reservationId.isNotEmpty) {
    ref.invalidate(learnerCheckoutControllerProvider(reservationId));
    ref.invalidate(learnerDeliveriesProvider);
  }
}

bool isAuthPendingNotificationError(Object error) {
  return error is ApiException && error.code == 'AUTH_PENDING';
}

bool isCancelledNotificationError(Object error) {
  return error is ApiException && error.code == 'CANCELLED';
}
