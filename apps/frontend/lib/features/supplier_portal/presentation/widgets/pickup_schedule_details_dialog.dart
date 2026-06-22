import 'package:flutter/material.dart';

import '../../../../app/theme/app_color_tokens.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import 'package:frontend/features/supplier_portal/presentation/theme/supplier_theme_extension.dart';
import '../../data/models/supplier_pickup_schedule_item.dart';
import '../../data/pickup_schedule_grouping.dart';

class PickupScheduleDetailsDialog extends StatelessWidget {
  const PickupScheduleDetailsDialog({
    super.key,
    required this.item,
    required this.groupKind,
  });

  final SupplierPickupScheduleItem item;
  final PickupScheduleGroupKind groupKind;

  static Future<void> show(
    BuildContext context, {
    required SupplierPickupScheduleItem item,
    required PickupScheduleGroupKind groupKind,
  }) {
    return showDialog<void>(
      context: context,
      barrierColor: AppColorTokens.supplierDialogBarrier,
      builder: (context) => PickupScheduleDetailsDialog(
        item: item,
        groupKind: groupKind,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final compact = MediaQuery.sizeOf(context).width < 480;
    final screenSize = MediaQuery.sizeOf(context);
    final window = item.pickupWindow;
    final outerPadding = compact ? 18.0 : 24.0;
    final dialogWidth = compact ? screenSize.width - 32 : 560.0;

    return Dialog(
      backgroundColor: AppColorTokens.supplierDialogSurface,
      elevation: 16,
      shadowColor: AppColorTokens.supplierDialogShadow,
      insetPadding: EdgeInsets.symmetric(
        horizontal: compact ? AppSpacing.md : AppSpacing.lg,
        vertical: AppSpacing.lg,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.lgAll,
        side: BorderSide(color: colors.border.withValues(alpha: 0.32)),
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
                        context.s.pickupDetails,
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
                      color: colors.textMuted,
                      size: 22,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              const Divider(
                height: 1,
                thickness: 1,
                color: AppColorTokens.supplierDividerStrong,
              ),
              const SizedBox(height: AppSpacing.md),
              Flexible(
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _DetailRow(label: context.s.materialName, value: item.materialTitle),
                      _DetailRow(label: context.s.learnerLabel, value: item.learnerName),
                      _DetailRow(label: context.s.quantity, value: item.quantityLabel),
                      _DetailRow(
                        label: context.s.pickupTypeLabel,
                        value: item.pickupType,
                      ),
                      _DetailRow(label: context.s.statusLabel, value: item.status.label),
                      if (window != null) ...[
                        const _SectionDivider(),
                        _DetailRow(
                          label: context.s.dateLabel,
                          value: formatScheduleDateLabel(window.start),
                        ),
                        _DetailRow(
                          label: context.s.timeLabel,
                          value: formatPickupTimeRange(window),
                        ),
                      ],
                      if (item.isCompleted && item.completedAt != null) ...[
                        if (window == null) const _SectionDivider(),
                        _DetailRow(
                          label: context.s.filterCompleted,
                          value: formatScheduleDateLabel(item.completedAt!),
                        ),
                      ],
                      if (item.supplierNote?.trim().isNotEmpty == true) ...[
                        const _SectionDivider(),
                        _DetailRow(
                          label: context.s.pickupNotes,
                          value: item.supplierNote!.trim(),
                        ),
                      ],
                      if (item.learnerMessage?.trim().isNotEmpty == true) ...[
                        const _SectionDivider(),
                        _DetailRow(
                          label: context.s.learnerMessageLabel,
                          value: item.learnerMessage!.trim(),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              const Divider(
                height: 1,
                thickness: 1,
                color: AppColorTokens.supplierDividerStrong,
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
                      backgroundColor: colors.chipUnselected
                          .withValues(alpha: 0.55),
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.lg,
                        vertical: AppSpacing.sm + 2,
                      ),
                      minimumSize: Size(compact ? double.infinity : 96, 44),
                      shape: RoundedRectangleBorder(
                        borderRadius: AppRadius.mdAll,
                        side: BorderSide(
                          color: colors.border.withValues(alpha: 0.35),
                        ),
                      ),
                    ),
                    child: Text(context.s.close),
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

class _SectionDivider extends StatelessWidget {
  const _SectionDivider();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Divider(
        height: 1,
        thickness: 1,
        color: AppColorTokens.supplierDividerSubtle,
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

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
              color: colors.textPrimary,
              fontSize: 15,
              fontWeight: FontWeight.w500,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }
}
