import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_response.dart';
import 'models/admin_reservations_models.dart';

class AdminReservationsApi {
  const AdminReservationsApi(this._client);

  final Dio _client;

  Future<AdminReservationsListResponse> fetchReservations({
    required int page,
    required int limit,
    String? search,
    String? status,
    String? hasDelivery,
    String? dateFrom,
    String? dateTo,
  }) {
    final queryParameters = <String, dynamic>{
      'page': page,
      'limit': limit,
      if (search != null && search.isNotEmpty) 'search': search,
      if (status != null && status.isNotEmpty && status != 'ALL')
        'status': status,
      if (hasDelivery != null && hasDelivery.isNotEmpty && hasDelivery != 'ALL')
        'hasDelivery': hasDelivery,
      if (dateFrom != null && dateFrom.isNotEmpty) 'dateFrom': dateFrom,
      if (dateTo != null && dateTo.isNotEmpty) 'dateTo': dateTo,
    };

    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/admin/reservations',
        queryParameters: queryParameters,
      ),
      AdminReservationsListResponse.fromJson,
    );
  }

  Future<AdminReservationDetail> fetchReservationDetail(String id) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('/api/admin/reservations/$id'),
      AdminReservationDetail.fromJson,
    );
  }
}

final adminReservationsApiProvider = Provider<AdminReservationsApi>((ref) {
  return AdminReservationsApi(ref.watch(apiClientProvider));
});
