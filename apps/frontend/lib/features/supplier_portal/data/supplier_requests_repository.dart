import '../../reservations/data/models/reservation_message.dart';
import 'models/handover_verify_preview.dart';
import 'models/supplier_incoming_request.dart';

/// API-ready contract for supplier reservation requests.
abstract class SupplierRequestsRepository {
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
  });

  Future<SupplierReservationDetail> fetchReservationDetail(String requestId);

  Future<SupplierIncomingRequest> acceptRequest(
    String requestId,
    SupplierPickupWindow pickupWindow,
  );

  Future<SupplierIncomingRequest> declineRequest(
    String requestId, {
    String? reason,
  });

  Future<SupplierIncomingRequest> completeRequest(
    String requestId, {
    required String confirmationCode,
  });

  /// Verifies a scanned pickup QR without completing the reservation.
  Future<HandoverVerifyPreview> verifyHandoverCredential(String handoverToken);

  /// Explicitly confirms handover after a successful verify preview.
  Future<SupplierIncomingRequest> confirmHandoverCredential(
    String handoverToken,
  );

  Future<SupplierIncomingRequest> rescheduleRequest(
    String requestId,
    SupplierPickupWindow pickupWindow, {
    required String reason,
    String? messageToLearner,
    String? note,
  });
  Future<SupplierIncomingRequest> acceptLearnerReschedule(String requestId);

  Future<SupplierIncomingRequest> submitNoDriverPickupWindow(
    String requestId,
    SupplierPickupWindow pickupWindow,
  );

  Future<SupplierIncomingRequest> cancelAcceptedRequest(
    String requestId, {
    String? reason,
  });

  Future<void> submitNoShowReport(
    String requestId, {
    required String reasonCode,
    String? note,
  });

  Future<SupplierIncomingRequest> markLearnerNoShow(
    String requestId, {
    required String reason,
    String? note,
  });

  Future<SupplierIncomingRequest> markDeliveryPickupExpired(String requestId);

  Future<SupplierIncomingRequest> reportNoDriverAvailable(
    String requestId, {
    required String note,
  });

  Future<SupplierIncomingRequest> markDriverNoShow(
    String deliveryId, {
    required String note,
  });

  Future<List<ReservationMessage>> fetchReservationMessages(String requestId);

  Future<ReservationMessage> sendReservationMessage(
    String requestId,
    String body,
  );
}
