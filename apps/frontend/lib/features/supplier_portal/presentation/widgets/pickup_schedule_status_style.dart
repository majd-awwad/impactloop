import 'package:flutter/material.dart';

import '../../../../app/theme/app_color_tokens.dart';
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

  // Today - teal/green, needs attention now.
  static const _today = PickupScheduleStatusStyle(
    background: AppColorTokens.supplierPickupTodayBackground,
    border: AppColorTokens.supplierPickupTodayBorder,
    foreground: AppColorTokens.supplierDashboardReused,
    selectedBackground: AppColorTokens.supplierPickupTodaySelectedBackground,
    selectedBorder: AppColorTokens.supplierPickupTodaySelectedBorder,
    accent: AppColorTokens.supplierDashboardReused,
  );

  // Upcoming - blue, future/scheduled.
  static const _upcoming = PickupScheduleStatusStyle(
    background: AppColorTokens.supplierPickupUpcomingBackground,
    border: AppColorTokens.supplierPickupUpcomingBorder,
    foreground: AppColorTokens.supplierDashboardReserved,
    selectedBackground: AppColorTokens.supplierPickupUpcomingSelectedBackground,
    selectedBorder: AppColorTokens.supplierPickupUpcomingSelectedBorder,
    accent: AppColorTokens.supplierDashboardReserved,
  );

  // Completed - muted green, finished and low priority.
  static const _completed = PickupScheduleStatusStyle(
    background: AppColorTokens.supplierPickupCompletedBackground,
    border: AppColorTokens.supplierPickupCompletedBorder,
    foreground: AppColorTokens.supplierPickupCompletedForeground,
    selectedBackground: AppColorTokens.supplierPickupCompletedSelectedBackground,
    selectedBorder: AppColorTokens.supplierPickupCompletedSelectedBorder,
    accent: AppColorTokens.supplierPickupCompletedForeground,
  );

  // All - neutral gray.
  static const _all = PickupScheduleStatusStyle(
    background: AppColorTokens.supplierPickupAllBackground,
    border: AppColorTokens.supplierPickupAllBorder,
    foreground: AppColorTokens.supplierPickupAllForeground,
    selectedBackground: AppColorTokens.supplierPickupAllSelectedBackground,
    selectedBorder: AppColorTokens.supplierPickupAllSelectedBorder,
    accent: AppColorTokens.supplierPickupAllForeground,
  );

  // Late/overdue - amber warning (future use).
  static const _late = PickupScheduleStatusStyle(
    background: AppColorTokens.supplierPickupLateBackground,
    border: AppColorTokens.supplierPickupLateBorder,
    foreground: AppColorTokens.supplierDashboardPending,
    selectedBackground: AppColorTokens.supplierPickupLateSelectedBackground,
    selectedBorder: AppColorTokens.supplierPickupLateSelectedBorder,
    accent: AppColorTokens.supplierDashboardPending,
  );
}
