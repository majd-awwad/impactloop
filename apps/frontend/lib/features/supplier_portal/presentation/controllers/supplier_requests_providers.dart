import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/supplier_incoming_request.dart';
import '../../data/supplier_requests_api_repository.dart';
import 'supplier_pickup_schedule_providers.dart';

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
  return ref.read(supplierRequestsRepositoryProvider).fetchIncomingRequests(tab);
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

class CompletingReservationNotifier extends Notifier<String?> {
  @override
  String? build() => null;

  void setCompleting(String? reservationId) {
    state = reservationId;
  }
}

final completingReservationIdProvider =
    NotifierProvider<CompletingReservationNotifier, String?>(
  CompletingReservationNotifier.new,
);

Future<SupplierIncomingRequest> completeIncomingRequest(
  WidgetRef ref, {
  required String requestId,
}) async {
  final result = await ref
      .read(supplierRequestsRepositoryProvider)
      .completeRequest(requestId);
  ref.invalidate(incomingRequestsProvider);
  ref.invalidate(pickupScheduleProvider);
  ref.invalidate(pickupScheduleSummaryProvider);
  return result;
}
