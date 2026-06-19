import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/supplier_portal/data/models/supplier_incoming_request.dart';
import 'package:frontend/features/supplier_portal/data/models/supplier_pickup_schedule_item.dart';
import 'package:frontend/features/supplier_portal/data/pickup_schedule_filters.dart';

void main() {
  test('fromReservationJson maps accepted reservation payload', () {
    final item = SupplierPickupScheduleItem.fromReservationJson({
      'id': 'res-accepted-1',
      'status': 'ACCEPTED',
      'quantityRequested': 1,
      'message': 'I need it for a robotics project.',
      'pickupType': 'SELF_PICKUP',
      'pickupWindowStart': '2026-06-17T10:00:00.000Z',
      'pickupWindowEnd': '2026-06-17T12:00:00.000Z',
      'supplierNote': 'Pickup near main gate.',
      'material': {
        'title': 'Arduino Uno',
        'unit': 'piece',
        'imageUrl': '/uploads/materials/test.jpg',
      },
      'learner': {
        'displayName': 'Ahmad',
      },
    });

    expect(item.id, 'res-accepted-1');
    expect(item.materialTitle, 'Arduino Uno');
    expect(item.learnerName, 'Ahmad');
    expect(item.status, SupplierPickupScheduleStatus.accepted);
    expect(item.pickupType, 'Self pickup');
    expect(item.supplierNote, 'Pickup near main gate.');
    expect(item.learnerMessage, 'I need it for a robotics project.');
    expect(item.materialImageUrl, '/uploads/materials/test.jpg');
    expect(item.pickupWindow, isNotNull);
  });

  test('fromReservationJson maps completed reservation payload', () {
    final item = SupplierPickupScheduleItem.fromReservationJson({
      'id': 'res-completed-1',
      'status': 'COMPLETED',
      'quantityRequested': 6,
      'pickupType': 'SELF_PICKUP',
      'pickupWindowStart': '2026-06-16T11:00:00.000Z',
      'pickupWindowEnd': '2026-06-16T13:00:00.000Z',
      'material': {
        'title': 'Cardboard boxes',
        'unit': 'boxes',
      },
      'learner': {
        'displayName': 'Lina',
      },
    });

    expect(item.status, SupplierPickupScheduleStatus.completed);
    expect(item.isCompleted, isTrue);
  });

  test('filterPickupScheduleItems separates today and upcoming', () {
    final today = pickupScheduleDateOnly(DateTime.now());
    final tomorrow = today.add(const Duration(days: 1));

    final items = [
      SupplierPickupScheduleItem(
        id: 'today',
        materialTitle: 'Today item',
        learnerName: 'A',
        quantity: 1,
        unit: 'piece',
        status: SupplierPickupScheduleStatus.accepted,
        pickupType: 'Self pickup',
        pickupWindow: SupplierPickupWindow(
          start: today.add(const Duration(hours: 10)),
          end: today.add(const Duration(hours: 12)),
        ),
      ),
      SupplierPickupScheduleItem(
        id: 'upcoming',
        materialTitle: 'Future item',
        learnerName: 'B',
        quantity: 1,
        unit: 'piece',
        status: SupplierPickupScheduleStatus.accepted,
        pickupType: 'Self pickup',
        pickupWindow: SupplierPickupWindow(
          start: tomorrow.add(const Duration(hours: 13)),
          end: tomorrow.add(const Duration(hours: 15)),
        ),
      ),
    ];

    expect(
      filterPickupScheduleItems(items, SupplierPickupScheduleFilter.today),
      hasLength(1),
    );
    expect(
      filterPickupScheduleItems(items, SupplierPickupScheduleFilter.upcoming),
      hasLength(1),
    );
  });
}
