import 'package:flutter/material.dart';

import '../../../../shared/widgets/app_status_badge.dart';
import '../../data/models/supplier_pickup_schedule_item.dart';

/// Semantic tone mappings for Pickup Schedule filters, date groups, and badges.
class PickupScheduleStatusStyle {
  const PickupScheduleStatusStyle._(this.tone);

  final AppStatusTone tone;

  AppStatusStyle resolve(BuildContext context) =>
      AppStatusStyle.of(context, tone);

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

  /// Card badges represent reservation lifecycle, not calendar placement.
  static PickupScheduleStatusStyle forItem(
    SupplierPickupScheduleItem item,
  ) {
    return item.isCompleted ? _completed : _accepted;
  }

  /// Reserved for overdue/late pickups when mock or API data supports it.
  static PickupScheduleStatusStyle forLate() => _late;

  static const _today = PickupScheduleStatusStyle._(AppStatusTone.warning);
  static const _upcoming = PickupScheduleStatusStyle._(AppStatusTone.info);
  static const _accepted = PickupScheduleStatusStyle._(AppStatusTone.success);
  static const _completed = PickupScheduleStatusStyle._(AppStatusTone.success);
  static const _all = PickupScheduleStatusStyle._(AppStatusTone.neutral);
  static const _late = PickupScheduleStatusStyle._(AppStatusTone.warning);
}
