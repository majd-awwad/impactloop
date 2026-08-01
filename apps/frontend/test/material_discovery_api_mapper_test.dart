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
    expect(material.quantityLabel.en, 'Available: 3 of 10 sheet');
  });

  test('shows zero available stock when all quantity is held', () {
    final material = MaterialDiscoveryApiMapper.fromJson({
      'id': 'mat-held',
      'title': 'Fully held stock',
      'description': 'All pieces reserved',
      'status': 'PENDING_RESERVATION',
      'quantity': 10,
      'availableQuantity': 0,
      'unit': 'piece',
      'condition': 'GOOD',
      'isFree': true,
      'deliveryAvailable': false,
      'category': {'nameEn': 'Wood', 'nameAr': 'خشب'},
    });

    expect(material.availableQuantity, 0);
    expect(material.quantityLabel.en, 'Available: 0 of 10 piece');
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

  test('strips internal seed markers from public descriptions', () {
    final material = MaterialDiscoveryApiMapper.fromJson({
      'id': 'mat-6',
      'title': 'Motor driver',
      'description':
          '[my-materials-seed] key:elec-12-l298n-drivers\nDual H-bridge motor driver modules for Arduino projects.',
      'status': 'AVAILABLE',
      'quantity': 2,
      'unit': 'piece',
      'condition': 'GOOD',
      'isFree': true,
      'deliveryAvailable': false,
      'category': {'nameEn': 'Electronics', 'nameAr': 'إلكترونيات'},
    });

    expect(
      material.description.en,
      'Dual H-bridge motor driver modules for Arduino projects.',
    );
    expect(material.description.en.contains('[my-materials-seed]'), isFalse);
    expect(material.description.en.contains('key:'), isFalse);
  });

  test('maps createdAt to postedAt', () {
    final material = MaterialDiscoveryApiMapper.fromJson({
      'id': 'mat-7',
      'title': 'Posted material',
      'description': 'Has posted date',
      'status': 'AVAILABLE',
      'quantity': 1,
      'unit': 'piece',
      'condition': 'GOOD',
      'isFree': true,
      'deliveryAvailable': false,
      'createdAt': '2026-03-15T10:30:00.000Z',
      'category': {'nameEn': 'Wood', 'nameAr': 'خشب'},
    });

    expect(material.postedAt, isNotNull);
    expect(material.postedAt!.year, 2026);
    expect(material.postedAt!.month, 3);
    expect(material.postedAt!.day, 15);
  });

  test('maps category id and pickup/delivery availability labels', () {
    final both = MaterialDiscoveryApiMapper.fromJson({
      'id': 'mat-8',
      'title': 'Dual option stock',
      'description': 'Supports pickup and delivery',
      'status': 'AVAILABLE',
      'quantity': 1,
      'unit': 'piece',
      'condition': 'GOOD',
      'isFree': true,
      'deliveryAvailable': true,
      'pickupAllowed': true,
      'category': {
        'id': 'cat-electronics',
        'nameEn': 'Electronics',
        'nameAr': 'إلكترونيات',
      },
      'city': 'Nablus',
      'area': 'Industrial',
      'approximateLatitude': 32.22,
      'approximateLongitude': 35.25,
      'approximateDistanceKm': 4.6,
    });

    expect(both.categoryId, 'cat-electronics');
    expect(both.city, 'Nablus');
    expect(both.area, 'Industrial');
    expect(both.approximateLatitude, 32.22);
    expect(both.approximateLongitude, 35.25);
    expect(both.approximateDistanceKm, 4.6);
    expect(both.hasApproximatePin, isTrue);
    expect(both.approximateDistanceLabel?.en, '~4.6 km away');
    expect(both.availabilityLabel.en, 'Pickup and delivery available');

    final pickupOnly = MaterialDiscoveryApiMapper.fromJson({
      'id': 'mat-9',
      'title': 'Pickup only stock',
      'description': 'Pickup only',
      'status': 'AVAILABLE',
      'quantity': 1,
      'unit': 'piece',
      'condition': 'GOOD',
      'isFree': true,
      'deliveryAvailable': false,
      'pickupAllowed': true,
      'category': {'nameEn': 'Wood', 'nameAr': 'خشب'},
    });

    expect(pickupOnly.availabilityLabel.en, 'Pickup only');

    final deliveryOnly = MaterialDiscoveryApiMapper.fromJson({
      'id': 'mat-10',
      'title': 'Delivery only stock',
      'description': 'Delivery only',
      'status': 'AVAILABLE',
      'quantity': 1,
      'unit': 'piece',
      'condition': 'GOOD',
      'isFree': true,
      'deliveryAvailable': true,
      'pickupAllowed': false,
      'category': {'nameEn': 'Wood', 'nameAr': 'خشب'},
    });

    expect(deliveryOnly.availabilityLabel.en, 'Delivery available');
  });

  test('maps material detail enrichment and optional text fields', () {
    final material = MaterialDiscoveryApiMapper.fromJson({
      'id': 'mat-11',
      'title': 'Detail material',
      'description': 'Extended detail payload',
      'status': 'AVAILABLE',
      'quantity': 2,
      'unit': 'piece',
      'condition': 'GOOD',
      'isFree': true,
      'deliveryAvailable': true,
      'pickupAllowed': false,
      'suggestedUses': 'Good for robotics club builds.',
      'sourceType': 'WORKSHOP_SURPLUS',
      'supplierType': 'WORKSHOP',
      'supplierVerified': true,
      'isOwnMaterial': true,
      'canReserve': false,
      'reserveBlockReason': 'OWN_MATERIAL',
      'category': {'nameEn': 'Electronics', 'nameAr': 'إلكترونيات'},
    });

    expect(material.suggestedUses, 'Good for robotics club builds.');
    expect(material.sourceTypeLabel?.en, 'Workshop surplus');
    expect(material.supplierTypeLabel?.en, 'Workshop');
    expect(material.supplierVerified, isTrue);
    expect(material.isOwnMaterial, isTrue);
    expect(material.canReserve, isFalse);
    expect(material.reserveBlockReason, 'OWN_MATERIAL');
    expect(material.availabilityLabel.en, 'Delivery available');
  });

  test('maps detail images array and keeps imageUrl fallback', () {
    final material = MaterialDiscoveryApiMapper.fromJson({
      'id': 'mat-12',
      'title': 'Gallery material',
      'description': 'Has multiple images',
      'status': 'AVAILABLE',
      'quantity': 1,
      'unit': 'piece',
      'condition': 'GOOD',
      'isFree': true,
      'deliveryAvailable': false,
      'primaryImageUrl': '/uploads/materials/cover.jpg',
      'images': [
        {
          'id': 'img-cover',
          'url': '/uploads/materials/cover.jpg',
          'isCover': true,
          'isPrimary': true,
          'sortOrder': 1,
        },
        {
          'id': 'img-secondary',
          'url': '/uploads/materials/secondary.jpg',
          'isCover': false,
          'isPrimary': false,
          'sortOrder': 0,
        },
      ],
      'category': {'nameEn': 'Electronics', 'nameAr': 'إلكترونيات'},
    });

    expect(material.galleryImages.length, 2);
    expect(material.galleryImages.first.isCover, isTrue);
    expect(material.imageUrl, endsWith('/uploads/materials/cover.jpg'));
    expect(material.resolvedGalleryImages.length, 2);
  });

  test('falls back to imageUrl when images array is empty', () {
    final material = MaterialDiscoveryApiMapper.fromJson({
      'id': 'mat-13',
      'title': 'Single image material',
      'description': 'Legacy single image payload',
      'status': 'AVAILABLE',
      'quantity': 1,
      'unit': 'piece',
      'condition': 'GOOD',
      'isFree': true,
      'deliveryAvailable': false,
      'primaryImageUrl': '/uploads/materials/legacy.jpg',
      'category': {'nameEn': 'Wood', 'nameAr': 'خشب'},
    });

    expect(material.galleryImages, isEmpty);
    expect(material.imageUrl, endsWith('/uploads/materials/legacy.jpg'));
    expect(material.resolvedGalleryImages.length, 1);
  });
test('maps the optional recommendation impression id', () {
    final material = MaterialDiscoveryApiMapper.fromJson({
      'id': 'mat-recommended',
      'title': 'Recommended material',
      'description': 'Recommendation payload',
      'status': 'AVAILABLE',
      'quantity': 1,
      'unit': 'piece',
      'condition': 'GOOD',
      'isFree': true,
      'deliveryAvailable': false,
      'recommendationImpressionId': 'imp-material-1',
      'category': {'nameEn': 'Wood', 'nameAr': '???'},
    });

    expect(material.recommendationImpressionId, 'imp-material-1');
  });

  test('does not invent a recommendation impression id', () {
    final material = MaterialDiscoveryApiMapper.fromJson({
      'id': 'mat-plain',
      'title': 'Plain material',
      'description': 'Normal discovery payload',
      'status': 'AVAILABLE',
      'quantity': 1,
      'unit': 'piece',
      'condition': 'GOOD',
      'isFree': true,
      'deliveryAvailable': false,
      'recommendationImpressionId': '   ',
      'category': {'nameEn': 'Wood', 'nameAr': '???'},
    });

    expect(material.recommendationImpressionId, isNull);
  });

  test('rejects malformed recommendation impression values', () {
    for (final value in <Object?>[
      null,
      '',
      '   ',
      42,
      {'id': 'not-an-id'},
      ['not-an-id'],
    ]) {
      final material = MaterialDiscoveryApiMapper.fromJson({
        'id': 'mat-malformed',
        'title': 'Malformed recommendation value',
        'description': 'Still a valid material response',
        'status': 'AVAILABLE',
        'quantity': 1,
        'unit': 'piece',
        'condition': 'GOOD',
        'isFree': true,
        'deliveryAvailable': false,
        'recommendationImpressionId': value,
        'category': {'nameEn': 'Wood', 'nameAr': '???'},
      });

      expect(material.recommendationImpressionId, isNull);
    }
  });

  test('preserves recommendation context across engagement copy updates', () {
    final material = MaterialDiscoveryApiMapper.fromJson({
      'id': 'mat-copy',
      'title': 'Copyable material',
      'description': 'Recommendation payload',
      'status': 'AVAILABLE',
      'quantity': 1,
      'unit': 'piece',
      'condition': 'GOOD',
      'isFree': true,
      'deliveryAvailable': false,
      'recommendationImpressionId': 'imp-copy-material',
      'category': {'nameEn': 'Wood', 'nameAr': '???'},
    });

    expect(
      material.copyWith(likesCount: 1).recommendationImpressionId,
      'imp-copy-material',
    );
  });

  test('maps nested supplier summary when present', () {
    final material = MaterialDiscoveryApiMapper.fromJson({
      'id': 'mat-supplier',
      'title': 'Supplier material',
      'description': 'With supplier',
      'status': 'AVAILABLE',
      'quantity': 1,
      'unit': 'piece',
      'condition': 'GOOD',
      'isFree': true,
      'deliveryAvailable': false,
      'supplierName': 'Legacy Supplier',
      'supplierType': 'WORKSHOP',
      'supplierVerified': true,
      'supplier': {
        'id': 'sp-1',
        'displayName': 'Workshop One',
        'avatarUrl': '/uploads/profiles/avatar.jpg',
        'city': 'Nablus',
        'area': 'Industrial',
        'isFollowedByViewer': true,
      },
      'category': {'nameEn': 'Wood', 'nameAr': '???'},
    });

    expect(material.supplier, isNotNull);
    expect(material.supplier!.id, 'sp-1');
    expect(material.supplier!.displayName, 'Workshop One');
    expect(material.supplier!.avatarUrl, endsWith('/uploads/profiles/avatar.jpg'));
    expect(material.supplier!.city, 'Nablus');
    expect(material.supplier!.area, 'Industrial');
    expect(material.supplier!.isFollowedByViewer, isTrue);
    expect(material.supplierName.en, 'Legacy Supplier');
    expect(material.supplierType, 'WORKSHOP');
    expect(material.supplierVerified, isTrue);
  });

  test('omits nested supplier when absent and keeps flat supplier fields', () {
    final material = MaterialDiscoveryApiMapper.fromJson({
      'id': 'mat-flat',
      'title': 'Flat supplier material',
      'description': 'Without nested supplier',
      'status': 'AVAILABLE',
      'quantity': 1,
      'unit': 'piece',
      'condition': 'GOOD',
      'isFree': true,
      'deliveryAvailable': false,
      'supplierName': 'Flat Supplier',
      'supplierType': 'INDIVIDUAL_SUPPLIER',
      'supplierVerified': false,
      'category': {'nameEn': 'Wood', 'nameAr': '???'},
    });

    expect(material.supplier, isNull);
    expect(material.supplierName.en, 'Flat Supplier');
    expect(material.supplierType, 'INDIVIDUAL_SUPPLIER');
    expect(material.supplierVerified, isFalse);
  });

  test('maps isFollowedByViewer false when nested supplier is not followed', () {
    final material = MaterialDiscoveryApiMapper.fromJson({
      'id': 'mat-unfollowed',
      'title': 'Unfollowed supplier',
      'description': 'Supplier not followed',
      'status': 'AVAILABLE',
      'quantity': 1,
      'unit': 'piece',
      'condition': 'GOOD',
      'isFree': true,
      'deliveryAvailable': false,
      'supplier': {
        'id': 'sp-2',
        'displayName': 'Supplier Two',
        'isFollowedByViewer': false,
      },
      'category': {'nameEn': 'Wood', 'nameAr': '???'},
    });

    expect(material.supplier?.isFollowedByViewer, isFalse);
  });
}

