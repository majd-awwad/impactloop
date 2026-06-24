import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import 'models/create_reservation_request.dart';
import 'models/created_reservation.dart';
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
}
