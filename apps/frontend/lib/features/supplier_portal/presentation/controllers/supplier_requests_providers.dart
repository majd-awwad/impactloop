import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/supplier_incoming_request.dart';
import '../../data/supplier_requests_api_repository.dart';
import '../../application/supplier_portal_session.dart';
import '../../application/reservation_sync.dart';

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
      watchSupplierPortalSessionFromRef(ref);
      final tab = ref.watch(incomingRequestTabProvider);
      return ref
          .read(supplierRequestsRepositoryProvider)
          .fetchIncomingRequests(tab);
    });

Future<SupplierIncomingRequest> acceptIncomingRequest(
  WidgetRef ref, {
  required String requestId,
  required SupplierPickupWindow pickupWindow,
}) async {
  final updated = await ref
      .read(supplierRequestsRepositoryProvider)
      .acceptRequest(requestId, pickupWindow);
  invalidateReservationSyncProviders(ref);
  return updated;
}

Future<void> declineIncomingRequest(
  WidgetRef ref, {
  required String requestId,
  String? reason,
}) async {
  await ref
      .read(supplierRequestsRepositoryProvider)
      .declineRequest(requestId, reason: reason);
  invalidateReservationSyncProviders(ref);
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
  required String confirmationCode,
}) async {
  final result = await ref
      .read(supplierRequestsRepositoryProvider)
      .completeRequest(
        requestId,
        confirmationCode: confirmationCode,
      );
  invalidateReservationSyncProviders(ref);
  return result;
}

void _invalidateReservationFollowUp(WidgetRef ref) {
  invalidateReservationSyncProviders(ref);
}

Future<void> rescheduleIncomingRequest(
  WidgetRef ref, {
  required String requestId,
  required SupplierPickupWindow pickupWindow,
  required String reason,
  String? messageToLearner,
  String? note,
}) async {
  await ref.read(supplierRequestsRepositoryProvider).rescheduleRequest(
        requestId,
        pickupWindow,
        reason: reason,
        messageToLearner: messageToLearner,
        note: note,
      );
  _invalidateReservationFollowUp(ref);
}

Future<void> acceptLearnerReschedule(
  WidgetRef ref, {
  required String requestId,
}) async {
  await ref
      .read(supplierRequestsRepositoryProvider)
      .acceptLearnerReschedule(requestId);
  _invalidateReservationFollowUp(ref);
}

Future<void> submitNoDriverPickupWindow(
  WidgetRef ref, {
  required String requestId,
  required SupplierPickupWindow pickupWindow,
}) async {
  await ref.read(supplierRequestsRepositoryProvider).submitNoDriverPickupWindow(
        requestId,
        pickupWindow,
      );
  _invalidateReservationFollowUp(ref);
}

Future<void> cancelIncomingRequest(
  WidgetRef ref, {
  required String requestId,
  String? reason,
}) async {
  await ref
      .read(supplierRequestsRepositoryProvider)
      .cancelAcceptedRequest(requestId, reason: reason);
  _invalidateReservationFollowUp(ref);
}

Future<void> reportNoShowForRequest(
  WidgetRef ref, {
  required String requestId,
  required String reasonCode,
  String? note,
}) async {
  await ref.read(supplierRequestsRepositoryProvider).submitNoShowReport(
        requestId,
        reasonCode: reasonCode,
        note: note,
      );
  _invalidateReservationFollowUp(ref);
}

Future<void> markLearnerNoShowForRequest(
  WidgetRef ref, {
  required String requestId,
}) async {
  await ref.read(supplierRequestsRepositoryProvider).markLearnerNoShow(
        requestId,
        reason: 'LEARNER_DID_NOT_ARRIVE',
      );
  _invalidateReservationFollowUp(ref);
}

Future<void> markDeliveryPickupExpiredForRequest(
  WidgetRef ref, {
  required String requestId,
}) async {
  await ref
      .read(supplierRequestsRepositoryProvider)
      .markDeliveryPickupExpired(requestId);
  _invalidateReservationFollowUp(ref);
}

Future<void> reportNoDriverAvailableForRequest(
  WidgetRef ref, {
  required String requestId,
  required String note,
}) async {
  await ref.read(supplierRequestsRepositoryProvider).reportNoDriverAvailable(
        requestId,
        note: note,
      );
  _invalidateReservationFollowUp(ref);
}

Future<void> markDriverNoShowForDelivery(
  WidgetRef ref, {
  required String deliveryId,
  required String note,
}) async {
  await ref.read(supplierRequestsRepositoryProvider).markDriverNoShow(
        deliveryId,
        note: note,
      );
  _invalidateReservationFollowUp(ref);
}
