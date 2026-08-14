import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../reservations/data/models/handover_credential.dart';
import '../../reservations/data/models/reservation_message.dart';
import 'models/handover_verify_preview.dart';
import 'models/supplier_incoming_request.dart';
import 'supplier_requests_api.dart';
import 'supplier_requests_repository.dart';

final supplierRequestsApiProvider = Provider<SupplierRequestsApi>((ref) {
  return SupplierRequestsApi(ref.watch(apiClientProvider));
});

final supplierRequestsRepositoryProvider = Provider<SupplierRequestsRepository>(
  (ref) {
    return ApiSupplierRequestsRepository(
      ref.watch(supplierRequestsApiProvider),
    );
  },
);

class ApiSupplierRequestsRepository implements SupplierRequestsRepository {
  const ApiSupplierRequestsRepository(this._api);

  final SupplierRequestsApi _api;

  @override
  Future<SupplierReservationListResponse> fetchIncomingRequests({
    String? status,
    String? search,
    String? attentionState,
    String? fulfillmentMethod,
    String? historyScope,
    DateTime? dateFrom,
    DateTime? dateTo,
    required int page,
    required int limit,
  }) {
    return _api.fetchIncomingRequestsResponse(
      status: status,
      search: search,
      attentionState: attentionState,
      fulfillmentMethod: fulfillmentMethod,
      historyScope: historyScope,
      dateFrom: dateFrom,
      dateTo: dateTo,
      page: page,
      limit: limit,
    );
  }

  @override
  Future<SupplierReservationDetail> fetchReservationDetail(String requestId) {
    return _api.fetchReservationDetail(requestId);
  }

  @override
  Future<void> confirmDeliveryReturn(String deliveryId) {
    return _api.confirmDeliveryReturn(deliveryId);
  }

  @override
  Future<SupplierIncomingRequest> acceptRequest(
    String requestId,
    SupplierPickupWindow pickupWindow,
  ) {
    return _api.acceptRequest(requestId, pickupWindow);
  }

  @override
  Future<SupplierIncomingRequest> declineRequest(
    String requestId, {
    String? reason,
  }) {
    return _api.declineRequest(requestId, reason: reason);
  }

  @override
  Future<SupplierIncomingRequest> completeRequest(
    String requestId, {
    required String confirmationCode,
    bool cashReceivedConfirmed = false,
  }) {
    return _api.completeRequest(
      requestId,
      confirmationCode: confirmationCode,
      cashReceivedConfirmed: cashReceivedConfirmed,
    );
  }

  @override
  Future<HandoverCredential> issueDriverPickupHandoverCredential(
    String reservationId,
  ) {
    return _api.issueDriverPickupHandoverCredential(reservationId);
  }

  @override
  Future<HandoverVerifyPreview> verifyHandoverCredential(String handoverToken) {
    return _api.verifyHandoverCredential(handoverToken);
  }

  @override
  Future<SupplierIncomingRequest> confirmHandoverCredential(
    String handoverToken, {
    bool cashReceivedConfirmed = false,
  }) {
    return _api.confirmHandoverCredential(
      handoverToken,
      cashReceivedConfirmed: cashReceivedConfirmed,
    );
  }

  @override
  Future<SupplierIncomingRequest> rescheduleRequest(
    String requestId,
    SupplierPickupWindow pickupWindow, {
    required String reason,
    String? messageToLearner,
    String? note,
  }) {
    return _api.rescheduleRequest(
      requestId,
      pickupWindow,
      reason: reason,
      messageToLearner: messageToLearner,
      note: note,
    );
  }

  @override
  Future<SupplierIncomingRequest> acceptLearnerReschedule(String requestId) {
    return _api.acceptLearnerReschedule(requestId);
  }

  @override
  Future<SupplierIncomingRequest> submitNoDriverPickupWindow(
    String requestId,
    SupplierPickupWindow pickupWindow,
  ) {
    return _api.submitNoDriverPickupWindow(requestId, pickupWindow);
  }

  @override
  Future<SupplierIncomingRequest> cancelAcceptedRequest(
    String requestId, {
    String? reason,
  }) {
    return _api.cancelAcceptedRequest(requestId, reason: reason);
  }

  @override
  Future<void> submitNoShowReport(
    String requestId, {
    required String reasonCode,
    String? note,
  }) {
    return _api.submitNoShowReport(
      requestId,
      reasonCode: reasonCode,
      note: note,
    );
  }

  @override
  Future<SupplierIncomingRequest> markLearnerNoShow(
    String requestId, {
    required String reason,
    String? note,
  }) {
    return _api.markLearnerNoShow(requestId, reason: reason, note: note);
  }

  @override
  Future<SupplierIncomingRequest> markDeliveryPickupExpired(String requestId) {
    return _api.markDeliveryPickupExpired(requestId);
  }

  @override
  Future<SupplierIncomingRequest> reportNoDriverAvailable(
    String requestId, {
    required String note,
  }) {
    return _api.reportNoDriverAvailable(requestId, note: note);
  }

  @override
  Future<SupplierIncomingRequest> markDriverNoShow(
    String deliveryId, {
    required String note,
  }) {
    return _api.markDriverNoShow(deliveryId, note: note);
  }

  @override
  Future<List<ReservationMessage>> fetchReservationMessages(
    String requestId,
  ) async {
    final messages = await _api.fetchReservationMessages(requestId);
    return messages
        .map((item) => ReservationMessage.fromJson(item))
        .toList(growable: false);
  }

  @override
  Future<ReservationMessage> sendReservationMessage(
    String requestId,
    String body,
  ) async {
    final message = await _api.sendReservationMessage(requestId, body);
    return ReservationMessage.fromJson(message);
  }
}
