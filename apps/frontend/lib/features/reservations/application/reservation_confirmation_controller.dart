import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/learner_reservation.dart';
import '../data/reservations_repository.dart';

class ReservationConfirmationController extends Notifier<AsyncValue<void>> {
  @override
  AsyncValue<void> build() => const AsyncData(null);

  Future<LearnerReservation> acceptProposedPickup(String reservationId) {
    return _resolve(reservationId, action: 'ACCEPT_PROPOSED_PICKUP');
  }

  Future<LearnerReservation> submitDeliveryWindow({
    required String reservationId,
    required DateTime start,
    required DateTime end,
  }) {
    return _resolve(
      reservationId,
      action: 'SUBMIT_DELIVERY_WINDOW',
      deliveryWindowStart: start,
      deliveryWindowEnd: end,
    );
  }

  Future<LearnerReservation> cancelAwaitingConfirmation(String reservationId) {
    return _resolve(reservationId, action: 'CANCEL');
  }

  Future<LearnerReservation> _resolve(
    String reservationId, {
    required String action,
    DateTime? deliveryWindowStart,
    DateTime? deliveryWindowEnd,
  }) async {
    state = const AsyncLoading();

    try {
      final reservation = await ref
          .read(reservationsRepositoryProvider)
          .resolveLearnerConfirmation(
            reservationId: reservationId,
            action: action,
            deliveryWindowStart: deliveryWindowStart,
            deliveryWindowEnd: deliveryWindowEnd,
          );
      state = const AsyncData(null);
      return reservation;
    } catch (error, stackTrace) {
      state = AsyncError(error, stackTrace);
      rethrow;
    }
  }
}

final reservationConfirmationControllerProvider =
    NotifierProvider<ReservationConfirmationController, AsyncValue<void>>(
      ReservationConfirmationController.new,
    );

final confirmingReservationIdProvider =
    NotifierProvider<ConfirmingReservationIdNotifier, String?>(
      ConfirmingReservationIdNotifier.new,
    );

class ConfirmingReservationIdNotifier extends Notifier<String?> {
  @override
  String? build() => null;

  void setConfirming(String? reservationId) {
    state = reservationId;
  }
}
