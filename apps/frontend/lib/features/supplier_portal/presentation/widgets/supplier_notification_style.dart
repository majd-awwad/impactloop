import 'package:flutter/material.dart';

import '../../../../shared/widgets/app_status_badge.dart';
import '../../data/models/supplier_action_notification.dart';
import '../l10n/supplier_l10n.dart';

class SupplierNotificationStyle {
  const SupplierNotificationStyle({
    required this.icon,
    required this.accent,
    required this.typeLabel,
  });

  final IconData icon;
  final Color accent;
  final String typeLabel;

  static SupplierNotificationStyle forKind(
    BuildContext context,
    SupplierActionNotificationKind kind, {
    bool isCompleted = false,
  }) {
    final l = SupplierL10n.of(context);
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

    return SupplierNotificationStyle(
      icon: isCompleted ? Icons.check_circle_outline : presentation.icon,
      accent: AppStatusStyle.of(context, tone).foreground,
      typeLabel: isCompleted
          ? l.notificationCompleted
          : l.notificationTypeLabel(kind),
    );
  }

  static Color filterSelectedColor(
    BuildContext context,
    SupplierNotificationFilter filter,
  ) {
    final tone = switch (filter) {
      SupplierNotificationFilter.all => AppStatusTone.primary,
      SupplierNotificationFilter.actionNeeded => AppStatusTone.warning,
      SupplierNotificationFilter.reservations => AppStatusTone.info,
      SupplierNotificationFilter.completed => AppStatusTone.neutral,
    };
    return AppStatusStyle.of(context, tone).foreground;
  }
}
