import 'package:dio/dio.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_response.dart';
import 'models/supplier_incoming_request.dart';

class SupplierRequestsApi {
  const SupplierRequestsApi(this._client);

  final Dio _client;

  Future<List<SupplierIncomingRequest>> fetchIncomingRequests(
    SupplierIncomingRequestTab status,
  ) async {
    try {
      final response = await _client.get<Map<String, dynamic>>(
        '/api/supplier/reservations',
        queryParameters: {'status': status.name},
      );

      final body = response.data;
      if (body == null || body['success'] != true) {
        throw ApiException(
          message: body?['message'] as String? ?? 'Could not load requests',
          statusCode: response.statusCode,
        );
      }

      final data = body['data'];
      if (data is! Map) {
        throw const ApiException(message: 'Unexpected reservations response');
      }

      final reservations = data['reservations'];
      if (reservations is! List) {
        throw const ApiException(message: 'Unexpected reservations response');
      }

      return reservations
          .whereType<Map>()
          .map(
            (item) => SupplierIncomingRequest.fromJson(
              Map<String, dynamic>.from(item),
            ),
          )
          .toList();
    } on ApiException {
      rethrow;
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<SupplierIncomingRequest> acceptRequest(
    String requestId,
    SupplierPickupWindow pickupWindow,
  ) async {
    try {
      final response = await _client.patch<Map<String, dynamic>>(
        '/api/supplier/reservations/$requestId/accept',
        data: pickupWindow.toJson(),
      );

      return _parseReservationResponse(response);
    } on ApiException {
      rethrow;
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<SupplierIncomingRequest> declineRequest(
    String requestId, {
    String? reason,
  }) async {
    try {
      final response = await _client.patch<Map<String, dynamic>>(
        '/api/supplier/reservations/$requestId/decline',
        data: {
          if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
        },
      );

      return _parseReservationResponse(response);
    } on ApiException {
      rethrow;
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  SupplierIncomingRequest _parseReservationResponse(
    Response<Map<String, dynamic>> response,
  ) {
    final body = response.data;
    if (body == null || body['success'] != true) {
      throw ApiException(
        message: body?['message'] as String? ?? 'Request failed',
        statusCode: response.statusCode,
      );
    }

    final data = body['data'];
    if (data is! Map) {
      throw const ApiException(message: 'Unexpected reservation response');
    }

    return SupplierIncomingRequest.fromJson(Map<String, dynamic>.from(data));
  }
}
