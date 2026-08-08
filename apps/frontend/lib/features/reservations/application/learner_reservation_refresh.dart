import '../../deliveries/data/models/learner_delivery.dart';
import '../data/models/learner_reservation.dart';

const learnerReservationRefreshInterval = Duration(seconds: 10);

const _transitionalDeliveryStatuses = {
  'WAITING_FOR_DRIVER',
  'DRIVER_ASSIGNED',
  'ARRIVED_PICKUP',
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
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

bool learnerReservationsListNeedsActiveRefresh(
  List<LearnerReservation> reservations,
  List<LearnerDelivery> deliveries,
) {
  if (reservations.any(learnerReservationNeedsActiveRefresh)) {
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
