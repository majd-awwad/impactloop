import 'package:dio/dio.dart';

import '../../../core/network/api_response.dart';
import 'models/driver_delivery_failure_request.dart';
import 'models/driver_delivery.dart';
import 'models/driver_location_ping_request.dart';
import 'models/update_driver_delivery_status_request.dart';

class DriverDeliveriesApi {
  const DriverDeliveriesApi(this._client);

  final Dio _client;

  Future<List<DriverDelivery>> fetchAvailableDeliveries() {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('/api/driver/deliveries/available'),
      _parseDeliveryList,
    );
  }

  Future<List<DriverDelivery>> fetchActiveDeliveries() {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('/api/driver/deliveries/active'),
      _parseDeliveryList,
    );
  }

  Future<DriverDelivery> acceptDelivery(String deliveryId) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/driver/deliveries/$deliveryId/accept',
      ),
      DriverDelivery.fromJson,
    );
  }

  Future<DriverDelivery> updateDeliveryStatus(
    String deliveryId,
    UpdateDriverDeliveryStatusRequest request,
  ) {
    return unwrapApiResponse(
      _client.patch<Map<String, dynamic>>(
        '/api/driver/deliveries/$deliveryId/status',
        data: request.toJson(),
      ),
      DriverDelivery.fromJson,
    );
  }

  Future<void> createLocationPing(
    String deliveryId,
    DriverLocationPingRequest request,
  ) async {
    await unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/driver/deliveries/$deliveryId/location-pings',
        data: request.toJson(),
      ),
      (_) {},
    );
  }

  Future<DriverDelivery> reportPickupFailed(
    String deliveryId,
    DriverDeliveryFailureRequest request,
  ) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/driver/deliveries/$deliveryId/pickup-failed',
        data: request.toJson(),
      ),
      (json) => DriverDelivery.fromJson(
        Map<String, dynamic>.from(json['delivery'] as Map? ?? json),
      ),
    );
  }

  Future<DriverDelivery> reportDeliveryFailed(
    String deliveryId,
    DriverDeliveryFailureRequest request,
  ) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/driver/deliveries/$deliveryId/delivery-failed',
        data: request.toJson(),
      ),
      (json) => DriverDelivery.fromJson(
        Map<String, dynamic>.from(json['delivery'] as Map? ?? json),
      ),
    );
  }

  Future<DriverDelivery> reportDriverIssue(
    String deliveryId, {
    required String note,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/driver/deliveries/$deliveryId/driver-issue',
        data: {'note': note},
      ),
      (json) => DriverDelivery.fromJson(
        Map<String, dynamic>.from(json['delivery'] as Map? ?? json),
      ),
    );
  }
}

List<DriverDelivery> _parseDeliveryList(Map<String, dynamic> json) {
  final deliveries = json['deliveries'];
  if (deliveries is! List) {
    return const <DriverDelivery>[];
  }

  return deliveries
      .whereType<Map>()
      .map((item) => DriverDelivery.fromJson(Map<String, dynamic>.from(item)))
      .toList(growable: false);
}
