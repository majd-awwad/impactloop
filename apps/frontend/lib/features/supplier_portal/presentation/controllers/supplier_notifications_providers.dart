import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';
import '../../application/supplier_portal_session.dart';
import '../../data/models/supplier_action_notification.dart';
import '../../data/supplier_notifications_api.dart';

final supplierNotificationsApiProvider = Provider<SupplierNotificationsApi>((
  ref,
) {
  return SupplierNotificationsApi(ref.watch(apiClientProvider));
});

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

final supplierNotificationsProvider =
    FutureProvider.autoDispose<SupplierNotificationsResult>((ref) async {
      watchSupplierPortalSessionFromRef(ref);
      return ref.read(supplierNotificationsApiProvider).fetchNotifications();
    });

final supplierActionNeededCountProvider = Provider<int>((ref) {
  return ref
      .watch(supplierNotificationsProvider)
      .maybeWhen(
        data: (result) => result.summary.actionNeededCount,
        orElse: () => 0,
      );
});
