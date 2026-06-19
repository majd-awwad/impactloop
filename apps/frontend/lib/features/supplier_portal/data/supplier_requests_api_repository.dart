import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import 'models/supplier_incoming_request.dart';
import 'supplier_requests_api.dart';
import 'supplier_requests_repository.dart';

final supplierRequestsApiProvider = Provider<SupplierRequestsApi>((ref) {
  return SupplierRequestsApi(ref.watch(apiClientProvider));
});

final supplierRequestsRepositoryProvider =
    Provider<SupplierRequestsRepository>((ref) {
  return ApiSupplierRequestsRepository(ref.watch(supplierRequestsApiProvider));
});

class ApiSupplierRequestsRepository implements SupplierRequestsRepository {
  const ApiSupplierRequestsRepository(this._api);

  final SupplierRequestsApi _api;

  @override
  Future<List<SupplierIncomingRequest>> fetchIncomingRequests(
    SupplierIncomingRequestTab status,
  ) {
    return _api.fetchIncomingRequests(status);
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
  Future<SupplierIncomingRequest> completeRequest(String requestId) {
    return _api.completeRequest(requestId);
  }
}
