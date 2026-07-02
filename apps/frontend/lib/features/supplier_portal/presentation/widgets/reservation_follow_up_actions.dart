import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../theme/supplier_theme_extension.dart';

class ReservationFollowUpActions extends StatelessWidget {
  const ReservationFollowUpActions({
    super.key,
    required this.isOverdue,
    required this.canMarkCompleted,
    required this.canReschedule,
    required this.canCancel,
    required this.canReportNoShow,
    required this.hasNoShowReport,
    this.onMarkCompleted,
    this.onReschedule,
    this.onCancel,
    this.onReportNoShow,
    this.isBusy = false,
    this.compact = false,
  });

  final bool isOverdue;
  final bool canMarkCompleted;
  final bool canReschedule;
  final bool canCancel;
  final bool canReportNoShow;
  final bool hasNoShowReport;
  final VoidCallback? onMarkCompleted;
  final VoidCallback? onReschedule;
  final VoidCallback? onCancel;
  final VoidCallback? onReportNoShow;
  final bool isBusy;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    if (!isOverdue) {
      return const SizedBox.shrink();
    }

    final colors = context.supplierColors;
    final l = context.s;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
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
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            if (canMarkCompleted && onMarkCompleted != null)
              _ActionChip(
                label: l.markCompleted,
                onPressed: isBusy ? null : onMarkCompleted,
              ),
            if (canReschedule && onReschedule != null)
              _ActionChip(label: l.reschedulePickupAction, onPressed: onReschedule),
            if (canCancel && onCancel != null)
              _ActionChip(label: l.cancelReservationAction, onPressed: onCancel),
            if (canReportNoShow && onReportNoShow != null)
              _ActionChip(
                label: hasNoShowReport
                    ? l.noShowReportSubmitted
                    : l.reportNoShowAction,
                onPressed: hasNoShowReport ? null : onReportNoShow,
              ),
          ],
        ),
      ],
    );
  }
}

class _ActionChip extends StatelessWidget {
  const _ActionChip({required this.label, this.onPressed});

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        foregroundColor: colors.textPrimary,
        side: BorderSide(color: colors.border.withValues(alpha: 0.45)),
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
        style: context.supplierLabel().copyWith(fontSize: 12.5),
      ),
    );
  }
}
