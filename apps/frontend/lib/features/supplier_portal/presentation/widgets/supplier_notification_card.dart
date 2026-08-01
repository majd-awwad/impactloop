import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../data/models/supplier_action_notification.dart';
import '../theme/supplier_theme_extension.dart';
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
    final colors = context.supplierColors;
    final l = context.s;
    final style = SupplierNotificationStyle.forNotification(
      context,
      notification,
    );
    final compact =
        MediaQuery.sizeOf(context).width < AppSpacing.supplierLayoutBreakpoint;
    final showAction = notification.action.canNavigate && onAction != null;
    final muted =
        notification.state == SupplierNotificationState.resolved ||
        (notification.state == SupplierNotificationState.unknown &&
            notification.isCompleted);
    final borderColor = colors.border.withValues(
      alpha: colors.isDark ? 0.35 : 0.9,
    );

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: colors.surfaceSolid,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: borderColor),
        boxShadow: [
          BoxShadow(
            color: colors.cardShadow,
            blurRadius: colors.isDark ? 12 : 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              width: 4,
              color: style.accent.withValues(alpha: muted ? 0.4 : 1),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsetsDirectional.fromSTEB(
                  AppSpacing.md,
                  AppSpacing.sm + 2,
                  AppSpacing.md,
                  AppSpacing.md,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 28,
                          height: 28,
                          decoration: BoxDecoration(
                            color: style.badgeBackground,
                            borderRadius: AppRadius.mdAll,
                          ),
                          child: Icon(
                            _iconFor(notification, style.icon),
                            color: style.accent,
                            size: 15,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  if (!notification.isRead) ...[
                                    Container(
                                      width: 6,
                                      height: 6,
                                      decoration: BoxDecoration(
                                        color: colors.accent,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                    const SizedBox(width: AppSpacing.xs),
                                  ],
                                  Flexible(
                                    child: Text(
                                      notification.title,
                                      style: context.supplierTitle().copyWith(
                                        fontSize: compact ? 14 : 15,
                                        fontWeight: notification.isRead
                                            ? FontWeight.w600
                                            : FontWeight.w700,
                                        color: muted
                                            ? colors.textSecondary
                                            : colors.textPrimary,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 2),
                              Text(
                                _formatTimestamp(
                                  context,
                                  notification.createdAt,
                                ),
                                style: context.supplierBody().copyWith(
                                  fontSize: 11,
                                  color: colors.textMuted,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        _StatusBadge(notification: notification, style: style),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: AppSpacing.xs,
                      runSpacing: AppSpacing.xs,
                      children: [
                        _TypeBadge(
                          label: _categoryLabel(context, notification, style),
                          muted: muted,
                          style: style,
                        ),
                        if (notification.maxAllowedUnitPriceNis != null &&
                            notification.unit != null)
                          _TypeBadge(
                            label: l.maxPriceLabel(
                              notification.maxAllowedUnitPriceNis!,
                              notification.unit!,
                            ),
                            muted: muted,
                          ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      notification.body,
                      style: context.supplierBody().copyWith(
                        color: muted ? colors.textMuted : colors.textSecondary,
                        fontSize: 13,
                        height: 1.45,
                      ),
                    ),
                    if (showAction) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Align(
                        alignment: AlignmentDirectional.centerEnd,
                        child: TextButton(
                          onPressed: onAction,
                          style: TextButton.styleFrom(
                            backgroundColor:
                                notification.action.type ==
                                    SupplierNotificationActionType
                                        .reviewReservation
                                ? colors.accent
                                : colors.surfaceSolid,
                            foregroundColor:
                                notification.action.type ==
                                    SupplierNotificationActionType
                                        .reviewReservation
                                ? colors.textOnAccent
                                : colors.accent,
                            minimumSize: Size(
                              compact ? double.infinity : 0,
                              36,
                            ),
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            padding: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.md,
                              vertical: AppSpacing.xs,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: AppRadius.mdAll,
                              side: BorderSide(
                                color: colors.accent.withValues(alpha: 0.55),
                              ),
                            ),
                          ),
                          child: Text(
                            l.supplierNotificationActionLabel(
                              notification.action.type,
                              labelKey: notification.action.labelKey,
                            ),
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
            ),
          ],
        ),
      ),
    );
  }

  IconData _iconFor(
    SupplierActionNotification notification,
    IconData fallback,
  ) {
    if (notification.isUnknown) return Icons.info_outline;
    return switch (notification.category) {
      SupplierNotificationCategory.reservation => Icons.inbox_outlined,
      SupplierNotificationCategory.materialReview => Icons.category_outlined,
      SupplierNotificationCategory.deliveryRecovery =>
        Icons.local_shipping_outlined,
      SupplierNotificationCategory.account => Icons.person_outline,
      SupplierNotificationCategory.system => Icons.info_outline,
      SupplierNotificationCategory.unknown => fallback,
    };
  }

  String _categoryLabel(
    BuildContext context,
    SupplierActionNotification notification,
    SupplierNotificationStyle style,
  ) {
    if (notification.isUnknown) return context.s.t('Notification', 'إشعار');
    return switch (notification.category) {
      SupplierNotificationCategory.reservation => context.s.filterReservations,
      SupplierNotificationCategory.materialReview => context.s.t(
        'Material review',
        'مراجعة المواد',
      ),
      SupplierNotificationCategory.deliveryRecovery => context.s.t(
        'Delivery recovery',
        'معالجة التوصيل',
      ),
      SupplierNotificationCategory.account => context.s.t('Account', 'الحساب'),
      SupplierNotificationCategory.system => context.s.t('System', 'النظام'),
      SupplierNotificationCategory.unknown => style.typeLabel,
    };
  }

  String _formatTimestamp(BuildContext context, DateTime value) {
    final local = value.toLocal();
    final l = context.s;
    if (l.isArabic) {
      final hour = local.hour.toString().padLeft(2, '0');
      final minute = local.minute.toString().padLeft(2, '0');
      return '${local.day}/${local.month}/${local.year} · $hour:$minute';
    }

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

class _TypeBadge extends StatelessWidget {
  const _TypeBadge({required this.label, this.muted = false, this.style});

  final String label;
  final bool muted;
  final SupplierNotificationStyle? style;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: style?.categoryBackground ?? colors.chipUnselected,
        borderRadius: AppRadius.pillAll,
        border: Border.all(
          color:
              style?.categoryBorder ??
              colors.border.withValues(alpha: colors.isDark ? 0.35 : 0.65),
        ),
      ),
      child: Text(
        label,
        style: context.supplierChip().copyWith(
          fontSize: 10,
          color: muted
              ? colors.textMuted
              : style?.categoryForeground ?? colors.textSecondary,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.notification, required this.style});

  final SupplierActionNotification notification;
  final SupplierNotificationStyle style;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final resolved =
        notification.state == SupplierNotificationState.resolved ||
        (notification.state == SupplierNotificationState.unknown &&
            notification.isCompleted);
    if (resolved) {
      return _PillBadge(
        label: l.notificationCompleted,
        color: style.badgeForeground,
        background: style.badgeBackground,
        border: style.badgeBorder,
      );
    }

    final label = switch (notification.state) {
      SupplierNotificationState.needsAction => l.actionNeeded,
      SupplierNotificationState.waiting => context.s.t('Waiting', 'بانتظار'),
      SupplierNotificationState.update => context.s.t('Update', 'تحديث'),
      SupplierNotificationState.resolved => l.notificationCompleted,
      SupplierNotificationState.unknown => context.s.t('Notification', 'إشعار'),
    };
    return _PillBadge(
      label: label,
      color: style.badgeForeground,
      background: style.badgeBackground,
      border: style.badgeBorder,
    );
  }
}

class _PillBadge extends StatelessWidget {
  const _PillBadge({
    required this.label,
    required this.color,
    required this.background,
    required this.border,
  });

  final String label;
  final Color color;
  final Color background;
  final Color border;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: background,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: border),
      ),
      child: Text(
        label,
        style: context.supplierChip().copyWith(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
