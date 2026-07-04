import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import 'package:frontend/features/supplier_portal/presentation/theme/supplier_theme_extension.dart';
import '../../../auth/application/auth_controller.dart';
import '../../data/models/supplier_pickup_schedule_item.dart';
import '../../data/pickup_schedule_grouping.dart';
import 'reservation_follow_up_actions.dart';
import 'reservation_messages_panel.dart';

class PickupScheduleDetailsDialog extends ConsumerWidget {
  const PickupScheduleDetailsDialog({
    super.key,
    required this.item,
    required this.groupKind,
    this.onMarkCompleted,
    this.onReschedule,
    this.onCloseReservation,
    this.onReportToAdmin,
    this.isCompleting = false,
  });

  final SupplierPickupScheduleItem item;
  final PickupScheduleGroupKind groupKind;
  final VoidCallback? onMarkCompleted;
  final VoidCallback? onReschedule;
  final VoidCallback? onCloseReservation;
  final VoidCallback? onReportToAdmin;
  final bool isCompleting;

  static Future<void> show(
    BuildContext context, {
    required SupplierPickupScheduleItem item,
    required PickupScheduleGroupKind groupKind,
    VoidCallback? onMarkCompleted,
    VoidCallback? onReschedule,
    VoidCallback? onCloseReservation,
    VoidCallback? onReportToAdmin,
    bool isCompleting = false,
  }) {
    return showDialog<void>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.58),
      builder: (context) => PickupScheduleDetailsDialog(
        item: item,
        groupKind: groupKind,
        onMarkCompleted: onMarkCompleted,
        onReschedule: onReschedule,
        onCloseReservation: onCloseReservation,
        onReportToAdmin: onReportToAdmin,
        isCompleting: isCompleting,
      ),
    );
  }

  String? _pickupInstructions() {
    final supplierNote = item.supplierNote?.trim();
    if (supplierNote != null && supplierNote.isNotEmpty) {
      return supplierNote;
    }

    final windowNote = item.pickupWindow?.note?.trim();
    if (windowNote != null && windowNote.isNotEmpty) {
      return windowNote;
    }

    return null;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.supplierColors;
    final l = context.s;
    final compact = MediaQuery.sizeOf(context).width < 480;
    final screenSize = MediaQuery.sizeOf(context);
    final window = item.pickupWindow;
    final outerPadding = compact ? 18.0 : 24.0;
    final dialogWidth = compact ? screenSize.width - 32 : 560.0;
    final instructions = _pickupInstructions();
    final showFollowUp =
        !item.isCompleted &&
        item.status == SupplierPickupScheduleStatus.accepted &&
        item.pickupHandoverPhase != null;
    final currentUserId = ref.watch(authControllerProvider).user?.id ?? '';

    return Dialog(
      backgroundColor: colors.surfaceSolid,
      elevation: 16,
      shadowColor: colors.cardShadow,
      insetPadding: EdgeInsets.symmetric(
        horizontal: compact ? AppSpacing.md : AppSpacing.lg,
        vertical: AppSpacing.lg,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.lgAll,
        side: BorderSide(color: colors.border.withValues(alpha: 0.45)),
      ),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: dialogWidth,
          maxHeight: screenSize.height * 0.85,
        ),
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            outerPadding,
            outerPadding,
            outerPadding,
            compact ? AppSpacing.md : AppSpacing.lg,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        l.pickupDetails,
                        style: context.supplierTitle().copyWith(
                          fontSize: compact ? 18 : 20,
                          fontWeight: FontWeight.w700,
                          color: colors.textPrimary,
                        ),
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(
                      minWidth: 40,
                      minHeight: 40,
                    ),
                    icon: Icon(
                      Icons.close_rounded,
                      color: colors.textSecondary,
                      size: 22,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              Divider(
                height: 1,
                thickness: 1,
                color: colors.border.withValues(alpha: 0.35),
              ),
              const SizedBox(height: AppSpacing.md),
              Flexible(
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _SectionTitle(title: l.materialRequestSectionTitle),
                      _DetailRow(
                        label: l.materialLabel,
                        value: item.materialTitle,
                      ),
                      _DetailRow(
                        label: l.learnerLabel,
                        value: item.learnerName,
                      ),
                      _DetailRow(
                        label: l.quantity,
                        value: item.quantityLabel,
                      ),
                      _DetailRow(
                        label: l.pickupTypeLabel,
                        value: item.pickupType,
                      ),
                      _DetailRow(
                        label: l.statusLabel,
                        value: item.isOverdue
                            ? l.overdueBadge
                            : l.pickupScheduleStatusLabel(item.status),
                      ),
                      if (window != null) ...[
                        const _SectionDivider(),
                        _SectionTitle(title: l.pickupWindowSectionTitle),
                        _DetailRow(
                          label: l.dateLabel,
                          value: formatScheduleDateLabel(window.start),
                        ),
                        _DetailRow(
                          label: l.timeLabel,
                          value: l.pickupWindowRangeLabel(
                            formatPickupTimeRange(window),
                          ),
                        ),
                        _DetailRow(
                          label: l.pickupInstructionsLabel,
                          value: instructions ?? l.noPickupInstructions,
                          emphasizeValue: instructions != null,
                        ),
                      ] else if (item.isCompleted && item.completedAt != null) ...[
                        const _SectionDivider(),
                        _SectionTitle(title: l.pickupWindowSectionTitle),
                        _DetailRow(
                          label: l.completedLabel,
                          value: formatScheduleDateLabel(item.completedAt!),
                        ),
                      ],
                      if (item.learnerMessage?.trim().isNotEmpty == true) ...[
                        const _SectionDivider(),
                        _DetailRow(
                          label: l.learnerMessageLabel,
                          value: item.learnerMessage!.trim(),
                        ),
                      ],
                      if (showFollowUp) ...[
                        const _SectionDivider(),
                        ReservationFollowUpActions(
                          pickupHandoverPhase: item.pickupHandoverPhase,
                          canMarkCompleted: item.canSupplierComplete,
                          canRequestReschedule: item.canSupplierReschedule,
                          canCloseReservation: item.canSupplierCloseOverduePickup,
                          canReportToAdmin:
                              item.canSupplierReportAndCloseOverduePickup,
                          hasAdminReport: item.noShowReport != null,
                          isBusy: isCompleting,
                          onMarkCompleted: onMarkCompleted == null
                              ? null
                              : () {
                                  Navigator.of(context).pop();
                                  onMarkCompleted?.call();
                                },
                          onRequestReschedule: onReschedule == null
                              ? null
                              : () {
                                  Navigator.of(context).pop();
                                  onReschedule?.call();
                                },
                          onCloseReservation: onCloseReservation == null
                              ? null
                              : () {
                                  Navigator.of(context).pop();
                                  onCloseReservation?.call();
                                },
                          onReportToAdmin: onReportToAdmin == null
                              ? null
                              : () {
                                  Navigator.of(context).pop();
                                  onReportToAdmin?.call();
                                },
                        ),
                      ],
                      if (currentUserId.isNotEmpty &&
                          (item.canSendMessage ||
                              item.latestMessage != null)) ...[
                        const _SectionDivider(),
                        ReservationMessagesPanel(
                          reservationId: item.id,
                          canSendMessage: item.canSendMessage,
                          currentUserId: currentUserId,
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Divider(
                height: 1,
                thickness: 1,
                color: colors.border.withValues(alpha: 0.35),
              ),
              const SizedBox(height: AppSpacing.md),
              Align(
                alignment:
                    compact ? Alignment.center : Alignment.centerRight,
                child: SizedBox(
                  width: compact ? double.infinity : null,
                  child: TextButton(
                    onPressed: () => Navigator.of(context).pop(),
                    style: TextButton.styleFrom(
                      foregroundColor: colors.textPrimary,
                      backgroundColor: colors.chipUnselected.withValues(
                        alpha: colors.isDark ? 0.35 : 0.55,
                      ),
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.lg,
                        vertical: AppSpacing.sm + 2,
                      ),
                      minimumSize: Size(compact ? double.infinity : 96, 44),
                      shape: RoundedRectangleBorder(
                        borderRadius: AppRadius.mdAll,
                        side: BorderSide(
                          color: colors.border.withValues(alpha: 0.45),
                        ),
                      ),
                    ),
                    child: Text(l.close),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Text(
        title,
        style: context.supplierLabel().copyWith(
          color: colors.textSecondary,
          fontSize: 12.5,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.35,
        ),
      ),
    );
  }
}

class _SectionDivider extends StatelessWidget {
  const _SectionDivider();

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Divider(
        height: 1,
        thickness: 1,
        color: colors.border.withValues(alpha: 0.22),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.label,
    required this.value,
    this.emphasizeValue = true,
  });

  final String label;
  final String value;
  final bool emphasizeValue;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: context.supplierLabel().copyWith(
              color: colors.textMuted,
              fontSize: 12,
              fontWeight: FontWeight.w500,
              letterSpacing: 0.2,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: context.supplierBody().copyWith(
              color: emphasizeValue
                  ? colors.textPrimary
                  : colors.textSecondary,
              fontSize: 15,
              fontWeight: emphasizeValue ? FontWeight.w600 : FontWeight.w500,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }
}
