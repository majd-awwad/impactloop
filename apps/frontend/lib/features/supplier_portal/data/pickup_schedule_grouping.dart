import 'models/supplier_pickup_schedule_item.dart';
import 'models/supplier_incoming_request.dart' show SupplierPickupWindow;

String formatPickupTimeRange(SupplierPickupWindow window) {
  final start = window.start.toLocal();
  final end = window.end.toLocal();
  final startTime =
      '${start.hour.toString().padLeft(2, '0')}:${start.minute.toString().padLeft(2, '0')}';
  final endTime =
      '${end.hour.toString().padLeft(2, '0')}:${end.minute.toString().padLeft(2, '0')}';
  return '$startTime – $endTime';
}

String formatScheduleDateLabel(DateTime date) {
  final local = DateTime(date.year, date.month, date.day);
  final today = _dateOnly(DateTime.now());
  final tomorrow = today.add(const Duration(days: 1));

  if (local == today) {
    return 'Today';
  }
  if (local == tomorrow) {
    return 'Tomorrow';
  }

  return '${_monthLabel(local.month)} ${local.day}, ${local.year}';
}

String _monthLabel(int month) {
  const labels = [
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
  return labels[month - 1];
}

DateTime _dateOnly(DateTime value) {
  final local = value.toLocal();
  return DateTime(local.year, local.month, local.day);
}

int _groupSortOrder(PickupScheduleGroupKind kind) {
  return switch (kind) {
    PickupScheduleGroupKind.today => 0,
    PickupScheduleGroupKind.tomorrow => 1,
    PickupScheduleGroupKind.date => 2,
    PickupScheduleGroupKind.completed => 99,
  };
}

List<PickupScheduleDateGroup> groupPickupScheduleItems(
  List<SupplierPickupScheduleItem> items,
  SupplierPickupScheduleFilter filter,
) {
  if (items.isEmpty) {
    return const [];
  }

  final accepted = items.where((item) => !item.isCompleted).toList();
  final completed = items.where((item) => item.isCompleted).toList();

  final groups = <PickupScheduleDateGroup>[];

  if (filter == SupplierPickupScheduleFilter.completed) {
    if (completed.isNotEmpty) {
      groups.add(
        PickupScheduleDateGroup(
          kind: PickupScheduleGroupKind.completed,
          label: 'Completed',
          items: _sortByPickupStart(completed),
        ),
      );
    }
    return groups;
  }

  final today = _dateOnly(DateTime.now());
  final tomorrow = today.add(const Duration(days: 1));
  final byDate = <DateTime, List<SupplierPickupScheduleItem>>{};

  for (final item in accepted) {
    final date = _dateOnly(item.pickupWindow?.start ?? item.scheduleDate!);
    byDate.putIfAbsent(date, () => []).add(item);
  }

  final sortedDates = byDate.keys.toList()..sort();

  for (final date in sortedDates) {
    final groupItems = _sortByPickupStart(byDate[date]!);
    final kind = date == today
        ? PickupScheduleGroupKind.today
        : date == tomorrow
        ? PickupScheduleGroupKind.tomorrow
        : PickupScheduleGroupKind.date;

    groups.add(
      PickupScheduleDateGroup(
        kind: kind,
        label: formatScheduleDateLabel(date),
        date: date,
        items: groupItems,
      ),
    );
  }

  if (filter == SupplierPickupScheduleFilter.all && completed.isNotEmpty) {
    groups.add(
      PickupScheduleDateGroup(
        kind: PickupScheduleGroupKind.completed,
        label: 'Completed',
        items: _sortByPickupStart(completed),
      ),
    );
  }

  groups.sort((a, b) {
    final kindCompare = _groupSortOrder(
      a.kind,
    ).compareTo(_groupSortOrder(b.kind));
    if (kindCompare != 0) {
      return kindCompare;
    }
    if (a.date != null && b.date != null) {
      return a.date!.compareTo(b.date!);
    }
    return 0;
  });

  return groups;
}

List<SupplierPickupScheduleItem> _sortByPickupStart(
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
