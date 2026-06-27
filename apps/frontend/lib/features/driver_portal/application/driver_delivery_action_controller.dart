import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/driver_deliveries_repository.dart';
import '../data/models/driver_delivery.dart';
import '../data/models/driver_location_ping_request.dart';
import '../data/models/update_driver_delivery_status_request.dart';
import 'driver_deliveries_provider.dart';

class DriverDeliveryActionController extends Notifier<AsyncValue<void>> {
  @override
  AsyncValue<void> build() {
    return const AsyncData(null);
  }

  Future<DriverDelivery> acceptDelivery(String deliveryId) async {
    state = const AsyncLoading();

    try {
      final delivery = await ref
          .read(driverDeliveriesRepositoryProvider)
          .acceptDelivery(deliveryId);
      ref.invalidate(availableDriverDeliveriesProvider);
      ref.invalidate(activeDriverDeliveriesProvider);
      ref.invalidate(activeDriverDeliveryProvider(delivery.id));
      state = const AsyncData(null);
      return delivery;
    } catch (error, stackTrace) {
      state = AsyncError(error, stackTrace);
      rethrow;
    }
  }

  Future<DriverDelivery> updateStatus({
    required String deliveryId,
    required String status,
    String? note,
  }) async {
    state = const AsyncLoading();

    try {
      final delivery = await ref
          .read(driverDeliveriesRepositoryProvider)
          .updateDeliveryStatus(
            deliveryId,
            UpdateDriverDeliveryStatusRequest(status: status, note: note),
          );
      ref.invalidate(activeDriverDeliveriesProvider);
      ref.invalidate(activeDriverDeliveryProvider(delivery.id));
      if (status == 'DELIVERED') {
        ref.invalidate(availableDriverDeliveriesProvider);
      }
      state = const AsyncData(null);
      return delivery;
    } catch (error, stackTrace) {
      state = AsyncError(error, stackTrace);
      rethrow;
    }
  }

  Future<void> sendLocationPing({
    required String deliveryId,
    required DriverLocationPingRequest request,
  }) async {
    state = const AsyncLoading();

    try {
      await ref
          .read(driverDeliveriesRepositoryProvider)
          .createLocationPing(deliveryId, request);
      ref.invalidate(activeDriverDeliveriesProvider);
      ref.invalidate(activeDriverDeliveryProvider(deliveryId));
      state = const AsyncData(null);
    } catch (error, stackTrace) {
      state = AsyncError(error, stackTrace);
      rethrow;
    }
  }
}

final driverDeliveryActionControllerProvider =
    NotifierProvider<DriverDeliveryActionController, AsyncValue<void>>(
      DriverDeliveryActionController.new,
    );
