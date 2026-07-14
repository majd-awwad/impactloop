import 'app_status_badge.dart';

/// Maps incident-review lifecycle states to the app-wide semantic status
/// contract.
AppStatusTone incidentReportStatusTone(String? status) {
  switch (status?.trim().toUpperCase()) {
    case 'PENDING_REVIEW':
      return AppStatusTone.warning;
    case 'VERIFIED':
    case 'RESOLVED_NO_STRIKE':
      return AppStatusTone.success;
    case 'REJECTED':
      return AppStatusTone.danger;
    default:
      return AppStatusTone.neutral;
  }
}
