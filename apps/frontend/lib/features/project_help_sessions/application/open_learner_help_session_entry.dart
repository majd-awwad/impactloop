import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/navigation_extensions.dart';
import '../../../shared/widgets/app_feedback.dart';
import '../../learning_hub/application/learning_hub_providers.dart';
import '../../learning_hub/domain/models/project_build.dart';
import '../data/models/project_help_session_models.dart';
import '../presentation/l10n/project_help_sessions_l10n.dart';
import '../presentation/widgets/help_session_request_flow.dart';
import 'project_help_sessions_providers.dart';

bool isLearnerHelpSessionBuildEligible(ProjectBuildStatus status) {
  return status == ProjectBuildStatus.inProgress ||
      status == ProjectBuildStatus.paused;
}

class LearnerHelpSessionEntryResolution {
  const LearnerHelpSessionEntryResolution._({
    this.activeSession,
    this.build,
    this.availability,
    this.feedback,
  });

  const LearnerHelpSessionEntryResolution.session(ProjectHelpSession session)
    : this._(activeSession: session);

  const LearnerHelpSessionEntryResolution.request({
    required ProjectBuild build,
    required ProjectHelpSessionAvailability availability,
  }) : this._(build: build, availability: availability);

  const LearnerHelpSessionEntryResolution.feedback(String message)
    : this._(feedback: message);

  final ProjectHelpSession? activeSession;
  final ProjectBuild? build;
  final ProjectHelpSessionAvailability? availability;
  final String? feedback;
}

Future<LearnerHelpSessionEntryResolution> resolveLearnerHelpSessionEntry({
  required BuildContext context,
  required WidgetRef ref,
  required String buildId,
  required String projectId,
  ProjectBuild? build,
}) async {
  final activeSession = await ref.read(
    activeHelpSessionForBuildProvider(buildId).future,
  );
  if (activeSession != null) {
    return LearnerHelpSessionEntryResolution.session(activeSession);
  }

  final resolvedBuild =
      build ?? await ref.read(projectBuildProvider(projectId).future);
  if (resolvedBuild == null) {
    return LearnerHelpSessionEntryResolution.feedback(
      ProjectHelpSessionsL10n.buildUnavailable.resolve(context),
    );
  }

  final availability = await ref.read(
    projectHelpSessionAvailabilityProvider(projectId).future,
  );
  if (!availability.available) {
    return LearnerHelpSessionEntryResolution.feedback(
      ProjectHelpSessionsL10n.availabilityMessage(
        availability.reason,
      ).resolve(context),
    );
  }

  return LearnerHelpSessionEntryResolution.request(
    build: resolvedBuild,
    availability: availability,
  );
}

/// Opens the existing learner help-session request or detail flow.
///
/// Never fails silently: ineligible/unavailable states use the existing
/// snackbar feedback, and an active session navigates to its detail page.
Future<void> openLearnerHelpSessionEntry({
  required BuildContext context,
  required WidgetRef ref,
  required String buildId,
  required String projectId,
  ProjectBuild? build,
  VoidCallback? onLookupsComplete,
}) async {
  try {
    final resolution = await resolveLearnerHelpSessionEntry(
      context: context,
      ref: ref,
      buildId: buildId,
      projectId: projectId,
      build: build,
    );
    onLookupsComplete?.call();
    if (!context.mounted) {
      return;
    }

    if (resolution.activeSession != null) {
      context.push(learnerHelpSessionDetailRoute(resolution.activeSession!.id));
      return;
    }
    if (resolution.feedback != null) {
      showErrorSnackBar(
        context,
        'HELP_SESSION_UNAVAILABLE',
        message: resolution.feedback,
      );
      return;
    }

    final session = await showProjectHelpSessionRequestFlow(
      context: context,
      ref: ref,
      build: resolution.build!,
      availability: resolution.availability!,
    );
    if (session != null && context.mounted) {
      context.push(learnerHelpSessionDetailRoute(session.id));
    }
  } catch (error) {
    onLookupsComplete?.call();
    if (!context.mounted) {
      return;
    }
    await handleHelpSessionRequestError(context, error);
  }
}
