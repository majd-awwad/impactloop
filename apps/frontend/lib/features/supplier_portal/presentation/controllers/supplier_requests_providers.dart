import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/supplier_incoming_request.dart';
import '../../data/supplier_requests_api_repository.dart';

export '../../data/supplier_requests_api_repository.dart'
    show supplierRequestsRepositoryProvider;

class IncomingRequestTabNotifier extends Notifier<SupplierIncomingRequestTab> {
  @override
  SupplierIncomingRequestTab build() => SupplierIncomingRequestTab.pending;

  void selectTab(SupplierIncomingRequestTab tab) {
    state = tab;
  }
}

final incomingRequestTabProvider =
    NotifierProvider<IncomingRequestTabNotifier, SupplierIncomingRequestTab>(
  IncomingRequestTabNotifier.new,
);

final incomingRequestsProvider =
    FutureProvider.autoDispose<List<SupplierIncomingRequest>>((ref) async {
  final tab = ref.watch(incomingRequestTabProvider);
  return ref.watch(supplierRequestsRepositoryProvider).fetchIncomingRequests(tab);
});

Future<void> acceptIncomingRequest(
  WidgetRef ref, {
  required String requestId,
  required SupplierPickupWindow pickupWindow,
}) async {
  await ref
      .read(supplierRequestsRepositoryProvider)
      .acceptRequest(requestId, pickupWindow);
  ref.invalidate(incomingRequestsProvider);
}

Future<void> declineIncomingRequest(
  WidgetRef ref, {
  required String requestId,
  String? reason,
}) async {
  await ref.read(supplierRequestsRepositoryProvider).declineRequest(
        requestId,
        reason: reason,
      );
  ref.invalidate(incomingRequestsProvider);
}
