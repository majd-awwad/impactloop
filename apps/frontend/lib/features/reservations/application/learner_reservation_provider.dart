import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/learner_reservation.dart';
import '../data/reservations_repository.dart';

final learnerReservationProvider = FutureProvider.autoDispose
    .family<LearnerReservation, String>((ref, id) {
      return ref.watch(reservationsRepositoryProvider).fetchReservation(id);
    });
