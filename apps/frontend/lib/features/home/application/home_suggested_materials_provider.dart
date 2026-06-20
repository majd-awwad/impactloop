import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../material_discovery/data/api_material_discovery_repository.dart';
import '../../material_discovery/domain/discovery_material.dart';
import '../../material_discovery/domain/material_discovery_repository.dart';

final homeMaterialDiscoveryRepositoryProvider =
    Provider<MaterialDiscoveryRepository>((ref) {
      return ApiMaterialDiscoveryRepository(ref.watch(apiClientProvider));
    });

final homeSuggestedMaterialsProvider =
    FutureProvider.autoDispose<List<DiscoveryMaterial>>((ref) async {
      final repository = ref.watch(homeMaterialDiscoveryRepositoryProvider);
      final materials = await repository.getMaterials();

      return materials.take(4).toList(growable: false);
    });
