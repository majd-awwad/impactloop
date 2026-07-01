import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/learner_reservation.dart';
import '../data/reservations_repository.dart';

final myReservationsProvider =
    FutureProvider.autoDispose<List<LearnerReservation>>((ref) {
      return ref.watch(reservationsRepositoryProvider).fetchMyReservations();
    });
