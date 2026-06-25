import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/deliveries_repository.dart';
import '../data/models/learner_delivery.dart';

final learnerDeliveriesProvider =
    FutureProvider.autoDispose<List<LearnerDelivery>>((ref) {
      return ref.watch(deliveriesRepositoryProvider).fetchMyDeliveries();
    });

final learnerDeliveryProvider =
    FutureProvider.autoDispose.family<LearnerDelivery, String>((
      ref,
      deliveryId,
    ) {
      return ref.watch(deliveriesRepositoryProvider).fetchDelivery(deliveryId);
    });
