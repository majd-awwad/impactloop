import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../learner_material_requests/application/learner_material_requests_providers.dart';

/// Maps build item IDs to open material request IDs for a given build.
final openMaterialRequestsByBuildItemProvider = FutureProvider.autoDispose
    .family<Map<String, String>, String>((ref, buildId) async {
      watchLearnerMaterialRequestsSessionFromRef(ref);
      try {
        final result = await ref
            .read(learnerMaterialRequestsApiProvider)
            .fetchRequests(status: 'OPEN', page: 1, limit: 100);
        final map = <String, String>{};
        for (final request in result.items) {
          final itemId = request.projectBuildItemId;
          if (request.projectBuildId == buildId &&
              itemId != null &&
              itemId.isNotEmpty &&
              request.isOpen) {
            map[itemId] = request.id;
          }
        }
        return map;
      } catch (_) {
        return const {};
      }
    });
