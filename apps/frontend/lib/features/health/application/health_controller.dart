import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/health_remote_data_source.dart';

final healthStatusProvider = FutureProvider.autoDispose<HealthStatus>((ref) {
  final dataSource = ref.watch(healthRemoteDataSourceProvider);

  return dataSource.fetchHealth();
});
