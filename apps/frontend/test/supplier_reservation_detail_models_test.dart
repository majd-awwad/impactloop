import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/supplier_portal/data/models/supplier_incoming_request.dart';

void main() {
  test(
    'detail contract preserves canonical actions and conditional context',
    () {
      final detail = SupplierReservationDetail.fromJson({
        'id': 'reservation-1',
        'materialTitle': 'Servo motors',
        'learnerName': 'Learner',
        'quantityRequested': 2,
        'unit': 'pieces',
        'status': 'ACCEPTED',
        'requestedAt': '2026-07-12T18:22:00.000Z',
        'workflowPhase': 'DELIVERY',
        'attentionState': 'FULFILLMENT_IN_PROGRESS',
        'nextActor': 'DRIVER',
        'availableActions': ['REPORT_NO_DRIVER', 'SEND_MESSAGE'],
        'schedule': {
          'confirmedDeliveryWindow': {
            'start': '2026-07-13T10:00:00.000Z',
            'end': '2026-07-13T14:00:00.000Z',
          },
        },
        'delivery': {'deliveryId': 'delivery-1', 'status': 'DRIVER_ASSIGNED'},
        'group': {'groupId': 'group-1', 'itemCount': 2},
        'incident': {'id': 'incident-1', 'status': 'PENDING'},
      });

      expect(detail.reservation.availableActions.map((item) => item.value), [
        SupplierReservationAction.reportNoDriver,
        SupplierReservationAction.sendMessage,
      ]);
      expect(detail.schedule?.confirmedDeliveryWindow?.start, isNotNull);
      expect(detail.delivery?.deliveryId, 'delivery-1');
      expect(detail.group?.groupId, 'group-1');
      expect(detail.incident?.id, 'incident-1');
    },
  );

  test('unknown backend classifiers remain non-executable', () {
    final detail = SupplierReservationDetail.fromJson({
      'id': 'reservation-2',
      'materialTitle': 'Wire',
      'learnerName': 'Learner',
      'quantityRequested': 1,
      'unit': 'piece',
      'status': 'COMPLETED',
      'requestedAt': '2026-07-12T18:22:00.000Z',
      'workflowPhase': 'FUTURE_PHASE',
      'attentionState': 'FUTURE_ATTENTION',
      'availableActions': ['FUTURE_ACTION'],
    });

    expect(
      detail.reservation.workflowPhase?.value,
      SupplierWorkflowPhase.unknown,
    );
    expect(
      detail.reservation.attentionState?.value,
      SupplierAttentionState.unknown,
    );
    expect(detail.reservation.availableActions.single.isExecutable, isFalse);
  });
}
