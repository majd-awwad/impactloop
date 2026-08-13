import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import 'driver_deliveries_api.dart';
import 'models/driver_delivery_inactive_context.dart';
import 'models/driver_delivery_failure_request.dart';
import 'models/driver_deliveries_list_result.dart';
import 'models/driver_delivery.dart';
import 'models/driver_delivery_detail_result.dart';
import 'models/driver_location_ping_request.dart';
import 'models/update_driver_delivery_status_request.dart';
import 'models/driver_archive.dart';
import 'models/delivery_handover_verify_preview.dart';
import 'models/supplier_pickup_handover_verify_preview.dart';

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

  Future<DriverArchivePage<DriverHistoricalDelivery>> fetchHistory({
    String? cursor,
    int limit = 20,
  }) => _api.fetchHistory(cursor: cursor, limit: limit);

  Future<DriverHistoricalDelivery> fetchHistoricalDelivery(String deliveryId) =>
      _api.fetchHistoricalDelivery(deliveryId);

  Future<DriverArchivePage<DriverIncident>> fetchIncidents({
    String? cursor,
    int limit = 20,
  }) => _api.fetchIncidents(cursor: cursor, limit: limit);

  Future<DriverDeliveriesListResult> fetchAvailableDeliveries({
    DriverAvailableJobsFilter? filter,
    String? cursor,
    int limit = 20,
  }) {
    return _api.fetchAvailableDeliveries(
      filter: filter,
      cursor: cursor,
      limit: limit,
    );
  }

  Future<DriverDeliveryDetailResult> fetchDeliveryDetail(String deliveryId) {
    return _api.fetchDeliveryDetail(deliveryId);
  }

  Future<DriverDeliveriesListResult> fetchActiveDeliveries() {
    return _api.fetchActiveDeliveries();
  }

  Future<DriverDeliveryInactiveContext> fetchInactiveContext(
    String deliveryId,
  ) {
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

  Future<DeliveryHandoverVerifyPreview> verifyDeliveryHandoverCredential(
    String handoverToken,
  ) {
    return _api.verifyDeliveryHandoverCredential(handoverToken);
  }

  Future<DriverDelivery> confirmDeliveryHandoverCredential(
    String handoverToken, {
    bool cashReceivedConfirmed = false,
  }) {
    return _api.confirmDeliveryHandoverCredential(
      handoverToken,
      cashReceivedConfirmed: cashReceivedConfirmed,
    );
  }

  Future<SupplierPickupHandoverVerifyPreview>
  verifySupplierPickupHandoverCredential(String handoverToken) {
    return _api.verifySupplierPickupHandoverCredential(handoverToken);
  }

  Future<DriverDelivery> confirmSupplierPickupHandoverCredential(
    String handoverToken,
  ) {
    return _api.confirmSupplierPickupHandoverCredential(handoverToken);
  }
}
