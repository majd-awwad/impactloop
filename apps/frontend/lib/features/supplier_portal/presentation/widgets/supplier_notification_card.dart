import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../data/models/supplier_action_notification.dart';
import 'supplier_notification_style.dart';

class SupplierNotificationCard extends StatelessWidget {
  const SupplierNotificationCard({
    super.key,
    required this.notification,
    this.onAction,
  });

  final SupplierActionNotification notification;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final style = SupplierNotificationStyle.forKind(
      notification.kind,
      isCompleted: notification.isCompleted,
    );
    final compact =
        MediaQuery.sizeOf(context).width < AppSpacing.supplierLayoutBreakpoint;
    final showAction =
        notification.actionLabel != null &&
        onAction != null &&
        !notification.isCompleted;
    final muted = notification.isCompleted;

    return Opacity(
      opacity: muted ? 0.72 : 1,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm + 2,
        ),
        decoration: BoxDecoration(
          color: muted
              ? AuthDarkColors.surfaceSolid.withValues(alpha: 0.5)
              : AuthDarkColors.surfaceSolid.withValues(alpha: 0.78),
          borderRadius: AppRadius.lgAll,
          border: Border.all(
            color: muted
                ? style.border.withValues(alpha: 0.35)
                : style.border.withValues(alpha: 0.7),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(
                    color: style.background,
                    borderRadius: AppRadius.mdAll,
                  ),
                  child: Icon(style.icon, color: style.foreground, size: 16),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        notification.title,
                        style: AuthDarkTextStyles.title(context).copyWith(
                          fontSize: compact ? 14 : 15,
                          fontWeight: FontWeight.w700,
                          color: muted
                              ? AuthDarkColors.textSecondary
                              : AuthDarkColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _formatTimestamp(notification.createdAt),
                        style: AuthDarkTextStyles.body(context).copyWith(
                          fontSize: 11,
                          color: AuthDarkColors.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.xs),
                _StatusBadge(notification: notification),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                _SourceBadge(label: style.typeLabel, muted: muted),
                if (notification.maxAllowedUnitPriceNis != null &&
                    notification.unit != null) ...[
                  const SizedBox(width: AppSpacing.xs),
                  _SourceBadge(
                    label:
                        'Max ${notification.maxAllowedUnitPriceNis!.toStringAsFixed(0)} NIS/${notification.unit}',
                    muted: muted,
                  ),
                ],
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              notification.body,
              style: AuthDarkTextStyles.body(context).copyWith(
                color: muted
                    ? AuthDarkColors.textMuted
                    : AuthDarkColors.textSecondary,
                fontSize: 13,
                height: 1.45,
              ),
            ),
            if (showAction) ...[
              const SizedBox(height: AppSpacing.sm),
              Align(
                alignment: compact
                    ? Alignment.centerLeft
                    : Alignment.centerRight,
                child: TextButton(
                  onPressed: onAction,
                  style: TextButton.styleFrom(
                    backgroundColor: style.actionBackground,
                    foregroundColor: style.actionForeground,
                    minimumSize: Size(compact ? double.infinity : 0, 34),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.md,
                      vertical: AppSpacing.xs,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: AppRadius.mdAll,
                      side: BorderSide(
                        color: style.border.withValues(alpha: 0.45),
                      ),
                    ),
                  ),
                  child: Text(
                    notification.actionLabel!,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _formatTimestamp(DateTime value) {
    final local = value.toLocal();
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    final month = months[local.month - 1];
    final hour = local.hour.toString().padLeft(2, '0');
    final minute = local.minute.toString().padLeft(2, '0');
    return '$month ${local.day}, ${local.year} · $hour:$minute';
  }
}

class _SourceBadge extends StatelessWidget {
  const _SourceBadge({required this.label, this.muted = false});

  final String label;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AuthDarkColors.chipUnselected.withValues(
          alpha: muted ? 0.28 : 0.5,
        ),
        borderRadius: AppRadius.pillAll,
      ),
      child: Text(
        label,
        style: AuthDarkTextStyles.chip(context).copyWith(
          fontSize: 10,
          color: muted
              ? AuthDarkColors.textMuted
              : AuthDarkColors.textSecondary,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.notification});

  final SupplierActionNotification notification;

  @override
  Widget build(BuildContext context) {
    if (notification.isCompleted) {
      return _PillBadge(
        label: 'Completed',
        color: const Color(0xFF64748B),
        background: const Color(0x33475569),
      );
    }

    final label = switch (notification.status) {
      SupplierActionNotificationStatus.approved => 'Approved',
      SupplierActionNotificationStatus.rejected => 'Rejected',
      SupplierActionNotificationStatus.pending => 'Pending',
    };

    final color = switch (notification.status) {
      SupplierActionNotificationStatus.approved => const Color(0xFF2DD4BF),
      SupplierActionNotificationStatus.rejected => const Color(0xFFF87171),
      SupplierActionNotificationStatus.pending => const Color(0xFF94A3B8),
    };

    return _PillBadge(
      label: label,
      color: color,
      background: color.withValues(alpha: 0.16),
    );
  }
}

class _PillBadge extends StatelessWidget {
  const _PillBadge({
    required this.label,
    required this.color,
    required this.background,
  });

  final String label;
  final Color color;
  final Color background;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: background,
        borderRadius: AppRadius.pillAll,
      ),
      child: Text(
        label,
        style: AuthDarkTextStyles.chip(
          context,
        ).copyWith(color: color, fontSize: 10, fontWeight: FontWeight.w700),
      ),
    );
  }
}
