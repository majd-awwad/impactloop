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

  Future<SupplierIncomingRequest> completeRequest(String requestId);

  Future<SupplierIncomingRequest> rescheduleRequest(
    String requestId,
    SupplierPickupWindow pickupWindow, {
    String? messageToLearner,
  });

  Future<SupplierIncomingRequest> cancelAcceptedRequest(
    String requestId, {
    String? reason,
  });

  Future<void> submitNoShowReport(
    String requestId, {
    required String reasonCode,
    String? note,
  });

  Future<List<ReservationMessage>> fetchReservationMessages(String requestId);

  Future<ReservationMessage> sendReservationMessage(
    String requestId,
    String body,
  );
}
