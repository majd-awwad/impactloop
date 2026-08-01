import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/supplier_pickup_schedule_item.dart';
import '../../data/supplier_pickup_schedule_api_repository.dart';
import '../../application/supplier_portal_session.dart';

export '../../data/supplier_pickup_schedule_api_repository.dart'
    show supplierPickupScheduleRepositoryProvider;

class PickupScheduleFilterNotifier
    extends Notifier<SupplierPickupScheduleFilter> {
  @override
  SupplierPickupScheduleFilter build() => SupplierPickupScheduleFilter.today;

  void selectFilter(SupplierPickupScheduleFilter filter) {
    state = filter;
  }
}

final pickupScheduleFilterProvider =
    NotifierProvider<
      PickupScheduleFilterNotifier,
      SupplierPickupScheduleFilter
    >(PickupScheduleFilterNotifier.new);

final pickupSchedulePageProvider = FutureProvider.autoDispose
    .family<SupplierSchedulePage, SupplierScheduleQuery>((ref, query) async {
      watchSupplierPortalSessionFromRef(ref);
      final repository = ref.read(supplierPickupScheduleRepositoryProvider);
      return repository.fetchSchedule(query);
    });

/// One canonical server query shared by the list, summary, retry, and refresh
/// consumers. The selected filter changes the backend query; it is not a
/// local projection over a general reservation-list response.
final pickupScheduleCanonicalProvider =
    FutureProvider.autoDispose<SupplierSchedulePage>((ref) async {
      final filter = ref.watch(pickupScheduleFilterProvider);
      final query = SupplierScheduleQuery.forFilter(filter);
      return ref.watch(pickupSchedulePageProvider(query).future);
    });

final pickupScheduleProvider =
    FutureProvider.autoDispose<List<SupplierPickupScheduleItem>>((ref) async {
      final result = await ref.watch(pickupScheduleCanonicalProvider.future);
      return result.compatibilityItems;
    });

class PickupScheduleSummary {
  const PickupScheduleSummary({
    required this.todayCount,
    required this.upcomingCount,
    required this.completedCount,
    this.serverSummary,
    this.pagination,
  });

  final int todayCount;
  final int upcomingCount;
  final int completedCount;
  final SupplierScheduleApiSummary? serverSummary;
  final SupplierScheduleApiPagination? pagination;
}

final pickupScheduleSummaryProvider =
    FutureProvider.autoDispose<PickupScheduleSummary>((ref) async {
      final result = await ref.watch(pickupScheduleCanonicalProvider.future);
      return PickupScheduleSummary(
        todayCount: result.summary.today,
        upcomingCount: result.summary.upcoming,
        completedCount: result.summary.completed,
        serverSummary: result.summary,
        pagination: result.pagination,
      );
    });
