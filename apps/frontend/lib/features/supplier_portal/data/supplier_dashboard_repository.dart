import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import 'models/supplier_dashboard.dart';
import 'supplier_dashboard_api.dart';

final supplierDashboardApiProvider = Provider<SupplierDashboardApi>((ref) {
  return SupplierDashboardApi(ref.watch(apiClientProvider));
});

final supplierDashboardRepositoryProvider =
    Provider<SupplierDashboardRepository>((ref) {
  return SupplierDashboardRepository(ref.watch(supplierDashboardApiProvider));
});

class SupplierDashboardRepository {
  const SupplierDashboardRepository(this._api);

  final SupplierDashboardApi _api;

  Future<SupplierDashboard> fetchDashboard() => _api.fetchDashboard();
}
