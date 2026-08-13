import '../../../core/format/localized_formatters.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/l10n/learner_ui_labels.dart';
import '../../../shared/widgets/app_status_badge.dart';
import '../domain/delivery_status_contract.dart';

String? formatDeliveryPickupWindow({
  required DateTime? pickupWindowStart,
  DateTime? pickupWindowEnd,
  required AppLocalizations l10n,
}) {
  if (pickupWindowStart == null) {
    return null;
  }

  final start = pickupWindowStart.toLocal();
  final end = pickupWindowEnd?.toLocal();
  final formatter = LocalizedFormatters(l10n);
  return end == null
      ? formatter.dateTime(start)
      : formatter.dateTimeRange(start, end);
}

String deliveryStatusLabel(String status, {AppLocalizations? l10n}) {
  final normalized = normalizeDeliveryStatus(status);
  if (l10n != null) return LearnerUiLabels(l10n).deliveryStatus(status);
  switch (normalized) {
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
    case 'REDELIVERY_PENDING':
      return 'Redelivery is being arranged';
    case 'REDELIVERY_SCHEDULED':
      return 'Redelivery scheduled';
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
      return 'Unknown status';
  }
}

/// Maps delivery lifecycle states to the app-wide semantic status contract.
AppStatusTone deliveryStatusAppTone(String status) {
  switch (normalizeDeliveryStatus(status)) {
    case 'WAITING_FOR_DRIVER':
      return AppStatusTone.warning;
    case 'DRIVER_ASSIGNED':
    case 'ARRIVED_PICKUP':
    case 'PICKED_UP':
    case 'ON_THE_WAY':
    case 'ARRIVED_DROPOFF':
    case 'REDELIVERY_PENDING':
    case 'REDELIVERY_SCHEDULED':
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
