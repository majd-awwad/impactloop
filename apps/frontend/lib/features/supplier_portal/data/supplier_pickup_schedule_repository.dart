import 'models/supplier_pickup_schedule_item.dart';

/// API-ready contract for supplier pickup schedule.
abstract class SupplierPickupScheduleRepository {
  Future<SupplierSchedulePage> fetchSchedule(SupplierScheduleQuery query) async {
    // ignore: deprecated_member_use_from_same_package
    final items = await fetchPickupSchedule(query.filter);
    return SupplierSchedulePage(
      items: const [],
      pagination: SupplierScheduleApiPagination(
        page: query.page,
        limit: query.limit,
        total: items.length,
        totalPages: items.isEmpty ? 0 : 1,
      ),
      summary: SupplierScheduleApiSummary(
        total: items.length,
        unscheduledAction: 0,
        adminReview: 0,
        overdue: 0,
        inProgress: 0,
        today: 0,
        upcoming: 0,
        completed: items.where((item) => item.isCompleted).length,
        closed: 0,
        needsAttention: 0,
      ),
      legacyCompatibilityItems: List.unmodifiable(items),
    );
  }

  /// Legacy mock/test seam. Pickup Schedule production state uses
  /// [fetchSchedule] exclusively.
  @Deprecated('Use fetchSchedule with SupplierScheduleQuery.')
  Future<List<SupplierPickupScheduleItem>> fetchPickupSchedule(
    SupplierPickupScheduleFilter filter,
  ) async {
    final page = await fetchSchedule(SupplierScheduleQuery.forFilter(filter));
    return page.compatibilityItems;
  }
}
