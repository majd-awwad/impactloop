import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import 'models/create_reservation_request.dart';
import 'models/created_reservation.dart';
import 'models/learner_reservation.dart';
import 'models/reservation_message.dart';
import 'reservations_api.dart';

final reservationsApiProvider = Provider<ReservationsApi>((ref) {
  return ReservationsApi(ref.watch(apiClientProvider));
});

final reservationsRepositoryProvider = Provider<ReservationsRepository>((ref) {
  return ReservationsRepository(ref.watch(reservationsApiProvider));
});

class ReservationsRepository {
  const ReservationsRepository(this._api);

  final ReservationsApi _api;

  Future<CreatedReservation> createReservation(
    CreateReservationRequest request,
  ) {
    return _api.createReservation(request);
  }

  Future<List<LearnerReservation>> fetchMyReservations() {
    return _api.fetchMyReservations();
  }

  Future<void> cancelReservation(String reservationId) {
    return _api.cancelReservation(reservationId);
  }

  Future<LearnerReservation> resolveLearnerConfirmation({
    required String reservationId,
    required String action,
    DateTime? deliveryWindowStart,
    DateTime? deliveryWindowEnd,
  }) {
    return _api.resolveLearnerConfirmation(
      reservationId: reservationId,
      action: action,
      deliveryWindowStart: deliveryWindowStart,
      deliveryWindowEnd: deliveryWindowEnd,
    );
  }

  Future<List<ReservationMessage>> fetchReservationMessages(
    String reservationId,
  ) {
    return _api.fetchReservationMessages(reservationId);
  }

  Future<ReservationMessage> sendReservationMessage(
    String reservationId,
    String body,
  ) {
    return _api.sendReservationMessage(reservationId, body);
  }
}
