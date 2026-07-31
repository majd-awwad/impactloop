import '../../../core/format/localized_formatters.dart';
import '../../../l10n/app_localizations.dart';
import '../data/models/driver_delivery.dart';

/// Matches backend `HANDOVER_EARLY_MINUTES` / `HANDOVER_GRACE_MINUTES`.
const driverHandoverEarlyMinutes = 30;
const driverHandoverGraceMinutes = 30;

class DriverActionTimingGate {
  const DriverActionTimingGate({
    required this.isBlocked,
    this.title,
    this.body,
    this.availableAt,
    this.remainingLabel,
  });

  final bool isBlocked;
  final String? title;
  final String? body;
  final DateTime? availableAt;
  final String? remainingLabel;
}

class DriverNextActionGuidance {
  const DriverNextActionGuidance({
    required this.actionLabel,
    required this.requirements,
    this.timingGate,
    this.isActionEnabled = true,
  });

  final String actionLabel;
  final List<String> requirements;
  final DriverActionTimingGate? timingGate;
  final bool isActionEnabled;

  bool get isBlockedByTiming => timingGate?.isBlocked == true;
}

DateTime allowedPickupHandoverStart(DateTime windowStart) {
  return windowStart.subtract(
    const Duration(minutes: driverHandoverEarlyMinutes),
  );
}

DateTime allowedPickupHandoverEnd(DateTime windowEnd) {
  return windowEnd.add(const Duration(minutes: driverHandoverGraceMinutes));
}

DateTime allowedDeliveryHandoverStart(DateTime windowStart) {
  return windowStart.subtract(
    const Duration(minutes: driverHandoverEarlyMinutes),
  );
}

DateTime allowedDeliveryHandoverEnd(DateTime windowEnd) {
  return windowEnd.add(const Duration(minutes: driverHandoverGraceMinutes));
}

DateTime? resolveSupplierPickupWindowStart(DriverDelivery delivery) {
  return delivery.supplierPickupWindowStart ?? delivery.pickupWindowStart;
}

DateTime? resolveSupplierPickupWindowEnd(DriverDelivery delivery) {
  return delivery.supplierPickupWindowEnd ?? delivery.pickupWindowEnd;
}

String formatDriverTime(AppLocalizations l10n, DateTime value) {
  return LocalizedFormatters(l10n).time(value);
}

String formatDriverDateTime(AppLocalizations l10n, DateTime value) {
  return LocalizedFormatters(l10n).dateTime(value);
}

String formatRemainingDuration(AppLocalizations l10n, Duration duration) {
  if (duration.inDays >= 1) {
    return l10n.driverAvailableInDays(duration.inDays);
  }
  if (duration.inHours >= 1) {
    final hours = duration.inHours;
    final minutes = duration.inMinutes.remainder(60);
    if (minutes > 0) {
      return l10n.driverAvailableInHoursMinutes(hours, minutes);
    }
    return l10n.driverAvailableInHours(hours);
  }
  if (duration.inMinutes >= 1) {
    return l10n.driverAvailableInMinutes(duration.inMinutes);
  }
  return l10n.driverAvailableSoon;
}

DriverActionTimingGate evaluatePickupHandoverTiming(
  DriverDelivery delivery, {
  required AppLocalizations l10n,
  DateTime? now,
}) {
  final reference = now ?? DateTime.now();
  final windowStart = resolveSupplierPickupWindowStart(delivery);
  final windowEnd = resolveSupplierPickupWindowEnd(delivery);

  if (windowStart == null || windowEnd == null) {
    return const DriverActionTimingGate(isBlocked: false);
  }

  final allowedStart = allowedPickupHandoverStart(windowStart);
  final allowedEnd = allowedPickupHandoverEnd(windowEnd);

  if (reference.isBefore(allowedStart)) {
    final remaining = allowedStart.difference(reference);
    return DriverActionTimingGate(
      isBlocked: true,
      title: l10n.driverPickupNotAvailableYet,
      body: l10n.driverPickupConfirmFrom(formatDriverTime(l10n, allowedStart)),
      availableAt: allowedStart,
      remainingLabel: formatRemainingDuration(l10n, remaining),
    );
  }

  if (reference.isAfter(allowedEnd)) {
    return DriverActionTimingGate(
      isBlocked: true,
      title: l10n.driverSupplierPickupWindowPassed,
      body: l10n.driverPickupConfirmationEnded(
        formatDriverDateTime(l10n, allowedEnd),
      ),
    );
  }

  return const DriverActionTimingGate(isBlocked: false);
}

DriverActionTimingGate evaluateDeliveryHandoverTiming(
  DriverDelivery delivery, {
  required AppLocalizations l10n,
  DateTime? now,
}) {
  final reference = now ?? DateTime.now();
  final windowStart = delivery.confirmedDeliveryWindowStart;
  final windowEnd = delivery.confirmedDeliveryWindowEnd;

  if (windowStart == null || windowEnd == null) {
    return DriverActionTimingGate(
      isBlocked: true,
      title: l10n.driverDeliveryWindowNotSet,
      body: l10n.driverLearnerMustConfirmWindow,
    );
  }

  final allowedStart = allowedDeliveryHandoverStart(windowStart);
  final allowedEnd = allowedDeliveryHandoverEnd(windowEnd);

  if (reference.isBefore(allowedStart)) {
    final remaining = allowedStart.difference(reference);
    return DriverActionTimingGate(
      isBlocked: true,
      title: l10n.driverDeliveryNotAvailableYet,
      body: l10n.driverDeliveryConfirmFrom(
        formatDriverTime(l10n, allowedStart),
      ),
      availableAt: allowedStart,
      remainingLabel: formatRemainingDuration(l10n, remaining),
    );
  }

  if (reference.isAfter(allowedEnd)) {
    return DriverActionTimingGate(
      isBlocked: true,
      title: l10n.driverDeliveryWindowPassed,
      body: l10n.driverDeliveryConfirmationEnded(
        formatDriverDateTime(l10n, allowedEnd),
      ),
    );
  }

  return const DriverActionTimingGate(isBlocked: false);
}

DriverActionTimingGate? evaluateInformationalPickupWindow(
  DriverDelivery delivery, {
  required AppLocalizations l10n,
  DateTime? now,
}) {
  final reference = now ?? DateTime.now();
  final windowStart = resolveSupplierPickupWindowStart(delivery);
  final windowEnd = resolveSupplierPickupWindowEnd(delivery);

  if (windowStart == null) {
    return null;
  }

  if (reference.isBefore(windowStart)) {
    final remaining = windowStart.difference(reference);
    return DriverActionTimingGate(
      isBlocked: false,
      title: l10n.driverPickupWindowNotStarted,
      body: l10n.driverPickupStartsAt(formatDriverTime(l10n, windowStart)),
      availableAt: windowStart,
      remainingLabel: formatRemainingDuration(l10n, remaining),
    );
  }

  if (windowEnd != null && reference.isAfter(windowEnd)) {
    final allowedEnd = allowedPickupHandoverEnd(windowEnd);
    if (reference.isAfter(allowedEnd)) {
      return DriverActionTimingGate(
        isBlocked: false,
        title: l10n.driverSupplierPickupOverdue,
        body: l10n.driverPickupOverdueBody(
          formatDriverDateTime(l10n, allowedEnd),
        ),
      );
    }

    return DriverActionTimingGate(
      isBlocked: false,
      title: l10n.driverScheduledPickupEnded,
      body: l10n.driverScheduledPickupEndedBody(
        formatDriverTime(l10n, windowEnd),
      ),
    );
  }

  return null;
}

DriverNextActionGuidance buildDriverNextActionGuidance(
  DriverDelivery delivery, {
  required AppLocalizations l10n,
  DateTime? now,
}) {
  final nextStatus = delivery.nextStatus;
  if (nextStatus == null) {
    return DriverNextActionGuidance(
      actionLabel: l10n.driverNoNextAction,
      requirements: [l10n.driverCannotAdvanceFurther],
      isActionEnabled: false,
    );
  }

  switch (nextStatus) {
    case 'ARRIVED_PICKUP':
      return DriverNextActionGuidance(
        actionLabel: l10n.driverArriveAtPickup,
        requirements: [
          l10n.driverArriveAtPickupReq1,
          l10n.driverArriveAtPickupReq2,
        ],
        timingGate: evaluateInformationalPickupWindow(
          delivery,
          l10n: l10n,
          now: now,
        ),
      );
    case 'PICKED_UP':
      final timing = evaluatePickupHandoverTiming(
        delivery,
        l10n: l10n,
        now: now,
      );
      return DriverNextActionGuidance(
        actionLabel: l10n.driverMarkPickedUp,
        requirements: [
          l10n.driverMarkPickedUpReq1,
          l10n.driverMarkPickedUpReq2,
        ],
        timingGate: timing.isBlocked ? timing : null,
        isActionEnabled: !timing.isBlocked,
      );
    case 'ON_THE_WAY':
      return DriverNextActionGuidance(
        actionLabel: l10n.driverStartDeliveryOnTheWay,
        requirements: [
          l10n.driverStartDeliveryReq1,
          l10n.driverStartDeliveryReq2,
        ],
      );
    case 'ARRIVED_DROPOFF':
      return DriverNextActionGuidance(
        actionLabel: l10n.driverArriveAtDropoff,
        requirements: [
          l10n.driverArriveAtDropoffReq1,
          l10n.driverArriveAtDropoffReq2,
        ],
      );
    case 'DELIVERED':
      final timing = evaluateDeliveryHandoverTiming(
        delivery,
        l10n: l10n,
        now: now,
      );
      return DriverNextActionGuidance(
        actionLabel: l10n.driverMarkDelivered,
        requirements: [
          l10n.driverMarkDeliveredReq1,
          l10n.driverMarkDeliveredReq2,
        ],
        timingGate: timing.isBlocked ? timing : null,
        isActionEnabled: !timing.isBlocked,
      );
    default:
      return DriverNextActionGuidance(
        actionLabel: l10n.unknownStatus,
        requirements: const [],
      );
  }
}
