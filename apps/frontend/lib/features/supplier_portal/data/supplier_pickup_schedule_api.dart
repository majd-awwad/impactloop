import '../../../core/errors/api_exception.dart';
import 'models/supplier_incoming_request.dart';
import 'supplier_requests_api.dart';

/// Schedule-specific facade over the canonical supplier reservations API.
class SupplierPickupScheduleApi {
  const SupplierPickupScheduleApi(this._requestsApi);

  final SupplierRequestsApi _requestsApi;

  Future<SupplierReservationListResponse> fetchReservations({
    int page = 1,
    int limit = 100,
  }) async {
    final response = await _requestsApi.fetchIncomingRequestsResponse(
      historyScope: 'all',
      page: page,
      limit: limit,
    );
    if (response.usedLegacyReservations) {
      throw const ApiException(
        message: 'Pickup schedule requires the canonical reservations response',
      );
    }
    return response;
  }
}
