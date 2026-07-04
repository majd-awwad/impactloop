import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/reservations/data/models/create_reservation_request.dart';
import 'package:frontend/features/reservations/data/models/learner_reservation.dart';
import 'package:frontend/features/reservations/data/models/reservation_preferred_window.dart';

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

  test('LearnerReservation parses material imageUrl', () {
    final reservation = LearnerReservation.fromJson({
      'id': 'res-1',
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
        'imageUrl': 'https://example.test/material.jpg',
      },
      'supplier': {'id': 'sup-1', 'displayName': 'Supplier'},
    });

    expect(reservation.material.imageUrl, 'https://example.test/material.jpg');
  });

  test('LearnerReservation resolves relative material imageUrl', () {
    final reservation = LearnerReservation.fromJson({
      'id': 'res-1',
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
        'imageUrl': '/uploads/materials/cover.jpg',
      },
      'supplier': {'id': 'sup-1', 'displayName': 'Supplier'},
    });

    expect(
      reservation.material.imageUrl,
      endsWith('/uploads/materials/cover.jpg'),
    );
    expect(reservation.material.imageUrl, startsWith('http'));
  });

  test('LearnerReservation parses selfPickupCode for accepted pickup', () {
    final reservation = LearnerReservation.fromJson({
      'id': 'res-pickup-code',
      'status': 'ACCEPTED',
      'fulfillmentMethod': 'PICKUP',
      'quantityRequested': 1,
      'createdAt': '2026-01-01T00:00:00.000Z',
      'updatedAt': '2026-01-01T00:00:00.000Z',
      'selfPickupCode': '123456',
      'material': {
        'id': 'mat-1',
        'title': 'Wood panels',
        'materialType': 'Wood',
        'status': 'AVAILABLE',
        'unit': 'sheet',
      },
      'supplier': {'id': 'sup-1', 'displayName': 'Supplier'},
    });

    expect(reservation.selfPickupCode, '123456');
    expect(reservation.shouldShowSelfPickupCode, isTrue);
  });

  test('LearnerReservation hides selfPickupCode helper for pending status', () {
    final reservation = LearnerReservation.fromJson({
      'id': 'res-pending-code',
      'status': 'PENDING',
      'fulfillmentMethod': 'PICKUP',
      'quantityRequested': 1,
      'createdAt': '2026-01-01T00:00:00.000Z',
      'updatedAt': '2026-01-01T00:00:00.000Z',
      'selfPickupCode': '123456',
      'material': {
        'id': 'mat-1',
        'title': 'Wood panels',
        'materialType': 'Wood',
        'status': 'AVAILABLE',
        'unit': 'sheet',
      },
      'supplier': {'id': 'sup-1', 'displayName': 'Supplier'},
    });

    expect(reservation.shouldShowSelfPickupCode, isFalse);
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
      'fulfillmentMethod': 'DELIVERY',
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
      'fulfillmentMethod': 'PICKUP',
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

  test('LearnerReservation parses fulfillment fields', () {
    final reservation = LearnerReservation.fromJson({
      'id': 'res-fulfillment',
      'status': 'PENDING',
      'quantityRequested': 1,
      'fulfillmentMethod': 'DELIVERY',
      'learnerPreferredDeliveryWindows': [
        {
          'start': '2026-06-27T07:00:00.000Z',
          'end': '2026-06-27T13:00:00.000Z',
        },
      ],
      'deliveryAddressText': '12 Learner Street',
      'safeDropoffAllowed': true,
      'deliveryNote': 'Ring the bell',
      'createdAt': '2026-01-01T00:00:00.000Z',
      'updatedAt': '2026-01-01T00:00:00.000Z',
      'material': {
        'id': 'mat-1',
        'title': 'Wood panels',
        'materialType': 'Wood',
        'status': 'AVAILABLE',
        'unit': 'sheet',
        'deliveryAllowed': true,
      },
      'supplier': {'id': 'sup-1', 'displayName': 'Supplier'},
    });

    expect(reservation.isDeliveryFulfillment, isTrue);
    expect(reservation.learnerPreferredDeliveryWindows, hasLength(1));
    expect(reservation.deliveryAddressText, '12 Learner Street');
    expect(reservation.safeDropoffAllowed, isTrue);
    expect(reservation.deliveryNote, 'Ring the bell');
  });

  test('CreateReservationRequest serializes pickup fulfillment payload', () {
    final request = CreateReservationRequest(
      materialId: 'mat-1',
      quantityRequested: 2,
      fulfillmentMethod: 'PICKUP',
      learnerPreferredPickupWindows: [
        ReservationPreferredWindow(
          start: DateTime.utc(2026, 6, 27, 7),
          end: DateTime.utc(2026, 6, 27, 13),
        ),
      ],
    );

    final json = request.toJson();

    expect(json['fulfillmentMethod'], 'PICKUP');
    expect(json['learnerPreferredPickupWindows'], hasLength(1));
    expect(json.containsKey('deliveryAddressText'), isFalse);
  });

  test('LearnerReservation parses awaiting confirmation scheduling fields', () {
    final reservation = LearnerReservation.fromJson({
      'id': 'res-awaiting',
      'status': 'AWAITING_LEARNER_CONFIRMATION',
      'quantityRequested': 1,
      'fulfillmentMethod': 'DELIVERY',
      'supplierPickupWindowStart': '2026-06-27T07:00:00.000Z',
      'supplierPickupWindowEnd': '2026-06-27T09:00:00.000Z',
      'learnerPreferredDeliveryWindows': [
        {
          'start': '2026-06-27T05:00:00.000Z',
          'end': '2026-06-27T06:00:00.000Z',
        },
      ],
      'earliestDeliveryStart': '2026-06-27T10:00:00.000Z',
      'schedulingConflictReason': 'No overlap after delivery buffer',
      'createdAt': '2026-01-01T00:00:00.000Z',
      'updatedAt': '2026-01-01T00:00:00.000Z',
      'material': {
        'id': 'mat-1',
        'title': 'Wood panels',
        'materialType': 'Wood',
        'status': 'AVAILABLE',
        'unit': 'sheet',
        'deliveryAllowed': true,
      },
      'supplier': {'id': 'sup-1', 'displayName': 'Supplier'},
    });

    expect(reservation.isAwaitingConfirmation, isTrue);
    expect(reservation.supplierPickupWindowStart, isNotNull);
    expect(reservation.earliestDeliveryStart, isNotNull);
    expect(
      reservation.schedulingConflictReason,
      'No overlap after delivery buffer',
    );
  });

  test('LearnerReservation parses supplier proposed pickup fields', () {
    final reservation = LearnerReservation.fromJson({
      'id': 'res-pickup-awaiting',
      'status': 'AWAITING_LEARNER_CONFIRMATION',
      'quantityRequested': 1,
      'fulfillmentMethod': 'PICKUP',
      'supplierProposedPickupWindowStart': '2026-06-28T07:00:00.000Z',
      'supplierProposedPickupWindowEnd': '2026-06-28T09:00:00.000Z',
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

    expect(reservation.supplierProposedPickupWindowStart, isNotNull);
    expect(reservation.supplierProposedPickupWindowEnd, isNotNull);
  });
}
