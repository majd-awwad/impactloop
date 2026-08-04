import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../auth/application/auth_controller.dart';
import '../data/material_related_projects_api.dart';
import '../data/models/material_related_projects.dart';

export '../data/models/material_related_projects.dart';

const materialRelatedProjectsInitialLimit = 4;

Duration? _noAutomaticRelatedProjectsRetry(int retryCount, Object error) => null;

final materialRelatedProjectsApiProvider = Provider<MaterialRelatedProjectsApi>((
  ref,
) {
  return MaterialRelatedProjectsApi(ref.watch(apiClientProvider));
});

final materialRelatedProjectsInitialProvider = FutureProvider.autoDispose
    .family<MaterialRelatedProjectsPage, String>((ref, materialId) async {
      ref.watch(
        authControllerProvider.select(
          (auth) => (auth.status, auth.user?.id, auth.user?.roles),
        ),
      );

      return ref.read(materialRelatedProjectsApiProvider).fetchRelatedProjects(
        materialId: materialId,
        page: 1,
        limit: materialRelatedProjectsInitialLimit,
      );
    }, retry: _noAutomaticRelatedProjectsRetry);

void invalidateMaterialRelatedProjects(WidgetRef ref, String materialId) {
  ref.invalidate(materialRelatedProjectsInitialProvider(materialId));
}

List<MaterialRelatedProjectItem> mergeMaterialRelatedProjectItems(
  List<MaterialRelatedProjectItem> existing,
  List<MaterialRelatedProjectItem> incoming,
) {
  final seen = existing.map((item) => item.projectId).toSet();
  final merged = [...existing];

  for (final item in incoming) {
    if (seen.add(item.projectId)) {
      merged.add(item);
    }
  }

  return merged;
}
