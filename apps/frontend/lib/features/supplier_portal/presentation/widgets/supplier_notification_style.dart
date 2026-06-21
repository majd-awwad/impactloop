import 'package:flutter/material.dart';

import '../theme/supplier_color_scheme.dart';
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
    final c = SupplierColorScheme.of(context);

    if (isCompleted) {
      return SupplierNotificationStyle(
        icon: Icons.check_circle_outline,
        accent: c.textMuted,
        typeLabel: l.notificationCompleted,
      );
    }

    switch (kind) {
      case SupplierActionNotificationKind.categoryApproved:
      case SupplierActionNotificationKind.categorySuggestion:
        return SupplierNotificationStyle(
          icon: Icons.category_outlined,
          accent: c.isDark ? const Color(0xFF7DD3FC) : c.purpleAccent,
          typeLabel: l.notificationTypeLabel(kind),
        );
      case SupplierActionNotificationKind.categoryRejected:
        return SupplierNotificationStyle(
          icon: Icons.category_outlined,
          accent: c.redAccent,
          typeLabel: l.notificationTypeLabel(kind),
        );
      case SupplierActionNotificationKind.categoryPending:
        return SupplierNotificationStyle(
          icon: Icons.hourglass_top_outlined,
          accent: c.textSecondary,
          typeLabel: l.notificationTypeLabel(kind),
        );
      case SupplierActionNotificationKind.categoryCompleted:
        return forKind(
          context,
          SupplierActionNotificationKind.categoryApproved,
          isCompleted: true,
        );
      case SupplierActionNotificationKind.priceApproved:
        return SupplierNotificationStyle(
          icon: Icons.payments_outlined,
          accent: c.isDark ? const Color(0xFF60A5FA) : c.blueAccent,
          typeLabel: l.notificationTypeLabel(kind),
        );
      case SupplierActionNotificationKind.priceRejected:
        return SupplierNotificationStyle(
          icon: Icons.price_change_outlined,
          accent: c.amberAccent,
          typeLabel: l.notificationTypeLabel(kind),
        );
      case SupplierActionNotificationKind.pricePending:
        return SupplierNotificationStyle(
          icon: Icons.payments_outlined,
          accent: c.textSecondary,
          typeLabel: l.notificationTypeLabel(kind),
        );
      case SupplierActionNotificationKind.priceCompleted:
        return forKind(
          context,
          SupplierActionNotificationKind.priceApproved,
          isCompleted: true,
        );
      case SupplierActionNotificationKind.reservationPending:
        return SupplierNotificationStyle(
          icon: Icons.inbox_outlined,
          accent: c.isDark ? const Color(0xFF93C5FD) : c.blueAccent,
          typeLabel: l.notificationTypeLabel(kind),
        );
    }
  }

  static Color filterSelectedColor(
    BuildContext context,
    SupplierNotificationFilter filter,
  ) {
    final c = SupplierColorScheme.of(context);
    return switch (filter) {
      SupplierNotificationFilter.all => c.accentMuted,
      SupplierNotificationFilter.actionNeeded => c.isDark
          ? const Color(0xFF0891B2)
          : c.accent,
      SupplierNotificationFilter.reservations => c.blueAccent,
      SupplierNotificationFilter.completed => c.textMuted,
    };
  }
}
