import 'app_status_badge.dart';

/// Maps invitation lifecycle values to the shared semantic status contract.
AppStatusTone invitationStatusTone(String status) {
  switch (status.trim().toUpperCase()) {
    case 'PENDING':
    case 'SENT':
      return AppStatusTone.warning;
    case 'ACCEPTED':
    case 'USED':
      return AppStatusTone.success;
    case 'FAILED':
    case 'EXPIRED':
    case 'REVOKED':
      return AppStatusTone.danger;
    default:
      return AppStatusTone.neutral;
  }
}
