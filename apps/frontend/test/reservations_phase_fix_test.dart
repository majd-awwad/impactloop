import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/supplier_portal/data/models/supplier_incoming_request.dart';

void main() {
  test('supplier Accepted tab query excludes awaiting confirmation', () {
    expect(SupplierIncomingRequestTab.accepted.apiQueryValue, 'accepted');
    expect(SupplierIncomingRequestTab.needsLearner.apiQueryValue, 'needs_learner');
  });

  test('supplier delivery WAITING_FOR_DRIVER label', () {
    const summary = SupplierReservationDeliverySummary(
      id: 'del-1',
      status: 'WAITING_FOR_DRIVER',
    );

    expect(summary.statusLabel, 'Waiting for driver');
  });

  test('SupplierPickupWindow sends selected learner preferred delivery window', () {
    final payload = SupplierPickupWindow(
      start: DateTime.utc(2026, 6, 9, 8),
      end: DateTime.utc(2026, 6, 9, 9),
      selectedPreferredWindowIndex: 0,
    ).toJson();

    expect(payload['selectedPreferredWindowIndex'], 0);
    expect(payload.containsKey('proposedDeliveryWindowStart'), isFalse);
  });

  test('SupplierPickupWindow sends custom proposed delivery window', () {
    final proposedStart = DateTime.utc(2026, 6, 12, 12);
    final proposedEnd = DateTime.utc(2026, 6, 12, 14);

    final payload = SupplierPickupWindow(
      start: DateTime.utc(2026, 6, 9, 8),
      end: DateTime.utc(2026, 6, 9, 9),
      proposedDeliveryWindowStart: proposedStart,
      proposedDeliveryWindowEnd: proposedEnd,
    ).toJson();

    expect(payload['proposedDeliveryWindowStart'], proposedStart.toIso8601String());
    expect(payload['proposedDeliveryWindowEnd'], proposedEnd.toIso8601String());
  });

  test('supplier awaiting confirmation status label', () {
    expect(
      SupplierIncomingRequestStatus.awaitingConfirmation.label,
      'Waiting for learner confirmation',
    );
  });
}
