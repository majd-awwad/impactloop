import 'package:flutter/material.dart';

import '../../../../app/theme/auth_dark_colors.dart';
import '../../data/models/supplier_action_notification.dart';

class SupplierNotificationStyle {
  const SupplierNotificationStyle({
    required this.icon,
    required this.foreground,
    required this.background,
    required this.border,
    required this.typeLabel,
    required this.actionBackground,
    required this.actionForeground,
  });

  final IconData icon;
  final Color foreground;
  final Color background;
  final Color border;
  final String typeLabel;
  final Color actionBackground;
  final Color actionForeground;

  static const _completedBorder = Color(0x5994A3B8); // rgba(148,163,184,0.35)

  static SupplierNotificationStyle forKind(
    SupplierActionNotificationKind kind, {
    bool isCompleted = false,
  }) {
    if (isCompleted) {
      return const SupplierNotificationStyle(
        icon: Icons.check_circle_outline,
        foreground: Color(0xFF94A3B8),
        background: Color(0x1A64748B),
        border: _completedBorder,
        typeLabel: 'Completed',
        actionBackground: Color(0x1A64748B),
        actionForeground: Color(0xFF94A3B8),
      );
    }

    switch (kind) {
      case SupplierActionNotificationKind.categoryApproved:
      case SupplierActionNotificationKind.categorySuggestion:
        return const SupplierNotificationStyle(
          icon: Icons.category_outlined,
          foreground: Color(0xFF7DD3FC),
          background: Color(0x1A7DD3FC),
          border: Color(0x8C7DD3FC), // rgba(125,211,252,0.55)
          typeLabel: 'Category',
          actionBackground: Color(0x267DD3FC),
          actionForeground: Color(0xFFBAE6FD),
        );
      case SupplierActionNotificationKind.categoryRejected:
        return const SupplierNotificationStyle(
          icon: Icons.category_outlined,
          foreground: Color(0xFFF87171),
          background: Color(0x1FEF4444),
          border: Color(0x99F87171), // rgba(248,113,113,0.60)
          typeLabel: 'Category',
          actionBackground: Color(0x29EF4444),
          actionForeground: Color(0xFFFCA5A5),
        );
      case SupplierActionNotificationKind.categoryPending:
        return const SupplierNotificationStyle(
          icon: Icons.hourglass_top_outlined,
          foreground: AuthDarkColors.textSecondary,
          background: Color(0x1A94A3B8),
          border: Color(0x5994A3B8),
          typeLabel: 'Category',
          actionBackground: Color(0x1A94A3B8),
          actionForeground: AuthDarkColors.textSecondary,
        );
      case SupplierActionNotificationKind.categoryCompleted:
        return forKind(
          SupplierActionNotificationKind.categoryApproved,
          isCompleted: true,
        );
      case SupplierActionNotificationKind.priceApproved:
        return const SupplierNotificationStyle(
          icon: Icons.payments_outlined,
          foreground: Color(0xFF60A5FA),
          background: Color(0x1F3B82F6),
          border: Color(0x9960A5FA), // rgba(96,165,250,0.60)
          typeLabel: 'Price',
          actionBackground: Color(0x293B82F6),
          actionForeground: Color(0xFF93C5FD),
        );
      case SupplierActionNotificationKind.priceRejected:
        return const SupplierNotificationStyle(
          icon: Icons.price_change_outlined,
          foreground: Color(0xFFFBBF24),
          background: Color(0x1FF59E0B),
          border: Color(0xA6F59E0B), // rgba(245,158,11,0.65)
          typeLabel: 'Price',
          actionBackground: Color(0x29F59E0B),
          actionForeground: Color(0xFFFCD34D),
        );
      case SupplierActionNotificationKind.pricePending:
        return const SupplierNotificationStyle(
          icon: Icons.payments_outlined,
          foreground: AuthDarkColors.textSecondary,
          background: Color(0x1A94A3B8),
          border: Color(0x5994A3B8),
          typeLabel: 'Price',
          actionBackground: Color(0x1A94A3B8),
          actionForeground: AuthDarkColors.textSecondary,
        );
      case SupplierActionNotificationKind.priceCompleted:
        return forKind(
          SupplierActionNotificationKind.priceApproved,
          isCompleted: true,
        );
      case SupplierActionNotificationKind.reservationPending:
        return const SupplierNotificationStyle(
          icon: Icons.inbox_outlined,
          foreground: Color(0xFF93C5FD),
          background: Color(0x1F3B82F6),
          border: Color(0x993B82F6), // rgba(59,130,246,0.60)
          typeLabel: 'Reservation',
          actionBackground: Color(0x293B82F6),
          actionForeground: Color(0xFFBFDBFE),
        );
    }
  }

  static Color filterSelectedColor(SupplierNotificationFilter filter) {
    return switch (filter) {
      SupplierNotificationFilter.all => const Color(0xFF14B8A6),
      SupplierNotificationFilter.actionNeeded => const Color(0xFF0891B2),
      SupplierNotificationFilter.reservations => const Color(0xFF2563EB),
      SupplierNotificationFilter.completed => const Color(0xFF64748B),
    };
  }
}
