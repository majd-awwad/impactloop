import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import 'driver_deliveries_api.dart';
import 'models/driver_delivery_inactive_context.dart';
import 'models/driver_delivery_failure_request.dart';
import 'models/driver_deliveries_list_result.dart';
import 'models/driver_delivery.dart';
import 'models/driver_location_ping_request.dart';
import 'models/update_driver_delivery_status_request.dart';

final driverDeliveriesApiProvider = Provider<DriverDeliveriesApi>((ref) {
  return DriverDeliveriesApi(ref.read(apiClientProvider));
});

final driverDeliveriesRepositoryProvider = Provider<DriverDeliveriesRepository>(
  (ref) {
    return DriverDeliveriesRepository(ref.read(driverDeliveriesApiProvider));
  },
);

class DriverDeliveriesRepository {
  const DriverDeliveriesRepository(this._api);

  final DriverDeliveriesApi _api;

  Future<DriverDeliveriesListResult> fetchAvailableDeliveries({
    DriverAvailableJobsFilter? filter,
  }) {
    return _api.fetchAvailableDeliveries(filter: filter);
  }

  Future<DriverDeliveriesListResult> fetchActiveDeliveries() {
    return _api.fetchActiveDeliveries();
  }

  Future<DriverDeliveryInactiveContext> fetchInactiveContext(String deliveryId) {
    return _api.fetchInactiveContext(deliveryId);
  }

  Future<DriverDelivery> acceptDelivery(String deliveryId) {
    return _api.acceptDelivery(deliveryId);
  }

  Future<DriverDelivery> updateDeliveryStatus(
    String deliveryId,
    UpdateDriverDeliveryStatusRequest request,
  ) {
    return _api.updateDeliveryStatus(deliveryId, request);
  }

  Future<void> createLocationPing(
    String deliveryId,
    DriverLocationPingRequest request,
  ) {
    return _api.createLocationPing(deliveryId, request);
  }

  Future<DriverDelivery> reportPickupFailed(
    String deliveryId,
    DriverDeliveryFailureRequest request,
  ) {
    return _api.reportPickupFailed(deliveryId, request);
  }

  Future<DriverDelivery> reportDeliveryFailed(
    String deliveryId,
    DriverDeliveryFailureRequest request,
  ) {
    return _api.reportDeliveryFailed(deliveryId, request);
  }

  Future<DriverDelivery> reportDriverIssue(
    String deliveryId, {
    required String note,
  }) {
    return _api.reportDriverIssue(deliveryId, note: note);
  }
}
