import 'admin_impact_api.dart';
import 'models/admin_impact_models.dart';

class AdminImpactRepository {
  const AdminImpactRepository({required AdminImpactApi api}) : _api = api;

  final AdminImpactApi _api;

  Future<AdminImpactAnalytics> fetchImpactAnalytics() =>
      _api.fetchImpactAnalytics();
}
