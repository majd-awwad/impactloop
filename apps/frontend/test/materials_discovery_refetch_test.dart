import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/material_discovery/data/mock_materials.dart';
import 'package:frontend/features/material_discovery/presentation/views/materials_discovery_view.dart';
import 'package:frontend/shared/widgets/materials/app_material_card.dart';

void main() {
  testWidgets('keeps material cards visible while refetching', (tester) async {
    final controllers = _FilterControllers();

    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData.light(),
        home: Scaffold(
          body: SingleChildScrollView(
            child: MaterialsDiscoveryView(
              materials: mockMaterials.take(2).toList(),
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
              isRefetching: true,
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
    );

    expect(find.text('Updating results...'), findsOneWidget);
    expect(find.text('Reclaimed Birch Plywood Panels'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(find.byType(ImpactMaterialGridCard), findsNWidgets(2));

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
