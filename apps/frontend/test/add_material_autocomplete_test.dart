import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/materials/application/material_listing_providers.dart';
import 'package:frontend/features/materials/data/models/material_type.dart'
    as material_models;
import 'package:frontend/features/supplier_portal/presentation/pages/add_material_page.dart';

void main() {
  const suggestion = material_models.MaterialType(
    id: 'arduino-mega',
    nameEn: 'Arduino Mega 2560',
    normalizedName: 'arduino mega 2560',
    defaultUnit: 'piece',
    category: material_models.MaterialTypeCategorySummary(
      id: 'electronics',
      nameEn: 'Electronics & Components',
      nameAr: 'الإلكترونيات والمكونات',
    ),
    hasActivePriceRule: true,
    aliases: ['Arduino Mega'],
  );

  testWidgets('mouse click selects a visible material type suggestion', (
    tester,
  ) async {
    final controller = TextEditingController();
    addTearDown(controller.dispose);
    material_models.MaterialType? selectedMaterialType;

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          materialTypesSearchProvider.overrideWith(
            (ref, query) async =>
                const material_models.MaterialTypeSearchResult(
                  items: [suggestion],
                ),
          ),
        ],
        child: MaterialApp(
          home: Scaffold(
            body: StatefulBuilder(
              builder: (context, setState) {
                return MaterialTypeAutocompleteField(
                  controller: controller,
                  label: 'Material type / name',
                  hint: 'Search or type a material name',
                  categoryId: 'electronics',
                  selectedMaterialType: selectedMaterialType,
                  onChanged: (_) {},
                  onSelected: (value) {
                    setState(() {
                      selectedMaterialType = value;
                      controller.text = value.displayLabel(preferArabic: false);
                    });
                  },
                );
              },
            ),
          ),
        ),
      ),
    );

    await tester.enterText(find.byType(TextFormField), 'ard');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pump();

    expect(find.text('Arduino Mega 2560'), findsOneWidget);

    await tester.tap(
      find.text('Arduino Mega 2560'),
      kind: PointerDeviceKind.mouse,
    );
    await tester.pump();

    expect(selectedMaterialType?.id, 'arduino-mega');
    expect(controller.text, 'Arduino Mega 2560');
  });
}
