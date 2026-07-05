import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../app/theme/app_theme_colors.dart';
import '../data/models/learner_reservation.dart';
import '../data/models/reservation_preferred_window.dart';

enum LearnerReservationStatusFilter {
  all,
  active,
  needsAction,
  pending,
  accepted,
  completed,
  cancelled,
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
      case LearnerReservationStatusFilter.cancelled:
        return 'Cancelled';
    }
  }
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
          reservation.status == 'AWAITING_RESOLUTION';
    case LearnerReservationStatusFilter.needsAction:
      return reservation.isAwaitingConfirmation;
    case LearnerReservationStatusFilter.pending:
      return reservation.isPending;
    case LearnerReservationStatusFilter.accepted:
      return reservation.isAccepted;
    case LearnerReservationStatusFilter.completed:
      return reservation.isCompleted;
    case LearnerReservationStatusFilter.cancelled:
      return reservation.isCancelled ||
          reservation.isRejected ||
          reservation.isExpired;
  }
}

class LearnerReservationStatusStyle {
  const LearnerReservationStatusStyle({
    required this.accentColor,
    required this.chipBackground,
    required this.chipForeground,
    required this.chipBorder,
  });

  final Color accentColor;
  final Color chipBackground;
  final Color chipForeground;
  final Color chipBorder;

  static LearnerReservationStatusStyle forStatus(
    BuildContext context,
    String status,
  ) {
    final colors = AppThemeColors.of(context);

    switch (status) {
      case 'PENDING':
        return LearnerReservationStatusStyle(
          accentColor: colors.warning.withValues(alpha: 0.85),
          chipBackground: colors.warningSoft,
          chipForeground: colors.warningText,
          chipBorder: colors.warningBorder,
        );
      case 'AWAITING_LEARNER_CONFIRMATION':
        return LearnerReservationStatusStyle(
          accentColor: colors.primary.withValues(alpha: 0.85),
          chipBackground: colors.primarySoft,
          chipForeground: colors.primary,
          chipBorder: colors.primary.withValues(alpha: 0.35),
        );
      case 'AWAITING_SUPPLIER_CONFIRMATION':
        return LearnerReservationStatusStyle(
          accentColor: colors.primary.withValues(alpha: 0.85),
          chipBackground: colors.primarySoft,
          chipForeground: colors.primary,
          chipBorder: colors.primary.withValues(alpha: 0.35),
        );
      case 'ACCEPTED':
      case 'COMPLETED':
        return LearnerReservationStatusStyle(
          accentColor: colors.success.withValues(alpha: 0.85),
          chipBackground: colors.successSoft,
          chipForeground: colors.success,
          chipBorder: colors.success.withValues(alpha: 0.35),
        );
      case 'REJECTED':
        return LearnerReservationStatusStyle(
          accentColor: colors.danger.withValues(alpha: 0.75),
          chipBackground: colors.dangerSoft,
          chipForeground: colors.danger,
          chipBorder: colors.danger.withValues(alpha: 0.35),
        );
      case 'CANCELLED':
      case 'EXPIRED':
      case 'NO_SHOW':
      case 'FULFILLMENT_FAILED':
        return LearnerReservationStatusStyle(
          accentColor: colors.borderStrong.withValues(alpha: 0.55),
          chipBackground: colors.cardSurfaceAlt,
          chipForeground: colors.textSecondary,
          chipBorder: colors.borderSubtle,
        );
      case 'AWAITING_RESOLUTION':
        return LearnerReservationStatusStyle(
          accentColor: colors.warning.withValues(alpha: 0.85),
          chipBackground: colors.warningSoft,
          chipForeground: colors.warningText,
          chipBorder: colors.warningBorder,
        );
      default:
        return LearnerReservationStatusStyle(
          accentColor: colors.borderSubtle,
          chipBackground: colors.cardSurfaceAlt,
          chipForeground: colors.textMuted,
          chipBorder: colors.borderSubtle,
        );
    }
  }
}

String reservationStatusLabel(
  String status, {
  String? fulfillmentMethod,
  String? deliveryStatus,
  DateTime? pickupWindowEnd,
}) {
  switch (status) {
    case 'PENDING':
      return 'Pending supplier response';
    case 'AWAITING_LEARNER_CONFIRMATION':
      return 'Needs your confirmation';
    case 'AWAITING_SUPPLIER_CONFIRMATION':
      return 'Waiting for supplier response';
    case 'ACCEPTED':
      if (fulfillmentMethod == 'DELIVERY') {
        return 'Accepted';
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
      return 'Expired';
    case 'NO_SHOW':
      return 'Pickup missed';
    case 'FULFILLMENT_FAILED':
      return 'Fulfillment failed';
    case 'AWAITING_RESOLUTION':
      return 'Pending admin review';
    default:
      return status;
  }
}

String? learnerDeliverySecondaryStatusLabel({
  required String reservationStatus,
  required String fulfillmentMethod,
  String? deliveryStatus,
}) {
  if (fulfillmentMethod.toUpperCase() != 'DELIVERY') {
    return null;
  }

  final normalizedDeliveryStatus = deliveryStatus?.toUpperCase();

  if (reservationStatus == 'COMPLETED' ||
      normalizedDeliveryStatus == 'DELIVERED') {
    return 'Delivered';
  }

  if (reservationStatus == 'AWAITING_RESOLUTION') {
    switch (normalizedDeliveryStatus) {
      case 'FAILED_DELIVERY':
      case 'LEARNER_NO_SHOW':
        return 'Delivery issue reported';
      case 'FAILED_PICKUP':
        return 'Pickup failed';
      case 'DRIVER_NO_SHOW':
        return 'Driver no-show';
      default:
        return 'Pending admin review';
    }
  }

  if (reservationStatus != 'ACCEPTED') {
    return null;
  }

  switch (normalizedDeliveryStatus) {
    case 'WAITING_FOR_DRIVER':
      return 'Waiting for driver';
    case 'DRIVER_ASSIGNED':
    case 'ARRIVED_PICKUP':
      return 'Driver assigned';
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
    return 'Pending admin review';
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

  final prefix =
      reservation.isDeliveryFulfillment ? 'Preferred delivery' : 'Preferred pickup';
  final dateFormat = DateFormat('MMM d');
  final timeFormat = DateFormat('h:mm a');

  String formatWindow(ReservationPreferredWindow window) {
    final start = window.start.toLocal();
    final end = window.end.toLocal();
    final sameDay = start.year == end.year &&
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
  if (!reservation.isDeliveryFulfillment || reservation.safeDropoffAllowed == null) {
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
  final sameDay = start.year == end.year &&
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
    return 'Pickup: ${dateFormat.format(start)}, ${timeFormat.format(start)}';
  }

  final sameDay = start.year == end.year &&
      start.month == end.month &&
      start.day == end.day;

  if (sameDay) {
    return 'Pickup: ${dateFormat.format(start)}, '
        '${timeFormat.format(start)} – ${timeFormat.format(end)}';
  }

  return 'Pickup: ${dateFormat.format(start)}, ${timeFormat.format(start)} – '
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
    return 'This reservation was reported and is awaiting admin review.';
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

  if (reservation.deliveryRequested) {
    return 'Delivery requested';
  }

  if (reservation.material.deliveryAllowed) {
    return 'Delivery available';
  }

  return 'Pickup only';
}

bool shouldShowAcceptedPickupInfo(LearnerReservation reservation) =>
    reservation.isAccepted;

bool shouldShowSelfPickupMap(
  LearnerReservation reservation, {
  required bool hasDeliveryRecord,
}) =>
    reservation.shouldShowSelfPickupAddress(
      hasDeliveryRecord: hasDeliveryRecord,
    ) &&
    reservation.pickupLocationFull?.hasCoordinates == true;
