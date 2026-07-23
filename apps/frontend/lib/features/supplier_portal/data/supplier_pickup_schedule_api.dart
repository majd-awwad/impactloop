import 'package:dio/dio.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_response.dart';
import 'models/supplier_pickup_schedule_item.dart';

class SupplierPickupScheduleApi {
  const SupplierPickupScheduleApi(this._client);

  final Dio _client;

  Future<SupplierSchedulePage> fetchSchedule(
    SupplierScheduleQuery query,
  ) async {
    try {
      final response = await _client.get<Map<String, dynamic>>(
        '/api/supplier/reservations/schedule',
        queryParameters: query.toQueryParameters(),
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
        throw const ApiException(
          message: 'Unexpected pickup schedule response',
        );
      }
      return SupplierSchedulePage.fromJson(Map<String, dynamic>.from(data));
    } on ApiException {
      rethrow;
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }
}
