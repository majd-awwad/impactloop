import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/api_exception.dart';
import '../../../shared/widgets/app_feedback.dart';
import 'help_session_mutation_feedback.dart';
import 'project_help_session_mutation_sync.dart';
import 'project_help_sessions_providers.dart';
import '../data/models/project_help_session_models.dart';
import '../presentation/l10n/project_help_sessions_l10n.dart';

/// Thrown only for real API mutation failures — never for post-success UI work.
class ProjectHelpSessionMutationFailure implements Exception {
  const ProjectHelpSessionMutationFailure(this.error);

  final Object error;

  @override
  String toString() => error.toString();
}

Future<T?> runProjectHelpSessionMutation<T>(Future<T?> Function() mutate) async {
  try {
    return await mutate();
  } catch (error) {
    throw ProjectHelpSessionMutationFailure(error);
  }
}

/// Applies returned DTO immediately, then best-effort list/detail invalidation.
Future<void> completeLearnerHelpSessionMutation({
  required WidgetRef ref,
  required BuildContext hostContext,
  required ProjectHelpSession session,
  String? successMessage,
}) async {
  synchronizeLearnerHelpSessionMutation(ref, session: session);
  if (successMessage != null) {
    showHelpSessionMutationSuccess(hostContext, successMessage);
  }
}

Future<void> completeAuthorHelpSessionMutation({
  required WidgetRef ref,
  required BuildContext hostContext,
  required ProjectHelpSession session,
  String? successMessage,
}) async {
  synchronizeAuthorHelpSessionMutation(ref, session: session);
  if (successMessage != null) {
    showHelpSessionMutationSuccess(hostContext, successMessage);
  }
}

Future<void> completeHelpSessionSettingsMutation({
  required WidgetRef ref,
  required BuildContext hostContext,
  required ProjectHelpSessionSettings settings,
  required String successMessage,
  VoidCallback? onNavigate,
}) async {
  synchronizeHelpSessionSettingsMutation(ref, settings: settings);
  showHelpSessionMutationSuccess(hostContext, successMessage);
  try {
    onNavigate?.call();
  } catch (error, stackTrace) {
    if (kDebugMode) {
      debugPrint('help-session settings navigation failed: $error\n$stackTrace');
    }
  }
}

/// Zoom URL launch failures are not API mutation failures.
void showHelpSessionZoomLaunchFailure(BuildContext context) {
  if (!context.mounted) {
    return;
  }
  showInfoSnackBar(
    context,
    ProjectHelpSessionsL10n.joinLaunchFailed.resolve(context),
  );
}
bool isHelpSessionMutationGuardNoOp(Object? result, bool controllerBusy) {
  return result == null && controllerBusy;
}

ApiException helpSessionMutationGuardFailure() {
  return const ApiException(
    message: 'Request already in progress',
    code: 'MUTATION_IN_FLIGHT',
  );
}

bool helpSessionHasAuthorAlternative(ProjectHelpSession session) {
  return session.timeOptions.any(
    (option) =>
        option.type == ProjectHelpSessionTimeOptionType.authorAlternative,
  );
}

bool helpSessionRecoveryAlternativeProposed(ProjectHelpSession session) {
  return session.status == ProjectHelpSessionStatus.alternativeProposed ||
      helpSessionHasAuthorAlternative(session);
}

bool helpSessionRecoveryAccepted(ProjectHelpSession session) {
  return session.status == ProjectHelpSessionStatus.scheduled ||
      session.status == ProjectHelpSessionStatus.zoomPending ||
      session.selectedStartsAt != null;
}

bool helpSessionRecoveryDeclined(ProjectHelpSession session) {
  return session.status == ProjectHelpSessionStatus.declined;
}

bool helpSessionRecoveryCancelled(ProjectHelpSession session) {
  return session.status == ProjectHelpSessionStatus.cancelled;
}

bool helpSessionRecoveryAlternativeRejected(ProjectHelpSession session) {
  return session.status == ProjectHelpSessionStatus.pending &&
      !helpSessionHasAuthorAlternative(session);
}

bool helpSessionRecoveryCompleted(ProjectHelpSession session) {
  return session.status == ProjectHelpSessionStatus.completed;
}

bool helpSessionRecoveryZoomRetried(ProjectHelpSession session) {
  return session.status != ProjectHelpSessionStatus.schedulingFailed &&
      (session.status == ProjectHelpSessionStatus.zoomPending ||
          session.status == ProjectHelpSessionStatus.scheduled);
}

/// When a mutation failed in UI but the server may have applied it, refetch.
Future<ProjectHelpSession?> recoverHelpSessionAfterMutationFailure({
  required WidgetRef ref,
  required String sessionId,
  required bool authorView,
  int maxAttempts = 3,
}) async {
  for (var attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await Future<void>.delayed(Duration(milliseconds: 450 * attempt));
    }
    try {
      if (authorView) {
        ref.invalidate(authorHelpSessionDetailProvider(sessionId));
        final session =
            await ref.read(authorHelpSessionDetailProvider(sessionId).future);
        if (session != null) {
          return session;
        }
        continue;
      }
      ref.invalidate(learnerHelpSessionDetailProvider(sessionId));
      final session =
          await ref.read(learnerHelpSessionDetailProvider(sessionId).future);
      if (session != null) {
        return session;
      }
    } catch (error, stackTrace) {
      if (kDebugMode) {
        debugPrint(
          'help-session mutation recovery fetch failed: $error\n$stackTrace',
        );
      }
    }
  }
  return null;
}

Future<ProjectHelpSession?> runProjectHelpSessionMutationWithRecovery({
  required WidgetRef ref,
  required String sessionId,
  required bool authorView,
  required Future<ProjectHelpSession?> Function() mutate,
  required bool Function(ProjectHelpSession session) recoveryMatches,
}) async {
  Object? mutationError;
  ProjectHelpSession? updated;
  try {
    updated = await runProjectHelpSessionMutation(mutate);
  } on ProjectHelpSessionMutationFailure catch (failure) {
    mutationError = failure.error;
  }

  if (updated != null) {
    if (authorView) {
      synchronizeAuthorHelpSessionMutation(ref, session: updated);
    } else {
      synchronizeLearnerHelpSessionMutation(ref, session: updated);
    }
    return updated;
  }

  final recovered = await recoverHelpSessionAfterMutationFailure(
    ref: ref,
    sessionId: sessionId,
    authorView: authorView,
  );
  if (recovered != null && recoveryMatches(recovered)) {
    if (authorView) {
      synchronizeAuthorHelpSessionMutation(ref, session: recovered);
    } else {
      synchronizeLearnerHelpSessionMutation(ref, session: recovered);
    }
    return recovered;
  }

  if (mutationError != null) {
    throw mutationError!;
  }
  throw helpSessionMutationGuardFailure();
}

Future<ProjectHelpSession?> completeLearnerHelpSessionCancel({
  required WidgetRef ref,
  required String sessionId,
  required Future<ProjectHelpSession?> Function() mutate,
}) {
  return runProjectHelpSessionMutationWithRecovery(
    ref: ref,
    sessionId: sessionId,
    authorView: false,
    mutate: mutate,
    recoveryMatches: helpSessionRecoveryCancelled,
  );
}

Future<ProjectHelpSession?> completeAuthorHelpSessionCancel({
  required WidgetRef ref,
  required String sessionId,
  required Future<ProjectHelpSession?> Function() mutate,
}) {
  return runProjectHelpSessionMutationWithRecovery(
    ref: ref,
    sessionId: sessionId,
    authorView: true,
    mutate: mutate,
    recoveryMatches: helpSessionRecoveryCancelled,
  );
}
