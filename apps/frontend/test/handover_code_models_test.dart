import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/deliveries/data/models/learner_delivery.dart';
import 'package:frontend/features/driver_portal/data/models/update_driver_delivery_status_request.dart';

void main() {
  test('LearnerDelivery parses learnerDeliveryCode', () {
    final delivery = LearnerDelivery.fromJson({
      'id': 'del-1',
      'reservationId': 'res-1',
      'status': 'ON_THE_WAY',
      'requestedAt': '2026-01-01T00:00:00.000Z',
      'learnerDeliveryCode': '112233',
      'reservation': {
        'id': 'res-1',
        'status': 'ACCEPTED',
        'material': {'id': 'mat-1', 'title': 'Wood', 'status': 'AVAILABLE'},
        'supplier': {'id': 'sup-1', 'displayName': 'Supplier'},
      },
      'pickupLocation': {'id': 'loc-1', 'country': 'JO', 'city': 'Amman'},
      'dropoffLocation': {'id': 'loc-2', 'country': 'JO', 'city': 'Amman'},
    });

    expect(delivery.learnerDeliveryCode, '112233');
    expect(delivery.shouldShowLearnerDeliveryCode, isTrue);
  });

  test('LearnerDelivery hides delivery code for terminal status', () {
    final delivery = LearnerDelivery.fromJson({
      'id': 'del-1',
      'reservationId': 'res-1',
      'status': 'DELIVERED',
      'requestedAt': '2026-01-01T00:00:00.000Z',
      'learnerDeliveryCode': '112233',
      'reservation': {
        'id': 'res-1',
        'status': 'COMPLETED',
        'material': {'id': 'mat-1', 'title': 'Wood', 'status': 'REUSED'},
        'supplier': {'id': 'sup-1', 'displayName': 'Supplier'},
      },
      'pickupLocation': {'id': 'loc-1', 'country': 'JO', 'city': 'Amman'},
      'dropoffLocation': {'id': 'loc-2', 'country': 'JO', 'city': 'Amman'},
    });

    expect(delivery.shouldShowLearnerDeliveryCode, isFalse);
  });

  test('UpdateDriverDeliveryStatusRequest sends confirmationCode', () {
    const pickedUp = UpdateDriverDeliveryStatusRequest(
      status: 'PICKED_UP',
      confirmationCode: '123456',
    );
    const delivered = UpdateDriverDeliveryStatusRequest(
      status: 'DELIVERED',
      confirmationCode: '654321',
    );

    expect(pickedUp.toJson(), {
      'status': 'PICKED_UP',
      'confirmationCode': '123456',
      'cashReceivedConfirmed': false,
    });
    expect(delivered.toJson(), {
      'status': 'DELIVERED',
      'confirmationCode': '654321',
      'cashReceivedConfirmed': false,
    });
  });

  test('UpdateDriverDeliveryStatusRequest omits empty confirmationCode', () {
    const request = UpdateDriverDeliveryStatusRequest(status: 'ARRIVED_PICKUP');

    expect(request.toJson(), {
      'status': 'ARRIVED_PICKUP',
      'cashReceivedConfirmed': false,
    });
  });
}
