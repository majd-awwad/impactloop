import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../deliveries/data/models/learner_delivery.dart';
import '../../data/models/learner_reservation.dart';
import 'learner_reservation_list_card.dart';

/// Compatibility alias — list surfaces must use [LearnerReservationListCard].
/// Reservation Details must not use this widget.
@Deprecated('Use LearnerReservationListCard for the reservations list')
class LearnerReservationCard extends ConsumerWidget {
  const LearnerReservationCard({
    super.key,
    required this.reservation,
    required this.delivery,
  });

  final LearnerReservation reservation;
  final LearnerDelivery? delivery;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return LearnerReservationListCard(
      reservation: reservation,
      delivery: delivery,
    );
  }
}
