import 'package:dio/dio.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_response.dart';
import 'models/supplier_action_notification.dart';

class SupplierNotificationsApi {
  const SupplierNotificationsApi(this._client);

  final Dio _client;

  Future<SupplierNotificationsResult> fetchNotifications({
    SupplierNotificationsQuery query = const SupplierNotificationsQuery(),
  }) async {
    try {
      final response = await _client.get<Map<String, dynamic>>(
        '/api/supplier/notifications',
        queryParameters: query.toQueryParameters(),
      );
      final data = _readData(response);

      if (data['items'] is! List && data['notifications'] is! List) {
        throw const ApiException(message: 'Unexpected notifications response');
      }
      return SupplierNotificationsResult.fromJson(data);
    } on ApiException {
      rethrow;
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<int> fetchUnreadCount() async {
    try {
      final response = await _client.get<Map<String, dynamic>>(
        '/api/supplier/notifications/unread-count',
      );
      final data = _readData(response);
      return data['unreadCount'] as int? ?? data['count'] as int? ?? 0;
    } on ApiException {
      rethrow;
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<void> markRead(String notificationId) async {
    try {
      final response = await _client.patch<Map<String, dynamic>>(
        '/api/supplier/notifications/$notificationId/read',
      );
      _readData(response);
    } on ApiException {
      rethrow;
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<void> markAllRead() async {
    try {
      final response = await _client.patch<Map<String, dynamic>>(
        '/api/supplier/notifications/read-all',
      );
      _readData(response);
    } on ApiException {
      rethrow;
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Map<String, dynamic> _readData(Response<Map<String, dynamic>> response) {
    final body = response.data;
    if (body == null || body['success'] != true) {
      throw ApiException(
        message: body?['message'] as String? ?? 'Could not load notifications',
        statusCode: response.statusCode,
      );
    }
    final data = body['data'];
    if (data is! Map) {
      throw const ApiException(message: 'Unexpected notifications response');
    }
    return Map<String, dynamic>.from(data);
  }
}
