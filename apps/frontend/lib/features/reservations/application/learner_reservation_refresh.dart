import '../../deliveries/data/models/learner_delivery.dart';
import '../data/models/learner_reservation.dart';

/// List-level fallback while waiting on external reservation/delivery changes.
/// Kept deliberately slower than detail/tracking polls.
const learnerReservationRefreshInterval = Duration(seconds: 30);

const _transitionalDeliveryStatuses = {
  'WAITING_FOR_DRIVER',
  'DRIVER_ASSIGNED',
  'ARRIVED_PICKUP',
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
  'REDELIVERY_PENDING',
  'REDELIVERY_SCHEDULED',
  'RETURN_TO_SUPPLIER_REQUIRED',
};

bool learnerReservationNeedsActiveRefresh(LearnerReservation reservation) {
  if (reservation.isPending ||
      reservation.isAwaitingConfirmation ||
      reservation.isAwaitingSupplierConfirmation ||
      reservation.isAwaitingResolution) {
    return true;
  }

  if (!reservation.isAccepted) {
    return false;
  }

  final deliveryStatus = reservation.activeDelivery?.status.toUpperCase();
  return deliveryStatus != null &&
      _transitionalDeliveryStatuses.contains(deliveryStatus);
}

bool learnerDeliveryNeedsActiveRefresh(LearnerDelivery delivery) {
  return delivery.canTrack && !delivery.isTerminal;
}

bool _reservationHasTransitionalDelivery(LearnerReservation reservation) {
  final deliveryStatus = reservation.activeDelivery?.status.toUpperCase();
  return deliveryStatus != null &&
      _transitionalDeliveryStatuses.contains(deliveryStatus);
}

bool learnerReservationsListNeedsActiveRefresh(
  List<LearnerReservation> reservations,
  List<LearnerDelivery> deliveries,
) {
  if (reservations.any(learnerReservationNeedsActiveRefresh)) {
    return true;
  }

  return deliveries.any(learnerDeliveryNeedsActiveRefresh);
}

/// True when the full deliveries collection may change for list cards.
bool learnerReservationsListNeedsDeliveryRefresh(
  List<LearnerReservation> reservations,
  List<LearnerDelivery> deliveries,
) {
  if (reservations.any(_reservationHasTransitionalDelivery)) {
    return true;
  }

  return deliveries.any(learnerDeliveryNeedsActiveRefresh);
}

bool learnerReservationDetailNeedsActiveRefresh(
  LearnerReservation reservation,
  List<LearnerDelivery> deliveries,
) {
  if (learnerReservationNeedsActiveRefresh(reservation)) {
    return true;
  }

  return deliveries.any(
    (delivery) =>
        delivery.reservationId == reservation.id &&
        learnerDeliveryNeedsActiveRefresh(delivery),
  );
}

/// Detail pages should avoid `/deliveries/my` unless delivery state for this
/// reservation can still change externally.
bool learnerReservationDetailNeedsDeliveryRefresh(
  LearnerReservation reservation,
  List<LearnerDelivery> deliveries,
) {
  if (_reservationHasTransitionalDelivery(reservation)) {
    return true;
  }

  return deliveries.any(
    (delivery) =>
        delivery.reservationId == reservation.id &&
        learnerDeliveryNeedsActiveRefresh(delivery),
  );
}
