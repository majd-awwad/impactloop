import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/material_discovery/domain/discovery_material.dart';
import 'package:frontend/features/material_discovery/presentation/material_reserve_eligibility.dart';
import 'package:frontend/features/reservations/data/models/learner_reservation.dart';
import 'package:frontend/shared/models/localized_text.dart';
import 'package:frontend/shared/widgets/materials/material_condition_badge.dart';
import 'package:frontend/shared/widgets/materials/material_status_badge.dart';

DiscoveryMaterial _material({
  String status = 'AVAILABLE',
  double availableQuantity = 5,
  bool pickupAllowed = true,
  bool deliveryAvailable = true,
  bool? canReserve,
  String? reserveBlockReason,
  bool? isOwnMaterial,
}) {
  return DiscoveryMaterial(
    id: 'material-1',
    status: status,
    quantity: 5,
    availableQuantity: availableQuantity,
    unit: 'piece',
    title: const LocalizedText(en: 'Board', ar: 'Board'),
    description: const LocalizedText(en: 'Board', ar: 'Board'),
    category: const LocalizedText(en: 'Electronics', ar: 'Electronics'),
    conditionLabel: const LocalizedText(en: 'Good', ar: 'Good'),
    conditionTone: MaterialConditionBadgeTone.good,
    statusLabel: const LocalizedText(en: 'Available', ar: 'Available'),
    statusTone: MaterialStatusBadgeTone.available,
    quantityLabel: const LocalizedText(en: '5 pieces', ar: '5 pieces'),
    priceLabel: const LocalizedText(en: '10 NIS', ar: '10 NIS'),
    locationLabel: const LocalizedText(en: 'Nablus', ar: 'Nablus'),
    availabilityLabel: const LocalizedText(en: 'Pickup', ar: 'Pickup'),
    deliveryAvailable: deliveryAvailable,
    pickupAllowed: pickupAllowed,
    isFree: false,
    supplierName: const LocalizedText(en: 'Supplier', ar: 'Supplier'),
    supplierSubtitle: const LocalizedText(en: 'Supplier', ar: 'Supplier'),
    heroIconData: Icons.inventory_2_outlined,
    cardGradient: const [0xFF123456, 0xFF654321],
    canReserve: canReserve,
    reserveBlockReason: reserveBlockReason,
    isOwnMaterial: isOwnMaterial,
  );
}

LearnerReservation _reservation(String status) {
  return LearnerReservation(
    id: 'reservation-$status',
    status: status,
    quantityRequested: 1,
    createdAt: DateTime(2026),
    updatedAt: DateTime(2026),
    material: const LearnerReservationMaterial(
      id: 'material-1',
      title: 'Board',
      materialType: 'Electronics',
      status: 'AVAILABLE',
      deliveryAllowed: true,
    ),
    supplier: const LearnerReservationSupplier(
      id: 'supplier-1',
      displayName: 'Supplier',
    ),
  );
}

AuthState _learnerAuth() {
  return AuthState(
    user: User(
      id: 'learner-1',
      displayName: 'Learner',
      email: 'learner@test.com',
      accountStatus: 'ACTIVE',
      roles: const ['LEARNER'],
      activeRole: 'LEARNER',
      createdAt: DateTime(2026),
    ),
    accessToken: 'test-token',
    hasBootstrapped: true,
  );
}

void main() {
  test('no previous reservation and available material can reserve', () {
    final eligibility = MaterialReserveEligibility.resolve(
      material: _material(canReserve: null),
      authState: _learnerAuth(),
      isSubmitting: false,
      isLoadingReservation: false,
      showReservationStatusCta: false,
      learnerReservation: null,
    );

    expect(eligibility.canTapReserve, isTrue);
    expect(eligibility.disabledReason, isNull);
  });

  for (final status in const [
    'PENDING',
    'AWAITING_LEARNER_CONFIRMATION',
    'AWAITING_SUPPLIER_CONFIRMATION',
    'ACCEPTED',
    'AWAITING_RESOLUTION',
  ]) {
    test('$status previous reservation blocks duplicate reservation', () {
      final eligibility = MaterialReserveEligibility.resolve(
        material: _material(canReserve: null),
        authState: _learnerAuth(),
        isSubmitting: false,
        isLoadingReservation: false,
        showReservationStatusCta: false,
        learnerReservation: _reservation(status),
      );

      expect(eligibility.canTapReserve, isFalse);
      expect(eligibility.learnerReservation?.status, status);
      expect(
        eligibility.disabledReason?.en,
        'You already have a reservation request for this material.',
      );
    });
  }

  for (final status in const [
    'REJECTED',
    'CANCELLED',
    'EXPIRED',
    'COMPLETED',
  ]) {
    test(
      '$status previous reservation does not block a reservable material',
      () {
        final eligibility = MaterialReserveEligibility.resolve(
          material: _material(canReserve: null),
          authState: _learnerAuth(),
          isSubmitting: false,
          isLoadingReservation: false,
          showReservationStatusCta: false,
          learnerReservation: _reservation(status),
        );

        expect(eligibility.canTapReserve, isTrue);
        expect(eligibility.learnerReservation, isNull);
        expect(eligibility.disabledReason, isNull);
      },
    );
  }

  test('terminal previous reservation cannot reserve unavailable material', () {
    final eligibility = MaterialReserveEligibility.resolve(
      material: _material(
        status: 'REUSED',
        availableQuantity: 1,
        canReserve: null,
      ),
      authState: _learnerAuth(),
      isSubmitting: false,
      isLoadingReservation: false,
      showReservationStatusCta: false,
      learnerReservation: _reservation('REJECTED'),
    );

    expect(eligibility.canTapReserve, isFalse);
    expect(eligibility.learnerReservation, isNull);
    expect(eligibility.disabledReason?.en, 'This material is not available.');
  });

  test('completed previous reservation cannot reserve with no quantity', () {
    final eligibility = MaterialReserveEligibility.resolve(
      material: _material(availableQuantity: 0, canReserve: null),
      authState: _learnerAuth(),
      isSubmitting: false,
      isLoadingReservation: false,
      showReservationStatusCta: false,
      learnerReservation: _reservation('COMPLETED'),
    );

    expect(eligibility.canTapReserve, isFalse);
    expect(eligibility.learnerReservation, isNull);
    expect(eligibility.disabledReason?.en, 'This material is not available.');
  });

  test('supplier-only authenticated user sees learner CTA reason', () {
    final eligibility = MaterialReserveEligibility.resolve(
      material: _material(canReserve: false, reserveBlockReason: 'NOT_LEARNER'),
      authState: AuthState(
        user: User(
          id: 'supplier-1',
          displayName: 'Supplier',
          email: 'supplier@test.com',
          accountStatus: 'ACTIVE',
          roles: const ['SUPPLIER'],
          activeRole: 'SUPPLIER',
          createdAt: DateTime(2026),
        ),
        accessToken: 'test-token',
        hasBootstrapped: true,
      ),
      isSubmitting: false,
      isLoadingReservation: false,
      showReservationStatusCta: false,
      learnerReservation: null,
    );

    expect(eligibility.canTapReserve, isFalse);
    expect(
      eligibility.disabledReason?.en,
      'Become a learner to reserve materials.',
    );
  });

  test('own material is blocked with clear reason', () {
    final eligibility = MaterialReserveEligibility.resolve(
      material: _material(isOwnMaterial: true, canReserve: false),
      authState: _learnerAuth(),
      isSubmitting: false,
      isLoadingReservation: false,
      showReservationStatusCta: false,
      learnerReservation: null,
    );

    expect(eligibility.canTapReserve, isFalse);
    expect(
      eligibility.disabledReason?.en,
      'You cannot reserve your own material.',
    );
  });
}
