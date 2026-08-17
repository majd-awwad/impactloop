import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/material_discovery/domain/discovery_material.dart';
import 'package:frontend/features/material_discovery/presentation/widgets/reservation_form/reservation_form_logic.dart';
import 'package:frontend/features/reservations/data/models/reservation_quote.dart';
import 'package:frontend/shared/models/localized_text.dart';
import 'package:frontend/shared/widgets/materials/material_condition_badge.dart';
import 'package:frontend/shared/widgets/materials/material_status_badge.dart';

DiscoveryMaterial _material({
  double availableQuantity = 20,
  String unit = 'piece',
  bool isFree = false,
  bool pickupAllowed = true,
  bool deliveryAvailable = true,
}) {
  return DiscoveryMaterial(
    id: 'material-1',
    availableQuantity: availableQuantity,
    quantity: availableQuantity,
    unit: unit,
    title: const LocalizedText(en: 'Jumper Wires', ar: 'أسلاك'),
    description: const LocalizedText(en: 'Bundle', ar: 'حزمة'),
    category: const LocalizedText(en: 'Electronics', ar: 'إلكترونيات'),
    conditionLabel: const LocalizedText(en: 'Good', ar: 'جيد'),
    conditionTone: MaterialConditionBadgeTone.good,
    statusLabel: const LocalizedText(en: 'Available', ar: 'متاح'),
    statusTone: MaterialStatusBadgeTone.available,
    quantityLabel: const LocalizedText(en: '20', ar: '20'),
    priceLabel: const LocalizedText(en: '10 NIS', ar: '10 شيكل'),
    locationLabel: const LocalizedText(en: 'Ramallah', ar: 'رام الله'),
    availabilityLabel: const LocalizedText(en: 'Available', ar: 'متاح'),
    deliveryAvailable: deliveryAvailable,
    pickupAllowed: pickupAllowed,
    isFree: isFree,
    supplierName: const LocalizedText(en: 'Supplier', ar: 'مورد'),
    supplierSubtitle: const LocalizedText(en: 'Supplier', ar: 'مورد'),
    heroIconData: Icons.inventory_2_outlined,
    cardGradient: const [0xFF123456, 0xFF654321],
  );
}

ReservationQuote _quote({
  double totalAmount = 210,
  String fulfillmentMethod = 'DELIVERY',
}) {
  return ReservationQuote(
    materialId: 'material-1',
    unitPrice: 10,
    quantity: 1,
    materialSubtotal: 10,
    deliveryFee: 200,
    totalAmount: totalAmount,
    currency: 'NIS',
    fulfillmentMethod: fulfillmentMethod,
    canDeliver: true,
    groupingAvailable: false,
    groupingApplied: false,
  );
}

void main() {
  group('resolveInitialReservationQuantity', () {
    test('defaults to 1 for normal reservation', () {
      expect(
        resolveInitialReservationQuantity(
          availableQuantity: 20,
          unit: 'piece',
        ),
        1,
      );
    });

    test('preserves requested quantity when valid', () {
      expect(
        resolveInitialReservationQuantity(
          availableQuantity: 20,
          unit: 'piece',
          requestedQuantity: 5,
        ),
        5,
      );
    });

    test('clamps requested quantity to available stock', () {
      expect(
        resolveInitialReservationQuantity(
          availableQuantity: 3,
          unit: 'piece',
          requestedQuantity: 8,
        ),
        3,
      );
    });

    test('defaults to 1 for non-count units instead of full stock', () {
      expect(
        resolveInitialReservationQuantity(
          availableQuantity: 12.5,
          unit: 'kg',
        ),
        1,
      );
    });
  });

  group('reservationQuantityStep', () {
    test('steps by 1 for piece-like units including Arabic and pcs', () {
      expect(reservationQuantityStep('piece'), 1);
      expect(reservationQuantityStep('pcs'), 1);
      expect(reservationQuantityStep('قطعة'), 1);
      expect(reservationQuantityStep('قطعة pcs'), 1);
      expect(reservationQuantityStep('bag'), 1);
    });

    test('steps by 0.1 only for measurable units', () {
      expect(reservationQuantityStep('kg'), 0.1);
      expect(reservationQuantityStep('كيلو'), 0.1);
      expect(reservationQuantityStep('liter'), 0.1);
      expect(reservationQuantityStep('meter'), 0.1);
    });
  });

  group('shouldShowReservationPaymentMethod', () {
    test('hides payment for free materials with zero quote', () {
      expect(
        shouldShowReservationPaymentMethod(
          material: _material(isFree: true),
          fulfillmentMethod: 'PICKUP',
          quantity: 1,
          quote: _quote(totalAmount: 0),
        ),
        isFalse,
      );
    });

    test('shows payment for pickup with positive quote', () {
      expect(
        shouldShowReservationPaymentMethod(
          material: _material(),
          fulfillmentMethod: 'PICKUP',
          quantity: 1,
          quote: _quote(totalAmount: 50, fulfillmentMethod: 'PICKUP'),
        ),
        isTrue,
      );
    });

    test('shows payment for delivery before quote when material is paid', () {
      expect(
        shouldShowReservationPaymentMethod(
          material: _material(),
          fulfillmentMethod: 'DELIVERY',
          quantity: 1,
          quote: null,
        ),
        isTrue,
      );
    });

    test('hides payment when quote total is zero', () {
      expect(
        shouldShowReservationPaymentMethod(
          material: _material(),
          fulfillmentMethod: 'DELIVERY',
          quantity: 1,
          quote: _quote(totalAmount: 0),
        ),
        isFalse,
      );
    });
  });

  group('initialFulfillmentMethod', () {
    test('prefers pickup when both are available', () {
      expect(initialFulfillmentMethod(_material()), 'PICKUP');
    });

    test('selects delivery when pickup is unavailable', () {
      expect(
        initialFulfillmentMethod(
          _material(pickupAllowed: false, deliveryAvailable: true),
        ),
        'DELIVERY',
      );
    });
  });
}
