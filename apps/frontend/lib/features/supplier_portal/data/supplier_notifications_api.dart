import 'package:dio/dio.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_response.dart';
import 'models/supplier_action_notification.dart';

class SupplierNotificationsApi {
  const SupplierNotificationsApi(this._client);

  final Dio _client;

  Future<SupplierNotificationsResult> fetchNotifications() async {
    try {
      final response = await _client.get<Map<String, dynamic>>(
        '/api/supplier/notifications',
      );

      final body = response.data;
      if (body == null || body['success'] != true) {
        throw ApiException(
          message:
              body?['message'] as String? ?? 'Could not load notifications',
          statusCode: response.statusCode,
        );
      }

      final data = body['data'];
      if (data is! Map) {
        throw const ApiException(message: 'Unexpected notifications response');
      }

      final notifications = data['notifications'];
      if (notifications is! List) {
        throw const ApiException(message: 'Unexpected notifications response');
      }

      final summaryJson = data['summary'];
      final summary = summaryJson is Map
          ? SupplierNotificationsSummary.fromJson(
              Map<String, dynamic>.from(summaryJson),
            )
          : const SupplierNotificationsSummary(
              totalCount: 0,
              actionNeededCount: 0,
              reviewCount: 0,
              reservationCount: 0,
              completedCount: 0,
            );

      return SupplierNotificationsResult(
        notifications: (notifications
                .whereType<Map>()
                .map(
                  (item) => SupplierActionNotification.fromJson(
                    Map<String, dynamic>.from(item),
                  ),
                )
                .toList()
              ..sort((a, b) => b.createdAt.compareTo(a.createdAt))),
        summary: summary,
      );
    } on ApiException {
      rethrow;
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }
}
