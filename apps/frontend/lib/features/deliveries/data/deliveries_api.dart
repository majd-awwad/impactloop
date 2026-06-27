import 'package:dio/dio.dart';

import '../../../core/network/api_response.dart';
import 'models/learner_delivery.dart';
import 'models/request_delivery_request.dart';

class DeliveriesApi {
  const DeliveriesApi(this._client);

  final Dio _client;

  Future<LearnerDelivery> requestDelivery(
    String reservationId,
    RequestDeliveryRequest request,
  ) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/reservations/$reservationId/delivery',
        data: request.toJson(),
      ),
      LearnerDelivery.fromJson,
    );
  }

  Future<List<LearnerDelivery>> fetchMyDeliveries() {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('/api/deliveries/my'),
      (json) {
        final deliveries = json['deliveries'];
        if (deliveries is! List) {
          return const <LearnerDelivery>[];
        }

        return deliveries
            .whereType<Map>()
            .map(
              (item) =>
                  LearnerDelivery.fromJson(Map<String, dynamic>.from(item)),
            )
            .toList(growable: false);
      },
    );
  }

  Future<LearnerDelivery> fetchDelivery(String deliveryId) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('/api/deliveries/$deliveryId'),
      LearnerDelivery.fromJson,
    );
  }
}
