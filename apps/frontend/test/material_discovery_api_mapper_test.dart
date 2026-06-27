import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/material_discovery/data/material_discovery_api_mapper.dart';
import 'package:frontend/shared/widgets/materials/material_status_badge.dart';

void main() {
  test('maps availableQuantity with fallback to quantity', () {
    final material = MaterialDiscoveryApiMapper.fromJson({
      'id': 'mat-1',
      'title': 'Wood panels',
      'description': 'Surplus wood',
      'status': 'PENDING_RESERVATION',
      'quantity': 10,
      'availableQuantity': 3,
      'unit': 'sheet',
      'condition': 'GOOD',
      'isFree': true,
      'deliveryAvailable': false,
      'category': {'nameEn': 'Wood', 'nameAr': 'خشب'},
    });

    expect(material.availableQuantity, 3);
    expect(material.quantity, 10);
    expect(material.statusTone, MaterialStatusBadgeTone.available);
    expect(
      material.quantityLabel.en,
      'Available: 3 of 10 sheet',
    );
  });

  test('falls back to quantity when availableQuantity is missing', () {
    final material = MaterialDiscoveryApiMapper.fromJson({
      'id': 'mat-2',
      'title': 'Arduino boards',
      'description': 'Electronics surplus',
      'status': 'AVAILABLE',
      'quantity': 5,
      'unit': 'piece',
      'condition': 'GOOD',
      'isFree': true,
      'deliveryAvailable': true,
      'category': {'nameEn': 'Electronics', 'nameAr': 'إلكترونيات'},
    });

    expect(material.availableQuantity, 5);
    expect(material.quantityLabel.en, '5 piece');
  });
}
