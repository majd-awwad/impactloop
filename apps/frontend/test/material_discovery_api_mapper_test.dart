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
      'pickupAllowed': true,
      'viewsCount': 4,
      'category': {'nameEn': 'Wood', 'nameAr': 'خشب'},
    });

    expect(material.availableQuantity, 3);
    expect(material.quantity, 10);
    expect(material.viewsCount, 4);
    expect(material.isPopular, isFalse);
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
    expect(material.viewsCount, 0);
    expect(material.isPopular, isFalse);
  });

  test('marks material as popular at the views threshold', () {
    final material = MaterialDiscoveryApiMapper.fromJson({
      'id': 'mat-3',
      'title': 'Popular stock',
      'description': 'Seen often',
      'status': 'AVAILABLE',
      'quantity': 1,
      'unit': 'piece',
      'condition': 'GOOD',
      'isFree': true,
      'deliveryAvailable': false,
      'viewsCount': 10,
      'category': {'nameEn': 'Wood', 'nameAr': 'خشب'},
    });

    expect(material.isPopular, isTrue);
  });

  test('resolves primaryImageUrl and relative upload paths', () {
    final material = MaterialDiscoveryApiMapper.fromJson({
      'id': 'mat-4',
      'title': 'With photo',
      'description': 'Has image',
      'status': 'AVAILABLE',
      'quantity': 1,
      'unit': 'piece',
      'condition': 'GOOD',
      'isFree': true,
      'deliveryAvailable': false,
      'primaryImageUrl': '/uploads/materials/cover.jpg',
      'category': {'nameEn': 'Electronics', 'nameAr': 'إلكترونيات'},
    });

    expect(material.imageUrl, endsWith('/uploads/materials/cover.jpg'));
  });

  test('returns null imageUrl when no image metadata exists', () {
    final material = MaterialDiscoveryApiMapper.fromJson({
      'id': 'mat-5',
      'title': 'No photo',
      'description': 'Missing image',
      'status': 'AVAILABLE',
      'quantity': 1,
      'unit': 'piece',
      'condition': 'GOOD',
      'isFree': true,
      'deliveryAvailable': false,
      'category': {'nameEn': 'Wood', 'nameAr': 'خشب'},
    });

    expect(material.imageUrl, isNull);
  });
}
