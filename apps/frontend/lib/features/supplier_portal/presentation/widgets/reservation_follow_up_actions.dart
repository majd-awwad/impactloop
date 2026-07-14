import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../theme/supplier_theme_extension.dart';

class ReservationFollowUpActions extends StatelessWidget {
  const ReservationFollowUpActions({
    super.key,
    required this.pickupHandoverPhase,
    required this.canMarkCompleted,
    required this.canRequestReschedule,
    required this.canCloseReservation,
    required this.canReportToAdmin,
    required this.hasAdminReport,
    this.canAcceptLearnerReschedule = false,
    this.canProposeDifferentTime = false,
    this.canCloseAwaitingLearnerRequest = false,
    this.canReportAwaitingLearnerRequest = false,
    this.onMarkCompleted,
    this.onRequestReschedule,
    this.onCloseReservation,
    this.onReportToAdmin,
    this.onAcceptLearnerReschedule,
    this.onProposeDifferentTime,
    this.isBusy = false,
  });

  final String? pickupHandoverPhase;
  final bool canMarkCompleted;
  final bool canRequestReschedule;
  final bool canCloseReservation;
  final bool canReportToAdmin;
  final bool hasAdminReport;
  final bool canAcceptLearnerReschedule;
  final bool canProposeDifferentTime;
  final bool canCloseAwaitingLearnerRequest;
  final bool canReportAwaitingLearnerRequest;
  final VoidCallback? onMarkCompleted;
  final VoidCallback? onRequestReschedule;
  final VoidCallback? onCloseReservation;
  final VoidCallback? onReportToAdmin;
  final VoidCallback? onAcceptLearnerReschedule;
  final VoidCallback? onProposeDifferentTime;
  final bool isBusy;

  bool get _hasAnyAction =>
      (canAcceptLearnerReschedule && onAcceptLearnerReschedule != null) ||
      (canProposeDifferentTime && onProposeDifferentTime != null) ||
      (canCloseAwaitingLearnerRequest && onCloseReservation != null) ||
      (canReportAwaitingLearnerRequest && onReportToAdmin != null) ||
      (pickupHandoverPhase == 'BEFORE_ALLOWED' &&
          canRequestReschedule &&
          onRequestReschedule != null) ||
      (pickupHandoverPhase == 'DURING_ALLOWED' &&
          canMarkCompleted &&
          onMarkCompleted != null) ||
      (pickupHandoverPhase == 'AFTER_ALLOWED' &&
          ((canCloseReservation && onCloseReservation != null) ||
              (canReportToAdmin && onReportToAdmin != null) ||
              (canRequestReschedule && onRequestReschedule != null)));

  @override
  Widget build(BuildContext context) {
    if (!_hasAnyAction) {
      return const SizedBox.shrink();
    }

    final colors = context.supplierColors;
    final l = context.s;
    final showOverdueWarning = pickupHandoverPhase == 'AFTER_ALLOWED';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (showOverdueWarning) ...[
          Container(
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: colors.amberAccent.withValues(alpha: 0.12),
              borderRadius: AppRadius.mdAll,
              border: Border.all(color: colors.border.withValues(alpha: 0.28)),
            ),
            child: Text(
              l.pickupWindowPassedWarning,
              style: context.supplierBody().copyWith(
                color: colors.textPrimary,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            if (canAcceptLearnerReschedule && onAcceptLearnerReschedule != null)
              _ActionChip(
                label: 'Accept new time',
                onPressed: onAcceptLearnerReschedule,
                tone: AppStatusTone.success,
              ),
            if (canProposeDifferentTime && onProposeDifferentTime != null)
              _ActionChip(
                label: 'Propose different time',
                onPressed: onProposeDifferentTime,
                tone: AppStatusTone.warning,
              ),
            if (pickupHandoverPhase == 'DURING_ALLOWED' &&
                canMarkCompleted &&
                onMarkCompleted != null)
              _ActionChip(
                label: l.markCompleted,
                onPressed: isBusy ? null : onMarkCompleted,
                tone: AppStatusTone.success,
              ),
            if (pickupHandoverPhase != 'DURING_ALLOWED' &&
                canRequestReschedule &&
                onRequestReschedule != null)
              _ActionChip(
                label: 'Request reschedule',
                onPressed: onRequestReschedule,
                tone: AppStatusTone.warning,
              ),
            if ((pickupHandoverPhase == 'AFTER_ALLOWED' ||
                    canCloseAwaitingLearnerRequest) &&
                canCloseReservation &&
                onCloseReservation != null)
              _ActionChip(
                label: 'Close reservation',
                onPressed: onCloseReservation,
                tone: AppStatusTone.danger,
              ),
            if ((pickupHandoverPhase == 'AFTER_ALLOWED' ||
                    canReportAwaitingLearnerRequest) &&
                canReportToAdmin &&
                onReportToAdmin != null)
              _ActionChip(
                label: hasAdminReport
                    ? 'Reported to admin'
                    : 'Report to admin',
                onPressed: hasAdminReport ? null : onReportToAdmin,
                tone: AppStatusTone.danger,
              ),
          ],
        ),
      ],
    );
  }
}
class _ActionChip extends StatelessWidget {
  const _ActionChip({
    required this.label,
    required this.tone,
    this.onPressed,
  });

  final String label;
  final AppStatusTone tone;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        foregroundColor: AppStatusStyle.of(context, tone).foreground,
        side: BorderSide(color: AppStatusStyle.of(context, tone).border),
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.xs,
        ),
        minimumSize: const Size(0, 36),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
      ),
      child: Text(
        label,
        style: context.supplierLabel().copyWith(
          fontSize: 12.5,
          color: onPressed == null
              ? colors.textMuted
              : AppStatusStyle.of(context, tone).foreground,
        ),
      ),
    );
  }
}
