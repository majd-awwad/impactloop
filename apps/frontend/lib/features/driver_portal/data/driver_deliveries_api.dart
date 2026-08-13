import 'package:dio/dio.dart';

import '../../../core/network/api_response.dart';
import 'models/driver_delivery_inactive_context.dart';
import 'models/driver_delivery_failure_request.dart';
import 'models/driver_delivery.dart';
import 'models/driver_delivery_detail_result.dart';
import 'models/driver_deliveries_list_result.dart';
import 'models/driver_location_ping_request.dart';
import 'models/update_driver_delivery_status_request.dart';
import 'models/driver_archive.dart';
import 'models/delivery_handover_verify_preview.dart';
import 'models/supplier_pickup_handover_verify_preview.dart';

class DriverDeliveriesApi {
  const DriverDeliveriesApi(this._client);

  final Dio _client;

  Future<DriverArchivePage<DriverHistoricalDelivery>> fetchHistory({
    String? cursor,
    int limit = 20,
  }) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/driver/deliveries/history',
        queryParameters: {'limit': limit, 'cursor': ?cursor},
      ),
      (json) => DriverArchivePage(
        items: (json['deliveries'] as List? ?? const [])
            .whereType<Map>()
            .map(
              (item) => DriverHistoricalDelivery.fromJson(
                Map<String, dynamic>.from(item),
              ),
            )
            .toList(growable: false),
        pagination: DriverDeliveriesPagination.fromJson(
          Map<String, dynamic>.from(json['pagination'] as Map? ?? const {}),
        ),
      ),
    );
  }

  Future<DriverHistoricalDelivery> fetchHistoricalDelivery(String deliveryId) =>
      unwrapApiResponse(
        _client.get<Map<String, dynamic>>(
          '/api/driver/deliveries/history/$deliveryId',
        ),
        DriverHistoricalDelivery.fromJson,
      );

  Future<DriverArchivePage<DriverIncident>> fetchIncidents({
    String? cursor,
    int limit = 20,
  }) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/driver/incidents',
        queryParameters: {'limit': limit, 'cursor': ?cursor},
      ),
      (json) => DriverArchivePage(
        items: (json['incidents'] as List? ?? const [])
            .whereType<Map>()
            .map(
              (item) =>
                  DriverIncident.fromJson(Map<String, dynamic>.from(item)),
            )
            .toList(growable: false),
        pagination: DriverDeliveriesPagination.fromJson(
          Map<String, dynamic>.from(json['pagination'] as Map? ?? const {}),
        ),
      ),
    );
  }

  Future<DriverDeliveriesListResult> fetchAvailableDeliveries({
    DriverAvailableJobsFilter? filter,
    String? cursor,
    int limit = 20,
  }) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/driver/deliveries/available',
        queryParameters: {
          ...?filter?.toQueryParameters(),
          'limit': limit,
          'cursor': ?cursor,
        },
      ),
      _parseDeliveriesListResult,
    );
  }

  Future<DriverDeliveryDetailResult> fetchDeliveryDetail(String deliveryId) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('/api/driver/deliveries/$deliveryId'),
      DriverDeliveryDetailResult.fromJson,
    );
  }

  Future<DriverDeliveriesListResult> fetchActiveDeliveries() {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('/api/driver/deliveries/active'),
      _parseDeliveriesListResult,
    );
  }

  Future<DriverDeliveryInactiveContext> fetchInactiveContext(
    String deliveryId,
  ) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/driver/deliveries/$deliveryId/inactive-context',
      ),
      DriverDeliveryInactiveContext.fromJson,
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

  Future<DeliveryHandoverVerifyPreview> verifyDeliveryHandoverCredential(
    String handoverToken,
  ) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/driver/deliveries/handover/verify',
        data: {'handoverToken': handoverToken},
      ),
      DeliveryHandoverVerifyPreview.fromJson,
    );
  }

  Future<DriverDelivery> confirmDeliveryHandoverCredential(
    String handoverToken,
  ) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/driver/deliveries/handover/confirm',
        data: {'handoverToken': handoverToken},
      ),
      DriverDelivery.fromJson,
    );
  }

  Future<SupplierPickupHandoverVerifyPreview> verifySupplierPickupHandoverCredential(
    String handoverToken,
  ) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/driver/deliveries/pickup-handover/verify',
        data: {'handoverToken': handoverToken},
      ),
      SupplierPickupHandoverVerifyPreview.fromJson,
    );
  }

  Future<DriverDelivery> confirmSupplierPickupHandoverCredential(
    String handoverToken,
  ) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/driver/deliveries/pickup-handover/confirm',
        data: {'handoverToken': handoverToken},
      ),
      DriverDelivery.fromJson,
    );
  }
}

DriverDeliveriesListResult _parseDeliveriesListResult(
  Map<String, dynamic> json,
) {
  final deliveries = json['deliveries'];
  final list = deliveries is List
      ? deliveries
            .whereType<Map>()
            .map(
              (item) =>
                  DriverDelivery.fromJson(Map<String, dynamic>.from(item)),
            )
            .toList(growable: false)
      : const <DriverDelivery>[];

  return DriverDeliveriesListResult(
    deliveries: list,
    meta: DriverDeliveriesListMeta.fromJson(json),
  );
}
