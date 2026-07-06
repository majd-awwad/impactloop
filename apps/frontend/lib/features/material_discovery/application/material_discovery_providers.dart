import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../data/api_material_discovery_repository.dart';
import '../domain/material_discovery_repository.dart';

final materialDiscoveryRepositoryProvider =
    Provider<MaterialDiscoveryRepository>((ref) {
      return ApiMaterialDiscoveryRepository(ref.watch(apiClientProvider));
    });
