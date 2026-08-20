import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import 'admin_impact_api.dart';
import 'admin_impact_repository.dart';
import 'models/admin_impact_models.dart';

final adminImpactApiProvider = Provider<AdminImpactApi>((ref) {
  return AdminImpactApi(ref.watch(apiClientProvider));
});

final adminImpactRepositoryProvider = Provider<AdminImpactRepository>((ref) {
  return AdminImpactRepository(api: ref.watch(adminImpactApiProvider));
});

final adminImpactAnalyticsProvider = FutureProvider<AdminImpactAnalytics>((
  ref,
) {
  return ref.watch(adminImpactRepositoryProvider).fetchImpactAnalytics();
});
