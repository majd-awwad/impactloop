import 'package:dio/dio.dart';

import '../../../core/network/api_response.dart';
import 'models/admin_dashboard_models.dart';

class AdminDashboardApi {
  const AdminDashboardApi(this._client);

  final Dio _client;

  Future<AdminDashboardResponse> fetchDashboard() {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('/api/admin/dashboard'),
      AdminDashboardResponse.fromJson,
    );
  }
}
