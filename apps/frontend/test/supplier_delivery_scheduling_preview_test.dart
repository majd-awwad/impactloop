import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/reservations/data/models/reservation_preferred_window.dart';
import 'package:frontend/features/supplier_portal/application/supplier_delivery_scheduling_preview.dart';

void main() {
  test('previewSupplierDeliveryScheduling trims partial overlap', () {
    final supplierPickupEnd = DateTime.parse('2026-07-10T16:00:00.000Z');
    final preview = previewSupplierDeliveryScheduling(
      supplierPickupWindowEnd: supplierPickupEnd,
      learnerDeliveryWindows: [
        ReservationPreferredWindow(
          start: DateTime.parse('2026-07-10T15:00:00.000Z'),
          end: DateTime.parse('2026-07-10T20:00:00.000Z'),
        ),
      ],
    );

    expect(preview, isNotNull);
    expect(preview!.isFeasible, isTrue);
    expect(
      preview.earliestDeliveryStart,
      DateTime.parse('2026-07-10T17:00:00.000Z'),
    );
    expect(preview.confirmedStart, DateTime.parse('2026-07-10T17:00:00.000Z'));
    expect(preview.confirmedEnd, DateTime.parse('2026-07-10T20:00:00.000Z'));
  });

  test('previewSupplierDeliveryScheduling returns infeasible preview', () {
    final supplierPickupEnd = DateTime.parse('2026-07-10T16:00:00.000Z');
    final preview = previewSupplierDeliveryScheduling(
      supplierPickupWindowEnd: supplierPickupEnd,
      learnerDeliveryWindows: [
        ReservationPreferredWindow(
          start: DateTime.parse('2026-07-10T12:00:00.000Z'),
          end: DateTime.parse('2026-07-10T16:30:00.000Z'),
        ),
      ],
    );

    expect(preview, isNotNull);
    expect(preview!.isFeasible, isFalse);
  });
}
