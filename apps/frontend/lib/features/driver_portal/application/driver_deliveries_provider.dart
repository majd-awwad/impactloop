import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/driver_deliveries_repository.dart';
import '../data/models/driver_delivery.dart';

final availableDriverDeliveriesProvider =
    FutureProvider.autoDispose<List<DriverDelivery>>((ref) {
      return ref
          .watch(driverDeliveriesRepositoryProvider)
          .fetchAvailableDeliveries();
    });

final activeDriverDeliveriesProvider =
    FutureProvider.autoDispose<List<DriverDelivery>>((ref) {
      return ref.watch(driverDeliveriesRepositoryProvider).fetchActiveDeliveries();
    });

final activeDriverDeliveryProvider =
    FutureProvider.autoDispose.family<DriverDelivery?, String>((
      ref,
      deliveryId,
    ) async {
      final deliveries = await ref.watch(activeDriverDeliveriesProvider.future);

      for (final delivery in deliveries) {
        if (delivery.id == deliveryId) {
          return delivery;
        }
      }

      return null;
    });
