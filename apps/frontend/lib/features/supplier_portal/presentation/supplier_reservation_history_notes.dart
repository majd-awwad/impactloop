import '../../../../l10n/app_localizations.dart';
import '../data/models/supplier_incoming_request.dart';

const _userReasonEventCodes = <String>{
  'DECLINED_BY_SUPPLIER',
  'SUPPLIER_CANCELLED',
  'SUPPLIER_CANCELLED_PENDING_RESCHEDULE',
  'SUPPLIER_REQUESTED_RESCHEDULE',
  'LEARNER_REQUESTED_RESCHEDULE',
  'FULFILLMENT_ISSUE_REPORTED',
  'LEARNER_NO_SHOW_AFTER_PICKUP',
  'ACCEPTED_BY_SUPPLIER',
};

String? supplierReservationHistoryNoteLabel(
  AppLocalizations l10n,
  SupplierReservationHistoryEntry entry,
) {
  final reasonText = entry.reasonText?.trim();
  final eventCode = entry.eventCode?.trim();

  if (eventCode != null && eventCode.isNotEmpty) {
    if (_userReasonEventCodes.contains(eventCode) &&
        reasonText != null &&
        reasonText.isNotEmpty) {
      return reasonText;
    }

    final label = _eventCodeLabel(l10n, eventCode);
    if (label != null) {
      return label;
    }
  }

  if (reasonText != null && reasonText.isNotEmpty) {
    return reasonText;
  }

  final legacy = _legacyNoteLabel(l10n, entry.note);
  if (legacy != null) {
    return legacy;
  }

  final note = entry.note?.trim();
  return note == null || note.isEmpty ? null : note;
}

String? _eventCodeLabel(AppLocalizations l10n, String eventCode) =>
    switch (eventCode) {
      'ACCEPTED_BY_SUPPLIER' => l10n.supplierHistoryEventAcceptedBySupplier,
      'DECLINED_BY_SUPPLIER' => l10n.supplierHistoryEventDeclinedBySupplier,
      'PICKUP_COMPLETED_BY_SUPPLIER' =>
        l10n.supplierHistoryEventPickupCompletedBySupplier,
      'SUPPLIER_REQUESTED_RESCHEDULE' =>
        l10n.supplierHistoryEventSupplierRequestedReschedule,
      'SUPPLIER_ACCEPTED_LEARNER_RESCHEDULE' =>
        l10n.supplierHistoryEventSupplierAcceptedLearnerReschedule,
      'SUPPLIER_CANCELLED' => l10n.supplierHistoryEventSupplierCancelled,
      'SUPPLIER_CANCELLED_PENDING_RESCHEDULE' =>
        l10n.supplierHistoryEventSupplierCancelledPendingReschedule,
      'REPORTED_AFTER_MISSED_PICKUP' =>
        l10n.supplierHistoryEventReportedAfterMissedPickup,
      'REQUESTED_BY_LEARNER' => l10n.supplierHistoryEventRequestedByLearner,
      'CANCELLED_BY_LEARNER' => l10n.supplierHistoryEventCancelledByLearner,
      'CANCELLED_BY_LEARNER_AWAITING_CONFIRMATION' =>
        l10n.supplierHistoryEventCancelledByLearnerAwaitingConfirmation,
      'LEARNER_ACCEPTED_SUPPLIER_PICKUP_WINDOW' =>
        l10n.supplierHistoryEventLearnerAcceptedSupplierPickupWindow,
      'LEARNER_CONFIRMED_DELIVERY_WINDOW' =>
        l10n.supplierHistoryEventLearnerConfirmedDeliveryWindow,
      'LEARNER_REQUESTED_RESCHEDULE' =>
        l10n.supplierHistoryEventLearnerRequestedReschedule,
      'LEARNER_CANCELLED_AFTER_RESCHEDULE' =>
        l10n.supplierHistoryEventLearnerCancelledAfterReschedule,
      'LEARNER_NO_SHOW_AFTER_PICKUP' =>
        l10n.supplierHistoryEventLearnerNoShowAfterPickup,
      'LEARNER_REPORTED_SUPPLIER_ISSUE' =>
        l10n.supplierHistoryEventLearnerReportedSupplierIssue,
      'PENDING_EXPIRED_AFTER_PREFERRED_WINDOW' =>
        l10n.supplierHistoryEventPendingExpiredAfterPreferredWindow,
      'PENDING_EXPIRED_AFTER_TIMEOUT' =>
        l10n.supplierHistoryEventPendingExpiredAfterTimeout,
      'MISSED_PICKUP_AUTO_EXPIRED' =>
        l10n.supplierHistoryEventMissedPickupAutoExpired,
      'NO_DRIVER_AVAILABLE' => l10n.supplierHistoryEventNoDriverAvailable,
      'NO_DRIVER_AUTO_ESCALATED' =>
        l10n.supplierHistoryEventNoDriverAutoEscalated,
      'ASSIGNED_DRIVER_PICKUP_AUTO_ESCALATED' =>
        l10n.supplierHistoryEventAssignedDriverPickupAutoEscalated,
      'DELIVERY_PICKUP_WINDOW_EXPIRED' =>
        l10n.supplierHistoryEventDeliveryPickupWindowExpired,
      'DRIVER_NO_SHOW_AT_SUPPLIER' =>
        l10n.supplierHistoryEventDriverNoShowAtSupplier,
      'DRIVER_NO_SHOW_REPORTED_BY_SUPPLIER' =>
        l10n.supplierHistoryEventDriverNoShowReportedBySupplier,
      'SUPPLIER_MARKED_PICKUP_EXPIRED' =>
        l10n.supplierHistoryEventSupplierMarkedPickupExpired,
      'SUPPLIER_PICKUP_WINDOW_EXPIRED_NO_DRIVER' =>
        l10n.supplierHistoryEventSupplierPickupWindowExpiredNoDriver,
      'DELIVERY_COMPLETED_BY_DRIVER' =>
        l10n.supplierHistoryEventDeliveryCompletedByDriver,
      'GROUPED_DELIVERY_COMPLETED_BY_DRIVER' =>
        l10n.supplierHistoryEventGroupedDeliveryCompletedByDriver,
      'SUPPLIER_SUBMITTED_PICKUP_WINDOW_NO_DRIVER' =>
        l10n.supplierHistoryEventSupplierSubmittedPickupWindowNoDriver,
      'SUPPLIER_SUBMITTED_REPLACEMENT_PICKUP_WINDOW' =>
        l10n.supplierHistoryEventSupplierSubmittedReplacementPickupWindow,
      'SUPPLIER_SUBMITTED_PICKUP_WINDOW_ADMIN_RECOVERY' =>
        l10n.supplierHistoryEventSupplierSubmittedPickupWindowAdminRecovery,
      'ADMIN_REQUESTED_NEW_PICKUP_WINDOW_NO_DRIVER' =>
        l10n.supplierHistoryEventAdminRequestedNewPickupWindowNoDriver,
      'ADMIN_REQUESTED_NEW_PICKUP_WINDOW_PICKUP_INCOMPLETE' =>
        l10n.supplierHistoryEventAdminRequestedNewPickupWindowPickupIncomplete,
      'ADMIN_CANCELLED_NO_DRIVER' =>
        l10n.supplierHistoryEventAdminCancelledNoDriver,
      'ADMIN_CANCELLED_PICKUP_INCOMPLETE' =>
        l10n.supplierHistoryEventAdminCancelledPickupIncomplete,
      'FULFILLMENT_ISSUE_REPORTED' =>
        l10n.supplierHistoryEventFulfillmentIssueReported,
      _ => null,
    };

String? _legacyNoteLabel(AppLocalizations l10n, String? note) {
  final trimmed = note?.trim();
  if (trimmed == null || trimmed.isEmpty) {
    return null;
  }

  if (trimmed.startsWith('event:')) {
    return null;
  }

  if (trimmed.startsWith('Supplier requested reschedule:')) {
    return trimmed.substring('Supplier requested reschedule:'.length).trim();
  }
  if (trimmed.startsWith('Learner requested reschedule:')) {
    return trimmed.substring('Learner requested reschedule:'.length).trim();
  }

  return _eventCodeLabel(
    l10n,
    switch (trimmed) {
      'Accepted by supplier' => 'ACCEPTED_BY_SUPPLIER',
      'Pickup completed by supplier' => 'PICKUP_COMPLETED_BY_SUPPLIER',
      'Supplier accepted learner reschedule proposal' =>
        'SUPPLIER_ACCEPTED_LEARNER_RESCHEDULE',
      'Reported to admin after missed pickup window' =>
        'REPORTED_AFTER_MISSED_PICKUP',
      'Reservation requested by learner' => 'REQUESTED_BY_LEARNER',
      'Cancelled by learner' => 'CANCELLED_BY_LEARNER',
      'Cancelled by learner while awaiting confirmation' =>
        'CANCELLED_BY_LEARNER_AWAITING_CONFIRMATION',
      'Learner accepted supplier proposed pickup window' =>
        'LEARNER_ACCEPTED_SUPPLIER_PICKUP_WINDOW',
      'Learner confirmed feasible delivery window' =>
        'LEARNER_CONFIRMED_DELIVERY_WINDOW',
      'Learner cancelled after reschedule request' =>
        'LEARNER_CANCELLED_AFTER_RESCHEDULE',
      'Learner no-show after pickup window' => 'LEARNER_NO_SHOW_AFTER_PICKUP',
      'Learner reported supplier issue after pickup window' =>
        'LEARNER_REPORTED_SUPPLIER_ISSUE',
      'No driver available' => 'NO_DRIVER_AVAILABLE',
      'No driver auto-escalated' => 'NO_DRIVER_AUTO_ESCALATED',
      'Assigned-driver pickup auto-escalated' =>
        'ASSIGNED_DRIVER_PICKUP_AUTO_ESCALATED',
      'Delivery pickup window expired' => 'DELIVERY_PICKUP_WINDOW_EXPIRED',
      'Driver no-show at supplier pickup' => 'DRIVER_NO_SHOW_AT_SUPPLIER',
      'Driver no-show reported by supplier' =>
        'DRIVER_NO_SHOW_REPORTED_BY_SUPPLIER',
      'Delivery completed by driver' => 'DELIVERY_COMPLETED_BY_DRIVER',
      'Grouped delivery completed by driver' =>
        'GROUPED_DELIVERY_COMPLETED_BY_DRIVER',
      'Supplier submitted new pickup window after no driver available' =>
        'SUPPLIER_SUBMITTED_PICKUP_WINDOW_NO_DRIVER',
      'Supplier submitted replacement pickup window after partial pickup' =>
        'SUPPLIER_SUBMITTED_REPLACEMENT_PICKUP_WINDOW',
      'Supplier submitted new pickup window after admin recovery' =>
        'SUPPLIER_SUBMITTED_PICKUP_WINDOW_ADMIN_RECOVERY',
      'Admin asked supplier to choose a new pickup window after no driver was available' =>
        'ADMIN_REQUESTED_NEW_PICKUP_WINDOW_NO_DRIVER',
      'Admin asked supplier to choose a new pickup window after pickup was not completed' =>
        'ADMIN_REQUESTED_NEW_PICKUP_WINDOW_PICKUP_INCOMPLETE',
      'Admin cancelled and released hold after no driver available' =>
        'ADMIN_CANCELLED_NO_DRIVER',
      'Admin cancelled and released hold after pickup was not completed' =>
        'ADMIN_CANCELLED_PICKUP_INCOMPLETE',
      _ when trimmed.startsWith(
        'Expired automatically after the last preferred scheduling window passed without supplier response.',
      ) =>
        'PENDING_EXPIRED_AFTER_PREFERRED_WINDOW',
      _ when RegExp(
        r'^Expired automatically after \d+ hours without supplier response\.$',
      ).hasMatch(trimmed) =>
        'PENDING_EXPIRED_AFTER_TIMEOUT',
      _ when RegExp(
        r'^Automatically expired after the pickup window passed without follow-up within \d+ hours\.$',
      ).hasMatch(trimmed) =>
        'MISSED_PICKUP_AUTO_EXPIRED',
      _ => '',
    },
  );
}
