import 'package:flutter/widgets.dart';

import '../../../data/models/project_help_session_models.dart';
import '../../l10n/project_help_sessions_l10n.dart';

enum HelpSessionDetailRole { learner, author }

class HelpSessionStatusCopy {
  const HelpSessionStatusCopy._();

  static String overview({
    required BuildContext context,
    required ProjectHelpSession session,
    required HelpSessionDetailRole role,
  }) {
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    final learnerActions = session.allowedActions;
    final authorActions = session.authorAllowedActions;

    return switch (session.status) {
      ProjectHelpSessionStatus.pending =>
        role == HelpSessionDetailRole.learner
            ? (isArabic
                ? 'بانتظار صاحب المشروع لاختيار موعد من الخيارات المقترحة.'
                : 'Waiting for the project creator to choose a time from your proposed options.')
            : (isArabic
                ? 'اختر أحد المواعيد المقترحة أو اقترح بديلًا أو ارفض الطلب.'
                : 'Choose one of the proposed times, suggest an alternative, or decline the request.'),
      ProjectHelpSessionStatus.alternativeProposed =>
        role == HelpSessionDetailRole.learner
            ? ProjectHelpSessionsL10n.creatorSuggestedDifferentTime
                .resolve(context)
            : ProjectHelpSessionsL10n.waitingLearnerAlternative.resolve(context),
      ProjectHelpSessionStatus.zoomPending =>
        role == HelpSessionDetailRole.learner
            ? ProjectHelpSessionsL10n.meetingBeingPrepared.resolve(context)
            : ProjectHelpSessionsL10n.zoomBeingCreated.resolve(context),
      ProjectHelpSessionStatus.schedulingFailed =>
        role == HelpSessionDetailRole.learner
            ? ProjectHelpSessionsL10n.zoomDelayedBody.resolve(context)
            : ProjectHelpSessionsL10n.zoomRetryBody.resolve(context),
      ProjectHelpSessionStatus.scheduled =>
        role == HelpSessionDetailRole.learner
            ? (learnerActions.canJoin
                ? ProjectHelpSessionsL10n.joinZoom.resolve(context)
                : ProjectHelpSessionsL10n.joinOpensLater.resolve(context))
            : (authorActions.canJoin
                ? ProjectHelpSessionsL10n.joinZoom.resolve(context)
                : ProjectHelpSessionsL10n.joinOpensLater.resolve(context)),
      ProjectHelpSessionStatus.declined =>
        ProjectHelpSessionsL10n.declinedTitle.resolve(context),
      ProjectHelpSessionStatus.cancelled =>
        ProjectHelpSessionsL10n.sessionCancelledOverview.resolve(context),
      ProjectHelpSessionStatus.completed =>
        ProjectHelpSessionsL10n.completedTitle.resolve(context),
    };
  }

  static String activeCardSummary({
    required BuildContext context,
    required ProjectHelpSession session,
  }) {
    return overview(
      context: context,
      session: session,
      role: HelpSessionDetailRole.learner,
    );
  }
}
