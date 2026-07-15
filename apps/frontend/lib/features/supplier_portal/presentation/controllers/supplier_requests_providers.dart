import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/supplier_incoming_request.dart';
import '../../data/supplier_requests_api_repository.dart';
import '../../application/supplier_portal_session.dart';
import '../../application/reservation_sync.dart';

export '../../data/supplier_requests_api_repository.dart'
    show supplierRequestsRepositoryProvider;

class SupplierRequestInboxQuery {
  const SupplierRequestInboxQuery({
    this.status,
    this.search,
    this.attentionState,
    this.fulfillmentMethod,
    this.historyScope = 'ALL',
    this.dateFrom,
    this.dateTo,
    this.page = 1,
    this.limit = 10,
  });

  final String? status;
  final String? search;
  final String? attentionState;
  final String? fulfillmentMethod;
  final String historyScope;
  final DateTime? dateFrom;
  final DateTime? dateTo;
  final int page;
  final int limit;

  bool get hasActiveFilters =>
      status != null ||
      (search?.trim().isNotEmpty ?? false) ||
      attentionState != null ||
      fulfillmentMethod != null ||
      historyScope != 'ALL' ||
      dateFrom != null ||
      dateTo != null;

  int get activeFilterCount => [
    status,
    search?.trim().isNotEmpty == true ? search : null,
    attentionState,
    fulfillmentMethod,
    historyScope != 'ALL' ? historyScope : null,
    dateFrom != null || dateTo != null ? 'date' : null,
  ].whereType<String>().length;

  SupplierRequestInboxQuery copyWith({
    String? status,
    bool clearStatus = false,
    String? search,
    bool clearSearch = false,
    String? attentionState,
    bool clearAttentionState = false,
    String? fulfillmentMethod,
    bool clearFulfillmentMethod = false,
    String? historyScope,
    DateTime? dateFrom,
    DateTime? dateTo,
    bool clearDates = false,
    int? page,
    int? limit,
  }) => SupplierRequestInboxQuery(
    status: clearStatus ? null : status ?? this.status,
    search: clearSearch ? null : search ?? this.search,
    attentionState: clearAttentionState
        ? null
        : attentionState ?? this.attentionState,
    fulfillmentMethod: clearFulfillmentMethod
        ? null
        : fulfillmentMethod ?? this.fulfillmentMethod,
    historyScope: historyScope ?? this.historyScope,
    dateFrom: clearDates ? null : dateFrom ?? this.dateFrom,
    dateTo: clearDates ? null : dateTo ?? this.dateTo,
    page: page ?? this.page,
    limit: limit ?? this.limit,
  );
}

class IncomingRequestTabNotifier extends Notifier<SupplierRequestInboxQuery> {
  @override
  SupplierRequestInboxQuery build() => const SupplierRequestInboxQuery();

  void update(SupplierRequestInboxQuery query) {
    state = query;
  }

  void reset() => state = const SupplierRequestInboxQuery();
}

final incomingRequestTabProvider =
    NotifierProvider<IncomingRequestTabNotifier, SupplierRequestInboxQuery>(
      IncomingRequestTabNotifier.new,
    );

final incomingRequestsProvider =
    FutureProvider.autoDispose<SupplierReservationListResponse>((ref) async {
      watchSupplierPortalSessionFromRef(ref);
      final query = ref.watch(incomingRequestTabProvider);
      return ref
          .read(supplierRequestsRepositoryProvider)
          .fetchIncomingRequests(
            status: query.status,
            search: query.search,
            attentionState: query.attentionState,
            fulfillmentMethod: query.fulfillmentMethod,
            historyScope: query.historyScope,
            dateFrom: query.dateFrom,
            dateTo: query.dateTo,
            page: query.page,
            limit: query.limit,
          );
    });

final supplierReservationDetailProvider = FutureProvider.autoDispose
    .family<SupplierReservationDetail, String>((ref, reservationId) async {
  watchSupplierPortalSessionFromRef(ref);
  return ref
      .read(supplierRequestsRepositoryProvider)
      .fetchReservationDetail(reservationId);
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
