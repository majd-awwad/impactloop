import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/supplier_portal/data/models/supplier_incoming_request.dart';

void main() {
  test('SupplierIncomingRequest.fromJson parses reservation payload', () {
    final request = SupplierIncomingRequest.fromJson({
      'id': 'res-1',
      'status': 'PENDING',
      'quantityRequested': 2,
      'message': 'Need this for class.',
      'fulfillmentMethod': 'PICKUP',
      'fulfillmentLabel': 'Pickup selected',
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
    expect(request.fulfillmentSummary, 'Pickup selected');
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
      'fulfillmentMethod': 'PICKUP',
      'fulfillmentLabel': 'Delivery requested',
      'activeDelivery': {'id': 'del-1', 'status': 'DRIVER_ASSIGNED'},
      'canSupplierComplete': false,
      'createdAt': '2026-06-17T10:30:00.000Z',
      'material': {'title': 'Wood scraps', 'unit': 'kg'},
      'learner': {'displayName': 'Sara'},
    });

    expect(request.hasDelivery, isTrue);
    expect(request.activeDelivery?.id, 'del-1');
    expect(request.activeDelivery?.status, 'DRIVER_ASSIGNED');
    expect(request.deliveryStatusLabel, 'Driver assigned');
    expect(request.canSupplierComplete, isFalse);
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
        'fulfillmentMethod': 'PICKUP',
        'createdAt': '2026-06-17T10:30:00.000Z',
        'material': {'title': 'Cardboard', 'unit': 'box'},
        'learner': {'displayName': 'Omar'},
      });

      expect(request.hasDelivery, isFalse);
      expect(request.activeDelivery, isNull);
      expect(request.canSupplierComplete, isTrue);
    },
  );

  test('SupplierIncomingRequest.fromJson parses supplierHandoverCode', () {
    final request = SupplierIncomingRequest.fromJson({
      'id': 'res-delivery-code',
      'status': 'ACCEPTED',
      'fulfillmentMethod': 'DELIVERY',
      'quantityRequested': 1,
      'supplierHandoverCode': '654321',
      'activeDelivery': {'id': 'del-1', 'status': 'WAITING_FOR_DRIVER'},
      'createdAt': '2026-06-17T10:30:00.000Z',
      'material': {'title': 'Wood scraps', 'unit': 'kg'},
      'learner': {'displayName': 'Sara'},
    });

    expect(request.supplierHandoverCode, '654321');
    expect(request.shouldShowSupplierHandoverCode, isTrue);
  });

  test('SupplierIncomingRequest hides supplier handover code when delivered', () {
    final request = SupplierIncomingRequest.fromJson({
      'id': 'res-delivered',
      'status': 'ACCEPTED',
      'fulfillmentMethod': 'DELIVERY',
      'quantityRequested': 1,
      'supplierHandoverCode': '654321',
      'activeDelivery': {'id': 'del-1', 'status': 'DELIVERED'},
      'createdAt': '2026-06-17T10:30:00.000Z',
      'material': {'title': 'Wood scraps', 'unit': 'kg'},
      'learner': {'displayName': 'Sara'},
    });

    expect(request.shouldShowSupplierHandoverCode, isFalse);
  });

  test('SupplierIncomingRequestStatus maps EXPIRED separately from REJECTED', () {
    expect(
      SupplierIncomingRequestStatusLabels.fromApiValue('EXPIRED'),
      SupplierIncomingRequestStatus.expired,
    );
    expect(
      SupplierIncomingRequestStatusLabels.fromApiValue('REJECTED'),
      SupplierIncomingRequestStatus.declined,
    );
    expect(
      SupplierIncomingRequestStatus.expired.label,
      'Expired — no response',
    );
    expect(
      SupplierIncomingRequestStatus.declined.label,
      'Declined',
    );
  });

  test('SupplierIncomingRequest.fromJson maps EXPIRED status', () {
    final request = SupplierIncomingRequest.fromJson({
      'id': 'res-expired',
      'status': 'EXPIRED',
      'quantityRequested': 1,
      'fulfillmentMethod': 'PICKUP',
      'createdAt': '2026-06-17T10:30:00.000Z',
      'material': {'title': 'Wood scraps', 'unit': 'kg'},
      'learner': {'displayName': 'Sara'},
    });

    expect(request.status, SupplierIncomingRequestStatus.expired);
    expect(request.status, isNot(SupplierIncomingRequestStatus.declined));
  });

  test('SupplierIncomingRequestStatus maps awaiting confirmation', () {
    expect(
      SupplierIncomingRequestStatusLabels.fromApiValue(
        'AWAITING_LEARNER_CONFIRMATION',
      ),
      SupplierIncomingRequestStatus.awaitingConfirmation,
    );
  });

  test('SupplierIncomingRequest.fromJson parses fulfillment fields', () {
    final request = SupplierIncomingRequest.fromJson({
      'id': 'res-delivery',
      'status': 'PENDING',
      'quantityRequested': 1,
      'fulfillmentMethod': 'DELIVERY',
      'fulfillmentLabel': 'Delivery selected',
      'learnerPreferredDeliveryWindows': [
        {
          'start': '2026-07-10T14:00:00.000Z',
          'end': '2026-07-10T17:00:00.000Z',
        },
      ],
      'deliveryAddressText': '12 Main Street',
      'safeDropoffAllowed': true,
      'deliveryNote': 'Ring the bell',
      'createdAt': '2026-06-17T10:30:00.000Z',
      'material': {'title': 'Wood scraps', 'unit': 'kg'},
      'learner': {'displayName': 'Sara'},
    });

    expect(request.isDeliveryFulfillment, isTrue);
    expect(request.fulfillmentSummary, 'Delivery selected');
    expect(request.learnerPreferredDeliveryWindows, hasLength(1));
    expect(request.deliveryAddressText, '12 Main Street');
    expect(request.safeDropoffAllowed, isTrue);
    expect(request.reservationDeliveryNote, 'Ring the bell');
  });

  test('SupplierPickupWindow.toJson sends selected preferred window index', () {
    final window = SupplierPickupWindow(
      start: DateTime.parse('2026-07-10T14:00:00.000Z'),
      end: DateTime.parse('2026-07-10T16:00:00.000Z'),
      selectedPreferredWindowIndex: 0,
    );

    expect(window.toJson()['selectedPreferredWindowIndex'], 0);
  });

  test('SupplierIncomingRequest.fromJson parses learner reschedule proposal', () {
    final request = SupplierIncomingRequest.fromJson({
      'id': 'res-reschedule',
      'status': 'AWAITING_SUPPLIER_CONFIRMATION',
      'quantityRequested': 1,
      'createdAt': '2026-06-17T10:30:00.000Z',
      'material': {'title': 'Wood panels', 'unit': 'piece'},
      'learner': {'displayName': 'Ahmad'},
      'learnerProposedPickupWindowStart': '2026-07-12T08:00:00.000Z',
      'learnerProposedPickupWindowEnd': '2026-07-12T10:00:00.000Z',
      'pendingReschedule': {
        'requestedBy': 'LEARNER',
        'reason': 'Cannot make original time',
        'note': 'Can only come in the morning',
        'proposedPickupWindowStart': '2026-07-12T08:00:00.000Z',
        'proposedPickupWindowEnd': '2026-07-12T10:00:00.000Z',
      },
      'canSupplierAcceptLearnerReschedule': true,
    });

    expect(request.learnerProposedPickupWindow, isNotNull);
    expect(request.pendingRescheduleReason, 'Cannot make original time');
    expect(request.pendingRescheduleNote, 'Can only come in the morning');
    expect(request.canSupplierAcceptLearnerReschedule, isTrue);
  });

  test('SupplierIncomingRequest awaiting confirmation message variants', () {
    final proposed = SupplierIncomingRequest(
      id: 'res-awaiting',
      materialTitle: 'Item',
      learnerName: 'Learner',
      quantityRequested: 1,
      unit: 'piece',
      status: SupplierIncomingRequestStatus.awaitingConfirmation,
      requestedAt: DateTime.parse('2026-06-17T10:30:00.000Z'),
      supplierProposedPickupWindow: SupplierPickupWindow(
        start: DateTime.parse('2026-07-10T14:00:00.000Z'),
        end: DateTime.parse('2026-07-10T16:00:00.000Z'),
      ),
    );

    expect(
      proposed.awaitingConfirmationMessage,
      'Proposed pickup time — waiting for learner confirmation',
    );

    final conflict = SupplierIncomingRequest(
      id: proposed.id,
      materialTitle: proposed.materialTitle,
      learnerName: proposed.learnerName,
      quantityRequested: proposed.quantityRequested,
      unit: proposed.unit,
      status: proposed.status,
      requestedAt: proposed.requestedAt,
      schedulingConflictReason: 'No feasible delivery window',
    );

    expect(
      conflict.awaitingConfirmationMessage,
      'Scheduling conflict — waiting for learner confirmation',
    );
  });

  test('supplierActionStatusLabel shows new pickup window after admin reconfirm', () {
    final request = SupplierIncomingRequest.fromJson({
      'id': 'res-stale-pickup',
      'status': 'AWAITING_SUPPLIER_CONFIRMATION',
      'quantityRequested': 1,
      'fulfillmentMethod': 'DELIVERY',
      'canSubmitNoDriverPickupWindow': true,
      'pendingReschedule': {
        'requestedBy': 'SUPPLIER',
        'reason': 'STALE_PICKUP_ADMIN_REQUEST',
      },
      'activeDelivery': {'id': 'del-1', 'status': 'AWAITING_RESOLUTION'},
      'createdAt': '2026-06-17T10:30:00.000Z',
      'material': {'title': 'Panels', 'unit': 'piece'},
      'learner': {'displayName': 'Ahmad'},
    });

    expect(
      request.status,
      SupplierIncomingRequestStatus.awaitingSupplierConfirmation,
    );
    expect(request.supplierActionStatusLabel, 'New pickup window needed');
    expect(
      request.status.label,
      isNot('New pickup window needed'),
    );
  });

  test('supplierActionStatusLabel keeps needs resolution label before admin action', () {
    final request = SupplierIncomingRequest.fromJson({
      'id': 'res-awaiting-resolution',
      'status': 'AWAITING_RESOLUTION',
      'quantityRequested': 1,
      'fulfillmentMethod': 'DELIVERY',
      'canSubmitNoDriverPickupWindow': false,
      'activeDelivery': {'id': 'del-1', 'status': 'AWAITING_RESOLUTION'},
      'createdAt': '2026-06-17T10:30:00.000Z',
      'material': {'title': 'Panels', 'unit': 'piece'},
      'learner': {'displayName': 'Ahmad'},
    });

    expect(request.status, SupplierIncomingRequestStatus.needsResolution);
    expect(request.supplierActionStatusLabel, 'Pending admin review');
  });
}
