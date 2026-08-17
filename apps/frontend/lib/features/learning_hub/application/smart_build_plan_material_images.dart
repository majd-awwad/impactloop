import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../material_discovery/application/material_discovery_providers.dart';

final smartBuildPlanMaterialImageProvider = FutureProvider.autoDispose
    .family<String?, String>((ref, materialId) async {
      if (materialId.trim().isEmpty) {
        return null;
      }

      final material = await ref
          .watch(materialDiscoveryRepositoryProvider)
          .getMaterialById(materialId);
      return material?.imageUrl;
    });
