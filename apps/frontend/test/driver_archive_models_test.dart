import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/driver_portal/data/models/driver_archive.dart';

void main() {
  test('historical delivery parses carried, unpicked, and timeline evidence', () {
    final delivery = DriverHistoricalDelivery.fromJson(
      _deliveryJson(unpickedReason: 'MATERIAL_MISSING'),
    );

    expect(delivery.carriedItems.single.materialTitle, 'Wood');
    expect(delivery.unpickedItems.single.materialTitle, 'Metal');
    expect(delivery.unpickedItems.single.driverNote, 'Driver note');
    expect(delivery.partialPickupOccurred, isTrue);
    expect(delivery.timeline.single.status, 'PICKED_UP');
    expect(delivery.pickupLocation.latitude, isNull);
  });

  for (final reason in const [
    'MATERIAL_NOT_READY',
    'MATERIAL_MISSING',
    'WRONG_ITEM',
    'QUANTITY_MISMATCH',
    'DAMAGED_ITEM',
    'SUPPLIER_REFUSED_HANDOVER',
    'OTHER',
  ]) {
    test('Flutter contract preserves partial-pickup reason $reason', () {
      final delivery = DriverHistoricalDelivery.fromJson(
        _deliveryJson(unpickedReason: reason),
      );
      expect(delivery.unpickedItems.single.unpickedReason, reason);
    });
  }

  test('missing itemAuditComplete is incomplete, never fabricated true', () {
    final json = _deliveryJson(unpickedReason: 'OTHER')
      ..remove('itemAuditComplete');
    expect(
      DriverHistoricalDelivery.fromJson(json).itemAuditComplete,
      isFalse,
    );
  });

  test('missing or malformed required historical timestamp is controlled', () {
    final missing = _deliveryJson(unpickedReason: 'OTHER')
      ..remove('historicalAt');
    final malformed = _deliveryJson(unpickedReason: 'OTHER')
      ..['historicalAt'] = 'not-a-date';
    expect(
      () => DriverHistoricalDelivery.fromJson(missing),
      throwsA(isA<FormatException>()),
    );
    expect(
      () => DriverHistoricalDelivery.fromJson(malformed),
      throwsA(isA<FormatException>()),
    );
  });

  test('malformed required incident and timeline timestamps are controlled', () {
    expect(
      () => DriverIncident.fromJson({
        'id': 'report-1',
        'createdAt': 'bad',
      }),
      throwsA(isA<FormatException>()),
    );
    final malformedTimeline = _deliveryJson(unpickedReason: 'OTHER');
    malformedTimeline['statusTimeline'] = [
      {'newStatus': 'PICKED_UP'},
    ];
    expect(
      () => DriverHistoricalDelivery.fromJson(malformedTimeline),
      throwsA(isA<FormatException>()),
    );
  });

  test('incident parses only authorized Delivery link objects', () {
    final incident = DriverIncident.fromJson({
      'id': 'report-1',
      'type': 'PICKUP_FAILED',
      'reviewStatus': 'PENDING_REVIEW',
      'createdAt': '2026-08-02T09:00:00.000Z',
      'resolutionOutcome': 'SUPPLIER_RESCHEDULE_REQUESTED',
      'reporterNote': 'Material was missing',
      'reservation': {
        'material': {'title': 'Wood'},
      },
      'relatedDelivery': {'id': 'delivery-1', 'isHistorical': true},
      'recoveryDelivery': {'id': 'delivery-2', 'isHistorical': true},
      'recoveryDeliveryId': 'must-not-be-read',
      'recoveryDeliveryGroupId': 'must-not-be-read',
      'reviewNote': 'must never be parsed',
    });

    expect(incident.reporterNote, 'Material was missing');
    expect(incident.relatedDeliveryId, 'delivery-1');
    expect(incident.recoveryDeliveryId, 'delivery-2');
  });
}

Map<String, dynamic> _deliveryJson({required String unpickedReason}) => {
  'id': 'delivery-1',
  'status': 'DELIVERED',
  'historicalAt': '2026-08-02T09:00:00.000Z',
  'assignmentOutcome': 'CLOSED',
  'supplier': {'displayName': 'Supplier'},
  'pickupLocation': {'city': 'Hebron', 'area': 'North'},
  'dropoffLocation': {'city': 'Hebron', 'area': 'South'},
  'carriedItems': [
    {
      'reservationId': 'reservation-1',
      'materialId': 'material-1',
      'materialTitle': 'Wood',
      'quantity': 2,
      'unit': 'kg',
      'recordedAt': '2026-08-02T08:00:00.000Z',
    },
  ],
  'unpickedItems': [
    {
      'reservationId': 'reservation-2',
      'materialId': 'material-2',
      'materialTitle': 'Metal',
      'quantity': 1,
      'unit': 'kg',
      'unpickedReason': unpickedReason,
      'driverNote': 'Driver note',
      'recordedAt': '2026-08-02T08:00:00.000Z',
    },
  ],
  'partialPickupOccurred': true,
  'itemAuditComplete': true,
  'statusTimeline': [
    {'newStatus': 'PICKED_UP', 'occurredAt': '2026-08-02T08:00:00.000Z'},
  ],
};
