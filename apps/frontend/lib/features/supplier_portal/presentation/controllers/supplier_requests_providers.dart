import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/supplier_incoming_request.dart';
import '../../data/supplier_requests_api_repository.dart';
import '../../application/supplier_portal_session.dart';
import 'supplier_dashboard_providers.dart';
import 'supplier_notifications_providers.dart';
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
      watchSupplierPortalSessionFromRef(ref);
      final tab = ref.watch(incomingRequestTabProvider);
      return ref
          .read(supplierRequestsRepositoryProvider)
          .fetchIncomingRequests(tab);
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
  ref.invalidate(supplierNotificationsProvider);
  ref.invalidate(supplierDashboardProvider);
  ref.invalidate(pickupScheduleProvider);
  ref.invalidate(pickupScheduleSummaryProvider);
}

Future<void> declineIncomingRequest(
  WidgetRef ref, {
  required String requestId,
  String? reason,
}) async {
  await ref
      .read(supplierRequestsRepositoryProvider)
      .declineRequest(requestId, reason: reason);
  ref.invalidate(incomingRequestsProvider);
  ref.invalidate(supplierNotificationsProvider);
  ref.invalidate(supplierDashboardProvider);
  ref.invalidate(pickupScheduleProvider);
  ref.invalidate(pickupScheduleSummaryProvider);
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
  ref.invalidate(supplierNotificationsProvider);
  ref.invalidate(supplierDashboardProvider);
  ref.invalidate(pickupScheduleProvider);
  ref.invalidate(pickupScheduleSummaryProvider);
  return result;
}

void _invalidateReservationFollowUp(WidgetRef ref) {
  ref.invalidate(incomingRequestsProvider);
  ref.invalidate(supplierNotificationsProvider);
  ref.invalidate(supplierDashboardProvider);
  ref.invalidate(pickupScheduleProvider);
  ref.invalidate(pickupScheduleSummaryProvider);
}

Future<void> rescheduleIncomingRequest(
  WidgetRef ref, {
  required String requestId,
  required SupplierPickupWindow pickupWindow,
  String? messageToLearner,
}) async {
  await ref.read(supplierRequestsRepositoryProvider).rescheduleRequest(
        requestId,
        pickupWindow,
        messageToLearner: messageToLearner,
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
