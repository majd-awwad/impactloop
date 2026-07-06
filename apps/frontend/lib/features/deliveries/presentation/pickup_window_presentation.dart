import '../../driver_portal/data/models/driver_delivery.dart';
import '../data/models/learner_delivery.dart';

String learnerReservationPickupWindowDetail(
  LearnerDeliveryReservation reservation,
) {
  final start =
      reservation.supplierPickupWindowStart ?? reservation.pickupWindowStart;
  final end =
      reservation.supplierPickupWindowEnd ?? reservation.pickupWindowEnd;

  if (start == null && end == null) {
    return 'Pickup window not set';
  }

  if (start != null && end != null) {
    return '${_formatDateTime(start)} – ${_formatDateTime(end)}';
  }

  return _formatDateTime(start ?? end!);
}

String driverPickupWindowSummary(
  DriverDelivery delivery, {
  DateTime? now,
}) {
  final reference = now ?? DateTime.now();
  final start =
      delivery.supplierPickupWindowStart ?? delivery.pickupWindowStart;
  final end = delivery.supplierPickupWindowEnd ?? delivery.pickupWindowEnd;

  if (start == null && end == null) {
    return 'Pickup window not set';
  }

  final effectiveStart = start ?? end!;
  final effectiveEnd = end ?? start!;
  final dateLabel = _isSameDay(effectiveStart, reference)
      ? 'Today'
      : _formatDate(effectiveStart);
  final timeRange =
      '${_formatTime(effectiveStart)} – ${_formatTime(effectiveEnd)}';

  if (reference.isBefore(effectiveStart)) {
    final diff = effectiveStart.difference(reference);
    if (diff.inHours >= 1) {
      final hours = diff.inHours;
      return 'Pickup starts in $hours ${hours == 1 ? 'hour' : 'hours'} · $dateLabel · $timeRange';
    }
    if (diff.inMinutes >= 1) {
      final minutes = diff.inMinutes;
      return 'Pickup starts in $minutes min · $dateLabel · $timeRange';
    }
    return 'Pickup starts soon · $dateLabel · $timeRange';
  }

  if (reference.isAfter(effectiveEnd)) {
    return 'Pickup window ended · $dateLabel · $timeRange';
  }

  return 'Ready for pickup now · $dateLabel · $timeRange';
}

String driverPickupWindowDetail(DriverDelivery delivery) {
  final start =
      delivery.supplierPickupWindowStart ?? delivery.pickupWindowStart;
  final end = delivery.supplierPickupWindowEnd ?? delivery.pickupWindowEnd;

  if (start == null && end == null) {
    return 'Not set';
  }

  if (start != null && end != null) {
    return '${_formatDateTime(start)} – ${_formatDateTime(end)}';
  }

  return _formatDateTime(start ?? end!);
}

bool isPickupWindowNotStarted(DriverDelivery delivery, {DateTime? now}) {
  final reference = now ?? DateTime.now();
  final start =
      delivery.supplierPickupWindowStart ?? delivery.pickupWindowStart;
  return start != null && reference.isBefore(start);
}

bool _isSameDay(DateTime left, DateTime right) {
  final a = left.toLocal();
  final b = right.toLocal();
  return a.year == b.year && a.month == b.month && a.day == b.day;
}

String _formatDate(DateTime value) {
  final local = value.toLocal();
  return '${local.year}-${_two(local.month)}-${_two(local.day)}';
}

String _formatTime(DateTime value) {
  final local = value.toLocal();
  return '${_two(local.hour)}:${_two(local.minute)}';
}

String _formatDateTime(DateTime value) {
  final local = value.toLocal();
  return '${local.year}-${_two(local.month)}-${_two(local.day)} '
      '${_two(local.hour)}:${_two(local.minute)}';
}

String _two(int value) => value.toString().padLeft(2, '0');
