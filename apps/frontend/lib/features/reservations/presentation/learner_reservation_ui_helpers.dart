import 'package:flutter/material.dart';
import '../../../core/format/localized_formatters.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/l10n/learner_ui_labels.dart';
import '../../../shared/widgets/app_status_badge.dart';
import '../../../shared/widgets/incident_report_status_presentation.dart';
import '../../deliveries/presentation/delivery_status_presentation.dart';
import '../../deliveries/domain/delivery_status_contract.dart';
import '../data/models/learner_reservation.dart';
import '../data/models/reservation_preferred_window.dart';

enum LearnerReservationStatusFilter {
  all,
  active,
  needsAction,
  pending,
  accepted,
  completed,
  closed,
}

extension LearnerReservationStatusFilterX on LearnerReservationStatusFilter {
  String get label {
    switch (this) {
      case LearnerReservationStatusFilter.all:
        return 'All';
      case LearnerReservationStatusFilter.active:
        return 'Active';
      case LearnerReservationStatusFilter.needsAction:
        return 'Needs action';
      case LearnerReservationStatusFilter.pending:
        return 'Pending';
      case LearnerReservationStatusFilter.accepted:
        return 'Accepted';
      case LearnerReservationStatusFilter.completed:
        return 'Completed';
      case LearnerReservationStatusFilter.closed:
        return 'Closed';
    }
  }

  String labelFor(AppLocalizations l10n) =>
      LearnerUiLabels(l10n).reservationFilter(name);
}

const missedPickupExpiryReason = 'PICKUP_WINDOW_MISSED';
const noDriverCancelReason = 'NO_DRIVER_UNAVAILABLE';
const stalePickupCancelReason = 'PICKUP_NOT_COMPLETED';
const adminPickupReconfirmReasons = {
  'NO_DRIVER_ADMIN_REQUEST',
  'STALE_PICKUP_ADMIN_REQUEST',
};

bool isMissedPickupExpiry(LearnerReservation reservation) =>
    reservation.isExpired &&
    reservation.rejectionReason == missedPickupExpiryReason;

bool learnerReservationNeedsAction(LearnerReservation reservation) {
  if (reservation.isAwaitingConfirmation) {
    return true;
  }

  if (reservation.isReadOnlyFinalState) {
    return false;
  }

  return reservation.isAccepted &&
      (reservation.isOverdue ||
          reservation.needsFollowUp ||
          reservation.assignedDriverPickupOverdue);
}

bool reservationMatchesStatusFilter(
  LearnerReservation reservation,
  LearnerReservationStatusFilter filter,
) {
  switch (filter) {
    case LearnerReservationStatusFilter.all:
      return true;
    case LearnerReservationStatusFilter.active:
      return reservation.isPending ||
          reservation.isAccepted ||
          reservation.isAwaitingConfirmation ||
          reservation.isAwaitingSupplierConfirmation ||
          reservation.status == 'AWAITING_RESOLUTION';
    case LearnerReservationStatusFilter.needsAction:
      return learnerReservationNeedsAction(reservation);
    case LearnerReservationStatusFilter.pending:
      return reservation.isPending ||
          reservation.isAwaitingSupplierConfirmation;
    case LearnerReservationStatusFilter.accepted:
      return reservation.isAccepted;
    case LearnerReservationStatusFilter.completed:
      return reservation.isCompleted;
    case LearnerReservationStatusFilter.closed:
      return reservation.isCancelled ||
          reservation.isRejected ||
          reservation.isExpired ||
          reservation.status == 'NO_SHOW' ||
          reservation.status == 'FULFILLMENT_FAILED';
  }
}

class LearnerReservationStatusStyle {
  const LearnerReservationStatusStyle({
    required this.accentColor,
    required this.tone,
  });

  final Color accentColor;
  final AppStatusTone tone;

  static LearnerReservationStatusStyle forStatus(
    BuildContext context,
    String status, {
    String? incidentReviewStatus,
  }) {
    final tone = learnerReservationStatusTone(
      status,
      incidentReviewStatus: incidentReviewStatus,
    );
    final style = AppStatusStyle.of(context, tone);

    return LearnerReservationStatusStyle(
      accentColor: style.foreground.withValues(alpha: 0.85),
      tone: tone,
    );
  }
}

/// Maps booking lifecycle states to the app-wide semantic status contract.
AppStatusTone learnerReservationStatusTone(
  String status, {
  String? incidentReviewStatus,
}) {
  switch (status) {
    case 'PENDING':
    case 'AWAITING_LEARNER_CONFIRMATION':
    case 'AWAITING_SUPPLIER_CONFIRMATION':
      return AppStatusTone.warning;
    case 'AWAITING_RESOLUTION':
      if (incidentReviewStatus?.trim().isNotEmpty == true) {
        return incidentReportStatusTone(incidentReviewStatus);
      }
      return AppStatusTone.warning;
    case 'ACCEPTED':
    case 'COMPLETED':
      return AppStatusTone.success;
    case 'REJECTED':
    case 'CANCELLED':
    case 'EXPIRED':
    case 'NO_SHOW':
    case 'FULFILLMENT_FAILED':
      return AppStatusTone.danger;
    default:
      return AppStatusTone.neutral;
  }
}

String incidentReviewStatusLabel(String? status, {AppLocalizations? l10n}) {
  if (l10n != null) {
    return LearnerUiLabels(l10n).incidentReviewStatus(status);
  }
  switch (status) {
    case 'PENDING_REVIEW':
      return 'Pending admin review';
    case 'VERIFIED':
      return 'Report verified';
    case 'REJECTED':
      return 'Report dismissed';
    case 'RESOLVED_NO_STRIKE':
      return 'Resolved without strike';
    default:
      return 'Pending admin review';
  }
}

String? incidentReviewStatusMessage(String? status, {AppLocalizations? l10n}) {
  if (l10n != null) {
    return switch (status) {
      'PENDING_REVIEW' => l10n.reservationReportedAwaitingAdmin,
      'VERIFIED' => l10n.reservationReportVerifiedMessage,
      'REJECTED' => l10n.reservationReportDismissedMessage,
      'RESOLVED_NO_STRIKE' => l10n.reservationIncidentResolvedMessage,
      _ => null,
    };
  }
  switch (status) {
    case 'PENDING_REVIEW':
      return 'This reservation was reported and is awaiting admin review.';
    case 'VERIFIED':
      return 'Your report was verified by an admin.';
    case 'REJECTED':
      return 'Your report was reviewed and dismissed.';
    case 'RESOLVED_NO_STRIKE':
      return 'This incident was resolved without a strike.';
    default:
      return null;
  }
}

String reservationStatusLabel(
  String status, {
  String? fulfillmentMethod,
  String? deliveryStatus,
  DateTime? pickupWindowEnd,
  String? incidentReviewStatus,
  bool isOverdue = false,
  bool needsFollowUp = false,
  String? rejectionReason,
  String? pendingRescheduleReason,
  AppLocalizations? l10n,
}) {
  if (l10n != null) {
    return LearnerUiLabels(l10n).reservationStatus(
      status,
      fulfillmentMethod: fulfillmentMethod,
      deliveryStatus: deliveryStatus,
      pickupWindowEnd: pickupWindowEnd,
      incidentReviewStatus: incidentReviewStatus,
      isOverdue: isOverdue,
      needsFollowUp: needsFollowUp,
      rejectionReason: rejectionReason,
      pendingRescheduleReason: pendingRescheduleReason,
    );
  }
  switch (status) {
    case 'PENDING':
      return 'Pending supplier response';
    case 'AWAITING_LEARNER_CONFIRMATION':
      return 'Needs your confirmation';
    case 'AWAITING_SUPPLIER_CONFIRMATION':
      if (pendingRescheduleReason != null &&
          adminPickupReconfirmReasons.contains(pendingRescheduleReason)) {
        return 'Waiting for supplier to choose a new pickup window';
      }
      return 'Waiting for supplier response';
    case 'ACCEPTED':
      if (fulfillmentMethod == 'DELIVERY') {
        return 'Accepted';
      }
      if (isOverdue || needsFollowUp) {
        return 'Pickup window passed';
      }
      return 'Accepted / Ready for pickup';
    case 'REJECTED':
      return 'Rejected';
    case 'COMPLETED':
      if (fulfillmentMethod == 'DELIVERY' &&
          (deliveryStatus != null &&
              isSuccessfulLearnerDeliveryStatus(deliveryStatus))) {
        return 'Completed';
      }
      return 'Completed';
    case 'CANCELLED':
      if (fulfillmentMethod == 'PICKUP' && pickupWindowEnd != null) {
        return 'Closed after missed pickup';
      }
      return 'Cancelled';
    case 'EXPIRED':
      if (rejectionReason == missedPickupExpiryReason) {
        return 'Pickup missed';
      }
      if (rejectionReason == noDriverCancelReason) {
        return 'Cancelled — no driver available';
      }
      if (rejectionReason == stalePickupCancelReason) {
        return 'Admin cancelled due to unresolved pickup';
      }
      if (rejectionReason == null || rejectionReason.trim().isEmpty) {
        return 'Expired — no response';
      }
      return 'Expired';
    case 'NO_SHOW':
      return 'Pickup missed';
    case 'FULFILLMENT_FAILED':
      return 'Fulfillment failed';
    case 'AWAITING_RESOLUTION':
      return incidentReviewStatusLabel(incidentReviewStatus);
    default:
      return 'Unknown status';
  }
}

String? resolveLearnerChipDeliveryStatus({
  required LearnerReservation reservation,
  String? linkedDeliveryStatus,
}) => linkedDeliveryStatus ?? reservation.activeDelivery?.status;

bool learnerNoDriverIncidentAwaitingResolution({
  required String reservationStatus,
  required String fulfillmentMethod,
  String? deliveryStatus,
  String? activeDeliveryStatus,
}) {
  if (reservationStatus != 'AWAITING_RESOLUTION') {
    return false;
  }

  if (fulfillmentMethod.toUpperCase() != 'DELIVERY') {
    return false;
  }

  final effectiveStatus = deliveryStatus ?? activeDeliveryStatus;
  return effectiveStatus?.toUpperCase() == 'AWAITING_RESOLUTION';
}

class LearnerReservationStatusChipLabels {
  const LearnerReservationStatusChipLabels({
    required this.primary,
    this.secondary,
  });

  final String primary;
  final String? secondary;
}

LearnerReservationStatusChipLabels learnerReservationStatusChipLabels(
  LearnerReservation reservation, {
  String? linkedDeliveryStatus,
  AppLocalizations? l10n,
}) {
  final deliveryStatus = resolveLearnerChipDeliveryStatus(
    reservation: reservation,
    linkedDeliveryStatus: linkedDeliveryStatus,
  );

  final primary =
      learnerDeliveryPrimaryStatusLabel(
        reservationStatus: reservation.status,
        fulfillmentMethod: reservation.fulfillmentMethod,
        deliveryStatus: deliveryStatus,
        incidentReviewStatus: reservation.incidentReviewStatus,
        l10n: l10n,
      ) ??
      reservationStatusLabel(
        reservation.status,
        fulfillmentMethod: reservation.fulfillmentMethod,
        deliveryStatus: deliveryStatus,
        pickupWindowEnd: reservation.pickupWindowEnd,
        incidentReviewStatus: reservation.incidentReviewStatus,
        isOverdue: reservation.isOverdue,
        needsFollowUp: reservation.needsFollowUp,
        rejectionReason: reservation.rejectionReason,
        pendingRescheduleReason: reservation.pendingRescheduleReason,
        l10n: l10n,
      );

  final secondary = learnerDeliverySecondaryStatusLabel(
    reservationStatus: reservation.status,
    fulfillmentMethod: reservation.fulfillmentMethod,
    deliveryStatus: deliveryStatus,
    incidentReviewStatus: reservation.incidentReviewStatus,
    noDriverOverdue: reservation.canReportNoDriverAvailable,
    assignedDriverPickupOverdue: reservation.assignedDriverPickupOverdue,
    pendingIncidentReasonCode: reservation.pendingIncidentReasonCode,
    activeDeliveryStatus: reservation.activeDelivery?.status,
    l10n: l10n,
  );

  if (secondary != null && secondary != primary) {
    return LearnerReservationStatusChipLabels(
      primary: primary,
      secondary: secondary,
    );
  }

  if (reservation.status != 'AWAITING_RESOLUTION' &&
      reservation.isDeliveryFulfillment &&
      deliveryStatus != null) {
    final fallback = deliveryStatusLabel(deliveryStatus, l10n: l10n);
    if (fallback != primary) {
      return LearnerReservationStatusChipLabels(
        primary: primary,
        secondary: fallback,
      );
    }
  }

  return LearnerReservationStatusChipLabels(primary: primary);
}

String? learnerDeliverySecondaryStatusLabel({
  required String reservationStatus,
  required String fulfillmentMethod,
  String? deliveryStatus,
  String? incidentReviewStatus,
  bool noDriverOverdue = false,
  bool assignedDriverPickupOverdue = false,
  String? pendingIncidentReasonCode,
  String? activeDeliveryStatus,
  AppLocalizations? l10n,
}) {
  if (fulfillmentMethod.toUpperCase() != 'DELIVERY') {
    return null;
  }

  final normalizedDeliveryStatus = (deliveryStatus ?? activeDeliveryStatus)
      ?.toUpperCase();

  if (reservationStatus == 'COMPLETED' ||
      isSuccessfulLearnerDeliveryStatus(normalizedDeliveryStatus)) {
    return l10n?.statusDelivered ?? 'Delivered';
  }

  if (reservationStatus == 'AWAITING_RESOLUTION') {
    switch (pendingIncidentReasonCode) {
      case 'NO_DRIVER_AVAILABLE':
        return l10n?.statusNoDriverAvailable ?? 'No driver available';
      case 'NO_RESPONSE_AFTER_PICKUP_WINDOW':
        return l10n?.statusDriverPickupOverdue ?? 'Driver pickup overdue';
    }

    switch (normalizedDeliveryStatus) {
      case 'FAILED_DELIVERY':
      case 'LEARNER_NO_SHOW':
        return l10n?.statusDeliveryIssueReported ?? 'Delivery issue reported';
      case 'FAILED_PICKUP':
        return l10n?.statusPickupFailed ?? 'Pickup failed';
      case 'DRIVER_NO_SHOW':
        return l10n?.statusDriverNoShow ?? 'Driver no-show';
      default:
        return null;
    }
  }

  if (reservationStatus != 'ACCEPTED') {
    return null;
  }

  switch (normalizedDeliveryStatus) {
    case 'WAITING_FOR_DRIVER':
      return noDriverOverdue
          ? l10n?.statusDriverNotAssignedInTime ?? 'Driver not assigned in time'
          : l10n?.statusWaitingDriver ?? 'Waiting for driver';
    case 'DRIVER_ASSIGNED':
      return assignedDriverPickupOverdue
          ? l10n?.statusDriverPickupOverdue ?? 'Driver pickup overdue'
          : l10n?.statusDriverAssigned ?? 'Driver assigned';
    case 'ARRIVED_PICKUP':
      return assignedDriverPickupOverdue
          ? l10n?.statusPickupNotCompleted ?? 'Pickup not completed'
          : l10n?.statusAtSupplierPickup ?? 'At supplier pickup';
    case 'PICKED_UP':
    case 'ON_THE_WAY':
    case 'ARRIVED_DROPOFF':
      return l10n?.statusOnTheWay ?? 'On the way';
    default:
      return null;
  }
}

String? learnerDeliveryPrimaryStatusLabel({
  required String reservationStatus,
  required String fulfillmentMethod,
  String? deliveryStatus,
  String? incidentReviewStatus,
  AppLocalizations? l10n,
}) {
  if (fulfillmentMethod.toUpperCase() != 'DELIVERY') {
    return null;
  }

  final normalizedDeliveryStatus = deliveryStatus?.toUpperCase();

  if (reservationStatus == 'COMPLETED' ||
      isSuccessfulLearnerDeliveryStatus(normalizedDeliveryStatus)) {
    return l10n?.statusCompleted ?? 'Completed';
  }

  if (reservationStatus == 'AWAITING_LEARNER_CONFIRMATION') {
    return l10n?.statusNeedsConfirmation ?? 'Needs your confirmation';
  }

  if (reservationStatus == 'AWAITING_RESOLUTION') {
    return incidentReviewStatusLabel(incidentReviewStatus, l10n: l10n);
  }

  if (normalizedDeliveryStatus == 'PICKED_UP' ||
      normalizedDeliveryStatus == 'ON_THE_WAY' ||
      normalizedDeliveryStatus == 'ARRIVED_DROPOFF') {
    return l10n?.statusInDelivery ?? 'In delivery';
  }

  if (reservationStatus == 'ACCEPTED') {
    return l10n?.statusAccepted ?? 'Accepted';
  }

  return null;
}

String formatFulfillmentMethodLabel(
  LearnerReservation reservation, {
  AppLocalizations? l10n,
}) {
  return reservation.isDeliveryFulfillment
      ? l10n?.delivery ?? 'Delivery'
      : l10n?.pickup ?? 'Pickup';
}

String? formatPreferredWindowsSummary(
  LearnerReservation reservation, {
  required AppLocalizations l10n,
}) {
  final windows = reservation.isDeliveryFulfillment
      ? reservation.learnerPreferredDeliveryWindows
      : reservation.learnerPreferredPickupWindows;

  if (windows.isEmpty) {
    return null;
  }

  final prefix = reservation.isDeliveryFulfillment
      ? l10n.preferredDelivery
      : l10n.requestedPickup;
  final first = LocalizedFormatters(
    l10n,
  ).dateTimeRange(windows.first.start, windows.first.end);
  if (windows.length == 1) return '$prefix: $first';
  return '$prefix: $first (${l10n.additionalWindows(windows.length - 1)})';
}

String? formatDeliveryAddressSummary(
  LearnerReservation reservation, {
  AppLocalizations? l10n,
}) {
  if (!reservation.isDeliveryFulfillment) {
    return null;
  }

  final address = reservation.deliveryAddressText?.trim();
  if (address == null || address.isEmpty) {
    return null;
  }

  return l10n?.deliveryAddressLabel(address) ?? 'Delivery address: $address';
}

String? formatSafeDropoffSummary(
  LearnerReservation reservation, {
  AppLocalizations? l10n,
}) {
  if (!reservation.isDeliveryFulfillment ||
      reservation.safeDropoffAllowed == null) {
    return null;
  }

  return reservation.safeDropoffAllowed == true
      ? l10n?.safeDropoffAllowed ?? 'Safe drop-off allowed'
      : l10n?.safeDropoffNotAllowed ?? 'Safe drop-off not allowed';
}

String formatReservationDate(DateTime value, {required AppLocalizations l10n}) {
  return LocalizedFormatters(l10n).date(value);
}

String formatPreferredWindowRange(
  ReservationPreferredWindow window, {
  String prefix = '',
  required AppLocalizations l10n,
}) {
  final range = LocalizedFormatters(
    l10n,
  ).dateTimeRange(window.start, window.end);
  return prefix.isEmpty ? range : '$prefix: $range';
}

String? formatAwaitingPickupPreferredSummary(
  LearnerReservation reservation, {
  required AppLocalizations l10n,
}) {
  if (reservation.learnerPreferredPickupWindows.isEmpty) {
    return null;
  }

  final window = formatPreferredWindowRange(
    reservation.learnerPreferredPickupWindows.first,
    l10n: l10n,
  );
  return l10n.yourPreferredPickupWindow(window);
}

String? formatAwaitingPickupProposedSummary(
  LearnerReservation reservation, {
  required AppLocalizations l10n,
}) {
  if (reservation.supplierProposedPickupWindowStart == null ||
      reservation.supplierProposedPickupWindowEnd == null) {
    return null;
  }

  final window = formatPreferredWindowRange(
    ReservationPreferredWindow(
      start: reservation.supplierProposedPickupWindowStart!,
      end: reservation.supplierProposedPickupWindowEnd!,
    ),
    l10n: l10n,
  );
  return l10n.supplierProposedPickupWindow(window);
}

String? formatAwaitingDeliverySupplierPickupSummary(
  LearnerReservation reservation, {
  required AppLocalizations l10n,
}) {
  final start = reservation.supplierPickupWindowStart;
  if (start == null) return null;
  final window = formatPreferredWindowRange(
    ReservationPreferredWindow(
      start: start,
      end: reservation.supplierPickupWindowEnd ?? start,
    ),
    l10n: l10n,
  );
  return l10n.supplierDriverPickupWindow(window);
}

String? formatAwaitingDeliveryEarliestSummary(
  LearnerReservation reservation, {
  required AppLocalizations l10n,
}) {
  if (reservation.earliestDeliveryStart == null) {
    return null;
  }

  final formatted = LocalizedFormatters(
    l10n,
  ).dateTime(reservation.earliestDeliveryStart!);
  return l10n.earliestPossibleDelivery(formatted);
}

String? formatAwaitingDeliveryProposedSummary(
  LearnerReservation reservation, {
  required AppLocalizations l10n,
}) {
  if (reservation.confirmedDeliveryWindowStart == null ||
      reservation.confirmedDeliveryWindowEnd == null) {
    return null;
  }

  final window = formatPreferredWindowRange(
    ReservationPreferredWindow(
      start: reservation.confirmedDeliveryWindowStart!,
      end: reservation.confirmedDeliveryWindowEnd!,
    ),
    l10n: l10n,
  );
  return l10n.supplierProposedDeliveryWindow(window);
}

String? formatConfirmedDeliveryWindowSummary(
  LearnerReservation reservation, {
  required AppLocalizations l10n,
}) {
  if (!reservation.isAccepted ||
      reservation.confirmedDeliveryWindowStart == null ||
      reservation.confirmedDeliveryWindowEnd == null) {
    return null;
  }

  final window = formatPreferredWindowRange(
    ReservationPreferredWindow(
      start: reservation.confirmedDeliveryWindowStart!,
      end: reservation.confirmedDeliveryWindowEnd!,
    ),
    l10n: l10n,
  );
  return l10n.confirmedDeliveryWindow(window);
}

String? formatSupplierPickupWindowSummary(
  LearnerReservation reservation, {
  required AppLocalizations l10n,
}) {
  if (reservation.supplierPickupWindowStart == null ||
      reservation.supplierPickupWindowEnd == null) {
    return null;
  }

  final window = formatPreferredWindowRange(
    ReservationPreferredWindow(
      start: reservation.supplierPickupWindowStart!,
      end: reservation.supplierPickupWindowEnd!,
    ),
    l10n: l10n,
  );
  return l10n.supplierPickupWindow(window);
}

String? formatAwaitingDeliveryPreferredSummary(
  LearnerReservation reservation, {
  required AppLocalizations l10n,
}) {
  if (reservation.learnerPreferredDeliveryWindows.isEmpty) {
    return null;
  }

  final window = formatPreferredWindowRange(
    reservation.learnerPreferredDeliveryWindows.first,
    l10n: l10n,
  );
  return l10n.previousPreferredDeliveryWindow(window);
}

String? formatSchedulingConflictReason(
  LearnerReservation reservation, {
  required AppLocalizations l10n,
}) {
  final reason = reservation.schedulingConflictReason?.trim();
  if (reason == null || reason.isEmpty) {
    return null;
  }

  return l10n.schedulingConflict(reason);
}

String? formatPickupWindow(
  LearnerReservation reservation, {
  required AppLocalizations l10n,
}) {
  if (!reservation.isAccepted || reservation.pickupWindowStart == null) {
    return null;
  }

  final start = reservation.pickupWindowStart!;
  final end = reservation.pickupWindowEnd;
  final formatted = end == null
      ? LocalizedFormatters(l10n).dateTime(start)
      : LocalizedFormatters(l10n).dateTimeRange(start, end);
  return l10n.confirmedPickupWindow(formatted);
}

String? reservationStatusMessage(
  LearnerReservation reservation, {
  required AppLocalizations l10n,
}) {
  if (reservation.isPending) {
    return l10n.reservationWaitingSupplierMessage;
  }

  if (reservation.isAwaitingConfirmation) {
    return l10n.reservationScheduleNeedsConfirmation;
  }

  if (reservation.isAwaitingSupplierConfirmation) {
    return l10n.reservationRescheduleWaitingSupplier;
  }

  if (reservation.isAwaitingResolution) {
    return incidentReviewStatusMessage(
          reservation.incidentReviewStatus,
          l10n: l10n,
        ) ??
        l10n.reservationReportedAwaitingAdmin;
  }

  if (reservation.isAccepted) {
    if (reservation.isOverdue || reservation.needsFollowUp) {
      return l10n.pickupWindowPassedFollowup;
    }

    return reservation.supplierNote?.trim().isNotEmpty == true
        ? reservation.supplierNote
        : l10n.reservationAcceptedPickupMessage;
  }

  if (reservation.isRejected) {
    return reservation.rejectionReason?.trim().isNotEmpty == true
        ? reservation.rejectionReason
        : l10n.reservationRejectedSupplierMessage;
  }

  if (reservation.isCompleted) {
    return l10n.reservationCompletedMessage;
  }

  if (reservation.isCancelled) {
    return l10n.reservationCancelledMessage;
  }

  if (reservation.isExpired) {
    if (isMissedPickupExpiry(reservation)) {
      return l10n.reservationMissedPickupExpiredMessage;
    }
    if (reservation.rejectionReason == null ||
        reservation.rejectionReason!.trim().isEmpty) {
      return l10n.reservationSupplierNoResponseExpired;
    }
    return l10n.reservationExpiredMessage;
  }

  return null;
}

String formatRequestedQuantity(LearnerReservation reservation) {
  final quantity = reservation.quantityRequested;
  final formatted = quantity == quantity.roundToDouble()
      ? quantity.toStringAsFixed(0)
      : quantity.toString();
  return '$formatted ${reservation.material.unit}';
}

String formatSupplierQuantityLine(
  LearnerReservation reservation, {
  required AppLocalizations l10n,
}) {
  return l10n.supplierQuantityLine(
    reservation.supplier.displayName,
    formatRequestedQuantity(reservation),
  );
}

String? formatPickupAddress(LearnerReservation reservation) {
  if (!reservation.isAccepted) {
    return null;
  }

  final address = reservation.pickupLocationFull?.formattedAddress;
  if (address == null || address.trim().isEmpty) {
    return null;
  }

  return address;
}

String formatDeliveryAvailability(
  LearnerReservation reservation, {
  required AppLocalizations l10n,
  bool hasDeliveryRecord = false,
}) {
  if (hasDeliveryRecord) {
    return l10n.deliveryInProgress;
  }

  if (reservation.isDeliveryFulfillment) {
    if (reservation.isAccepted) {
      return reservation.activeDelivery != null
          ? l10n.deliveryScheduled
          : l10n.deliveryReservation;
    }

    return reservation.isPending
        ? l10n.deliverySelectedAtReservation
        : l10n.deliveryReservation;
  }

  if (reservation.activeDelivery != null &&
      !reservation.isDeliveryFulfillment) {
    return l10n.deliveryRequestedStatus;
  }

  if (reservation.material.deliveryAllowed) {
    return l10n.deliveryAvailable;
  }

  return l10n.pickupOnly;
}

bool shouldShowAcceptedPickupInfo(LearnerReservation reservation) =>
    reservation.isAccepted;

String combinedDeliverySummary(
  LearnerReservation reservation, {
  required AppLocalizations l10n,
}) {
  final formatters = LocalizedFormatters(l10n);
  final parts = <String>[
    l10n.combinedDelivery,
    if (reservation.groupItemCount != null && reservation.groupItemCount! > 0)
      l10n.combinedDeliveryItems(reservation.groupItemCount!),
    if (reservation.groupTotal != null)
      l10n.combinedDeliveryTotal(
        reservation.currency ?? 'NIS',
        formatters.number(reservation.groupTotal!, decimalDigits: 2),
      ),
    if (reservation.deliveryFee == 0) l10n.combinedDeliveryFeeOnce,
  ];

  return parts.join(' · ');
}

bool shouldShowSelfPickupMap(
  LearnerReservation reservation, {
  required bool hasDeliveryRecord,
}) =>
    reservation.shouldShowSelfPickupAddress(
      hasDeliveryRecord: hasDeliveryRecord,
    ) &&
    reservation.pickupLocationFull?.hasCoordinates == true;
