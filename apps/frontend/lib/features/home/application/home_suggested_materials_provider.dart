import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../material_discovery/application/material_discovery_providers.dart';
import '../../material_discovery/domain/discovery_material.dart';
import '../../material_discovery/domain/material_discovery_query.dart';
import '../../material_discovery/domain/material_discovery_repository.dart';

final homeMaterialDiscoveryRepositoryProvider =
    Provider<MaterialDiscoveryRepository>((ref) {
      return ref.watch(materialDiscoveryRepositoryProvider);
    });

final homeSuggestedMaterialsProvider =
    FutureProvider.autoDispose<List<DiscoveryMaterial>>((ref) async {
      final repository = ref.watch(homeMaterialDiscoveryRepositoryProvider);
      final result = await repository.fetchMaterials(
        const MaterialDiscoveryQuery(page: 1, limit: 4, sort: 'newest'),
      );

      return result.items;
    });
