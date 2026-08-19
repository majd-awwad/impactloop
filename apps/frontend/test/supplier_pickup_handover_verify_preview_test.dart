import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/driver_portal/data/models/supplier_pickup_handover_verify_preview.dart';

void main() {
  test(
    'verify preview reads reserved quantity from items, not a missing top-level 0',
    () {
      final preview = SupplierPickupHandoverVerifyPreview.fromJson({
        'deliveryId': 'delivery-1',
        'reservationId': 'reservation-1',
        'supplier': {'displayName': 'Workshop Surplus'},
        'pickupLocation': {'city': 'Ramallah', 'area': 'Al-Bireh'},
        'items': [
          {
            'reservationId': 'reservation-1',
            'material': {
              'id': 'material-1',
              'title': 'Arduino Uno',
            },
            'quantity': 4,
            'unit': 'piece',
          },
        ],
        'expiresAt': '2026-08-18T16:00:00.000Z',
      });

      expect(preview.quantity, 4);
      expect(preview.unit, 'piece');
      expect(preview.materialTitle, 'Arduino Uno');
      expect(preview.supplierDisplayName, 'Workshop Surplus');
      expect(preview.pickupCity, 'Ramallah');
    },
  );

  test('verify preview prefers the item matching this reservation', () {
    final preview = SupplierPickupHandoverVerifyPreview.fromJson({
      'deliveryId': 'delivery-1',
      'reservationId': 'reservation-2',
      'supplier': {'displayName': 'Supplier'},
      'pickupLocation': {'city': 'Hebron'},
      'items': [
        {
          'reservationId': 'reservation-1',
          'material': {'title': 'Wood'},
          'quantity': 1,
          'unit': 'sheet',
        },
        {
          'reservationId': 'reservation-2',
          'material': {'title': 'Acrylic'},
          'quantity': 3,
          'unit': 'piece',
        },
      ],
    });

    expect(preview.quantity, 3);
    expect(preview.unit, 'piece');
    expect(preview.materialTitle, 'Acrylic');
  });

  test('missing reserved quantity stays 0 instead of inventing a fallback', () {
    final preview = SupplierPickupHandoverVerifyPreview.fromJson({
      'deliveryId': 'delivery-1',
      'reservationId': 'reservation-1',
      'supplier': {'displayName': 'Supplier'},
      'pickupLocation': {'city': 'Nablus'},
    });

    expect(preview.quantity, 0);
    expect(preview.materialTitle, isEmpty);
  });
}
