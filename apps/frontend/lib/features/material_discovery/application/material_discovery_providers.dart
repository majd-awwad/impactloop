import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../data/api_material_discovery_repository.dart';
import '../domain/liked_materials_repository.dart';
import '../domain/material_discovery_repository.dart';

final apiMaterialDiscoveryRepositoryProvider =
    Provider<ApiMaterialDiscoveryRepository>((ref) {
      return ApiMaterialDiscoveryRepository(ref.watch(apiClientProvider));
    });

final materialDiscoveryRepositoryProvider =
    Provider<MaterialDiscoveryRepository>((ref) {
      return ref.watch(apiMaterialDiscoveryRepositoryProvider);
    });

final likedMaterialsRepositoryProvider = Provider<LikedMaterialsRepository>((
  ref,
) {
  return ref.watch(apiMaterialDiscoveryRepositoryProvider);
});
