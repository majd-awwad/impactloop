import 'models/supplier_pickup_schedule_item.dart';

DateTime pickupScheduleDateOnly(DateTime value) {
  final local = value.toLocal();
  return DateTime(local.year, local.month, local.day);
}

bool pickupScheduleIsSameDay(DateTime? value, DateTime day) {
  if (value == null) {
    return false;
  }
  return pickupScheduleDateOnly(value) == day;
}

List<SupplierPickupScheduleItem> filterPickupScheduleItems(
  List<SupplierPickupScheduleItem> items,
  SupplierPickupScheduleFilter filter,
) {
  final today = pickupScheduleDateOnly(DateTime.now());

  final filtered = items.where((item) {
    return switch (filter) {
      SupplierPickupScheduleFilter.today =>
        !item.isCompleted &&
            pickupScheduleIsSameDay(item.pickupWindow?.start, today),
      SupplierPickupScheduleFilter.upcoming =>
        !item.isCompleted &&
            item.pickupWindow != null &&
            pickupScheduleDateOnly(item.pickupWindow!.start).isAfter(today),
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
