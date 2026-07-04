import '../../reservations/data/models/reservation_preferred_window.dart';

const supplierDeliveryBufferMinutes = 60;

class SupplierDeliverySchedulingPreview {
  const SupplierDeliverySchedulingPreview({
    required this.earliestDeliveryStart,
    this.confirmedStart,
    this.confirmedEnd,
  });

  final DateTime earliestDeliveryStart;
  final DateTime? confirmedStart;
  final DateTime? confirmedEnd;

  bool get isFeasible => confirmedStart != null && confirmedEnd != null;
}

SupplierDeliverySchedulingPreview? previewSupplierDeliveryScheduling({
  required DateTime supplierPickupWindowEnd,
  required List<ReservationPreferredWindow> learnerDeliveryWindows,
}) {
  if (learnerDeliveryWindows.isEmpty) {
    return null;
  }

  final earliestDeliveryStart = supplierPickupWindowEnd.add(
    const Duration(minutes: supplierDeliveryBufferMinutes),
  );

  for (final window in learnerDeliveryWindows) {
    if (!window.end.isAfter(earliestDeliveryStart)) {
      continue;
    }

    final confirmedStart = window.start.isAfter(earliestDeliveryStart)
        ? window.start
        : earliestDeliveryStart;

    if (!confirmedStart.isBefore(window.end)) {
      continue;
    }

    return SupplierDeliverySchedulingPreview(
      earliestDeliveryStart: earliestDeliveryStart,
      confirmedStart: confirmedStart,
      confirmedEnd: window.end,
    );
  }

  return SupplierDeliverySchedulingPreview(
    earliestDeliveryStart: earliestDeliveryStart,
  );
}
