import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../shared/widgets/app_status_badge.dart';
import '../../../shared/widgets/incident_report_status_presentation.dart';
import '../../deliveries/presentation/delivery_status_presentation.dart';
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

String incidentReviewStatusLabel(String? status) {
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

String? incidentReviewStatusMessage(String? status) {
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
}) {
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
          deliveryStatus?.toUpperCase() == 'DELIVERED') {
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
      return status;
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
    final fallback = deliveryStatusLabel(deliveryStatus);
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
}) {
  if (fulfillmentMethod.toUpperCase() != 'DELIVERY') {
    return null;
  }

  final normalizedDeliveryStatus = (deliveryStatus ?? activeDeliveryStatus)
      ?.toUpperCase();

  if (reservationStatus == 'COMPLETED' ||
      normalizedDeliveryStatus == 'DELIVERED') {
    return 'Delivered';
  }

  if (reservationStatus == 'AWAITING_RESOLUTION') {
    switch (pendingIncidentReasonCode) {
      case 'NO_DRIVER_AVAILABLE':
        return 'No driver available';
      case 'NO_RESPONSE_AFTER_PICKUP_WINDOW':
        return 'Driver pickup overdue';
    }

    switch (normalizedDeliveryStatus) {
      case 'FAILED_DELIVERY':
      case 'LEARNER_NO_SHOW':
        return 'Delivery issue reported';
      case 'FAILED_PICKUP':
        return 'Pickup failed';
      case 'DRIVER_NO_SHOW':
        return 'Driver no-show';
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
          ? 'Driver not assigned in time'
          : 'Waiting for driver';
    case 'DRIVER_ASSIGNED':
      return assignedDriverPickupOverdue
          ? 'Driver pickup overdue'
          : 'Driver assigned';
    case 'ARRIVED_PICKUP':
      return assignedDriverPickupOverdue
          ? 'Pickup not completed'
          : 'At supplier pickup';
    case 'PICKED_UP':
    case 'ON_THE_WAY':
    case 'ARRIVED_DROPOFF':
      return 'On the way';
    default:
      return null;
  }
}

String? learnerDeliveryPrimaryStatusLabel({
  required String reservationStatus,
  required String fulfillmentMethod,
  String? deliveryStatus,
  String? incidentReviewStatus,
}) {
  if (fulfillmentMethod.toUpperCase() != 'DELIVERY') {
    return null;
  }

  final normalizedDeliveryStatus = deliveryStatus?.toUpperCase();

  if (reservationStatus == 'COMPLETED' ||
      normalizedDeliveryStatus == 'DELIVERED') {
    return 'Completed';
  }

  if (reservationStatus == 'AWAITING_LEARNER_CONFIRMATION') {
    return 'Needs your confirmation';
  }

  if (reservationStatus == 'AWAITING_RESOLUTION') {
    return incidentReviewStatusLabel(incidentReviewStatus);
  }

  if (normalizedDeliveryStatus == 'PICKED_UP' ||
      normalizedDeliveryStatus == 'ON_THE_WAY' ||
      normalizedDeliveryStatus == 'ARRIVED_DROPOFF') {
    return 'In delivery';
  }

  if (reservationStatus == 'ACCEPTED') {
    return 'Accepted';
  }

  return null;
}

String formatFulfillmentMethodLabel(LearnerReservation reservation) {
  return reservation.isDeliveryFulfillment ? 'Delivery' : 'Pickup';
}

String? formatPreferredWindowsSummary(LearnerReservation reservation) {
  final windows = reservation.isDeliveryFulfillment
      ? reservation.learnerPreferredDeliveryWindows
      : reservation.learnerPreferredPickupWindows;

  if (windows.isEmpty) {
    return null;
  }

  final prefix = reservation.isDeliveryFulfillment
      ? 'Preferred delivery'
      : 'Requested pickup';
  final dateFormat = DateFormat('MMM d');
  final timeFormat = DateFormat('h:mm a');

  String formatWindow(ReservationPreferredWindow window) {
    final start = window.start.toLocal();
    final end = window.end.toLocal();
    final sameDay =
        start.year == end.year &&
        start.month == end.month &&
        start.day == end.day;

    if (sameDay) {
      return '${dateFormat.format(start)}, '
          '${timeFormat.format(start)} – ${timeFormat.format(end)}';
    }

    return '${dateFormat.format(start)}, ${timeFormat.format(start)} – '
        '${dateFormat.format(end)}, ${timeFormat.format(end)}';
  }

  final first = formatWindow(windows.first);
  if (windows.length == 1) {
    return '$prefix: $first';
  }

  return '$prefix: $first (+${windows.length - 1} more)';
}

String? formatDeliveryAddressSummary(LearnerReservation reservation) {
  if (!reservation.isDeliveryFulfillment) {
    return null;
  }

  final address = reservation.deliveryAddressText?.trim();
  if (address == null || address.isEmpty) {
    return null;
  }

  return 'Delivery address: $address';
}

String? formatSafeDropoffSummary(LearnerReservation reservation) {
  if (!reservation.isDeliveryFulfillment ||
      reservation.safeDropoffAllowed == null) {
    return null;
  }

  return reservation.safeDropoffAllowed == true
      ? 'Safe drop-off allowed'
      : 'Safe drop-off not allowed';
}

String formatReservationDate(DateTime value) {
  return DateFormat.yMMMd().format(value.toLocal());
}

String formatPreferredWindowRange(
  ReservationPreferredWindow window, {
  String prefix = '',
}) {
  final dateFormat = DateFormat('MMM d');
  final timeFormat = DateFormat('h:mm a');
  final start = window.start.toLocal();
  final end = window.end.toLocal();
  final sameDay =
      start.year == end.year &&
      start.month == end.month &&
      start.day == end.day;

  final range = sameDay
      ? '${dateFormat.format(start)}, '
            '${timeFormat.format(start)} – ${timeFormat.format(end)}'
      : '${dateFormat.format(start)}, ${timeFormat.format(start)} – '
            '${dateFormat.format(end)}, ${timeFormat.format(end)}';

  if (prefix.isEmpty) {
    return range;
  }

  return '$prefix: $range';
}

String? formatDateTimeRange({
  required String prefix,
  DateTime? start,
  DateTime? end,
}) {
  if (start == null) {
    return null;
  }

  return formatPreferredWindowRange(
    ReservationPreferredWindow(start: start, end: end ?? start),
    prefix: prefix,
  );
}

String? formatAwaitingPickupPreferredSummary(LearnerReservation reservation) {
  if (reservation.learnerPreferredPickupWindows.isEmpty) {
    return null;
  }

  return formatPreferredWindowRange(
    reservation.learnerPreferredPickupWindows.first,
    prefix: 'Your preferred pickup',
  );
}

String? formatAwaitingPickupProposedSummary(LearnerReservation reservation) {
  if (reservation.supplierProposedPickupWindowStart == null ||
      reservation.supplierProposedPickupWindowEnd == null) {
    return null;
  }

  return formatPreferredWindowRange(
    ReservationPreferredWindow(
      start: reservation.supplierProposedPickupWindowStart!,
      end: reservation.supplierProposedPickupWindowEnd!,
    ),
    prefix: 'Supplier proposed pickup',
  );
}

String? formatAwaitingDeliverySupplierPickupSummary(
  LearnerReservation reservation,
) {
  return formatDateTimeRange(
    prefix: 'Supplier driver pickup window',
    start: reservation.supplierPickupWindowStart,
    end: reservation.supplierPickupWindowEnd,
  );
}

String? formatAwaitingDeliveryEarliestSummary(LearnerReservation reservation) {
  if (reservation.earliestDeliveryStart == null) {
    return null;
  }

  final earliest = reservation.earliestDeliveryStart!.toLocal();
  return 'Earliest possible delivery: '
      '${DateFormat('MMM d, h:mm a').format(earliest)}';
}

String? formatAwaitingDeliveryProposedSummary(LearnerReservation reservation) {
  if (reservation.confirmedDeliveryWindowStart == null ||
      reservation.confirmedDeliveryWindowEnd == null) {
    return null;
  }

  return formatPreferredWindowRange(
    ReservationPreferredWindow(
      start: reservation.confirmedDeliveryWindowStart!,
      end: reservation.confirmedDeliveryWindowEnd!,
    ),
    prefix: 'Supplier proposed delivery',
  );
}

String? formatConfirmedDeliveryWindowSummary(LearnerReservation reservation) {
  if (!reservation.isAccepted ||
      reservation.confirmedDeliveryWindowStart == null ||
      reservation.confirmedDeliveryWindowEnd == null) {
    return null;
  }

  return formatPreferredWindowRange(
    ReservationPreferredWindow(
      start: reservation.confirmedDeliveryWindowStart!,
      end: reservation.confirmedDeliveryWindowEnd!,
    ),
    prefix: 'Confirmed delivery',
  );
}

String? formatSupplierPickupWindowSummary(LearnerReservation reservation) {
  if (reservation.supplierPickupWindowStart == null ||
      reservation.supplierPickupWindowEnd == null) {
    return null;
  }

  return formatDateTimeRange(
    prefix: 'Supplier pickup window',
    start: reservation.supplierPickupWindowStart,
    end: reservation.supplierPickupWindowEnd,
  );
}

String? formatAwaitingDeliveryPreferredSummary(LearnerReservation reservation) {
  if (reservation.learnerPreferredDeliveryWindows.isEmpty) {
    return null;
  }

  return formatPreferredWindowRange(
    reservation.learnerPreferredDeliveryWindows.first,
    prefix: 'Your previous preferred delivery',
  );
}

String? formatSchedulingConflictReason(LearnerReservation reservation) {
  final reason = reservation.schedulingConflictReason?.trim();
  if (reason == null || reason.isEmpty) {
    return null;
  }

  return 'Scheduling conflict: $reason';
}

String? formatPickupWindow(LearnerReservation reservation) {
  if (!reservation.isAccepted || reservation.pickupWindowStart == null) {
    return null;
  }

  final start = reservation.pickupWindowStart!.toLocal();
  final end = reservation.pickupWindowEnd?.toLocal();
  final dateFormat = DateFormat('MMM d');
  final timeFormat = DateFormat('h:mm a');

  if (end == null) {
    return 'Confirmed pickup: ${dateFormat.format(start)}, ${timeFormat.format(start)}';
  }

  final sameDay =
      start.year == end.year &&
      start.month == end.month &&
      start.day == end.day;

  if (sameDay) {
    return 'Confirmed pickup: ${dateFormat.format(start)}, '
        '${timeFormat.format(start)} – ${timeFormat.format(end)}';
  }

  return 'Confirmed pickup: ${dateFormat.format(start)}, ${timeFormat.format(start)} – '
      '${dateFormat.format(end)}, ${timeFormat.format(end)}';
}

String? reservationStatusMessage(LearnerReservation reservation) {
  if (reservation.isPending) {
    return 'Waiting for supplier response.';
  }

  if (reservation.isAwaitingConfirmation) {
    return 'The supplier proposed a schedule that needs your confirmation.';
  }

  if (reservation.isAwaitingSupplierConfirmation) {
    return 'You requested a new pickup time. Waiting for the supplier to respond.';
  }

  if (reservation.isAwaitingResolution) {
    return incidentReviewStatusMessage(reservation.incidentReviewStatus) ??
        'This reservation was reported and is awaiting admin review.';
  }

  if (reservation.isAccepted) {
    if (reservation.isOverdue || reservation.needsFollowUp) {
      return 'Pickup window passed. Please contact the supplier or wait for follow-up.';
    }

    return reservation.supplierNote?.trim().isNotEmpty == true
        ? reservation.supplierNote
        : 'Reservation accepted. Follow the pickup window from the supplier.';
  }

  if (reservation.isRejected) {
    return reservation.rejectionReason?.trim().isNotEmpty == true
        ? reservation.rejectionReason
        : 'The supplier rejected this reservation request.';
  }

  if (reservation.isCompleted) {
    return 'This reservation is completed.';
  }

  if (reservation.isCancelled) {
    return 'This reservation was cancelled.';
  }

  if (reservation.isExpired) {
    if (isMissedPickupExpiry(reservation)) {
      return 'This reservation expired after the pickup window passed without follow-up. Create a new reservation if you still need the material.';
    }
    if (reservation.rejectionReason == null ||
        reservation.rejectionReason!.trim().isEmpty) {
      return 'This request expired because the supplier did not respond in time.';
    }
    return 'This reservation expired.';
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

String formatSupplierQuantityLine(LearnerReservation reservation) {
  return 'Supplier: ${reservation.supplier.displayName} · '
      'Requested: ${formatRequestedQuantity(reservation)}';
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
  bool hasDeliveryRecord = false,
}) {
  if (hasDeliveryRecord) {
    return 'Delivery in progress';
  }

  if (reservation.isDeliveryFulfillment) {
    if (reservation.isAccepted) {
      return reservation.activeDelivery != null
          ? 'Delivery scheduled'
          : 'Delivery reservation';
    }

    return reservation.isPending
        ? 'Delivery selected at reservation'
        : 'Delivery reservation';
  }

  if (reservation.activeDelivery != null &&
      !reservation.isDeliveryFulfillment) {
    return 'Delivery requested';
  }

  if (reservation.material.deliveryAllowed) {
    return 'Delivery available';
  }

  return 'Pickup only';
}

bool shouldShowAcceptedPickupInfo(LearnerReservation reservation) =>
    reservation.isAccepted;

String combinedDeliverySummary(LearnerReservation reservation) {
  final parts = <String>[
    'Combined delivery',
    if (reservation.groupItemCount != null && reservation.groupItemCount! > 0)
      '${reservation.groupItemCount} items in this group',
    if (reservation.groupTotal != null)
      'Group total ${reservation.currency ?? 'NIS'} ${reservation.groupTotal!.toStringAsFixed(2)}',
    if (reservation.deliveryFee == 0) 'Delivery fee charged once for the group',
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
