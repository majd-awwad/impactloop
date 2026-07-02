import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/material_discovery/data/mock_materials.dart';
import 'package:frontend/features/material_discovery/presentation/views/materials_discovery_view.dart';
import 'package:frontend/shared/widgets/materials/app_material_card.dart';

void main() {
  testWidgets('uses compact list cards on narrow discovery widths', (
    tester,
  ) async {
    final controllers = _FilterControllers();

    await tester.binding.setSurfaceSize(const Size(360, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData.light(),
        home: Scaffold(
          body: SingleChildScrollView(
            child: SizedBox(
              width: 328,
              child: MaterialsDiscoveryView(
                materials: mockMaterials.take(1).toList(),
                pagination: null,
                categories: const [],
                searchController: controllers.search,
                cityController: controllers.city,
                areaController: controllers.area,
                searchValue: '',
                selectedCategoryIndex: 0,
                selectedQuickFilterIndex: 0,
                selectedSortIndex: 0,
                selectedConditionIndex: 0,
                hasActiveFilters: false,
                isRefetching: false,
                isLoadingMore: false,
                onSearchChanged: (_) {},
                onCityChanged: (_) {},
                onAreaChanged: (_) {},
                onCategorySelected: (_) {},
                onQuickFilterSelected: (_) {},
                onSortSelected: (_) {},
                onConditionSelected: (_) {},
                onClearFilters: () {},
                onLoadMore: () {},
                showHeroSection: false,
                showLocationPrivacyPanel: false,
              ),
            ),
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.byType(ImpactMaterialCompactCard), findsOneWidget);
    expect(find.byType(ImpactMaterialGridCard), findsNothing);
    expect(tester.takeException(), isNull);

    controllers.dispose();
  });
}

class _FilterControllers {
  _FilterControllers()
    : search = TextEditingController(),
      city = TextEditingController(),
      area = TextEditingController();

  final TextEditingController search;
  final TextEditingController city;
  final TextEditingController area;

  void dispose() {
    search.dispose();
    city.dispose();
    area.dispose();
  }
}
