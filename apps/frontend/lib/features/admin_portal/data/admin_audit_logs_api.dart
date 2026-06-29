import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_response.dart';
import 'models/admin_audit_logs_models.dart';

class AdminAuditLogsApi {
  const AdminAuditLogsApi(this._client);

  final Dio _client;

  Future<AdminAuditLogsListResponse> fetchAuditLogs({
    required int page,
    required int limit,
    String? search,
    String? action,
    String? targetType,
    String? actorId,
    String? dateFrom,
    String? dateTo,
  }) {
    final queryParameters = <String, dynamic>{
      'page': page,
      'limit': limit,
      if (search != null && search.isNotEmpty) 'search': search,
      if (action != null && action.isNotEmpty && action != 'ALL') 'action': action,
      if (targetType != null && targetType.isNotEmpty && targetType != 'ALL')
        'targetType': targetType,
      if (actorId != null && actorId.isNotEmpty && actorId != 'ALL')
        'actorId': actorId,
      if (dateFrom != null && dateFrom.isNotEmpty) 'dateFrom': dateFrom,
      if (dateTo != null && dateTo.isNotEmpty) 'dateTo': dateTo,
    };

    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/admin/audit-logs',
        queryParameters: queryParameters,
      ),
      AdminAuditLogsListResponse.fromJson,
    );
  }
}

final adminAuditLogsApiProvider = Provider<AdminAuditLogsApi>((ref) {
  return AdminAuditLogsApi(ref.watch(apiClientProvider));
});
