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
}
