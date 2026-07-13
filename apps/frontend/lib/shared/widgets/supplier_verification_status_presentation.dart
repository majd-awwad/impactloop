import 'app_status_badge.dart';

/// Maps supplier verification values to the shared semantic status contract.
AppStatusTone supplierVerificationStatusTone(String status) {
  switch (status.trim().toUpperCase()) {
    case 'PENDING':
    case 'CHANGES_REQUESTED':
    case 'UNVERIFIED':
      return AppStatusTone.warning;
    case 'APPROVED':
    case 'VERIFIED':
      return AppStatusTone.success;
    case 'REJECTED':
      return AppStatusTone.danger;
    case 'NOT_REQUIRED':
    default:
      return AppStatusTone.neutral;
  }
}
