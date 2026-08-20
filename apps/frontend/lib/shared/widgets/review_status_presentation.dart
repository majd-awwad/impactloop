import 'app_status_badge.dart';

/// Maps approval workflow values to the shared semantic status contract.
AppStatusTone reviewStatusTone(String status) {
  switch (status.trim().toUpperCase()) {
    case 'PENDING':
    case 'CHANGES_REQUESTED':
      return AppStatusTone.warning;
    case 'APPROVED':
    case 'RESOLVED':
      return AppStatusTone.success;
    case 'REJECTED':
      return AppStatusTone.danger;
    default:
      return AppStatusTone.neutral;
  }
}
