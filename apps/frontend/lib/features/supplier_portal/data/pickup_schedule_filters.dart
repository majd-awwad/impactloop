import 'models/supplier_pickup_schedule_item.dart';

/// The single local calendar conversion point for this feature. Backend ISO
/// timestamps are parsed by the hardened request model and converted here.
DateTime pickupScheduleDateOnly(DateTime value) {
  final local = value.toLocal();
  return DateTime(local.year, local.month, local.day);
}

bool pickupScheduleIsSameDay(DateTime? value, DateTime day) {
  if (value == null) return false;
  return pickupScheduleDateOnly(value) == pickupScheduleDateOnly(day);
}

List<SupplierPickupScheduleItem> filterPickupScheduleItems(
  List<SupplierPickupScheduleItem> items,
  SupplierPickupScheduleFilter filter, {
  DateTime? now,
}) {
  final today = pickupScheduleDateOnly(now ?? DateTime.now());
  final filtered = items.where((item) {
    final scheduledDate = item.pickupWindow?.start;
    return switch (filter) {
      SupplierPickupScheduleFilter.today =>
        !item.isCompleted && pickupScheduleIsSameDay(scheduledDate, today),
      SupplierPickupScheduleFilter.upcoming =>
        !item.isCompleted &&
            scheduledDate != null &&
            pickupScheduleDateOnly(scheduledDate).isAfter(today),
      SupplierPickupScheduleFilter.completed => item.isCompleted,
      SupplierPickupScheduleFilter.all => true,
    };
  }).toList();

  return _sortPickupScheduleItems(filtered);
}

List<SupplierPickupScheduleItem> _sortPickupScheduleItems(
  List<SupplierPickupScheduleItem> items,
) {
  return List.of(items)..sort((a, b) {
    final aTime =
        a.pickupWindow?.start ??
        a.completedAt ??
        DateTime.fromMillisecondsSinceEpoch(0);
    final bTime =
        b.pickupWindow?.start ??
        b.completedAt ??
        DateTime.fromMillisecondsSinceEpoch(0);
    return aTime.compareTo(bTime);
  });
}
