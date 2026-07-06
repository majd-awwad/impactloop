import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../deliveries/application/learner_deliveries_provider.dart';
import 'learner_reservation_provider.dart';
import 'my_reservations_provider.dart';

void invalidateLearnerReservationCaches(
  WidgetRef ref, {
  String? reservationId,
}) {
  ref.invalidate(myReservationsProvider);
  ref.invalidate(learnerDeliveriesProvider);
  if (reservationId != null) {
    ref.invalidate(learnerReservationProvider(reservationId));
  }
}
