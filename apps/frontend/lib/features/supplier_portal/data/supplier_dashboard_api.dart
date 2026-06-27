import 'package:dio/dio.dart';

import '../../../core/network/api_response.dart';
import 'models/supplier_dashboard.dart';

class SupplierDashboardApi {
  const SupplierDashboardApi(this._client);

  final Dio _client;

  static const _basePath = '/api/supplier';

  Future<SupplierDashboard> fetchDashboard() {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('$_basePath/dashboard'),
      SupplierDashboard.fromJson,
    );
  }
}
