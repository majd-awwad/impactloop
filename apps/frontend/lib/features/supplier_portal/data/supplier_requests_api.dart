import 'package:dio/dio.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_response.dart';
import '../../reservations/data/models/handover_credential.dart';
import 'models/handover_verify_preview.dart';
import 'models/supplier_incoming_request.dart';

class SupplierRequestsApi {
  const SupplierRequestsApi(this._client);

  final Dio _client;

  Future<SupplierReservationListResponse> fetchIncomingRequestsResponse({
    String? status,
    String? search,
    String? attentionState,
    String? fulfillmentMethod,
    String? historyScope,
    DateTime? dateFrom,
    DateTime? dateTo,
    required int page,
    required int limit,
  }) async {
    try {
      final queryParameters = <String, dynamic>{'page': page, 'limit': limit};
      if (status != null) queryParameters['status'] = status;
      if (search != null && search.trim().isNotEmpty) {
        queryParameters['search'] = search.trim();
      }
      if (attentionState != null) {
        queryParameters['attentionState'] = attentionState;
      }
      if (fulfillmentMethod != null) {
        queryParameters['fulfillmentMethod'] = fulfillmentMethod;
      }
      if (historyScope != null) {
        queryParameters['historyScope'] = historyScope;
      }
      if (dateFrom != null) {
        queryParameters['dateFrom'] = dateFrom.toUtc().toIso8601String();
      }
      if (dateTo != null) {
        queryParameters['dateTo'] = dateTo.toUtc().toIso8601String();
      }
      final response = await _client.get<Map<String, dynamic>>(
        '/api/supplier/reservations',
        queryParameters: queryParameters,
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

      return SupplierReservationListResponse.fromData(
        Map<String, dynamic>.from(data),
      );
    } on ApiException {
      rethrow;
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<SupplierReservationDetail> fetchReservationDetail(
    String reservationId,
  ) async {
    try {
      final response = await _client.get<Map<String, dynamic>>(
        '/api/supplier/reservations/$reservationId',
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw ApiException(
          message: body?['message'] as String? ?? 'Could not load reservation',
          statusCode: response.statusCode,
        );
      }
      final data = body['data'];
      if (data is! Map) {
        throw const ApiException(
          message: 'Unexpected reservation detail response',
        );
      }
      return SupplierReservationDetail.fromJson(
        Map<String, dynamic>.from(data),
      );
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

  Future<HandoverVerifyPreview> verifyHandoverCredential(
    String handoverToken,
  ) async {
    try {
      final response = await _client.post<Map<String, dynamic>>(
        '/api/supplier/reservations/handover/verify',
        data: {'handoverToken': handoverToken},
      );

      final body = response.data;
      if (body == null || body['success'] != true) {
        throw ApiException(
          message: body?['message'] as String? ?? 'Could not verify pickup QR',
          statusCode: response.statusCode,
        );
      }

      final data = body['data'];
      if (data is! Map) {
        throw const ApiException(message: 'Unexpected handover verify response');
      }

      return HandoverVerifyPreview.fromJson(Map<String, dynamic>.from(data));
    } on ApiException {
      rethrow;
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<HandoverCredential> issueDriverPickupHandoverCredential(
    String reservationId,
  ) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/supplier/reservations/$reservationId/driver-pickup-handover-credential',
      ),
      HandoverCredential.fromJson,
    );
  }

  Future<SupplierIncomingRequest> confirmHandoverCredential(
    String handoverToken,
  ) async {
    try {
      final response = await _client.post<Map<String, dynamic>>(
        '/api/supplier/reservations/handover/confirm',
        data: {'handoverToken': handoverToken},
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

  Future<SupplierIncomingRequest> submitNoDriverPickupWindow(
    String requestId,
    SupplierPickupWindow pickupWindow,
  ) async {
    try {
      final response = await _client.post<Map<String, dynamic>>(
        '/api/supplier/reservations/$requestId/submit-no-driver-pickup-window',
        data: pickupWindow.toJson(),
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

  Future<void> submitNoShowReport(
    String requestId, {
    required String reasonCode,
    String? note,
  }) async {
    try {
      final response = await _client.post<Map<String, dynamic>>(
        '/api/supplier/reservations/$requestId/no-show-report',
        data: {'reasonCode': reasonCode, 'note': note?.trim() ?? ''},
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
