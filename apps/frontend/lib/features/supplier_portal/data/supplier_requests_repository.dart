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
}
