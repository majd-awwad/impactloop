import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import 'models/supplier_pickup_schedule_item.dart';
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
    extends SupplierPickupScheduleRepository {
  ApiSupplierPickupScheduleRepository(this._api);

  final SupplierPickupScheduleApi _api;

  @override
  Future<SupplierSchedulePage> fetchSchedule(
    SupplierScheduleQuery query,
  ) {
    return _api.fetchSchedule(query);
  }
}
