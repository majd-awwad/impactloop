import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/materials/application/material_listing_providers.dart';
import 'package:frontend/features/materials/data/categories_api.dart';
import 'package:frontend/features/materials/data/material_listing_data_providers.dart';
import 'package:frontend/features/materials/data/models/category.dart';

void main() {
  group('material category providers', () {
    test('materialCategoriesProvider loads full material taxonomy', () async {
      final spy = _SpyCategoriesApi();
      final container = ProviderContainer(
        overrides: [categoriesApiProvider.overrideWithValue(spy)],
      );
      addTearDown(container.dispose);

      await container.read(materialCategoriesProvider.future);

      expect(spy.calls, hasLength(1));
      expect(spy.calls.single, {
        'type': 'MATERIAL',
        'rootOnly': true,
        'discoveryOnly': false,
      });
    });

    test(
      'discoveryMaterialCategoriesProvider requests discoveryOnly categories',
      () async {
        final spy = _SpyCategoriesApi();
        final container = ProviderContainer(
          overrides: [categoriesApiProvider.overrideWithValue(spy)],
        );
        addTearDown(container.dispose);

        await container.read(discoveryMaterialCategoriesProvider.future);

        expect(spy.calls, hasLength(1));
        expect(spy.calls.single, {
          'type': 'MATERIAL',
          'rootOnly': true,
          'discoveryOnly': true,
        });
      },
    );
  });
}

class _SpyCategoriesApi extends CategoriesApi {
  _SpyCategoriesApi() : super(Dio());

  final List<Map<String, Object?>> calls = [];

  @override
  Future<List<MaterialCategory>> fetchCategories({
    String type = 'MATERIAL',
    bool rootOnly = true,
    bool discoveryOnly = false,
  }) async {
    calls.add({
      'type': type,
      'rootOnly': rootOnly,
      'discoveryOnly': discoveryOnly,
    });
    return const [];
  }
}
