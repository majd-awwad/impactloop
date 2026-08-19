import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../deliveries/data/models/learner_delivery.dart';
import '../../application/reservation_cancel_controller.dart';
import '../../data/models/learner_reservation.dart';
import 'reservation_detail_actions.dart';
import 'reservation_detail_semantic.dart';

class ReservationDetailQuickActions extends ConsumerWidget {
  const ReservationDetailQuickActions({
    super.key,
    required this.reservation,
    required this.delivery,
  });

  final LearnerReservation reservation;
  final LearnerDelivery? delivery;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final cancelState = ref.watch(reservationCancelControllerProvider);
    final cancellingId = ref.watch(cancellingReservationIdProvider);
    final isCancelling = cancellingId == reservation.id;

    final actions = <Widget>[
      if (resolveDeliveryActionButton(
            context: context,
            reservation: reservation,
            delivery: delivery,
            onNavigate: (deliveryId) {
              context.push('/learner/deliveries/$deliveryId');
            },
          )
          case final viewDelivery?)
        viewDelivery,
      if (reservation.canLearnerRequestDelivery)
        ReservationDetailActionButton(
          label: l10n.requestDelivery,
          onPressed: () =>
              showRequestDeliveryForReservation(context, ref, reservation),
          tone: AppStatusTone.primary,
        ),
      if (reservation.isPending)
        ReservationDetailActionButton(
          label: l10n.cancelRequest,
          onPressed: isCancelling || cancelState.isLoading
              ? null
              : () => confirmCancelReservation(context, ref, reservation),
          loading: isCancelling,
          tone: AppStatusTone.danger,
        ),
      if (reservation.canLearnerReschedule)
        LearnerRequestRescheduleButton(reservation: reservation),
      if (reservation.canLearnerReportSupplier)
        LearnerReportSupplierButton(reservation: reservation),
      if (reservation.canReportNoDriverAvailable)
        LearnerReportNoDriverButton(reservation: reservation),
    ];

    if (actions.isEmpty) {
      return const SizedBox.shrink();
    }

    return ReservationDetailSurfaceCard(
      semantic: ReservationDetailSemantic.neutral,
      title: l10n.reservationDetailQuickActionsTitle,
      titleIcon: Icons.touch_app_outlined,
      child: Wrap(
        spacing: AppSpacing.sm,
        runSpacing: AppSpacing.sm,
        children: actions,
      ),
    );
  }
}
