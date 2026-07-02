import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/deliveries_repository.dart';
import '../data/models/learner_delivery.dart';
import '../data/models/request_delivery_request.dart';

class DeliveryRequestController extends Notifier<AsyncValue<void>> {
  @override
  AsyncValue<void> build() => const AsyncData(null);

  Future<LearnerDelivery> requestDelivery({
    required String reservationId,
    required RequestDeliveryRequest request,
  }) async {
    state = const AsyncLoading();

    try {
      final delivery = await ref
          .read(deliveriesRepositoryProvider)
          .requestDelivery(reservationId, request);
      state = const AsyncData(null);
      return delivery;
    } catch (error, stackTrace) {
      state = AsyncError(error, stackTrace);
      rethrow;
    }
  }
}

final deliveryRequestControllerProvider =
    NotifierProvider<DeliveryRequestController, AsyncValue<void>>(
      DeliveryRequestController.new,
    );
