import 'app_status_badge.dart';

/// Maps Learning Project lifecycle values to the shared semantic status contract.
AppStatusTone learningProjectStatusTone(String status) {
  switch (status.trim().toUpperCase()) {
    case 'PENDING_REVIEW':
    case 'CHANGES_REQUESTED':
      return AppStatusTone.warning;
    case 'PUBLISHED':
      return AppStatusTone.success;
    case 'REJECTED':
    case 'HIDDEN':
      return AppStatusTone.danger;
    case 'ARCHIVED':
    case 'DRAFT':
    default:
      return AppStatusTone.neutral;
  }
}
