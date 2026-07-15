import 'package:flutter/material.dart';

import '../../../../app/theme/app_theme_colors.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../data/models/supplier_action_notification.dart';
import '../theme/supplier_theme_extension.dart';

class SupplierNotificationStyle {
  const SupplierNotificationStyle({
    required this.icon,
    required this.accent,
    required this.typeLabel,
    required this.badgeBackground,
    required this.badgeForeground,
    required this.badgeBorder,
    required this.categoryBackground,
    required this.categoryForeground,
    required this.categoryBorder,
  });

  final IconData icon;
  final Color accent;
  final String typeLabel;
  final Color badgeBackground;
  final Color badgeForeground;
  final Color badgeBorder;
  final Color categoryBackground;
  final Color categoryForeground;
  final Color categoryBorder;

  static SupplierNotificationStyle forNotification(
    BuildContext context,
    SupplierActionNotification notification,
  ) {
    final l = context.s;
    final state = _stateColors(
      context,
      notification.state,
      isCompleted: notification.isCompleted,
    );
    final category = _categoryColors(context, notification.category);

    return SupplierNotificationStyle(
      icon: _categoryIcon(notification.category),
      accent: state.foreground,
      typeLabel: notification.isUnknown
          ? l.t('Notification', 'إشعار')
          : l.notificationTypeLabel(notification.kind),
      badgeBackground: state.background,
      badgeForeground: state.foreground,
      badgeBorder: state.border,
      categoryBackground: category.background,
      categoryForeground: category.foreground,
      categoryBorder: category.border,
    );
  }

  static SupplierNotificationStyle forKind(
    BuildContext context,
    SupplierActionNotificationKind kind, {
    bool isCompleted = false,
  }) {
    final l = context.s;
    final presentation = switch (kind) {
      SupplierActionNotificationKind.categoryApproved => (
        icon: Icons.category_outlined,
        tone: AppStatusTone.success,
      ),
      SupplierActionNotificationKind.categorySuggestion => (
        icon: Icons.category_outlined,
        tone: AppStatusTone.warning,
      ),
      SupplierActionNotificationKind.categoryRejected => (
        icon: Icons.category_outlined,
        tone: AppStatusTone.danger,
      ),
      SupplierActionNotificationKind.categoryPending => (
        icon: Icons.hourglass_top_outlined,
        tone: AppStatusTone.warning,
      ),
      SupplierActionNotificationKind.categoryCompleted => (
        icon: Icons.check_circle_outline,
        tone: AppStatusTone.neutral,
      ),
      SupplierActionNotificationKind.priceApproved => (
        icon: Icons.payments_outlined,
        tone: AppStatusTone.success,
      ),
      SupplierActionNotificationKind.priceRejected => (
        icon: Icons.price_change_outlined,
        tone: AppStatusTone.danger,
      ),
      SupplierActionNotificationKind.pricePending => (
        icon: Icons.payments_outlined,
        tone: AppStatusTone.warning,
      ),
      SupplierActionNotificationKind.priceCompleted => (
        icon: Icons.check_circle_outline,
        tone: AppStatusTone.neutral,
      ),
      SupplierActionNotificationKind.reservationPending => (
        icon: Icons.inbox_outlined,
        tone: AppStatusTone.warning,
      ),
    };
    final tone = isCompleted ? AppStatusTone.neutral : presentation.tone;
    final status = _toneColors(context, tone);
    final category = _categoryColors(
      context,
      SupplierNotificationCategory.unknown,
    );

    return SupplierNotificationStyle(
      icon: isCompleted ? Icons.check_circle_outline : presentation.icon,
      accent: status.foreground,
      typeLabel: isCompleted
          ? l.notificationCompleted
          : l.notificationTypeLabel(kind),
      badgeBackground: status.background,
      badgeForeground: status.foreground,
      badgeBorder: status.border,
      categoryBackground: category.background,
      categoryForeground: category.foreground,
      categoryBorder: category.border,
    );
  }

  static Color filterSelectedColor(
    BuildContext context,
    SupplierNotificationFilter filter,
  ) {
    return context.supplierColors.accent;
  }

  static _NotificationColorSet _stateColors(
    BuildContext context,
    SupplierNotificationState state, {
    required bool isCompleted,
  }) {
    if (state == SupplierNotificationState.resolved ||
        (state == SupplierNotificationState.unknown && isCompleted)) {
      return _toneColors(context, AppStatusTone.neutral);
    }

    return switch (state) {
      SupplierNotificationState.needsAction => _NotificationColorSet(
        background: AppThemeColors.of(context).warningSoft,
        foreground: AppThemeColors.of(context).accentAmber,
        border: AppThemeColors.of(context).warningBorder,
      ),
      SupplierNotificationState.waiting => _toneColors(
        context,
        AppStatusTone.info,
      ),
      SupplierNotificationState.update => _NotificationColorSet(
        background: AppThemeColors.of(context).accentSoft,
        foreground: AppThemeColors.of(context).accentMint,
        border: AppThemeColors.of(context).accentMint.withValues(alpha: 0.42),
      ),
      SupplierNotificationState.resolved => _toneColors(
        context,
        AppStatusTone.neutral,
      ),
      SupplierNotificationState.unknown => _toneColors(
        context,
        AppStatusTone.neutral,
      ),
    };
  }

  static _NotificationColorSet _categoryColors(
    BuildContext context,
    SupplierNotificationCategory category,
  ) {
    final colors = context.supplierColors;
    final theme = AppThemeColors.of(context);

    return switch (category) {
      SupplierNotificationCategory.reservation => _fromAccent(
        colors.blueAccent,
      ),
      SupplierNotificationCategory.materialReview => _fromAccent(
        colors.isDark
            ? SupplierUiPalette.dark.purpleAccent
            : SupplierUiPalette.light.purpleAccent,
      ),
      SupplierNotificationCategory.deliveryRecovery => _fromAccent(
        theme.accentMint,
      ),
      SupplierNotificationCategory.account => _fromAccent(
        colors.textSecondary,
      ),
      SupplierNotificationCategory.system ||
      SupplierNotificationCategory.unknown => _NotificationColorSet(
        background: colors.chipUnselected,
        foreground: colors.textSecondary,
        border: colors.border.withValues(alpha: colors.isDark ? 0.45 : 0.7),
      ),
    };
  }

  static _NotificationColorSet _toneColors(
    BuildContext context,
    AppStatusTone tone,
  ) {
    final style = AppStatusStyle.of(context, tone);
    return _NotificationColorSet(
      background: style.background,
      foreground: style.foreground,
      border: style.border,
    );
  }

  static _NotificationColorSet _fromAccent(Color accent) {
    return _NotificationColorSet(
      background: accent.withValues(alpha: 0.12),
      foreground: accent,
      border: accent.withValues(alpha: 0.42),
    );
  }

  static IconData _categoryIcon(SupplierNotificationCategory category) {
    return switch (category) {
      SupplierNotificationCategory.reservation => Icons.inbox_outlined,
      SupplierNotificationCategory.materialReview => Icons.category_outlined,
      SupplierNotificationCategory.deliveryRecovery =>
        Icons.local_shipping_outlined,
      SupplierNotificationCategory.account => Icons.person_outline,
      SupplierNotificationCategory.system ||
      SupplierNotificationCategory.unknown => Icons.info_outline,
    };
  }
}

class _NotificationColorSet {
  const _NotificationColorSet({
    required this.background,
    required this.foreground,
    required this.border,
  });

  final Color background;
  final Color foreground;
  final Color border;
}
