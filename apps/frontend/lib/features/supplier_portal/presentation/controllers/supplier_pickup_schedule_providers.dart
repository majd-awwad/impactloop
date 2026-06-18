import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/supplier_pickup_schedule_item.dart';
import '../../data/supplier_pickup_schedule_api_repository.dart';

export '../../data/supplier_pickup_schedule_api_repository.dart'
    show supplierPickupScheduleRepositoryProvider;

class PickupScheduleFilterNotifier
    extends Notifier<SupplierPickupScheduleFilter> {
  @override
  SupplierPickupScheduleFilter build() =>
      SupplierPickupScheduleFilter.today;

  void selectFilter(SupplierPickupScheduleFilter filter) {
    state = filter;
  }
}

final pickupScheduleFilterProvider = NotifierProvider<
    PickupScheduleFilterNotifier, SupplierPickupScheduleFilter>(
  PickupScheduleFilterNotifier.new,
);

final pickupScheduleProvider =
    FutureProvider.autoDispose<List<SupplierPickupScheduleItem>>((ref) async {
  final filter = ref.watch(pickupScheduleFilterProvider);
  return ref
      .read(supplierPickupScheduleRepositoryProvider)
      .fetchPickupSchedule(filter);
});

class PickupScheduleSummary {
  const PickupScheduleSummary({
    required this.todayCount,
    required this.upcomingCount,
    required this.completedCount,
  });

  final int todayCount;
  final int upcomingCount;
  final int completedCount;
}

final pickupScheduleSummaryProvider =
    FutureProvider.autoDispose<PickupScheduleSummary>((ref) async {
  final repository = ref.read(supplierPickupScheduleRepositoryProvider);
  final results = await Future.wait([
    repository.fetchPickupSchedule(SupplierPickupScheduleFilter.today),
    repository.fetchPickupSchedule(SupplierPickupScheduleFilter.upcoming),
    repository.fetchPickupSchedule(SupplierPickupScheduleFilter.completed),
  ]);

  return PickupScheduleSummary(
    todayCount: results[0].length,
    upcomingCount: results[1].length,
    completedCount: results[2].length,
  );
});
