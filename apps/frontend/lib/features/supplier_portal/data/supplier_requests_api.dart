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
        queryParameters: {'status': status.apiQueryValue},
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
          if (reason != null && reason.trim().isNotEmpty)
            'reason': reason.trim(),
        },
      );

      return _parseReservationResponse(response);
    } on ApiException {
      rethrow;
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<SupplierIncomingRequest> completeRequest(
    String requestId, {
    required String confirmationCode,
  }) async {
    try {
      final response = await _client.patch<Map<String, dynamic>>(
        '/api/supplier/reservations/$requestId/complete',
        data: {'confirmationCode': confirmationCode},
      );

      return _parseReservationResponse(response);
    } on ApiException {
      rethrow;
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<SupplierIncomingRequest> rescheduleRequest(
    String requestId,
    SupplierPickupWindow pickupWindow, {
    required String reason,
    String? messageToLearner,
    String? note,
  }) async {
    try {
      final response = await _client.patch<Map<String, dynamic>>(
        '/api/supplier/reservations/$requestId/reschedule',
        data: {
          ...pickupWindow.toJson(),
          'reason': reason.trim(),
          if (messageToLearner != null && messageToLearner.trim().isNotEmpty)
            'messageToLearner': messageToLearner.trim(),
          if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
        },
      );

      return _parseReservationResponse(response);
    } on ApiException {
      rethrow;
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<SupplierIncomingRequest> acceptLearnerReschedule(
    String requestId,
  ) async {
    try {
      final response = await _client.post<Map<String, dynamic>>(
        '/api/supplier/reservations/$requestId/accept-learner-reschedule',
      );

      return _parseReservationResponse(response);
    } on ApiException {
      rethrow;
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<SupplierIncomingRequest> cancelAcceptedRequest(
    String requestId, {
    String? reason,
  }) async {
    try {
      final response = await _client.patch<Map<String, dynamic>>(
        '/api/supplier/reservations/$requestId/cancel',
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

  Future<void> submitNoShowReport(
    String requestId, {
    required String reasonCode,
    String? note,
  }) async {
    try {
      final response = await _client.post<Map<String, dynamic>>(
        '/api/supplier/reservations/$requestId/no-show-report',
        data: {
          'reasonCode': reasonCode,
          'note': note?.trim() ?? '',
        },
      );

      final body = response.data;
      if (body == null || body['success'] != true) {
        throw ApiException(
          message: body?['message'] as String? ?? 'Request failed',
          statusCode: response.statusCode,
        );
      }
    } on ApiException {
      rethrow;
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<SupplierIncomingRequest> markLearnerNoShow(
    String requestId, {
    required String reason,
    String? note,
  }) async {
    try {
      final response = await _client.post<Map<String, dynamic>>(
        '/api/supplier/reservations/$requestId/mark-no-show',
        data: {
          'reason': reason,
          if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
        },
      );

      return _parseReservationResponse(response);
    } on ApiException {
      rethrow;
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<SupplierIncomingRequest> markDeliveryPickupExpired(
    String requestId,
  ) async {
    try {
      final response = await _client.post<Map<String, dynamic>>(
        '/api/supplier/reservations/$requestId/mark-delivery-pickup-expired',
      );

      return _parseReservationResponse(response);
    } on ApiException {
      rethrow;
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<SupplierIncomingRequest> reportNoDriverAvailable(
    String requestId, {
    required String note,
  }) async {
    try {
      final response = await _client.post<Map<String, dynamic>>(
        '/api/supplier/reservations/$requestId/report-no-driver',
        data: {'note': note.trim()},
      );

      return _parseReservationResponse(response);
    } on ApiException {
      rethrow;
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<SupplierIncomingRequest> markDriverNoShow(
    String deliveryId, {
    required String note,
  }) async {
    try {
      final response = await _client.post<Map<String, dynamic>>(
        '/api/supplier/deliveries/$deliveryId/driver-no-show',
        data: {'note': note.trim()},
      );

      return _parseReservationResponse(response);
    } on ApiException {
      rethrow;
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<List<Map<String, dynamic>>> fetchReservationMessages(
    String requestId,
  ) async {
    try {
      final response = await _client.get<Map<String, dynamic>>(
        '/api/supplier/reservations/$requestId/messages',
      );

      final body = response.data;
      if (body == null || body['success'] != true) {
        throw ApiException(
          message: body?['message'] as String? ?? 'Could not load messages',
          statusCode: response.statusCode,
        );
      }

      final data = body['data'];
      if (data is! Map) {
        return const [];
      }

      final messages = data['messages'];
      if (messages is! List) {
        return const [];
      }

      return messages
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList(growable: false);
    } on ApiException {
      rethrow;
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<Map<String, dynamic>> sendReservationMessage(
    String requestId,
    String body,
  ) async {
    try {
      final response = await _client.post<Map<String, dynamic>>(
        '/api/supplier/reservations/$requestId/messages',
        data: {'body': body},
      );

      final payload = response.data;
      if (payload == null || payload['success'] != true) {
        throw ApiException(
          message: payload?['message'] as String? ?? 'Request failed',
          statusCode: response.statusCode,
        );
      }

      final data = payload['data'];
      if (data is! Map) {
        throw const ApiException(message: 'Unexpected message response');
      }

      return Map<String, dynamic>.from(data);
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
