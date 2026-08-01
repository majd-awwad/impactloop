import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/learner_reservation.dart';
import '../data/reservations_repository.dart';

const _myReservationsCacheDuration = Duration(minutes: 2);

final myReservationsProvider =
    FutureProvider.autoDispose<List<LearnerReservation>>((ref) {
      final keepAlive = ref.keepAlive();
      Timer? cacheTimer;

      ref.onCancel(() {
        cacheTimer = Timer(_myReservationsCacheDuration, keepAlive.close);
      });
      ref.onResume(() {
        cacheTimer?.cancel();
        cacheTimer = null;
      });
      ref.onDispose(() {
        cacheTimer?.cancel();
      });

      return ref.watch(reservationsRepositoryProvider).fetchMyReservations();
    });
