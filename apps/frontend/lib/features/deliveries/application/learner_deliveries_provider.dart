import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/deliveries_repository.dart';
import '../data/models/learner_delivery.dart';

const _learnerDeliveryTrackingPollInterval = Duration(seconds: 20);
const _learnerDeliveriesCacheDuration = Duration(minutes: 2);

final learnerDeliveriesProvider =
    FutureProvider.autoDispose<List<LearnerDelivery>>((ref) {
      final keepAlive = ref.keepAlive();
      Timer? cacheTimer;

      ref.onCancel(() {
        cacheTimer = Timer(_learnerDeliveriesCacheDuration, keepAlive.close);
      });
      ref.onResume(() {
        cacheTimer?.cancel();
        cacheTimer = null;
      });
      ref.onDispose(() {
        cacheTimer?.cancel();
      });

      return ref.watch(deliveriesRepositoryProvider).fetchMyDeliveries();
    });

final learnerDeliveryProvider = FutureProvider.autoDispose
    .family<LearnerDelivery, String>((ref, deliveryId) async {
      final delivery = await ref
          .watch(deliveriesRepositoryProvider)
          .fetchDelivery(deliveryId);

      if (delivery.canTrack) {
        final timer = Timer(_learnerDeliveryTrackingPollInterval, () {
          ref.invalidateSelf();
        });
        ref.onDispose(timer.cancel);
      }

      return delivery;
    });
