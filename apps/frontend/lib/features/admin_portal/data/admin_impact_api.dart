import 'package:dio/dio.dart';

import '../../../core/network/api_response.dart';
import 'models/admin_impact_models.dart';

class AdminImpactApi {
  const AdminImpactApi(this._client);

  final Dio _client;

  Future<AdminImpactAnalytics> fetchImpactAnalytics() {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('/api/admin/impact'),
      AdminImpactAnalytics.fromJson,
    );
  }
}
