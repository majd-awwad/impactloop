import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/reservations/data/models/learner_reservation.dart';

void main() {
  test('LearnerReservation parses unit on material', () {
    final reservation = LearnerReservation.fromJson({
      'id': 'res-1',
      'status': 'PENDING',
      'quantityRequested': 2.5,
      'createdAt': '2026-01-01T00:00:00.000Z',
      'updatedAt': '2026-01-01T00:00:00.000Z',
      'material': {
        'id': 'mat-1',
        'title': 'Wood panels',
        'materialType': 'Wood',
        'status': 'AVAILABLE',
        'unit': 'sheet',
        'deliveryAllowed': false,
      },
      'supplier': {
        'id': 'sup-1',
        'displayName': 'Supplier',
      },
    });

    expect(reservation.quantityRequested, 2.5);
    expect(reservation.material.unit, 'sheet');
    expect(reservation.isPending, isTrue);
  });

  test('LearnerReservation exposes cancelled and expired helpers', () {
    final cancelled = LearnerReservation.fromJson({
      'id': 'res-2',
      'status': 'CANCELLED',
      'quantityRequested': 1,
      'createdAt': '2026-01-01T00:00:00.000Z',
      'updatedAt': '2026-01-01T00:00:00.000Z',
      'material': {
        'id': 'mat-1',
        'title': 'Wood panels',
        'materialType': 'Wood',
        'status': 'AVAILABLE',
        'unit': 'sheet',
      },
      'supplier': {'id': 'sup-1', 'displayName': 'Supplier'},
    });

    expect(cancelled.isCancelled, isTrue);
    expect(cancelled.isPending, isFalse);
  });

  test('LearnerReservation parses pickupLocationFull when present', () {
    final reservation = LearnerReservation.fromJson({
      'id': 'res-3',
      'status': 'ACCEPTED',
      'quantityRequested': 1,
      'createdAt': '2026-01-01T00:00:00.000Z',
      'updatedAt': '2026-01-01T00:00:00.000Z',
      'pickupLocationFull': {
        'country': 'Palestine',
        'city': 'Nablus',
        'area': 'Old City',
        'addressLine': '12 Supplier Street',
        'latitude': 32.2211,
        'longitude': 35.2544,
        'isApproximate': false,
      },
      'material': {
        'id': 'mat-1',
        'title': 'Wood panels',
        'materialType': 'Wood',
        'status': 'RESERVED',
        'unit': 'sheet',
        'deliveryAllowed': false,
      },
      'supplier': {'id': 'sup-1', 'displayName': 'Supplier'},
    });

    expect(reservation.pickupLocationFull, isNotNull);
    expect(reservation.pickupLocationFull?.addressLine, '12 Supplier Street');
    expect(reservation.pickupLocationFull?.latitude, 32.2211);
    expect(reservation.hasRevealedPickupLocation, isTrue);
    expect(
      reservation.pickupLocationFull?.formattedAddress,
      '12 Supplier Street, Old City, Nablus, Palestine',
    );
  });

  test('LearnerReservation tolerates missing pickupLocationFull', () {
    final reservation = LearnerReservation.fromJson({
      'id': 'res-4',
      'status': 'PENDING',
      'quantityRequested': 1,
      'createdAt': '2026-01-01T00:00:00.000Z',
      'updatedAt': '2026-01-01T00:00:00.000Z',
      'material': {
        'id': 'mat-1',
        'title': 'Wood panels',
        'materialType': 'Wood',
        'status': 'AVAILABLE',
        'unit': 'sheet',
      },
      'supplier': {'id': 'sup-1', 'displayName': 'Supplier'},
    });

    expect(reservation.pickupLocationFull, isNull);
    expect(reservation.hasRevealedPickupLocation, isFalse);
  });

  test('LearnerReservation tolerates explicit null pickupLocationFull', () {
    final reservation = LearnerReservation.fromJson({
      'id': 'res-5',
      'status': 'ACCEPTED',
      'quantityRequested': 1,
      'createdAt': '2026-01-01T00:00:00.000Z',
      'updatedAt': '2026-01-01T00:00:00.000Z',
      'pickupLocationFull': null,
      'material': {
        'id': 'mat-1',
        'title': 'Wood panels',
        'materialType': 'Wood',
        'status': 'RESERVED',
        'unit': 'sheet',
      },
      'supplier': {'id': 'sup-1', 'displayName': 'Supplier'},
    });

    expect(reservation.pickupLocationFull, isNull);
    expect(reservation.hasRevealedPickupLocation, isFalse);
  });

  test('LearnerReservationPickupLocation formats city-only address', () {
    final location = LearnerReservationPickupLocation.fromJson({
      'city': 'Nablus',
    });

    expect(location.formattedAddress, 'Nablus');
  });

  test('LearnerReservation shouldShowSelfPickupAddress respects delivery flags', () {
    final reservation = LearnerReservation.fromJson({
      'id': 'res-6',
      'status': 'ACCEPTED',
      'quantityRequested': 1,
      'deliveryRequested': true,
      'createdAt': '2026-01-01T00:00:00.000Z',
      'updatedAt': '2026-01-01T00:00:00.000Z',
      'pickupLocationFull': {
        'city': 'Nablus',
        'addressLine': '12 Supplier Street',
      },
      'material': {
        'id': 'mat-1',
        'title': 'Wood panels',
        'materialType': 'Wood',
        'status': 'RESERVED',
        'unit': 'sheet',
      },
      'supplier': {'id': 'sup-1', 'displayName': 'Supplier'},
    });

    expect(reservation.hasRevealedPickupLocation, isTrue);
    expect(
      reservation.shouldShowSelfPickupAddress(hasDeliveryRecord: false),
      isFalse,
    );
    expect(
      reservation.shouldShowSelfPickupAddress(hasDeliveryRecord: true),
      isFalse,
    );

    final selfPickup = LearnerReservation.fromJson({
      'id': 'res-7',
      'status': 'ACCEPTED',
      'quantityRequested': 1,
      'createdAt': '2026-01-01T00:00:00.000Z',
      'updatedAt': '2026-01-01T00:00:00.000Z',
      'pickupLocationFull': {
        'city': 'Nablus',
        'addressLine': '12 Supplier Street',
      },
      'material': {
        'id': 'mat-1',
        'title': 'Wood panels',
        'materialType': 'Wood',
        'status': 'RESERVED',
        'unit': 'sheet',
      },
      'supplier': {'id': 'sup-1', 'displayName': 'Supplier'},
    });

    expect(
      selfPickup.shouldShowSelfPickupAddress(hasDeliveryRecord: false),
      isTrue,
    );
    expect(
      selfPickup.shouldShowSelfPickupAddress(hasDeliveryRecord: true),
      isFalse,
    );
  });
}
