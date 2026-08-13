import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/driver_portal/data/models/driver_delivery.dart';
import 'package:frontend/features/driver_portal/data/models/driver_delivery_failure_request.dart';

Map<String, dynamic> deliveryJson(String status) => {
  'id': 'delivery-1',
  'reservationId': 'reservation-1',
  'status': status,
  'requestedAt': '2026-08-13T08:00:00.000Z',
  'material': const <String, dynamic>{},
  'supplier': const <String, dynamic>{},
  'pickupLocation': const <String, dynamic>{},
  'dropoffLocation': const <String, dynamic>{},
};

void main() {
  test('picked-up delivery locally requires a window before on-the-way', () {
    final withoutWindow = DriverDelivery.fromJson(deliveryJson('PICKED_UP'));
    expect(withoutWindow.nextStatus, isNull);

    final withWindow = DriverDelivery.fromJson({
      ...deliveryJson('PICKED_UP'),
      'confirmedDeliveryWindowStart': '2026-08-14T08:00:00.000Z',
      'confirmedDeliveryWindowEnd': '2026-08-14T09:00:00.000Z',
    });
    expect(withWindow.nextStatus, 'ON_THE_WAY');
  });

  test(
    'retry projection preserves learner context, attempt evidence, and deadline',
    () {
      final delivery = DriverDelivery.fromJson({
        ...deliveryJson('REDELIVERY_PENDING'),
        'learner': {'displayName': 'Learner', 'phone': '+970599000000'},
        'learnerPreferredDeliveryWindows': [
          {
            'start': '2026-08-14T08:00:00.000Z',
            'end': '2026-08-14T09:00:00.000Z',
          },
        ],
        'retryDeadline': '2026-08-15T10:00:00.000Z',
        'deliveryAttempts': [
          {
            'attemptNumber': 1,
            'attemptedAt': '2026-08-13T10:00:00.000Z',
            'failureReason': 'LEARNER_UNREACHABLE',
            'learnerContactAttempted': true,
            'outcome': 'FAILED_RETRYABLE',
            'retryDeadline': '2026-08-15T10:00:00.000Z',
          },
        ],
      });

      expect(delivery.nextStatus, isNull);
      expect(delivery.learner?.phone, '+970599000000');
      expect(delivery.learnerPreferredDeliveryWindows, hasLength(1));
      expect(delivery.deliveryAttempts.single.learnerContactAttempted, isTrue);
      expect(delivery.retryDeadline, isNotNull);
      expect(delivery.isAutoPingEligible, isTrue);
    },
  );

  test('scheduled redelivery starts the same delivery row on the way', () {
    final delivery = DriverDelivery.fromJson(
      deliveryJson('REDELIVERY_SCHEDULED'),
    );
    expect(delivery.id, 'delivery-1');
    expect(delivery.nextStatus, 'ON_THE_WAY');
  });

  test(
    'failure payload includes contact evidence and optional immediate window',
    () {
      final request = DriverDeliveryFailureRequest(
        reason: 'LEARNER_REQUESTED_RESCHEDULE',
        learnerContactAttempted: true,
        note: 'Learner requested tomorrow.',
        retryWindowStart: DateTime.utc(2026, 8, 14, 8),
        retryWindowEnd: DateTime.utc(2026, 8, 14, 9),
      ).toJson();

      expect(request['learnerContactAttempted'], isTrue);
      expect(request['retryWindowStart'], '2026-08-14T08:00:00.000Z');
      expect(request['retryWindowEnd'], '2026-08-14T09:00:00.000Z');
    },
  );
}
