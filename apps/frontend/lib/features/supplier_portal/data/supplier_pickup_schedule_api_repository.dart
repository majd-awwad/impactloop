import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'models/supplier_pickup_schedule_item.dart';
import 'supplier_pickup_schedule_api.dart';
import 'supplier_requests_api_repository.dart';
import 'supplier_pickup_schedule_repository.dart';

final supplierPickupScheduleApiProvider = Provider<SupplierPickupScheduleApi>((
  ref,
) {
  return SupplierPickupScheduleApi(ref.watch(supplierRequestsApiProvider));
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
    // The legacy repository interface returns a List for the existing page.
    // This immutable ListBase also carries pagination and the server summary;
    // the provider reads those fields without issuing another request.
    return projectSupplierReservations(await _api.fetchReservations());
  }
}
