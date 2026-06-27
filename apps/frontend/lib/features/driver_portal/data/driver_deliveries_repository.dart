import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import 'driver_deliveries_api.dart';
import 'models/driver_delivery.dart';
import 'models/driver_location_ping_request.dart';
import 'models/update_driver_delivery_status_request.dart';

final driverDeliveriesApiProvider = Provider<DriverDeliveriesApi>((ref) {
  return DriverDeliveriesApi(ref.watch(apiClientProvider));
});

final driverDeliveriesRepositoryProvider =
    Provider<DriverDeliveriesRepository>((ref) {
      return DriverDeliveriesRepository(ref.watch(driverDeliveriesApiProvider));
    });

class DriverDeliveriesRepository {
  const DriverDeliveriesRepository(this._api);

  final DriverDeliveriesApi _api;

  Future<List<DriverDelivery>> fetchAvailableDeliveries() {
    return _api.fetchAvailableDeliveries();
  }

  Future<List<DriverDelivery>> fetchActiveDeliveries() {
    return _api.fetchActiveDeliveries();
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
}
