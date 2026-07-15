import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';
import '../../application/supplier_portal_session.dart';
import '../../data/models/supplier_action_notification.dart';
import '../../data/supplier_notifications_api.dart';

final supplierNotificationsApiProvider = Provider<SupplierNotificationsApi>(
  (ref) => SupplierNotificationsApi(ref.watch(apiClientProvider)),
);

class SupplierNotificationFilterNotifier
    extends Notifier<SupplierNotificationFilter> {
  @override
  SupplierNotificationFilter build() => SupplierNotificationFilter.all;

  void selectFilter(SupplierNotificationFilter filter) {
    state = filter;
  }
}

final supplierNotificationFilterProvider =
    NotifierProvider<
      SupplierNotificationFilterNotifier,
      SupplierNotificationFilter
    >(SupplierNotificationFilterNotifier.new);

final supplierNotificationsProvider = FutureProvider.autoDispose
    .family<SupplierNotificationsResult, SupplierNotificationsQuery>((
      ref,
      query,
    ) async {
      watchSupplierPortalSessionFromRef(ref);
      if (!query.hasValidDateRange) {
        throw const FormatException('dateFrom must be before dateTo');
      }
      return ref
          .read(supplierNotificationsApiProvider)
          .fetchNotifications(query: query);
    });

final supplierNotificationsUnreadCountProvider =
    AsyncNotifierProvider.autoDispose<
      SupplierNotificationsUnreadCountNotifier,
      int
    >(SupplierNotificationsUnreadCountNotifier.new);

class SupplierNotificationsUnreadCountNotifier extends AsyncNotifier<int> {
  @override
  Future<int> build() async {
    watchSupplierPortalSessionFromRef(ref);
    return ref.read(supplierNotificationsApiProvider).fetchUnreadCount();
  }

  void setCount(int count) {
    state = AsyncData(count.clamp(0, 999999));
  }
}

final supplierActionNeededCountProvider = Provider<int>((ref) {
  return ref
      .watch(supplierNotificationsProvider(const SupplierNotificationsQuery()))
      .maybeWhen(
        data: (result) => result.summary.canonicalNeedsAction,
        orElse: () => 0,
      );
});

Future<void> markSupplierNotificationRead(
  WidgetRef ref,
  SupplierActionNotification notification, {
  SupplierNotificationsQuery? query,
}) async {
  if (!notification.isRead) {
    await ref.read(supplierNotificationsApiProvider).markRead(notification.id);
  }
  if (query != null) {
    ref.invalidate(supplierNotificationsProvider(query));
  } else {
    ref.invalidate(supplierNotificationsProvider);
  }
  ref.invalidate(supplierNotificationsUnreadCountProvider);
}

Future<void> markAllSupplierNotificationsRead(
  WidgetRef ref, {
  SupplierNotificationsQuery? query,
}) async {
  await ref.read(supplierNotificationsApiProvider).markAllRead();
  if (query != null) {
    ref.invalidate(supplierNotificationsProvider(query));
  } else {
    ref.invalidate(supplierNotificationsProvider);
  }
  ref.read(supplierNotificationsUnreadCountProvider.notifier).setCount(0);
  ref.invalidate(supplierNotificationsUnreadCountProvider);
}

Future<void> refreshSupplierNotifications(
  WidgetRef ref,
  SupplierNotificationsQuery query,
) async {
  ref.invalidate(supplierNotificationsProvider(query));
  ref.invalidate(supplierNotificationsUnreadCountProvider);
}
