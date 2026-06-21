import 'package:flutter/material.dart';

import '../../data/models/supplier_pickup_schedule_item.dart';

/// Centralized semantic colors for Pickup Schedule filters, badges, and accents.
class PickupScheduleStatusStyle {
  const PickupScheduleStatusStyle({
    required this.background,
    required this.border,
    required this.foreground,
    required this.selectedBackground,
    required this.selectedBorder,
    required this.accent,
  });

  final Color background;
  final Color border;
  final Color foreground;
  final Color selectedBackground;
  final Color selectedBorder;
  final Color accent;

  /// Filter chips: Today / Upcoming / Completed / All.
  static PickupScheduleStatusStyle styleForPickupFilter(
    SupplierPickupScheduleFilter filter,
  ) => forFilter(filter);

  static PickupScheduleStatusStyle forFilter(
    SupplierPickupScheduleFilter filter,
  ) {
    return switch (filter) {
      SupplierPickupScheduleFilter.today => _today,
      SupplierPickupScheduleFilter.upcoming => _upcoming,
      SupplierPickupScheduleFilter.completed => _completed,
      SupplierPickupScheduleFilter.all => _all,
    };
  }

  static PickupScheduleStatusStyle forGroupKind(PickupScheduleGroupKind kind) {
    return switch (kind) {
      PickupScheduleGroupKind.today => _today,
      PickupScheduleGroupKind.tomorrow => _upcoming,
      PickupScheduleGroupKind.date => _upcoming,
      PickupScheduleGroupKind.completed => _completed,
    };
  }

  /// Card badges and time accents derived from pickup state + date group.
  static PickupScheduleStatusStyle forItem(
    SupplierPickupScheduleItem item,
    PickupScheduleGroupKind? groupKind,
  ) {
    if (item.isCompleted) {
      return _completed;
    }
    if (groupKind == PickupScheduleGroupKind.today) {
      return _today;
    }
    return _upcoming;
  }

  /// Reserved for overdue/late pickups when mock or API data supports it.
  static PickupScheduleStatusStyle forLate() => _late;

  // Today — teal/green, needs attention now.
  static const _today = PickupScheduleStatusStyle(
    background: Color(0x2414B8A6), // rgba(20, 184, 166, 0.14)
    border: Color(0x8014B8A6), // rgba(20, 184, 166, 0.50)
    foreground: Color(0xFF2DD4BF),
    selectedBackground: Color(0x3814B8A6), // rgba(20, 184, 166, 0.22)
    selectedBorder: Color(0xA614B8A6), // rgba(20, 184, 166, 0.65)
    accent: Color(0xFF2DD4BF),
  );

  // Upcoming — blue, future/scheduled.
  static const _upcoming = PickupScheduleStatusStyle(
    background: Color(0x243B82F6), // rgba(59, 130, 246, 0.14)
    border: Color(0x803B82F6), // rgba(59, 130, 246, 0.50)
    foreground: Color(0xFF60A5FA),
    selectedBackground: Color(0x383B82F6), // rgba(59, 130, 246, 0.22)
    selectedBorder: Color(0xA63B82F6), // rgba(59, 130, 246, 0.65)
    accent: Color(0xFF60A5FA),
  );

  // Completed — muted green, finished and low priority.
  static const _completed = PickupScheduleStatusStyle(
    background: Color(0x1F22C55E), // rgba(34, 197, 94, 0.12)
    border: Color(0x6622C55E), // rgba(34, 197, 94, 0.40)
    foreground: Color(0xFF86EFAC),
    selectedBackground: Color(0x2E22C55E), // rgba(34, 197, 94, 0.18)
    selectedBorder: Color(0x8022C55E), // rgba(34, 197, 94, 0.50)
    accent: Color(0xFF86EFAC),
  );

  // All — neutral gray.
  static const _all = PickupScheduleStatusStyle(
    background: Color(0x1F94A3B8), // rgba(148, 163, 184, 0.12)
    border: Color(0x5994A3B8), // rgba(148, 163, 184, 0.35)
    foreground: Color(0xFFCBD5E1),
    selectedBackground: Color(0x3394A3B8), // rgba(148, 163, 184, 0.20)
    selectedBorder: Color(0x8094A3B8), // rgba(148, 163, 184, 0.50)
    accent: Color(0xFFCBD5E1),
  );

  // Late/overdue — amber warning (future use).
  static const _late = PickupScheduleStatusStyle(
    background: Color(0x24F59E0B), // rgba(245, 158, 11, 0.14)
    border: Color(0x80F59E0B), // rgba(245, 158, 11, 0.50)
    foreground: Color(0xFFFBBF24),
    selectedBackground: Color(0x38F59E0B),
    selectedBorder: Color(0xA6F59E0B),
    accent: Color(0xFFFBBF24),
  );
}
