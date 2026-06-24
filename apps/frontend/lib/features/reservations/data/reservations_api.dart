import 'package:dio/dio.dart';

import '../../../core/network/api_response.dart';
import 'models/create_reservation_request.dart';
import 'models/created_reservation.dart';

class ReservationsApi {
  const ReservationsApi(this._client);

  final Dio _client;

  Future<CreatedReservation> createReservation(
    CreateReservationRequest request,
  ) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/reservations',
        data: request.toJson(),
      ),
      CreatedReservation.fromJson,
    );
  }
}
