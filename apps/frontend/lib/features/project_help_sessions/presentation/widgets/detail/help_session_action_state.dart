import '../../../data/models/project_help_session_models.dart';

enum HelpSessionActionPhase {
  negotiation,
  beforeJoinWindow,
  joinWindowActive,
  afterJoinWindow,
  terminal,
}

class HelpSessionActionState {
  const HelpSessionActionState({
    required this.phase,
    required this.canJoin,
    required this.canCancel,
    required this.canComplete,
    required this.canReportNoShow,
    required this.noShowReported,
    required this.isResolutionWindow,
  });

  final HelpSessionActionPhase phase;
  final bool canJoin;
  final bool canCancel;
  final bool canComplete;
  final bool canReportNoShow;
  final bool noShowReported;
  final bool isResolutionWindow;

  bool get showDisabledJoin => phase == HelpSessionActionPhase.beforeJoinWindow;
  bool get showNoShowHint => phase == HelpSessionActionPhase.joinWindowActive;
}

HelpSessionActionState resolveHelpSessionActionState({
  required ProjectHelpSession session,
  required bool authorView,
  DateTime? now,
}) {
  final learnerActions = effectiveLearnerAllowedActions(session);
  final authorActions = effectiveAuthorAllowedActions(session);
  final isTerminal =
      session.status == ProjectHelpSessionStatus.cancelled ||
      session.status == ProjectHelpSessionStatus.declined ||
      session.status == ProjectHelpSessionStatus.completed;
  final current = (now ?? DateTime.now()).toUtc();
  final scheduledEndsAt = session.scheduledEndsAt?.toUtc();
  final autoFinalizeAt = session.autoFinalizeAt?.toUtc();
  final isResolutionWindow =
      session.status == ProjectHelpSessionStatus.scheduled &&
      scheduledEndsAt != null &&
      autoFinalizeAt != null &&
      !session.autoFinalizationBlocked &&
      !current.isBefore(scheduledEndsAt) &&
      current.isBefore(autoFinalizeAt);

  var phase = HelpSessionActionPhase.negotiation;
  if (isTerminal) {
    phase = HelpSessionActionPhase.terminal;
  } else if (session.status == ProjectHelpSessionStatus.scheduled) {
    final opensAt = session.joinAvailableAt?.toUtc();
    final closesAt = session.joinClosesAt?.toUtc();
    if (opensAt == null || current.isBefore(opensAt)) {
      phase = HelpSessionActionPhase.beforeJoinWindow;
    } else if (closesAt == null || !current.isAfter(closesAt)) {
      phase = HelpSessionActionPhase.joinWindowActive;
    } else {
      phase = HelpSessionActionPhase.afterJoinWindow;
    }
  }

  return HelpSessionActionState(
    phase: phase,
    canJoin: authorView ? authorActions.canJoin : learnerActions.canJoin,
    canCancel: authorView ? authorActions.canCancel : learnerActions.canCancel,
    canComplete: authorView && authorActions.canComplete,
    canReportNoShow: authorView
        ? authorActions.canReportNoShow
        : learnerActions.canReportNoShow,
    noShowReported: session.noShowReportedAt != null,
    isResolutionWindow: isResolutionWindow,
  );
}
