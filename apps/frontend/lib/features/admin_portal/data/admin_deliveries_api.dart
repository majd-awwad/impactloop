import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_response.dart';
import 'models/admin_deliveries_models.dart';

class AdminDeliveriesApi {
  const AdminDeliveriesApi(this._client);

  final Dio _client;

  Future<AdminDeliveriesListResponse> fetchDeliveries({
    required int page,
    required int limit,
    String? search,
    String? status,
    String? assignment,
    String? dateFrom,
    String? dateTo,
  }) {
    final queryParameters = <String, dynamic>{
      'page': page,
      'limit': limit,
      if (search != null && search.isNotEmpty) 'search': search,
      if (status != null && status.isNotEmpty && status != 'ALL') 'status': status,
      if (assignment != null && assignment.isNotEmpty && assignment != 'ALL')
        'assignment': assignment,
      if (dateFrom != null && dateFrom.isNotEmpty) 'dateFrom': dateFrom,
      if (dateTo != null && dateTo.isNotEmpty) 'dateTo': dateTo,
    };

    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/admin/deliveries',
        queryParameters: queryParameters,
      ),
      AdminDeliveriesListResponse.fromJson,
    );
  }

  Future<AdminDeliveryDetail> fetchDeliveryDetail(String id) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('/api/admin/deliveries/$id'),
      AdminDeliveryDetail.fromJson,
    );
  }

  Future<AdminDeliveryDetail> reopenDriverAssignment(String id) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/admin/deliveries/$id/reopen-driver-assignment',
      ),
      AdminDeliveryDetail.fromJson,
    );
  }
}

final adminDeliveriesApiProvider = Provider<AdminDeliveriesApi>((ref) {
  return AdminDeliveriesApi(ref.watch(apiClientProvider));
});
