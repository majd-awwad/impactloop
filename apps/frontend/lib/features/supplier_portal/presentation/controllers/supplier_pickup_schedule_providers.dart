import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/supplier_pickup_schedule_item.dart';
import '../../data/models/supplier_incoming_request.dart';
import '../../data/pickup_schedule_filters.dart';
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

/// One bounded canonical query shared by the list, summary, retry, and refresh
/// consumers. Filter tabs are projections over this loaded response.
final pickupScheduleCanonicalProvider =
    FutureProvider.autoDispose<SupplierScheduleQueryResult>((ref) async {
      watchSupplierPortalSessionFromRef(ref);
      final repository = ref.read(supplierPickupScheduleRepositoryProvider);
      final raw = await repository.fetchPickupSchedule(
        SupplierPickupScheduleFilter.all,
      );
      return raw is SupplierScheduleQueryResult
          ? raw
          : SupplierScheduleQueryResult.fromLegacyItems(raw);
    });

final pickupScheduleProvider =
    FutureProvider.autoDispose<List<SupplierPickupScheduleItem>>((ref) async {
      final filter = ref.watch(pickupScheduleFilterProvider);
      final result = await ref.watch(pickupScheduleCanonicalProvider.future);
      return filterPickupScheduleItems(result, filter);
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
  final SupplierReservationSummary? serverSummary;
  final SupplierReservationPagination? pagination;
}

final pickupScheduleSummaryProvider =
    FutureProvider.autoDispose<PickupScheduleSummary>((ref) async {
      final result = await ref.watch(pickupScheduleCanonicalProvider.future);
      final items = result.toList(growable: false);
      final today = filterPickupScheduleItems(
        items,
        SupplierPickupScheduleFilter.today,
      );
      final upcoming = filterPickupScheduleItems(
        items,
        SupplierPickupScheduleFilter.upcoming,
      );
      final completed = filterPickupScheduleItems(
        items,
        SupplierPickupScheduleFilter.completed,
      );
      return PickupScheduleSummary(
        // These are explicitly compatibility counts over the bounded loaded
        // page. The authoritative server operational summary is retained.
        todayCount: today.length,
        upcomingCount: upcoming.length,
        completedCount: completed.length,
        serverSummary: result.summary,
        pagination: result.pagination,
      );
    });
