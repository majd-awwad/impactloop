import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/create_reservation_request.dart';
import '../data/models/created_reservation.dart';
import '../data/reservations_repository.dart';

class ReservationCreateController extends Notifier<AsyncValue<void>> {
  @override
  AsyncValue<void> build() => const AsyncData(null);

  Future<CreatedReservation> create(CreateReservationRequest request) async {
    state = const AsyncLoading();

    try {
      final reservation = await ref
          .read(reservationsRepositoryProvider)
          .createReservation(request);
      state = const AsyncData(null);
      return reservation;
    } catch (error, stackTrace) {
      state = AsyncError(error, stackTrace);
      rethrow;
    }
  }
}

final reservationCreateControllerProvider =
    NotifierProvider<ReservationCreateController, AsyncValue<void>>(
      ReservationCreateController.new,
    );
