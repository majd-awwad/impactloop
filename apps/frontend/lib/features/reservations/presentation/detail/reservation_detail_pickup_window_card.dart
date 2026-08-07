import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/format/localized_formatters.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../data/models/learner_reservation.dart';
import 'reservation_detail_semantic.dart';

enum ReservationPickupWindowPhase {
  notStarted,
  active,
  ended,
  unavailable,
}

ReservationPickupWindowPhase resolvePickupWindowPhase(
  LearnerReservation reservation,
) {
  final phase = reservation.pickupHandoverPhase?.toUpperCase();
  if (phase == 'BEFORE_ALLOWED') {
    return ReservationPickupWindowPhase.notStarted;
  }
  if (phase == 'DURING_ALLOWED') {
    return ReservationPickupWindowPhase.active;
  }
  if (phase == 'AFTER_ALLOWED') {
    return ReservationPickupWindowPhase.ended;
  }

  if (!reservation.isAccepted || reservation.pickupWindowStart == null) {
    return ReservationPickupWindowPhase.unavailable;
  }

  final now = DateTime.now();
  final start = reservation.pickupWindowStart!;
  final end = reservation.pickupWindowEnd ?? start;

  if (now.isBefore(start)) return ReservationPickupWindowPhase.notStarted;
  if (now.isAfter(end)) return ReservationPickupWindowPhase.ended;
  return ReservationPickupWindowPhase.active;
}

class ReservationDetailPickupWindowCard extends StatelessWidget {
  const ReservationDetailPickupWindowCard({
    super.key,
    required this.reservation,
  });

  final LearnerReservation reservation;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final palette = MaterialsUiPalette.of(context);

    if (!reservation.isPickupFulfillment ||
        !reservation.isAccepted ||
        reservation.pickupWindowStart == null) {
      return const SizedBox.shrink();
    }

    final phase = resolvePickupWindowPhase(reservation);
    final start = reservation.pickupWindowStart!;
    final end = reservation.pickupWindowEnd;
    final formatted = end == null
        ? LocalizedFormatters(l10n).dateTime(start)
        : LocalizedFormatters(l10n).dateTimeRange(start, end);

    final (label, tone, semantic) = switch (phase) {
      ReservationPickupWindowPhase.notStarted => (
          l10n.pickupWindowNotStarted,
          AppStatusTone.warning,
          ReservationDetailSemantic.waiting,
        ),
      ReservationPickupWindowPhase.active => (
          l10n.pickupWindowActiveNow,
          AppStatusTone.success,
          ReservationDetailSemantic.pickup,
        ),
      ReservationPickupWindowPhase.ended => (
          l10n.pickupWindowEnded,
          AppStatusTone.neutral,
          ReservationDetailSemantic.neutral,
        ),
      ReservationPickupWindowPhase.unavailable => (
          l10n.pickupWindow,
          AppStatusTone.neutral,
          ReservationDetailSemantic.neutral,
        ),
    };

    return ReservationDetailSurfaceCard(
      semantic: semantic,
      title: l10n.pickupWindow,
      titleIcon: Icons.schedule_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppStatusBadge(label: label, tone: tone),
          const SizedBox(height: AppSpacing.sm),
          Text(
            formatted,
            style: AppTextStyles.body(context).copyWith(
              color: palette.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
