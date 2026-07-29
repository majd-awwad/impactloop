import 'app_status_badge.dart';

/// Maps account availability values to the shared semantic status contract.
AppStatusTone accountStatusTone(String status) {
  switch (status.trim().toUpperCase()) {
    case 'ACTIVE':
      return AppStatusTone.primary;
    case 'SUSPENDED':
    case 'INACTIVE':
      return AppStatusTone.warning;
    case 'DISABLED':
      return AppStatusTone.danger;
    default:
      return AppStatusTone.neutral;
  }
}
