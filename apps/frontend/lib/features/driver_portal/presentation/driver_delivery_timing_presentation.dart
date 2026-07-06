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

String formatDriverTime(DateTime value) {
  final local = value.toLocal();
  return '${_two(local.hour)}:${_two(local.minute)}';
}

String formatDriverDateTime(DateTime value) {
  final local = value.toLocal();
  return '${local.year}-${_two(local.month)}-${_two(local.day)} '
      '${_two(local.hour)}:${_two(local.minute)}';
}

String formatRemainingDuration(Duration duration) {
  if (duration.inDays >= 1) {
    final days = duration.inDays;
    return 'Available in $days ${days == 1 ? 'day' : 'days'}';
  }
  if (duration.inHours >= 1) {
    final hours = duration.inHours;
    final minutes = duration.inMinutes.remainder(60);
    if (minutes > 0) {
      return 'Available in $hours h $minutes min';
    }
    return 'Available in $hours ${hours == 1 ? 'hour' : 'hours'}';
  }
  if (duration.inMinutes >= 1) {
    final minutes = duration.inMinutes;
    return 'Available in $minutes ${minutes == 1 ? 'minute' : 'minutes'}';
  }
  return 'Available soon';
}

DriverActionTimingGate evaluatePickupHandoverTiming(
  DriverDelivery delivery, {
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
      title: 'Pickup confirmation is not available yet',
      body: 'Pickup can be confirmed from ${formatDriverTime(allowedStart)} '
          '(30 minutes before the supplier window).',
      availableAt: allowedStart,
      remainingLabel: formatRemainingDuration(remaining),
    );
  }

  if (reference.isAfter(allowedEnd)) {
    return DriverActionTimingGate(
      isBlocked: true,
      title: 'Supplier pickup window has passed',
      body:
          'The allowed pickup confirmation window ended at '
          '${formatDriverDateTime(allowedEnd)}.',
    );
  }

  return const DriverActionTimingGate(isBlocked: false);
}

DriverActionTimingGate evaluateDeliveryHandoverTiming(
  DriverDelivery delivery, {
  DateTime? now,
}) {
  final reference = now ?? DateTime.now();
  final windowStart = delivery.confirmedDeliveryWindowStart;
  final windowEnd = delivery.confirmedDeliveryWindowEnd;

  if (windowStart == null || windowEnd == null) {
    return const DriverActionTimingGate(
      isBlocked: true,
      title: 'Delivery confirmation window is not set',
      body:
          'The learner must confirm a delivery window before you can mark delivered.',
    );
  }

  final allowedStart = allowedDeliveryHandoverStart(windowStart);
  final allowedEnd = allowedDeliveryHandoverEnd(windowEnd);

  if (reference.isBefore(allowedStart)) {
    final remaining = allowedStart.difference(reference);
    return DriverActionTimingGate(
      isBlocked: true,
      title: 'Delivery confirmation is not available yet',
      body: 'Delivery can be confirmed from ${formatDriverTime(allowedStart)}.',
      availableAt: allowedStart,
      remainingLabel: formatRemainingDuration(remaining),
    );
  }

  if (reference.isAfter(allowedEnd)) {
    return DriverActionTimingGate(
      isBlocked: true,
      title: 'Delivery window has passed',
      body:
          'The allowed delivery confirmation window ended at '
          '${formatDriverDateTime(allowedEnd)}.',
    );
  }

  return const DriverActionTimingGate(isBlocked: false);
}

DriverActionTimingGate? evaluateInformationalPickupWindow(
  DriverDelivery delivery, {
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
      title: 'Pickup window has not started yet',
      body: 'Pickup starts at ${formatDriverTime(windowStart)}.',
      availableAt: windowStart,
      remainingLabel: formatRemainingDuration(remaining),
    );
  }

  if (windowEnd != null && reference.isAfter(windowEnd)) {
    return DriverActionTimingGate(
      isBlocked: false,
      title: 'Scheduled pickup window has ended',
      body:
          'The supplier window ended at ${formatDriverTime(windowEnd)}. '
          'You may still complete pickup if the material is ready.',
    );
  }

  return null;
}

DriverNextActionGuidance buildDriverNextActionGuidance(
  DriverDelivery delivery, {
  DateTime? now,
}) {
  final nextStatus = delivery.nextStatus;
  if (nextStatus == null) {
    return const DriverNextActionGuidance(
      actionLabel: 'No next action',
      requirements: ['This delivery cannot be advanced further.'],
      isActionEnabled: false,
    );
  }

  switch (nextStatus) {
    case 'ARRIVED_PICKUP':
      return DriverNextActionGuidance(
        actionLabel: 'Arrive at pickup',
        requirements: const [
          'Drive to the supplier pickup location.',
          'No confirmation code is required for this step.',
        ],
        timingGate: evaluateInformationalPickupWindow(delivery, now: now),
      );
    case 'PICKED_UP':
      final timing = evaluatePickupHandoverTiming(delivery, now: now);
      return DriverNextActionGuidance(
        actionLabel: 'Mark picked up',
        requirements: const [
          'You must be at the supplier pickup location.',
          'Enter the supplier handover code when prompted.',
        ],
        timingGate: timing.isBlocked ? timing : null,
        isActionEnabled: !timing.isBlocked,
      );
    case 'ON_THE_WAY':
      return const DriverNextActionGuidance(
        actionLabel: 'Start delivery / On the way',
        requirements: [
          'Material must already be picked up from the supplier.',
          'No confirmation code is required for this step.',
        ],
      );
    case 'ARRIVED_DROPOFF':
      return const DriverNextActionGuidance(
        actionLabel: 'Arrive at drop-off',
        requirements: [
          'Drive to the learner drop-off location.',
          'No confirmation code is required for this step.',
        ],
      );
    case 'DELIVERED':
      final timing = evaluateDeliveryHandoverTiming(delivery, now: now);
      return DriverNextActionGuidance(
        actionLabel: 'Mark delivered',
        requirements: const [
          'You must be at the learner drop-off location.',
          'Enter the learner delivery code when prompted.',
        ],
        timingGate: timing.isBlocked ? timing : null,
        isActionEnabled: !timing.isBlocked,
      );
    default:
      return DriverNextActionGuidance(
        actionLabel: nextStatus,
        requirements: const [],
      );
  }
}

String _two(int value) => value.toString().padLeft(2, '0');
