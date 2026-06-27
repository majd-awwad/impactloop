import 'admin_dashboard_api.dart';
import 'models/admin_dashboard_models.dart';

class AdminDashboardRepository {
  const AdminDashboardRepository({required AdminDashboardApi api}) : _api = api;

  final AdminDashboardApi _api;

  Future<AdminDashboardResponse> fetchDashboard() => _api.fetchDashboard();
}

