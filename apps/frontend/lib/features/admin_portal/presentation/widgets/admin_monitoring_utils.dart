import 'package:intl/intl.dart';

const kTimeRangeAll = 'ALL';
const kTimeRangeToday = 'TODAY';
const kTimeRangeLast7 = 'LAST_7';
const kTimeRangeLast30 = 'LAST_30';
const kTimeRangeCustom = 'CUSTOM';

class ResolvedDateRange {
  const ResolvedDateRange({this.dateFrom, this.dateTo, this.error});

  final String? dateFrom;
  final String? dateTo;
  final String? error;
}

String formatIsoDate(DateTime date) {
  final month = date.month.toString().padLeft(2, '0');
  final day = date.day.toString().padLeft(2, '0');
  return '${date.year}-$month-$day';
}

ResolvedDateRange resolveDateRange({
  required String timeRange,
  String? customDateFrom,
  String? customDateTo,
}) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);

  switch (timeRange) {
    case kTimeRangeToday:
      final iso = formatIsoDate(today);
      return ResolvedDateRange(dateFrom: iso, dateTo: iso);
    case kTimeRangeLast7:
      return ResolvedDateRange(
        dateFrom: formatIsoDate(today.subtract(const Duration(days: 6))),
        dateTo: formatIsoDate(today),
      );
    case kTimeRangeLast30:
      return ResolvedDateRange(
        dateFrom: formatIsoDate(today.subtract(const Duration(days: 29))),
        dateTo: formatIsoDate(today),
      );
    case kTimeRangeCustom:
      final from = customDateFrom?.trim();
      final to = customDateTo?.trim();
      if (from == null || from.isEmpty || to == null || to.isEmpty) {
        return const ResolvedDateRange(error: 'Select both From and To dates.');
      }
      if (from.compareTo(to) > 0) {
        return const ResolvedDateRange(
          error: 'From date must be on or before To date.',
        );
      }
      return ResolvedDateRange(dateFrom: from, dateTo: to);
    case kTimeRangeAll:
    default:
      return const ResolvedDateRange();
  }
}

String? formatAdminDateTime(String? raw) {
  if (raw == null || raw.isEmpty) return null;
  final parsed = DateTime.tryParse(raw);
  if (parsed == null) return raw;
  return DateFormat.yMMMd().add_jm().format(parsed.toLocal());
}

String humanizeEnum(String value) {
  switch (value.toUpperCase()) {
    case 'LEARNER_DID_NOT_ARRIVE':
      return 'Learner did not arrive';
    case 'SUPPLIER_UNAVAILABLE':
      return 'Supplier unavailable';
    case 'SUPPLIER_MATERIAL_NOT_READY':
      return 'Material not ready';
    case 'NO_DRIVER_AVAILABLE':
      return 'No driver available';
    case 'DRIVER_DID_NOT_ARRIVE':
      return 'Driver no-show';
    case 'PICKUP_FAILED':
      return 'Pickup failed';
    case 'DELIVERY_FAILED':
      return 'Delivery failed';
    case 'DRIVER_ISSUE':
      return 'Driver issue';
    case 'WRONG_INFORMATION':
      return 'Wrong information';
    default:
      final label = value.replaceAll('_', ' ').toLowerCase();
      if (label.isEmpty) return value;
      return '${label[0].toUpperCase()}${label.substring(1)}';
  }
}

String adminIncidentReportStatusLabel(String status) {
  switch (status.toUpperCase()) {
    case 'PENDING_REVIEW':
      return 'Pending admin review';
    case 'RESOLVED_NO_STRIKE':
      return 'Resolved without strike';
    default:
      return monitoringStatusLabel(status);
  }
}

String monitoringStatusLabel(String status) {
  switch (status.toUpperCase()) {
    case 'PENDING':
      return 'Pending';
    case 'ACCEPTED':
      return 'Accepted';
    case 'AWAITING_LEARNER_CONFIRMATION':
      return 'Waiting for learner confirmation';
    case 'AWAITING_SUPPLIER_CONFIRMATION':
      return 'Waiting for supplier response';
    case 'AWAITING_RESOLUTION':
      return 'Pending admin review';
    case 'RESOLVED_NO_STRIKE':
      return 'Resolved without strike';
    case 'VERIFIED':
      return 'Verified';
    case 'REJECTED':
      return 'Rejected';
    case 'COMPLETED':
      return 'Completed';
    case 'CANCELLED':
      return 'Cancelled';
    case 'EXPIRED':
      return 'Expired';
    case 'NO_SHOW':
      return 'Pickup missed';
    case 'FULFILLMENT_FAILED':
      return 'Fulfillment failed';
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
    case 'FAILED_PICKUP':
      return 'Pickup failed';
    case 'FAILED_DELIVERY':
      return 'Delivery failed';
    case 'DRIVER_NO_SHOW':
      return 'Driver no-show';
    case 'LEARNER_NO_SHOW':
      return 'Learner no-show';
    case 'SUSPENDED':
      return 'Suspended';
    case 'ACTIVE':
      return 'Active';
    case 'DISABLED':
      return 'Disabled';
    case 'PENDING_REVIEW':
      return 'Pending review';
    default:
      final label = humanizeEnum(status);
      if (label.isEmpty) return status;
      return '${label[0].toUpperCase()}${label.substring(1)}';
  }
}

String displayPersonLabel(String name, String email) {
  final trimmedName = name.trim();
  if (trimmedName.isNotEmpty) return trimmedName;
  final trimmedEmail = email.trim();
  if (trimmedEmail.isNotEmpty) return trimmedEmail;
  return 'Unknown';
}

String? safeDropdownValue(String selected, Iterable<String> allowed) {
  if (selected == 'ALL') return 'ALL';
  return allowed.contains(selected) ? selected : 'ALL';
}
