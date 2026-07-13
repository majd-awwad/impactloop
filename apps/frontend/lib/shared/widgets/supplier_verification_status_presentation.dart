import 'app_status_badge.dart';
import 'review_status_presentation.dart';

/// Maps supplier verification values to the shared semantic status contract.
AppStatusTone supplierVerificationStatusTone(String status) {
  final normalized = status.trim().toUpperCase();
  switch (normalized) {
    case 'UNVERIFIED':
      return AppStatusTone.warning;
    case 'VERIFIED':
      return AppStatusTone.success;
    case 'NOT_REQUIRED':
      return AppStatusTone.neutral;
    default:
      return reviewStatusTone(normalized);
  }
}
