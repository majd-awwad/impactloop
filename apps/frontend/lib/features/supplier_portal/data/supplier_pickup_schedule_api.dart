import 'package:dio/dio.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_response.dart';
import 'models/supplier_pickup_schedule_item.dart';

class SupplierPickupScheduleApi {
  const SupplierPickupScheduleApi(this._client);

  final Dio _client;

  Future<List<SupplierPickupScheduleItem>> fetchAcceptedReservations() {
    return _fetchReservations('accepted');
  }

  Future<List<SupplierPickupScheduleItem>> fetchCompletedReservations() {
    return _fetchReservations('completed');
  }

  Future<List<SupplierPickupScheduleItem>> _fetchReservations(
    String status,
  ) async {
    try {
      final response = await _client.get<Map<String, dynamic>>(
        '/api/supplier/reservations',
        queryParameters: {'status': status},
      );

      final body = response.data;
      if (body == null || body['success'] != true) {
        throw ApiException(
          message:
              body?['message'] as String? ?? 'Could not load pickup schedule',
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
            (item) => SupplierPickupScheduleItem.fromReservationJson(
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
}
