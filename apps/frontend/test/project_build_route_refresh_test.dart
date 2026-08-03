import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/learning_hub/application/learning_hub_providers.dart';
import 'package:frontend/features/learning_hub/application/project_build_refresh.dart';

void main() {
  test('refreshProjectBuildWith invalidates only the target build', () async {
    var fetchCount = 0;

    final container = ProviderContainer(
      overrides: [
        projectBuildProvider('project-1').overrideWith((ref) async {
          fetchCount++;
          return null;
        }),
        projectBuildProvider('project-2').overrideWith((ref) async {
          return null;
        }),
      ],
    );
    addTearDown(container.dispose);

    refreshProjectBuildWith(container.invalidate, 'project-1');
    await container.read(projectBuildProvider('project-1').future);

    refreshProjectBuildWith(container.invalidate, 'project-1');
    await container.read(projectBuildProvider('project-1').future);

    expect(fetchCount, 2);
  });

  test('refreshProjectBuildWith skips blank project ids', () {
    var fetchCount = 0;

    final container = ProviderContainer(
      overrides: [
        projectBuildProvider('project-1').overrideWith((ref) async {
          fetchCount++;
          return null;
        }),
      ],
    );
    addTearDown(container.dispose);

    refreshProjectBuildWith(container.invalidate, null);
    refreshProjectBuildWith(container.invalidate, '   ');

    expect(fetchCount, 0);
  });
}
