import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../deliveries/data/models/learner_delivery.dart';
import '../../data/models/learner_reservation.dart';
import '../learner_reservation_payment_presentation.dart';

class ReservationDetailStickyActionBar extends StatelessWidget {
  const ReservationDetailStickyActionBar({
    super.key,
    required this.reservation,
    required this.delivery,
    this.onCheckoutOrder,
    this.onScrollToPickupCode,
  });

  final LearnerReservation reservation;
  final LearnerDelivery? delivery;
  final ValueChanged<String>? onCheckoutOrder;
  final VoidCallback? onScrollToPickupCode;

  @override
  Widget build(BuildContext context) {
    final action = resolvePrimaryAction(reservation, delivery: delivery);
    if (!_isStickyAction(action)) {
      return const SizedBox.shrink();
    }

    final label = primaryActionLabel(action, l10n: context.l10n);
    final icon = primaryActionIcon(action);
    final summary = reservation.paymentSummary;

    VoidCallback? onPressed;
    if (action == LearnerReservationPrimaryAction.payNow ||
        action == LearnerReservationPrimaryAction.completePayment) {
      final orderId = summary?.checkoutableOrderId;
      if (orderId != null && onCheckoutOrder != null) {
        onPressed = () => onCheckoutOrder!(orderId);
      }
    } else if (action == LearnerReservationPrimaryAction.viewPickupCode) {
      onPressed = onScrollToPickupCode;
    } else if (action == LearnerReservationPrimaryAction.trackDelivery) {
      final deliveryId = delivery?.id ?? reservation.activeDelivery?.id;
      if (deliveryId != null) {
        onPressed = () {
          final canTrack = delivery?.canTrack == true;
          if (canTrack) {
            context.push('/learner/deliveries/$deliveryId/track');
          } else {
            context.push('/learner/deliveries/$deliveryId');
          }
        };
      }
    }

    if (onPressed == null) {
      return const SizedBox.shrink();
    }

    // Detail route is outside AppMobileNavigationShell — no bottom nav overlay.
    return Material(
      elevation: 8,
      color: Theme.of(context).colorScheme.surface,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(
            AppSpacing.md,
            AppSpacing.sm,
            AppSpacing.md,
            AppSpacing.sm,
          ),
          child: SizedBox(
            width: double.infinity,
            height: 48,
            child: FilledButton.icon(
              key: const Key('reservation-detail-sticky-action'),
              onPressed: onPressed,
              icon: Icon(icon, size: 18),
              label: Text(label),
              style: AppStatusButtonStyle.filled(
                context,
                AppStatusTone.primary,
              ),
            ),
          ),
        ),
      ),
    );
  }

  bool _isStickyAction(LearnerReservationPrimaryAction action) {
    return action == LearnerReservationPrimaryAction.payNow ||
        action == LearnerReservationPrimaryAction.completePayment ||
        action == LearnerReservationPrimaryAction.viewPickupCode ||
        action == LearnerReservationPrimaryAction.trackDelivery;
  }
}

bool shouldShowReservationDetailStickyBar(
  LearnerReservation reservation, {
  LearnerDelivery? delivery,
}) {
  final action = resolvePrimaryAction(reservation, delivery: delivery);
  return action == LearnerReservationPrimaryAction.payNow ||
      action == LearnerReservationPrimaryAction.completePayment ||
      action == LearnerReservationPrimaryAction.viewPickupCode ||
      action == LearnerReservationPrimaryAction.trackDelivery;
}
