import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/material_discovery/domain/discovery_material.dart';
import 'package:frontend/features/material_discovery/domain/material_discovery_list_merge.dart';
import 'package:frontend/shared/models/localized_text.dart';
import 'package:frontend/shared/widgets/materials/material_condition_badge.dart';
import 'package:frontend/shared/widgets/materials/material_status_badge.dart';

DiscoveryMaterial _material(String id) {
  return DiscoveryMaterial(
    id: id,
    title: LocalizedText(en: id, ar: id),
    description: LocalizedText(en: 'desc', ar: 'desc'),
    category: const LocalizedText(en: 'Wood', ar: 'خشب'),
    conditionLabel: const LocalizedText(en: 'Good', ar: 'جيدة'),
    conditionTone: MaterialConditionBadgeTone.good,
    statusLabel: const LocalizedText(en: 'Available', ar: 'متاح'),
    statusTone: MaterialStatusBadgeTone.available,
    quantityLabel: const LocalizedText(en: '1 piece', ar: '1 piece'),
    priceLabel: const LocalizedText(en: 'Free', ar: 'مجاناً'),
    locationLabel: const LocalizedText(en: 'Nablus', ar: 'نابلس'),
    availabilityLabel: const LocalizedText(en: 'Pickup only', ar: 'استلام فقط'),
    deliveryAvailable: false,
    isFree: true,
    supplierName: const LocalizedText(en: 'Supplier', ar: 'مورد'),
    supplierSubtitle: const LocalizedText(en: 'Supplier', ar: 'مورد'),
    heroIconData: Icons.inventory_2_outlined,
    cardGradient: const [0xFF000000, 0xFF111111],
  );
}

void main() {
  test('mergeDiscoveryMaterials replaces items on reset', () {
    final merged = mergeDiscoveryMaterials(
      reset: true,
      current: [_material('old-1')],
      incoming: [_material('new-1'), _material('new-2')],
    );

    expect(merged.map((item) => item.id), ['new-1', 'new-2']);
  });

  test('mergeDiscoveryMaterials appends unique ids on load more', () {
    final merged = mergeDiscoveryMaterials(
      reset: false,
      current: [_material('a'), _material('b')],
      incoming: [_material('b'), _material('c')],
    );

    expect(merged.map((item) => item.id), ['a', 'b', 'c']);
  });

  test('shouldApplyDiscoveryFetchResult ignores stale generations', () {
    expect(
      shouldApplyDiscoveryFetchResult(
        requestGeneration: 2,
        latestGeneration: 3,
      ),
      isFalse,
    );
    expect(
      shouldApplyDiscoveryFetchResult(
        requestGeneration: 3,
        latestGeneration: 3,
      ),
      isTrue,
    );
  });
}
