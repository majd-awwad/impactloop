import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import 'models/supplier_pickup_schedule_item.dart';
import 'pickup_schedule_filters.dart';
import 'supplier_pickup_schedule_api.dart';
import 'supplier_pickup_schedule_repository.dart';

final supplierPickupScheduleApiProvider = Provider<SupplierPickupScheduleApi>((
  ref,
) {
  return SupplierPickupScheduleApi(ref.watch(apiClientProvider));
});

final supplierPickupScheduleRepositoryProvider =
    Provider<SupplierPickupScheduleRepository>((ref) {
      return ApiSupplierPickupScheduleRepository(
        ref.watch(supplierPickupScheduleApiProvider),
      );
    });

class ApiSupplierPickupScheduleRepository
    implements SupplierPickupScheduleRepository {
  const ApiSupplierPickupScheduleRepository(this._api);

  final SupplierPickupScheduleApi _api;

  @override
  Future<List<SupplierPickupScheduleItem>> fetchPickupSchedule(
    SupplierPickupScheduleFilter filter,
  ) async {
    switch (filter) {
      case SupplierPickupScheduleFilter.today:
      case SupplierPickupScheduleFilter.upcoming:
        final accepted = await _api.fetchAcceptedReservations();
        return filterPickupScheduleItems(accepted, filter);
      case SupplierPickupScheduleFilter.completed:
        final completed = await _api.fetchCompletedReservations();
        return filterPickupScheduleItems(completed, filter);
      case SupplierPickupScheduleFilter.all:
        final results = await Future.wait([
          _api.fetchAcceptedReservations(),
          _api.fetchCompletedReservations(),
        ]);
        final merged = [...results[0], ...results[1]];
        return filterPickupScheduleItems(merged, filter);
    }
  }
}
