import 'app_status_badge.dart';
import 'package:flutter/material.dart';

String incidentReasonTitle(String? reasonCode) {
  switch (reasonCode?.trim().toUpperCase()) {
    case 'NO_DRIVER_AVAILABLE':
      return 'No driver available';
    case 'NO_RESPONSE_AFTER_PICKUP_WINDOW':
      return 'Pickup not completed';
    case 'DRIVER_DID_NOT_ARRIVE':
      return 'Driver no-show';
    case 'PICKUP_FAILED':
      return 'Pickup failure';
    case 'REPEATED_DELAY':
      return 'Repeated delay';
    case 'RESERVATION_EXPIRED':
      return 'Reservation expired';
    default:
      return 'Incident report';
  }
}

IconData incidentReasonIcon(String? reasonCode) {
  switch (reasonCode?.trim().toUpperCase()) {
    case 'NO_DRIVER_AVAILABLE':
      return Icons.local_shipping_outlined;
    case 'DRIVER_DID_NOT_ARRIVE':
      return Icons.person_off_outlined;
    case 'PICKUP_FAILED':
      return Icons.inventory_2_outlined;
    default:
      return Icons.report_outlined;
  }
}

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

String incidentReportStatusLabel(String? status) {
  switch (status?.trim().toUpperCase()) {
    case 'PENDING_REVIEW': return 'Pending review';
    case 'VERIFIED': return 'Verified';
    case 'REJECTED': return 'Rejected';
    case 'RESOLVED_NO_STRIKE': return 'Resolved without strike';
    default: return 'Unknown status';
  }
}

String incidentWorkflowLabel(String? workflowType) {
  switch (workflowType?.trim().toUpperCase()) {
    case 'ACCOUNTABILITY': return 'Accountability';
    case 'SYSTEM_RECOVERY': return 'System recovery';
    case 'ACCOUNTABILITY_AND_RECOVERY': return 'Accountability + recovery';
    default: return 'Unknown workflow';
  }
}

AppStatusTone incidentWorkflowTone(String? workflowType) {
  switch (workflowType?.trim().toUpperCase()) {
    case 'ACCOUNTABILITY': return AppStatusTone.info;
    case 'SYSTEM_RECOVERY': return AppStatusTone.success;
    case 'ACCOUNTABILITY_AND_RECOVERY': return AppStatusTone.info;
    default: return AppStatusTone.neutral;
  }
}

String incidentOperationalStateLabel(String? state) {
  switch (state?.trim().toUpperCase()) {
    case 'NOT_REQUIRED': return 'Not required';
    case 'REQUIRES_RESOLUTION': return 'Requires resolution';
    case 'RESOLVED': return 'Resolved';
    default: return 'Unknown state';
  }
}

AppStatusTone incidentOperationalStateTone(String? state) {
  switch (state?.trim().toUpperCase()) {
    case 'REQUIRES_RESOLUTION': return AppStatusTone.warning;
    case 'NOT_REQUIRED':
    case 'RESOLVED': return AppStatusTone.success;
    default: return AppStatusTone.neutral;
  }
}

String incidentTargetRoleLabel(String? role) {
  switch (role?.trim().toUpperCase()) {
    case 'LEARNER': return 'Learner';
    case 'SUPPLIER': return 'Supplier';
    case 'DRIVER': return 'Driver';
    case 'SYSTEM': return 'System';
    default: return 'Target unavailable';
  }
}

class IncidentStrikeDisplay {
  const IncidentStrikeDisplay(this.label, this.icon);
  final String label;
  final IconData icon;
}

IncidentStrikeDisplay incidentStrikeDisplay(
  String? strikeImpact,
  String? reportStatus, {
  required bool hasTargetUser,
}) {
  if (!hasTargetUser || strikeImpact?.trim().toUpperCase() == 'NONE') {
    return const IncidentStrikeDisplay('No strike', Icons.remove_circle_outline);
  }
  if (reportStatus?.trim().toUpperCase() == 'VERIFIED') {
    return const IncidentStrikeDisplay('Strike applied', Icons.check_circle_outline);
  }
  if (strikeImpact?.trim().toUpperCase() == 'STRIKE_IF_VERIFIED') {
    return const IncidentStrikeDisplay('Strike if verified', Icons.warning_amber_outlined);
  }
  return const IncidentStrikeDisplay('No strike', Icons.remove_circle_outline);
}

String incidentStrikeLabel(
  String? strikeImpact,
  String? reportStatus, {
  required bool hasTargetUser,
}) =>
    incidentStrikeDisplay(
      strikeImpact,
      reportStatus,
      hasTargetUser: hasTargetUser,
    ).label;

bool isSupportedIncidentAction(String action) => const {
  'VERIFY',
  'REJECT',
  'RESOLVE_WITHOUT_STRIKE',
  'REQUEST_SUPPLIER_RESCHEDULE',
  'CANCEL_AND_RELEASE_HOLD',
}.contains(action.trim().toUpperCase());

String incidentActionLabel(String action) {
  switch (action.trim().toUpperCase()) {
    case 'VERIFY': return 'Verify responsibility';
    case 'REJECT': return 'Reject report';
    case 'RESOLVE_WITHOUT_STRIKE': return 'Resolve without strike';
    case 'REQUEST_SUPPLIER_RESCHEDULE': return 'Ask supplier for new pickup window';
    case 'CANCEL_AND_RELEASE_HOLD': return 'Cancel and release hold';
    default: return action;
  }
}

String incidentActionSuccessLabel(String action) {
  switch (action.trim().toUpperCase()) {
    case 'VERIFY': return 'Incident verified.';
    case 'REJECT': return 'Incident rejected.';
    case 'RESOLVE_WITHOUT_STRIKE': return 'Incident resolved without a strike.';
    case 'REQUEST_SUPPLIER_RESCHEDULE': return 'Supplier asked to choose a new pickup window.';
    case 'CANCEL_AND_RELEASE_HOLD': return 'Reservation cancelled and hold released.';
    default: return 'Incident updated.';
  }
}
