import '../../reservations/data/models/reservation_message.dart';
import 'models/supplier_incoming_request.dart';

/// API-ready contract for supplier reservation requests.
abstract class SupplierRequestsRepository {
  Future<List<SupplierIncomingRequest>> fetchIncomingRequests(
    SupplierIncomingRequestTab status,
  );

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

  Future<SupplierIncomingRequest> rescheduleRequest(
    String requestId,
    SupplierPickupWindow pickupWindow, {
    required String reason,
    String? messageToLearner,
    String? note,
  });
  Future<SupplierIncomingRequest> acceptLearnerReschedule(String requestId);

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

  Future<SupplierIncomingRequest> markDriverNoShow(
    String deliveryId, {
    String? note,
  });

  Future<List<ReservationMessage>> fetchReservationMessages(String requestId);

  Future<ReservationMessage> sendReservationMessage(
    String requestId,
    String body,
  );
}
