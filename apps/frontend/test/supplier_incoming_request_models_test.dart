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

  test(
    'SupplierIncomingRequest hides supplier handover code when delivered',
    () {
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
    },
  );

  test(
    'SupplierIncomingRequestStatus maps EXPIRED separately from REJECTED',
    () {
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
      expect(SupplierIncomingRequestStatus.declined.label, 'Declined');
    },
  );

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

  test(
    'SupplierIncomingRequest.fromJson parses learner reschedule proposal',
    () {
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
    },
  );

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

  test(
    'supplierActionStatusLabel shows new pickup window after admin reconfirm',
    () {
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
      expect(request.status.label, isNot('New pickup window needed'));
    },
  );

  test(
    'supplierActionStatusLabel keeps needs resolution label before admin action',
    () {
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
    },
  );

  Map<String, dynamic> requestFixture({
    String id = 'res-contract',
    String status = 'PENDING',
    String fulfillmentMethod = 'PICKUP',
  }) => {
    'id': id,
    'status': status,
    'quantityRequested': 1,
    'fulfillmentMethod': fulfillmentMethod,
    'createdAt': '2026-07-10T10:00:00.000Z',
    'material': {'title': 'Panels', 'unit': 'piece'},
    'learner': {'displayName': 'Amina'},
  };

  test(
    'list response prefers items and preserves pagination and server summary',
    () {
      final response = SupplierReservationListResponse.fromData({
        'items': [requestFixture(id: 'new')],
        'reservations': [requestFixture(id: 'legacy')],
        'pagination': {'page': 2, 'limit': 10, 'total': 17, 'totalPages': 2},
        'summary': {
          'total': 17,
          'needsSupplierResponse': 2,
          'waitingForLearner': 3,
          'fulfillmentInProgress': 4,
          'adminReview': 1,
          'completed': 5,
          'closed': 2,
        },
      });

      expect(response.items.single.id, 'new');
      expect(response.items, hasLength(1));
      expect(response.usedLegacyReservations, isFalse);
      expect(response.pagination?.page, 2);
      expect(response.summary?.total, 17);
      expect(response.summary?.isReconciled, isTrue);
    },
  );

  test('legacy list response remains safe without fabricated pagination', () {
    final response = SupplierReservationListResponse.fromData({
      'reservations': [requestFixture(id: 'legacy')],
    });

    expect(response.items.single.id, 'legacy');
    expect(response.usedLegacyReservations, isTrue);
    expect(response.pagination, isNull);
    expect(response.summary, isNull);
  });

  test(
    'canonical server state, actions, and nested summaries are preserved',
    () {
      final request = SupplierIncomingRequest.fromJson({
        ...requestFixture(status: 'AWAITING_SUPPLIER_CONFIRMATION'),
        'workflowPhase': 'SCHEDULING',
        'attentionState': 'SUPPLIER_ACTION_REQUIRED',
        'nextActor': 'SUPPLIER',
        'summaryBucket': 'NEEDS_SUPPLIER_RESPONSE',
        'availableActions': ['ACCEPT_LEARNER_RESCHEDULE', 'FUTURE_ACTION'],
        'fulfillmentSummary': {
          'fulfillmentMethod': 'PICKUP',
          'pickupAllowed': true,
          'deliverySelected': false,
          'label': 'Pickup selected',
        },
        'scheduleSummary': {
          'activeWindowType': 'CONFIRMED_PICKUP',
          'effectiveWindowStart': '2026-07-11T10:00:00.000Z',
          'effectiveWindowEnd': '2026-07-11T12:00:00.000Z',
          'pendingReschedule': {
            'requestedBy': 'LEARNER',
            'reason': 'Cannot attend',
            'proposedPickupWindowStart': '2026-07-12T10:00:00.000Z',
            'proposedPickupWindowEnd': '2026-07-12T12:00:00.000Z',
          },
        },
        'message': 'Original note',
        'messageSummary': {
          'latestMessage': {
            'id': 'message-1',
            'senderRole': 'LEARNER',
            'senderId': 'learner-1',
            'body': 'Original note',
            'createdAt': '2026-07-10T12:00:00.000Z',
          },
          'messageCount': 2,
        },
      });

      expect(request.workflowPhase?.value, SupplierWorkflowPhase.scheduling);
      expect(
        request.attentionState?.value,
        SupplierAttentionState.supplierActionRequired,
      );
      expect(request.nextActor?.value, SupplierNextActor.supplier);
      expect(
        request.summaryBucket?.value,
        SupplierSummaryBucket.needsSupplierResponse,
      );
      expect(
        request.availableActions.first.value,
        SupplierReservationAction.acceptLearnerReschedule,
      );
      expect(request.availableActions.last.rawValue, 'FUTURE_ACTION');
      expect(request.availableActions.last.isExecutable, isFalse);
      expect(
        request.scheduleSummary?.pendingReschedule?.requestedBy.value,
        SupplierNextActor.learner,
      );
      expect(request.learnerNote, 'Original note');
      expect(request.messageSummary?.latestMessage?.id, 'message-1');
    },
  );

  test(
    'delivery, group, incident, and admin recovery contexts remain truthful',
    () {
      final request = SupplierIncomingRequest.fromJson({
        ...requestFixture(
          status: 'AWAITING_SUPPLIER_CONFIRMATION',
          fulfillmentMethod: 'DELIVERY',
        ),
        'scheduleSummary': {
          'recoveryContext': {
            'initiatedBy': 'ADMIN',
            'reason': 'NO_DRIVER_ADMIN_REQUEST',
          },
        },
        'deliverySummary': {
          'deliveryId': 'delivery-1',
          'status': 'AWAITING_RESOLUTION',
          'driver': {
            'id': 'driver-1',
            'userId': 'user-1',
            'displayName': 'Driver',
          },
          'recoveryRequired': true,
        },
        'groupSummary': {
          'groupId': 'group-1',
          'status': 'ASSIGNED',
          'grouped': true,
          'itemCount': 3,
        },
        'incidentSummary': {
          'id': 'report-1',
          'reasonCode': 'NO_DRIVER_AVAILABLE',
          'status': 'PENDING_REVIEW',
          'workflowType': 'NO_DRIVER',
          'operationalState': 'AWAITING_ADMIN',
        },
      });

      expect(
        request.scheduleSummary?.recoveryContext?.initiatedBy.value,
        SupplierNextActor.admin,
      );
      expect(request.deliverySummary?.deliveryId, 'delivery-1');
      expect(request.groupSummary?.grouped, isTrue);
      expect(request.groupSummary?.groupId, 'group-1');
      expect(request.groupSummary?.itemCount, 3);
      expect(request.incidentSummary?.reasonCode, 'NO_DRIVER_AVAILABLE');
    },
  );

  test(
    'unknown canonical enums and malformed optional windows do not throw',
    () {
      final request = SupplierIncomingRequest.fromJson({
        ...requestFixture(),
        'workflowPhase': 'FUTURE_PHASE',
        'attentionState': 'FUTURE_ATTENTION',
        'nextActor': 'FUTURE_ACTOR',
        'summaryBucket': 'FUTURE_BUCKET',
        'supplierPickupWindowStart': 'not-a-date',
        'supplierPickupWindowEnd': '2026-07-12T12:00:00.000Z',
      });

      expect(request.workflowPhase?.value, SupplierWorkflowPhase.unknown);
      expect(request.attentionState?.value, SupplierAttentionState.unknown);
      expect(request.nextActor?.value, SupplierNextActor.unknown);
      expect(request.summaryBucket?.value, SupplierSummaryBucket.unknown);
      expect(request.supplierPickupWindow, isNull);
    },
  );

  test('terminal status fixtures do not invent supplier actions', () {
    for (final status in const [
      'REJECTED',
      'CANCELLED',
      'EXPIRED',
      'NO_SHOW',
      'FULFILLMENT_FAILED',
      'COMPLETED',
    ]) {
      final request = SupplierIncomingRequest.fromJson({
        ...requestFixture(status: status),
        'availableActions': const [],
        'attentionState': 'TERMINAL',
      });
      expect(request.availableActions, isEmpty, reason: status);
      expect(request.attentionState?.value, SupplierAttentionState.terminal);
    }
  });

  test('detail response retains bounded messages and history', () {
    final detail = SupplierReservationDetail.fromJson({
      ...requestFixture(id: 'detail-1', fulfillmentMethod: 'DELIVERY'),
      'identity': {
        'reservationId': 'detail-1',
        'quantityRequested': 1,
        'createdAt': '2026-07-10T10:00:00.000Z',
        'updatedAt': '2026-07-11T10:00:00.000Z',
      },
      'request': {
        'originalLearnerNote': 'Original',
        'fulfillmentMethod': 'DELIVERY',
      },
      'schedule': {
        'supplierProposal': {
          'start': '2026-07-11T10:00:00.000Z',
          'end': '2026-07-11T12:00:00.000Z',
        },
        'confirmedDeliveryWindow': {
          'start': '2026-07-11T13:00:00.000Z',
          'end': '2026-07-11T15:00:00.000Z',
        },
      },
      'messages': {
        'count': 2,
        'truncated': false,
        'items': [
          {
            'id': 'message-2',
            'sender': {'id': 'supplier-1'},
            'body': 'Reply',
            'createdAt': '2026-07-11T10:00:00.000Z',
          },
        ],
      },
      'history': [
        {
          'id': 'history-1',
          'oldStatus': 'PENDING',
          'newStatus': 'ACCEPTED',
          'createdAt': '2026-07-11T10:00:00.000Z',
          'actor': {'id': 'supplier-1', 'displayName': 'Supplier'},
        },
      ],
      'delivery': {
        'deliveryId': 'delivery-detail',
        'status': 'WAITING_FOR_DRIVER',
      },
      'group': {'groupId': 'group-detail', 'grouped': true, 'itemCount': 2},
      'incident': {
        'id': 'incident-detail',
        'reasonCode': 'NO_DRIVER_AVAILABLE',
      },
    });

    expect(detail.identity?.reservationId, 'detail-1');
    expect(detail.request?.originalLearnerNote, 'Original');
    expect(detail.schedule?.supplierProposal?.start, isNotNull);
    expect(detail.schedule?.confirmedDeliveryWindow?.end, isNotNull);
    expect(detail.messages.single.id, 'message-2');
    expect(detail.messages.single.senderId, 'supplier-1');
    expect(detail.history.single.oldStatus, 'PENDING');
    expect(detail.delivery?.deliveryId, 'delivery-detail');
    expect(detail.group?.groupId, 'group-detail');
    expect(detail.incident?.id, 'incident-detail');
  });
}
