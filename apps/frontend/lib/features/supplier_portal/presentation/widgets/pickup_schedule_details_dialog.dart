import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';
import '../../data/models/supplier_pickup_schedule_item.dart';
import '../../data/pickup_schedule_grouping.dart';
import 'pickup_schedule_status_style.dart';

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
      builder: (context) => PickupScheduleDetailsDialog(
        item: item,
        groupKind: groupKind,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final style = PickupScheduleStatusStyle.forItem(item, groupKind);
    final window = item.pickupWindow;

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.xl,
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 480),
        child: DecoratedBox(
          decoration: SupplierDecorations.profileGlassCard,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Pickup details',
                        style: AuthDarkTextStyles.title(context),
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(
                        Icons.close_rounded,
                        color: AuthDarkColors.textMuted,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                _DetailRow(label: 'Material', value: item.materialTitle),
                _DetailRow(label: 'Learner', value: item.learnerName),
                _DetailRow(label: 'Quantity', value: item.quantityLabel),
                _DetailRow(label: 'Pickup type', value: item.pickupType),
                _DetailRow(label: 'Status', value: item.status.label),
                if (window != null) ...[
                  _DetailRow(
                    label: 'Date',
                    value: formatScheduleDateLabel(window.start),
                  ),
                  _DetailRow(
                    label: 'Time',
                    value: formatPickupTimeRange(window),
                  ),
                ],
                if (item.isCompleted && item.completedAt != null)
                  _DetailRow(
                    label: 'Completed',
                    value: formatScheduleDateLabel(item.completedAt!),
                  ),
                if (item.supplierNote?.trim().isNotEmpty == true)
                  _DetailRow(
                    label: 'Supplier note',
                    value: item.supplierNote!.trim(),
                  ),
                if (item.learnerMessage?.trim().isNotEmpty == true)
                  _DetailRow(
                    label: 'Learner message',
                    value: item.learnerMessage!.trim(),
                  ),
                const SizedBox(height: AppSpacing.lg),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () => Navigator.of(context).pop(),
                    style: TextButton.styleFrom(
                      foregroundColor: style.foreground,
                      backgroundColor: style.background,
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.lg,
                        vertical: AppSpacing.sm,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: AppRadius.mdAll,
                        side: BorderSide(color: style.border),
                      ),
                    ),
                    child: const Text('Close'),
                  ),
                ),
              ],
            ),
          ),
        ),
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
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 112,
            child: Text(
              label,
              style: AuthDarkTextStyles.label(context).copyWith(
                color: AuthDarkColors.textMuted,
                fontSize: 13,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: AuthDarkTextStyles.body(context).copyWith(
                fontSize: 14,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
