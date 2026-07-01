import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../data/admin_dashboard_api.dart';
import '../data/admin_dashboard_repository.dart';
import 'models/admin_dashboard_models.dart';

final adminDashboardApiProvider = Provider<AdminDashboardApi>((ref) {
  return AdminDashboardApi(ref.watch(apiClientProvider));
});

final adminDashboardRepositoryProvider = Provider<AdminDashboardRepository>((
  ref,
) {
  return AdminDashboardRepository(api: ref.watch(adminDashboardApiProvider));
});

final adminDashboardProvider = FutureProvider<AdminDashboardResponse>((ref) {
  return ref.watch(adminDashboardRepositoryProvider).fetchDashboard();
});

