import 'models/supplier_incoming_request.dart';
import 'models/supplier_pickup_schedule_item.dart';
import 'pickup_schedule_filters.dart';
import 'supplier_pickup_schedule_repository.dart';

class MockSupplierPickupScheduleRepository
    extends SupplierPickupScheduleRepository {
  MockSupplierPickupScheduleRepository() : _items = List.of(_buildSeedItems());

  final List<SupplierPickupScheduleItem> _items;

  @override
  Future<List<SupplierPickupScheduleItem>> fetchPickupSchedule(
    SupplierPickupScheduleFilter filter,
  ) async {
    await Future<void>.delayed(const Duration(milliseconds: 320));
    return filterPickupScheduleItems(_items, filter);
  }

  static List<SupplierPickupScheduleItem> _buildSeedItems() {
    final now = DateTime.now();
    final today = pickupScheduleDateOnly(now);
    final tomorrow = today.add(const Duration(days: 1));
    final futureDate = today.add(const Duration(days: 5));
    final yesterday = today.subtract(const Duration(days: 1));

    return [
      SupplierPickupScheduleItem(
        id: 'sched-arduino-1',
        materialTitle: 'Arduino Uno',
        learnerName: 'Ahmad',
        quantity: 1,
        unit: 'piece',
        status: SupplierPickupScheduleStatus.accepted,
        pickupType: 'Self pickup',
        canSupplierComplete: true,
        pickupWindow: SupplierPickupWindow(
          start: today.add(const Duration(hours: 10)),
          end: today.add(const Duration(hours: 12)),
          note: 'Pickup near main gate.',
        ),
        learnerMessage: 'I need it for a robotics project.',
      ),
      SupplierPickupScheduleItem(
        id: 'sched-fabric-1',
        materialTitle: 'Cotton fabric scraps',
        materialImageUrl:
            'https://images.unsplash.com/photo-1558171813-4c088753af8f?auto=format&fit=crop&w=240&q=80',
        learnerName: 'Sara',
        quantity: 3,
        unit: 'kg',
        status: SupplierPickupScheduleStatus.accepted,
        pickupType: 'Self pickup',
        canSupplierComplete: true,
        pickupWindow: SupplierPickupWindow(
          start: tomorrow.add(const Duration(hours: 13)),
          end: tomorrow.add(const Duration(hours: 15)),
          note: 'Call when you arrive.',
        ),
      ),
      SupplierPickupScheduleItem(
        id: 'sched-wood-1',
        materialTitle: 'Wood scraps',
        learnerName: 'Omar',
        quantity: 5,
        unit: 'kg',
        status: SupplierPickupScheduleStatus.accepted,
        pickupType: 'Self pickup',
        canSupplierComplete: true,
        pickupWindow: SupplierPickupWindow(
          start: futureDate.add(const Duration(hours: 9)),
          end: futureDate.add(const Duration(hours: 11)),
        ),
      ),
      SupplierPickupScheduleItem(
        id: 'sched-cardboard-1',
        materialTitle: 'Cardboard boxes',
        learnerName: 'Lina',
        quantity: 6,
        unit: 'boxes',
        status: SupplierPickupScheduleStatus.completed,
        pickupType: 'Self pickup',
        completedAt: yesterday.add(const Duration(hours: 14)),
        pickupWindow: SupplierPickupWindow(
          start: yesterday.add(const Duration(hours: 11)),
          end: yesterday.add(const Duration(hours: 13)),
        ),
      ),
    ];
  }
}
