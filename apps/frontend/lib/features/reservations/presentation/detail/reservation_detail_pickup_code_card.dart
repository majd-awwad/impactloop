import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/handover_confirmation_code_panel.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../data/models/learner_reservation.dart';
import 'reservation_detail_pickup_code_presentation.dart';
import 'reservation_detail_semantic.dart';

class ReservationDetailPickupCodeCard extends StatelessWidget {
  const ReservationDetailPickupCodeCard({
    super.key,
    required this.reservation,
    this.onPayNow,
  });

  final LearnerReservation reservation;
  final VoidCallback? onPayNow;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final palette = MaterialsUiPalette.of(context);
    final presentation = resolvePickupCodePresentation(reservation);

    if (presentation.state == ReservationDetailPickupCodeState.notApplicable) {
      return const SizedBox.shrink();
    }

    final summary = reservation.paymentSummary;
    final remaining = summary?.outstandingAmount;

    return ReservationDetailSurfaceCard(
      key: const Key('reservation-detail-pickup-code'),
      semantic: presentation.semantic,
      title: l10n.pickupCodeTitle,
      titleIcon: presentation.state == ReservationDetailPickupCodeState.available
          ? Icons.qr_code_2_rounded
          : Icons.lock_outline_rounded,
      child: switch (presentation.state) {
        ReservationDetailPickupCodeState.available => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                l10n.pickupCodeAvailableLabel,
                style: AppTextStyles.label(context).copyWith(
                  color: palette.textSecondary,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Semantics(
                label: l10n.pickupCodeTitle,
                child: HandoverConfirmationCodePanel(
                  code: presentation.code!,
                  instructions: l10n.supplierPickupCodeInstructions,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                l10n.pickupCodeSafetyNote,
                style: AppTextStyles.label(context).copyWith(
                  color: palette.textMuted,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ReservationDetailPickupCodeState.lockedByPayment => _LockedState(
            icon: Icons.lock_outline_rounded,
            message: l10n.pickupCodeLockedPayment,
            amountLine: remaining == null || remaining.isEmpty
                ? null
                : '${l10n.reservationDetailRemainingAmount}: ${l10n.reservationMoneyAmountWithCurrency(remaining)}',
            actionLabel: onPayNow == null ? null : l10n.payNow,
            onAction: onPayNow,
          ),
        ReservationDetailPickupCodeState.paymentUnavailable => _LockedState(
            icon: Icons.payments_outlined,
            message: l10n.paymentSummaryUnavailable,
          ),
        ReservationDetailPickupCodeState.waitingForWindow => _LockedState(
            icon: Icons.schedule_outlined,
            message: l10n.pickupCodeWaitingWindow,
          ),
        ReservationDetailPickupCodeState.paymentProcessing => _LockedState(
            icon: Icons.hourglass_top_rounded,
            message: l10n.pickupCodeProcessing,
          ),
        ReservationDetailPickupCodeState.underReview => _LockedState(
            icon: Icons.gavel_outlined,
            message: l10n.pickupCodeUnderReview,
          ),
        ReservationDetailPickupCodeState.refundProcessing => _LockedState(
            icon: Icons.replay_outlined,
            message: l10n.pickupCodeRefundProcessing,
          ),
        ReservationDetailPickupCodeState.refunded => _LockedState(
            icon: Icons.money_off_outlined,
            message: l10n.pickupCodeRefunded,
          ),
        ReservationDetailPickupCodeState.closed => _LockedState(
            icon: Icons.block_outlined,
            message: l10n.pickupCodeClosed,
          ),
        ReservationDetailPickupCodeState.notApplicable =>
          const SizedBox.shrink(),
      },
    );
  }
}

class _LockedState extends StatelessWidget {
  const _LockedState({
    required this.icon,
    required this.message,
    this.amountLine,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String message;
  final String? amountLine;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 22, color: palette.textMuted),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                message,
                style: AppTextStyles.label(context).copyWith(
                  color: palette.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
        if (amountLine != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            amountLine!,
            style: AppTextStyles.body(context).copyWith(
              color: palette.textPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
        if (actionLabel != null && onAction != null) ...[
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            height: 44,
            child: OutlinedButton(
              onPressed: onAction,
              child: Text(actionLabel!),
            ),
          ),
        ],
      ],
    );
  }
}
