import 'package:intl/intl.dart';

import '../../../shared/widgets/app_status_badge.dart';

String? formatDeliveryPickupWindow({
  required DateTime? pickupWindowStart,
  DateTime? pickupWindowEnd,
}) {
  if (pickupWindowStart == null) {
    return null;
  }

  final start = pickupWindowStart.toLocal();
  final end = pickupWindowEnd?.toLocal();
  final dateFormat = DateFormat('MMM d');
  final timeFormat = DateFormat('h:mm a');

  if (end == null) {
    return '${dateFormat.format(start)}, ${timeFormat.format(start)}';
  }

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

String deliveryStatusLabel(String status) {
  switch (status) {
    case 'WAITING_FOR_DRIVER':
      return 'Waiting for driver';
    case 'DRIVER_ASSIGNED':
      return 'Driver assigned';
    case 'ARRIVED_PICKUP':
      return 'Driver at pickup';
    case 'PICKED_UP':
      return 'Picked up';
    case 'ON_THE_WAY':
      return 'On the way';
    case 'ARRIVED_DROPOFF':
      return 'Arrived at dropoff';
    case 'DELIVERED':
      return 'Delivered';
    case 'CANCELLED':
      return 'Delivery cancelled';
    case 'FAILED_PICKUP':
      return 'Pickup failed';
    case 'FAILED_DELIVERY':
      return 'Delivery failed';
    case 'DRIVER_NO_SHOW':
      return 'Driver no-show';
    case 'LEARNER_NO_SHOW':
      return 'Learner no-show';
    case 'AWAITING_RESOLUTION':
      return 'Needs admin review';
    default:
      return status;
  }
}

/// Maps delivery lifecycle states to the app-wide semantic status contract.
AppStatusTone deliveryStatusAppTone(String status) {
  switch (status) {
    case 'WAITING_FOR_DRIVER':
      return AppStatusTone.warning;
    case 'DRIVER_ASSIGNED':
    case 'ARRIVED_PICKUP':
    case 'PICKED_UP':
    case 'ON_THE_WAY':
    case 'ARRIVED_DROPOFF':
      return AppStatusTone.info;
    case 'DELIVERED':
      return AppStatusTone.success;
    case 'AWAITING_RESOLUTION':
      return AppStatusTone.warning;
    case 'CANCELLED':
    case 'FAILED_PICKUP':
    case 'FAILED_DELIVERY':
    case 'DRIVER_NO_SHOW':
    case 'LEARNER_NO_SHOW':
      return AppStatusTone.danger;
    default:
      return AppStatusTone.neutral;
  }
}
