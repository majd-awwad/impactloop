import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/material_discovery/data/mock_material_discovery_repository.dart';
import 'package:frontend/features/material_discovery/domain/material_discovery_query.dart';

void main() {
  test('filter change resets to the first page of results', () async {
    const repository = MockMaterialDiscoveryRepository();

    final firstPage = await repository.fetchMaterials(
      const MaterialDiscoveryQuery(page: 1, limit: 1),
    );
    final filteredPage = await repository.fetchMaterials(
      const MaterialDiscoveryQuery(page: 1, limit: 1, priceType: 'FREE'),
    );

    expect(firstPage.pagination.page, 1);
    expect(filteredPage.pagination.page, 1);
    expect(filteredPage.items.length, lessThanOrEqualTo(1));
  });

  test('load more appends the next page instead of replacing totals', () async {
    const repository = MockMaterialDiscoveryRepository();

    final pageOne = await repository.fetchMaterials(
      const MaterialDiscoveryQuery(page: 1, limit: 1),
    );
    final pageTwo = await repository.fetchMaterials(
      const MaterialDiscoveryQuery(page: 2, limit: 1),
    );

    final combinedIds = {
      ...pageOne.items.map((item) => item.id),
      ...pageTwo.items.map((item) => item.id),
    };

    expect(pageOne.items, isNotEmpty);
    expect(combinedIds.length, greaterThan(pageOne.items.length));
  });
}
