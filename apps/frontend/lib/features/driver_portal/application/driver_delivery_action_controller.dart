import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/location/current_location_service.dart';
import '../data/driver_deliveries_repository.dart';
import '../data/models/driver_delivery_failure_request.dart';
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
    String? confirmationCode,
  }) async {
    state = const AsyncLoading();

    try {
      final delivery = await ref
          .read(driverDeliveriesRepositoryProvider)
          .updateDeliveryStatus(
            deliveryId,
            UpdateDriverDeliveryStatusRequest(
              status: status,
              note: note,
              confirmationCode: confirmationCode,
            ),
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

  Future<DriverDelivery> reportPickupFailed({
    required String deliveryId,
    required String reason,
    String? note,
  }) async {
    state = const AsyncLoading();

    try {
      final delivery = await ref
          .read(driverDeliveriesRepositoryProvider)
          .reportPickupFailed(
            deliveryId,
            DriverDeliveryFailureRequest(reason: reason, note: note),
          );
      ref.invalidate(activeDriverDeliveriesProvider);
      ref.invalidate(activeDriverDeliveryProvider(deliveryId));
      ref.invalidate(availableDriverDeliveriesProvider);
      state = const AsyncData(null);
      return delivery;
    } catch (error, stackTrace) {
      state = AsyncError(error, stackTrace);
      rethrow;
    }
  }

  Future<DriverDelivery> reportDeliveryFailed({
    required String deliveryId,
    required String reason,
    String? note,
  }) async {
    state = const AsyncLoading();

    try {
      final delivery = await ref
          .read(driverDeliveriesRepositoryProvider)
          .reportDeliveryFailed(
            deliveryId,
            DriverDeliveryFailureRequest(reason: reason, note: note),
          );
      ref.invalidate(activeDriverDeliveriesProvider);
      ref.invalidate(activeDriverDeliveryProvider(deliveryId));
      ref.invalidate(availableDriverDeliveriesProvider);
      state = const AsyncData(null);
      return delivery;
    } catch (error, stackTrace) {
      state = AsyncError(error, stackTrace);
      rethrow;
    }
  }

  Future<DriverDelivery> reportDriverIssue({
    required String deliveryId,
    required String note,
  }) async {
    state = const AsyncLoading();

    try {
      final delivery = await ref
          .read(driverDeliveriesRepositoryProvider)
          .reportDriverIssue(deliveryId, note: note);
      ref.invalidate(activeDriverDeliveriesProvider);
      ref.invalidate(activeDriverDeliveryProvider(deliveryId));
      ref.invalidate(availableDriverDeliveriesProvider);
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
    await ref
        .read(driverDeliveriesRepositoryProvider)
        .createLocationPing(deliveryId, request);
    // Do not invalidate delivery providers here — frequent pings were
    // remounting the detail page and disposing auto/demo tracking timers.
  }

  Future<void> captureAndSendLocationPing(String deliveryId) async {
    final capture = await ref
        .read(currentLocationServiceProvider)
        .captureCurrentLocation();

    await sendLocationPing(
      deliveryId: deliveryId,
      request: DriverLocationPingRequest(
        latitude: capture.latitude,
        longitude: capture.longitude,
        accuracyMeters: capture.accuracyMeters,
        heading: capture.heading,
        speed: capture.speed,
        capturedAt: capture.capturedAt,
      ),
    );
  }
}

final driverDeliveryActionControllerProvider =
    NotifierProvider<DriverDeliveryActionController, AsyncValue<void>>(
      DriverDeliveryActionController.new,
    );
