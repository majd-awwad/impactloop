import '../../../core/format/localized_formatters.dart';
import '../../../l10n/app_localizations.dart';
import '../data/models/learner_delivery.dart';
import '../domain/delivery_status_contract.dart';
import 'pickup_window_presentation.dart';

enum LearnerDeliveryAppointmentKind {
  notScheduled,
  scheduled,
  redeliveryPending,
}

class LearnerDeliveryAppointmentView {
  const LearnerDeliveryAppointmentView({
    required this.kind,
    this.start,
    this.end,
  });

  final LearnerDeliveryAppointmentKind kind;
  final DateTime? start;
  final DateTime? end;

  bool get showsOperationalWindow =>
      kind == LearnerDeliveryAppointmentKind.scheduled &&
      start != null &&
      end != null;
}

const _statusesBeforeSupplierPickup = <String>{
  'WAITING_FOR_DRIVER',
  'DRIVER_ASSIGNED',
  'ARRIVED_PICKUP',
};

const _statusesWithOperationalLearnerWindow = <String>{
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
  'REDELIVERY_SCHEDULED',
  'DELIVERED',
};

DateTime? _supplierPickupStart(LearnerDeliveryReservation reservation) =>
    reservation.supplierPickupWindowStart ?? reservation.pickupWindowStart;

DateTime? _supplierPickupEnd(LearnerDeliveryReservation reservation) =>
    reservation.supplierPickupWindowEnd ?? reservation.pickupWindowEnd;

bool hasSupplierPickupAvailability(LearnerDeliveryReservation reservation) =>
    _supplierPickupStart(reservation) != null ||
    _supplierPickupEnd(reservation) != null;

bool hasConfirmedLearnerDeliveryWindow(LearnerDeliveryReservation reservation) =>
    reservation.confirmedDeliveryWindowStart != null &&
    reservation.confirmedDeliveryWindowEnd != null;

/// Supplier → driver collection window. Never the learner drop-off appointment.
String learnerSupplierPickupWindowValue(
  LearnerDeliveryReservation reservation,
  AppLocalizations l10n,
) =>
    learnerReservationPickupWindowDetail(reservation, l10n);

/// Operational learner drop-off appointment.
///
/// `confirmedDeliveryWindow*` is reused for a derived placeholder before
/// pickup, the driver-set window after pickup, and the retry window after
/// reschedule. Visibility is therefore status-gated so a placeholder or a
/// superseded first-attempt window is never shown as the live appointment.
LearnerDeliveryAppointmentView resolveLearnerDeliveryAppointment(
  LearnerDelivery delivery,
) {
  final status = normalizeDeliveryStatus(delivery.status);

  if (status == 'REDELIVERY_PENDING') {
    return const LearnerDeliveryAppointmentView(
      kind: LearnerDeliveryAppointmentKind.redeliveryPending,
    );
  }

  if (_statusesBeforeSupplierPickup.contains(status)) {
    return const LearnerDeliveryAppointmentView(
      kind: LearnerDeliveryAppointmentKind.notScheduled,
    );
  }

  if (_statusesWithOperationalLearnerWindow.contains(status) &&
      hasConfirmedLearnerDeliveryWindow(delivery.reservation)) {
    return LearnerDeliveryAppointmentView(
      kind: LearnerDeliveryAppointmentKind.scheduled,
      start: delivery.reservation.confirmedDeliveryWindowStart,
      end: delivery.reservation.confirmedDeliveryWindowEnd,
    );
  }

  return const LearnerDeliveryAppointmentView(
    kind: LearnerDeliveryAppointmentKind.notScheduled,
  );
}

class LearnerDeliveryAppointmentCopy {
  const LearnerDeliveryAppointmentCopy({
    required this.label,
    required this.value,
    this.helper,
  });

  final String label;
  final String value;
  final String? helper;
}

LearnerDeliveryAppointmentCopy learnerDeliveryAppointmentCopy(
  LearnerDelivery delivery,
  AppLocalizations l10n,
) {
  final appointment = resolveLearnerDeliveryAppointment(delivery);
  switch (appointment.kind) {
    case LearnerDeliveryAppointmentKind.scheduled:
      return LearnerDeliveryAppointmentCopy(
        label: l10n.learnerDeliveryAppointment,
        value: LocalizedFormatters(l10n).dateTimeRange(
          appointment.start!,
          appointment.end!,
        ),
      );
    case LearnerDeliveryAppointmentKind.redeliveryPending:
      return LearnerDeliveryAppointmentCopy(
        label: l10n.learnerDeliveryAppointment,
        value: l10n.learnerRedeliveryNeedsScheduling,
        helper: l10n.learnerRedeliveryNeedsSchedulingHelper,
      );
    case LearnerDeliveryAppointmentKind.notScheduled:
      return LearnerDeliveryAppointmentCopy(
        label: l10n.learnerDeliveryAppointment,
        value: l10n.learnerDeliveryNotScheduled,
        helper: l10n.learnerDeliveryNotScheduledHelper,
      );
  }
}

String learnerDeliveryStatusTrackingBody(
  LearnerDelivery delivery,
  AppLocalizations l10n,
) {
  if (delivery.canTrack) {
    return '';
  }

  return switch (normalizeDeliveryStatus(delivery.status)) {
    'WAITING_FOR_DRIVER' => l10n.waitingForDriver,
    'DRIVER_ASSIGNED' =>
      '${l10n.driverAssigned}\n${l10n.driverWillCollectFromSupplierFirst}',
    'ARRIVED_PICKUP' => l10n.driverHeadingToPickup,
    _ when delivery.isTerminal => l10n.trackingComplete,
    _ => l10n.trackingAvailableAfterPickup,
  };
}
