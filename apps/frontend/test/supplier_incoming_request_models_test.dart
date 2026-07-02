import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/supplier_portal/data/models/supplier_incoming_request.dart';

void main() {
  test('SupplierIncomingRequest.fromJson parses reservation payload', () {
    final request = SupplierIncomingRequest.fromJson({
      'id': 'res-1',
      'status': 'PENDING',
      'quantityRequested': 2,
      'message': 'Need this for class.',
      'pickupType': 'SELF_PICKUP',
      'deliveryRequested': false,
      'createdAt': '2026-06-17T10:30:00.000Z',
      'material': {
        'title': 'Arduino Uno',
        'unit': 'piece',
        'images': [
          {'url': '/uploads/materials/test.jpg'},
        ],
      },
      'requester': {'displayName': 'Ahmad'},
      'learner': {'displayName': 'Ahmad'},
      'rejectionReason': 'Unavailable',
    });

    expect(request.id, 'res-1');
    expect(request.materialTitle, 'Arduino Uno');
    expect(request.learnerName, 'Ahmad');
    expect(request.status, SupplierIncomingRequestStatus.pending);
    expect(request.pickupPreference, 'Self pickup');
    expect(request.deliveryRequested, isFalse);
    expect(request.activeDelivery, isNull);
    expect(request.canSupplierComplete, isFalse);
    expect(request.learnerNote, 'Need this for class.');
    expect(request.materialImageUrl, '/uploads/materials/test.jpg');
    expect(request.declineReason, 'Unavailable');
  });

  test('SupplierIncomingRequest.fromJson parses delivery summary fields', () {
    final request = SupplierIncomingRequest.fromJson({
      'id': 'res-2',
      'status': 'ACCEPTED',
      'quantityRequested': 1,
      'deliveryRequested': true,
      'activeDelivery': {'id': 'del-1', 'status': 'DRIVER_ASSIGNED'},
      'canSupplierComplete': false,
      'createdAt': '2026-06-17T10:30:00.000Z',
      'material': {'title': 'Wood scraps', 'unit': 'kg'},
      'learner': {'displayName': 'Sara'},
    });

    expect(request.deliveryRequested, isTrue);
    expect(request.activeDelivery?.id, 'del-1');
    expect(request.activeDelivery?.status, 'DRIVER_ASSIGNED');
    expect(request.deliveryStatusLabel, 'Driver assigned');
    expect(request.canSupplierComplete, isFalse);
    expect(request.hasDelivery, isTrue);
  });

  test(
    'SupplierReservationDeliverySummary labels terminal delivery statuses',
    () {
      expect(
        const SupplierReservationDeliverySummary(
          id: 'del-cancelled',
          status: 'CANCELLED',
        ).statusLabel,
        'Delivery cancelled',
      );
      expect(
        const SupplierReservationDeliverySummary(
          id: 'del-failed',
          status: 'FAILED_DELIVERY',
        ).statusLabel,
        'Delivery failed',
      );
    },
  );

  test(
    'SupplierIncomingRequest.fromJson keeps old accepted pickup completable',
    () {
      final request = SupplierIncomingRequest.fromJson({
        'id': 'res-3',
        'status': 'ACCEPTED',
        'quantityRequested': 1,
        'createdAt': '2026-06-17T10:30:00.000Z',
        'material': {'title': 'Cardboard', 'unit': 'box'},
        'learner': {'displayName': 'Omar'},
      });

      expect(request.deliveryRequested, isFalse);
      expect(request.activeDelivery, isNull);
      expect(request.canSupplierComplete, isTrue);
    },
  );

  test('SupplierIncomingRequestStatus maps backend rejected status', () {
    expect(
      SupplierIncomingRequestStatusLabels.fromApiValue('REJECTED'),
      SupplierIncomingRequestStatus.declined,
    );
  });
}
