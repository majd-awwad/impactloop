import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../data/models/supplier_pickup_schedule_item.dart';
import '../../data/pickup_schedule_grouping.dart';

const _dialogSurface = Color(0xFF071A16);

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
      barrierColor: Colors.black.withValues(alpha: 0.58),
      builder: (context) =>
          PickupScheduleDetailsDialog(item: item, groupKind: groupKind),
    );
  }

  @override
  Widget build(BuildContext context) {
    final compact = MediaQuery.sizeOf(context).width < 480;
    final screenSize = MediaQuery.sizeOf(context);
    final window = item.pickupWindow;
    final outerPadding = compact ? 18.0 : 24.0;
    final dialogWidth = compact ? screenSize.width - 32 : 560.0;

    return Dialog(
      backgroundColor: _dialogSurface,
      elevation: 16,
      shadowColor: Colors.black.withValues(alpha: 0.5),
      insetPadding: EdgeInsets.symmetric(
        horizontal: compact ? AppSpacing.md : AppSpacing.lg,
        vertical: AppSpacing.lg,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.lgAll,
        side: BorderSide(color: AuthDarkColors.border.withValues(alpha: 0.32)),
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
                        'Pickup details',
                        style: AuthDarkTextStyles.title(context).copyWith(
                          fontSize: compact ? 18 : 20,
                          fontWeight: FontWeight.w700,
                          color: AuthDarkColors.textPrimary,
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
                    icon: const Icon(
                      Icons.close_rounded,
                      color: AuthDarkColors.textMuted,
                      size: 22,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              const Divider(height: 1, thickness: 1, color: Color(0x332DD4BF)),
              const SizedBox(height: AppSpacing.md),
              Flexible(
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _DetailRow(label: 'Material', value: item.materialTitle),
                      _DetailRow(label: 'Learner', value: item.learnerName),
                      _DetailRow(label: 'Quantity', value: item.quantityLabel),
                      _DetailRow(label: 'Pickup type', value: item.pickupType),
                      _DetailRow(label: 'Status', value: item.status.label),
                      if (window != null) ...[
                        const _SectionDivider(),
                        _DetailRow(
                          label: 'Date',
                          value: formatScheduleDateLabel(window.start),
                        ),
                        _DetailRow(
                          label: 'Time',
                          value: formatPickupTimeRange(window),
                        ),
                      ],
                      if (item.isCompleted && item.completedAt != null) ...[
                        if (window == null) const _SectionDivider(),
                        _DetailRow(
                          label: 'Completed',
                          value: formatScheduleDateLabel(item.completedAt!),
                        ),
                      ],
                      if (item.supplierNote?.trim().isNotEmpty == true) ...[
                        const _SectionDivider(),
                        _DetailRow(
                          label: 'Supplier note',
                          value: item.supplierNote!.trim(),
                        ),
                      ],
                      if (item.learnerMessage?.trim().isNotEmpty == true) ...[
                        const _SectionDivider(),
                        _DetailRow(
                          label: 'Learner message',
                          value: item.learnerMessage!.trim(),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              const Divider(height: 1, thickness: 1, color: Color(0x332DD4BF)),
              const SizedBox(height: AppSpacing.md),
              Align(
                alignment: compact ? Alignment.center : Alignment.centerRight,
                child: SizedBox(
                  width: compact ? double.infinity : null,
                  child: TextButton(
                    onPressed: () => Navigator.of(context).pop(),
                    style: TextButton.styleFrom(
                      foregroundColor: AuthDarkColors.textPrimary,
                      backgroundColor: AuthDarkColors.chipUnselected.withValues(
                        alpha: 0.55,
                      ),
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.lg,
                        vertical: AppSpacing.sm + 2,
                      ),
                      minimumSize: Size(compact ? double.infinity : 96, 44),
                      shape: RoundedRectangleBorder(
                        borderRadius: AppRadius.mdAll,
                        side: BorderSide(
                          color: AuthDarkColors.border.withValues(alpha: 0.35),
                        ),
                      ),
                    ),
                    child: const Text('Close'),
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
      child: Divider(height: 1, thickness: 1, color: Color(0x1F2DD4BF)),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: AuthDarkTextStyles.label(context).copyWith(
              color: AuthDarkColors.textMuted,
              fontSize: 12,
              fontWeight: FontWeight.w500,
              letterSpacing: 0.2,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: AuthDarkTextStyles.body(context).copyWith(
              color: AuthDarkColors.textPrimary,
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
