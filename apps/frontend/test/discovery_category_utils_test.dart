import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/material_discovery/domain/discovery_category_utils.dart';
import 'package:frontend/features/materials/data/models/category.dart';

void main() {
  test('filters internal-looking category names', () {
    final filtered = filterPublicDiscoveryCategories([
      MaterialCategory(
        id: '1',
        nameEn: '[test-admin-approvals] Final Category',
        nameAr: 'فئة',
        categoryType: 'MATERIAL',
      ),
      MaterialCategory(
        id: '2',
        nameEn: 'Electronics',
        nameAr: 'إلكترونيات',
        categoryType: 'MATERIAL',
      ),
    ]);

    expect(filtered, hasLength(1));
    expect(filtered.first.nameEn, 'Electronics');
  });

  test('dedupes categories with the same normalized label', () {
    final filtered = filterPublicDiscoveryCategories([
      MaterialCategory(
        id: '1',
        nameEn: 'Fabric',
        nameAr: 'أقمشة',
        categoryType: 'MATERIAL',
      ),
      MaterialCategory(
        id: '2',
        nameEn: ' fabric ',
        nameAr: 'أقمشة',
        categoryType: 'MATERIAL',
      ),
    ]);

    expect(filtered, hasLength(1));
    expect(filtered.first.id, '1');
  });
}
