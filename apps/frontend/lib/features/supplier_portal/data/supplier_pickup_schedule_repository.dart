import 'models/supplier_pickup_schedule_item.dart';

/// API-ready contract for supplier pickup schedule.
abstract class SupplierPickupScheduleRepository {
  Future<List<SupplierPickupScheduleItem>> fetchPickupSchedule(
    SupplierPickupScheduleFilter filter,
  );
}
