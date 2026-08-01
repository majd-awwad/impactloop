import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/reservations_repository.dart';

class ReservationCancelController extends Notifier<AsyncValue<void>> {
  @override
  AsyncValue<void> build() => const AsyncData(null);

  Future<void> cancel(String reservationId) async {
    state = const AsyncLoading();

    try {
      await ref
          .read(reservationsRepositoryProvider)
          .cancelReservation(reservationId);
      state = const AsyncData(null);
    } catch (error, stackTrace) {
      state = AsyncError(error, stackTrace);
      rethrow;
    }
  }
}

final reservationCancelControllerProvider =
    NotifierProvider<ReservationCancelController, AsyncValue<void>>(
      ReservationCancelController.new,
    );

final cancellingReservationIdProvider =
    NotifierProvider<CancellingReservationIdNotifier, String?>(
      CancellingReservationIdNotifier.new,
    );

class CancellingReservationIdNotifier extends Notifier<String?> {
  @override
  String? build() => null;

  void setCancelling(String? reservationId) {
    state = reservationId;
  }
}
