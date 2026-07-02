import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/reservations/data/models/learner_reservation.dart';
import 'package:frontend/features/reservations/presentation/learner_reservation_ui_helpers.dart';

void main() {
  test('formatPickupWindow renders readable same-day window', () {
    final reservation = LearnerReservation.fromJson({
      'id': 'res-1',
      'status': 'ACCEPTED',
      'quantityRequested': 1,
      'createdAt': '2026-01-01T00:00:00.000Z',
      'updatedAt': '2026-01-01T00:00:00.000Z',
      'pickupWindowStart': '2026-06-27T07:00:00.000Z',
      'pickupWindowEnd': '2026-06-27T13:00:00.000Z',
      'material': {
        'id': 'mat-1',
        'title': 'Wood panels',
        'materialType': 'Wood',
        'status': 'RESERVED',
      },
      'supplier': {'id': 'sup-1', 'displayName': 'Supplier'},
    });

    final text = formatPickupWindow(reservation);

    expect(text, isNotNull);
    expect(text, contains('Pickup:'));
    expect(text, contains('Jun 27'));
    expect(text, contains('–'));
  });

  test('formatDeliveryAvailability reflects reserve-time delivery choice', () {
    final reservation = LearnerReservation.fromJson({
      'id': 'res-1',
      'status': 'PENDING',
      'quantityRequested': 1,
      'fulfillmentMethod': 'DELIVERY',
      'createdAt': '2026-01-01T00:00:00.000Z',
      'updatedAt': '2026-01-01T00:00:00.000Z',
      'material': {
        'id': 'mat-1',
        'title': 'Wood panels',
        'materialType': 'Wood',
        'status': 'AVAILABLE',
        'deliveryAllowed': true,
      },
      'supplier': {'id': 'sup-1', 'displayName': 'Supplier'},
    });

    expect(
      formatDeliveryAvailability(reservation),
      'Delivery selected at reservation',
    );
  });

  test('formatPreferredWindowsSummary renders pickup windows', () {
    final reservation = LearnerReservation.fromJson({
      'id': 'res-1',
      'status': 'PENDING',
      'quantityRequested': 1,
      'fulfillmentMethod': 'PICKUP',
      'learnerPreferredPickupWindows': [
        {
          'start': '2026-06-27T07:00:00.000Z',
          'end': '2026-06-27T13:00:00.000Z',
        },
      ],
      'createdAt': '2026-01-01T00:00:00.000Z',
      'updatedAt': '2026-01-01T00:00:00.000Z',
      'material': {
        'id': 'mat-1',
        'title': 'Wood panels',
        'materialType': 'Wood',
        'status': 'AVAILABLE',
      },
      'supplier': {'id': 'sup-1', 'displayName': 'Supplier'},
    });

    final summary = formatPreferredWindowsSummary(reservation);

    expect(summary, isNotNull);
    expect(summary, contains('Preferred pickup'));
  });

  test('reservationMatchesStatusFilter groups cancelled terminal states', () {
    final cancelled = LearnerReservation.fromJson({
      'id': 'res-1',
      'status': 'CANCELLED',
      'quantityRequested': 1,
      'createdAt': '2026-01-01T00:00:00.000Z',
      'updatedAt': '2026-01-01T00:00:00.000Z',
      'material': {
        'id': 'mat-1',
        'title': 'Wood panels',
        'materialType': 'Wood',
        'status': 'AVAILABLE',
      },
      'supplier': {'id': 'sup-1', 'displayName': 'Supplier'},
    });

    expect(
      reservationMatchesStatusFilter(
        cancelled,
        LearnerReservationStatusFilter.cancelled,
      ),
      isTrue,
    );
    expect(
      reservationMatchesStatusFilter(
        cancelled,
        LearnerReservationStatusFilter.active,
      ),
      isFalse,
    );
  });

  test('reservationStatusLabel maps awaiting confirmation', () {
    expect(
      reservationStatusLabel('AWAITING_LEARNER_CONFIRMATION'),
      'Needs your confirmation',
    );
  });

  test('reservationStatusLabel maps accepted delivery fulfillment', () {
    expect(
      reservationStatusLabel('ACCEPTED', fulfillmentMethod: 'DELIVERY'),
      'Accepted / Ready for delivery',
    );
  });

  test('reservationMatchesStatusFilter includes awaiting confirmation in active', () {
    final awaiting = LearnerReservation.fromJson({
      'id': 'res-awaiting',
      'status': 'AWAITING_LEARNER_CONFIRMATION',
      'quantityRequested': 1,
      'createdAt': '2026-01-01T00:00:00.000Z',
      'updatedAt': '2026-01-01T00:00:00.000Z',
      'material': {
        'id': 'mat-1',
        'title': 'Wood panels',
        'materialType': 'Wood',
        'status': 'AVAILABLE',
      },
      'supplier': {'id': 'sup-1', 'displayName': 'Supplier'},
    });

    expect(
      reservationMatchesStatusFilter(
        awaiting,
        LearnerReservationStatusFilter.active,
      ),
      isTrue,
    );
    expect(
      reservationMatchesStatusFilter(
        awaiting,
        LearnerReservationStatusFilter.needsAction,
      ),
      isTrue,
    );
    expect(
      reservationMatchesStatusFilter(
        awaiting,
        LearnerReservationStatusFilter.all,
      ),
      isTrue,
    );
  });
}
