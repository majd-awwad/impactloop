import 'package:flutter/material.dart';

import '../../../../shared/widgets/app_status_badge.dart';
import '../../application/project_help_session_timezone.dart';
import '../../data/models/project_help_session_models.dart';
import '../l10n/project_help_sessions_l10n.dart';

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
  required bool viewerIsLearner,
}) {
  final role = session.cancelledByRole;
  if (role == null) {
    return '';
  }
  return switch ((viewerIsLearner, role)) {
    (true, ProjectHelpSessionCancelledByRole.learner) =>
      ProjectHelpSessionsL10n.cancelledByYou.en,
    (true, ProjectHelpSessionCancelledByRole.author) =>
      ProjectHelpSessionsL10n.cancelledByProjectCreator.en,
    (false, ProjectHelpSessionCancelledByRole.author) =>
      ProjectHelpSessionsL10n.cancelledByYou.en,
    (false, ProjectHelpSessionCancelledByRole.learner) =>
      ProjectHelpSessionsL10n.cancelledByLearner.en,
  };
}

String localizedCancellationActorLabel({
  required BuildContext context,
  required ProjectHelpSession session,
  required bool viewerIsLearner,
}) {
  final role = session.cancelledByRole;
  if (role == null) {
    return '';
  }
  return switch ((viewerIsLearner, role)) {
    (true, ProjectHelpSessionCancelledByRole.learner) =>
      ProjectHelpSessionsL10n.cancelledByYou.resolve(context),
    (true, ProjectHelpSessionCancelledByRole.author) =>
      ProjectHelpSessionsL10n.cancelledByProjectCreator.resolve(context),
    (false, ProjectHelpSessionCancelledByRole.author) =>
      ProjectHelpSessionsL10n.cancelledByYou.resolve(context),
    (false, ProjectHelpSessionCancelledByRole.learner) =>
      ProjectHelpSessionsL10n.cancelledByLearner.resolve(context),
  };
}

String readableCancellationReason(String? reason) {
  final value = reason?.trim() ?? '';
  if (value == 'ALTERNATIVE_REJECTED') {
    return '';
  }
  return value;
}
