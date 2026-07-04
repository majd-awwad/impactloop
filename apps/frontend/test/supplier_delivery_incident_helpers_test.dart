import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/supplier_portal/data/models/supplier_incoming_request.dart';

void main() {
  test('delivery incident flags parse from API JSON', () {
    final request = SupplierIncomingRequest.fromJson({
      'id': 'res-1',
      'status': 'ACCEPTED',
      'fulfillmentMethod': 'DELIVERY',
      'quantityRequested': 1,
      'createdAt': '2026-01-01T00:00:00.000Z',
      'canReportNoDriverAvailable': true,
      'canSupplierReportDriverNoShow': true,
      'activeDelivery': {'id': 'del-1', 'status': 'DRIVER_ASSIGNED'},
      'material': {'title': 'Panels'},
      'learner': {'displayName': 'Learner'},
    });

    expect(request.canReportNoDriverAvailable, isTrue);
    expect(request.canSupplierReportDriverNoShow, isTrue);
    expect(request.isDeliveryFulfillment, isTrue);
  });

  test('needsResolution status uses friendly label', () {
    expect(
      SupplierIncomingRequestStatus.needsResolution.label,
      'Pending admin review',
    );
  });

  test('read-only final state when awaiting admin review', () {
    final request = SupplierIncomingRequest.fromJson({
      'id': 'res-2',
      'status': 'AWAITING_RESOLUTION',
      'quantityRequested': 1,
      'createdAt': '2026-01-01T00:00:00.000Z',
      'material': {'title': 'Panels'},
      'learner': {'displayName': 'Learner'},
    });

    expect(request.isReadOnlyFinalState, isTrue);
  });
}
