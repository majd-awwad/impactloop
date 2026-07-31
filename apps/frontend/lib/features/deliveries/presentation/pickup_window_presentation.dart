import '../../driver_portal/data/models/driver_delivery.dart';
import '../../../core/format/localized_formatters.dart';
import '../../../l10n/app_localizations.dart';
import '../data/models/learner_delivery.dart';

String learnerReservationPickupWindowDetail(
  LearnerDeliveryReservation reservation,
  AppLocalizations l10n,
) {
  final start =
      reservation.supplierPickupWindowStart ?? reservation.pickupWindowStart;
  final end =
      reservation.supplierPickupWindowEnd ?? reservation.pickupWindowEnd;

  if (start == null && end == null) {
    return l10n.pickupWindowNotSet;
  }

  if (start != null && end != null) {
    return LocalizedFormatters(l10n).dateTimeRange(start, end);
  }

  return LocalizedFormatters(l10n).dateTime(start ?? end!);
}

String driverPickupWindowSummary(
  DriverDelivery delivery, {
  required AppLocalizations l10n,
  DateTime? now,
}) {
  final reference = now ?? DateTime.now();
  final formatters = LocalizedFormatters(l10n);
  final start =
      delivery.supplierPickupWindowStart ?? delivery.pickupWindowStart;
  final end = delivery.supplierPickupWindowEnd ?? delivery.pickupWindowEnd;

  if (start == null && end == null) {
    return l10n.pickupWindowNotSet;
  }

  final effectiveStart = start ?? end!;
  final effectiveEnd = end ?? start!;
  final dateLabel = _isSameDay(effectiveStart, reference)
      ? l10n.driverToday
      : formatters.date(effectiveStart);
  final timeRange =
      '${formatters.time(effectiveStart)} – ${formatters.time(effectiveEnd)}';

  if (reference.isBefore(effectiveStart)) {
    final diff = effectiveStart.difference(reference);
    if (diff.inHours >= 1) {
      return l10n.driverPickupStartsInHours(
        diff.inHours,
        dateLabel,
        timeRange,
      );
    }
    if (diff.inMinutes >= 1) {
      return l10n.driverPickupStartsInMinutes(
        diff.inMinutes,
        dateLabel,
        timeRange,
      );
    }
    return l10n.driverPickupStartsSoon(dateLabel, timeRange);
  }

  if (reference.isAfter(effectiveEnd)) {
    return l10n.driverPickupWindowEndedSummary(dateLabel, timeRange);
  }

  return l10n.driverReadyForPickupNow(dateLabel, timeRange);
}

String driverPickupWindowDetail(
  DriverDelivery delivery, {
  required AppLocalizations l10n,
}) {
  final start =
      delivery.supplierPickupWindowStart ?? delivery.pickupWindowStart;
  final end = delivery.supplierPickupWindowEnd ?? delivery.pickupWindowEnd;

  if (start == null && end == null) {
    return l10n.driverNotSet;
  }

  final formatters = LocalizedFormatters(l10n);
  if (start != null && end != null) {
    return formatters.dateTimeRange(start, end);
  }

  return formatters.dateTime(start ?? end!);
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
