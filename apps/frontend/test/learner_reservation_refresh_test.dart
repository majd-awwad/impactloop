import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/deliveries/data/models/learner_delivery.dart';
import 'package:frontend/features/reservations/application/learner_reservation_refresh.dart';
import 'package:frontend/features/reservations/data/models/learner_reservation.dart';

LearnerReservation _reservation({
  required String id,
  required String status,
  String? deliveryStatus,
}) {
  return LearnerReservation(
    id: id,
    status: status,
    quantityRequested: 1,
    createdAt: DateTime.utc(2026, 1, 1),
    updatedAt: DateTime.utc(2026, 1, 2),
    activeDelivery: deliveryStatus == null
        ? null
        : LearnerReservationActiveDelivery(
            id: 'delivery-$id',
            status: deliveryStatus,
          ),
    material: const LearnerReservationMaterial(
      id: 'material-1',
      title: 'Material',
      materialType: 'Wood',
      status: 'AVAILABLE',
      deliveryAllowed: true,
    ),
    supplier: const LearnerReservationSupplier(
      id: 'supplier-1',
      displayName: 'Supplier',
    ),
  );
}

LearnerDelivery _delivery({
  required String id,
  required String reservationId,
  required String status,
  bool canTrack = true,
}) {
  return LearnerDelivery(
    id: id,
    reservationId: reservationId,
    status: status,
    requestedAt: DateTime.utc(2026, 1, 1),
    canTrack: canTrack,
    reservation: LearnerDeliveryReservation(
      id: reservationId,
      status: 'ACCEPTED',
      material: const LearnerDeliveryMaterial(
        id: 'material-1',
        title: 'Material',
        status: 'RESERVED',
      ),
      supplier: const LearnerDeliverySupplier(
        id: 'supplier-1',
        displayName: 'Supplier',
      ),
    ),
    pickupLocation: const LearnerDeliveryLocation(
      id: 'pickup-1',
      country: 'Palestine',
      city: 'Ramallah',
    ),
    dropoffLocation: const LearnerDeliveryLocation(
      id: 'dropoff-1',
      country: 'Palestine',
      city: 'Nablus',
    ),
  );
}

void main() {
  group('learner reservation refresh helpers', () {
    test('static/terminal lists do not need polling', () {
      final reservations = [
        _reservation(id: 'r1', status: 'COMPLETED'),
        _reservation(id: 'r2', status: 'CANCELLED'),
      ];
      final deliveries = [
        _delivery(
          id: 'd1',
          reservationId: 'r1',
          status: 'COMPLETED',
          canTrack: false,
        ),
      ];

      expect(
        learnerReservationsListNeedsActiveRefresh(reservations, deliveries),
        isFalse,
      );
      expect(
        learnerReservationsListNeedsDeliveryRefresh(reservations, deliveries),
        isFalse,
      );
    });

    test('pending reservation enables list polling without deliveries', () {
      final reservations = [_reservation(id: 'r1', status: 'PENDING')];
      const deliveries = <LearnerDelivery>[];

      expect(
        learnerReservationsListNeedsActiveRefresh(reservations, deliveries),
        isTrue,
      );
      expect(
        learnerReservationsListNeedsDeliveryRefresh(reservations, deliveries),
        isFalse,
      );
    });

    test('transitional delivery enables delivery collection refresh', () {
      final reservations = [
        _reservation(
          id: 'r1',
          status: 'ACCEPTED',
          deliveryStatus: 'ON_THE_WAY',
        ),
      ];
      final deliveries = [
        _delivery(
          id: 'd1',
          reservationId: 'r1',
          status: 'ON_THE_WAY',
        ),
      ];

      expect(
        learnerReservationsListNeedsActiveRefresh(reservations, deliveries),
        isTrue,
      );
      expect(
        learnerReservationsListNeedsDeliveryRefresh(reservations, deliveries),
        isTrue,
      );
    });

    test('detail gates delivery refresh to the same reservation', () {
      final reservation = _reservation(id: 'r1', status: 'PENDING');
      final deliveries = [
        _delivery(
          id: 'd-other',
          reservationId: 'r-other',
          status: 'ON_THE_WAY',
        ),
      ];

      expect(
        learnerReservationDetailNeedsActiveRefresh(reservation, deliveries),
        isTrue,
      );
      expect(
        learnerReservationDetailNeedsDeliveryRefresh(reservation, deliveries),
        isFalse,
      );
    });

    test('list interval is slower than former 10s aggressive poll', () {
      expect(
        learnerReservationRefreshInterval,
        const Duration(seconds: 30),
      );
    });
  });
}
