import 'package:flutter/material.dart';

import '../../../../shared/widgets/app_status_badge.dart';
import '../../application/project_help_session_timezone.dart';
import '../../data/models/project_help_session_models.dart';

AppStatusTone helpSessionStatusTone(ProjectHelpSessionStatus status) {
  return switch (status) {
    ProjectHelpSessionStatus.pending ||
    ProjectHelpSessionStatus.alternativeProposed ||
    ProjectHelpSessionStatus.zoomPending =>
      AppStatusTone.warning,
    ProjectHelpSessionStatus.schedulingFailed => AppStatusTone.warning,
    ProjectHelpSessionStatus.scheduled => AppStatusTone.success,
    ProjectHelpSessionStatus.completed => AppStatusTone.success,
    ProjectHelpSessionStatus.declined => AppStatusTone.neutral,
    ProjectHelpSessionStatus.cancelled => AppStatusTone.neutral,
  };
}

String formatHelpSessionDateTime(
  BuildContext context,
  DateTime utc,
  String timezone,
) {
  final local = timezone == 'local'
      ? utc.toLocal()
      : projectHelpSessionUtcToWallClock(utc, timezone);
  return '${MaterialLocalizations.of(context).formatFullDate(local)} · ${MaterialLocalizations.of(context).formatTimeOfDay(
        TimeOfDay.fromDateTime(local),
        alwaysUse24HourFormat: false,
      )}';
}

String cancellationActorLabel({
  required ProjectHelpSession session,
  required String currentUserId,
  required String youLabel,
  required String creatorLabel,
}) {
  if (session.cancelledById == currentUserId) {
    return youLabel;
  }
  return creatorLabel;
}

String readableCancellationReason(String? reason) {
  final value = reason?.trim() ?? '';
  if (value == 'ALTERNATIVE_REJECTED') {
    return '';
  }
  return value;
}
