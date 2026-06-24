import 'package:dio/dio.dart';

import '../../../core/network/api_response.dart';
import 'models/create_reservation_request.dart';
import 'models/created_reservation.dart';
import 'models/learner_reservation.dart';

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

  Future<List<LearnerReservation>> fetchMyReservations() {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('/api/reservations/my'),
      (json) {
        final reservations = json['reservations'];
        if (reservations is! List) {
          return const <LearnerReservation>[];
        }

        return reservations
            .whereType<Map>()
            .map(
              (item) => LearnerReservation.fromJson(
                Map<String, dynamic>.from(item),
              ),
            )
            .toList(growable: false);
      },
    );
  }
}
