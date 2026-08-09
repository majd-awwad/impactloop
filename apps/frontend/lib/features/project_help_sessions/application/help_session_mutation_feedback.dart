import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/router/navigation_extensions.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/errors/common_api_error_codes.dart';
import '../../../shared/widgets/app_feedback.dart';
import '../data/models/project_help_session_models.dart';
import '../data/project_help_sessions_api.dart';
import '../presentation/l10n/project_help_sessions_l10n.dart';
import 'project_help_session_canonical_cache.dart';
import 'project_help_session_mutation_sync.dart';
import 'project_help_sessions_providers.dart';

bool isActiveHelpSessionAlreadyExistsError(Object error) {
  if (error is ApiException) {
    if (error.code == 'ACTIVE_SESSION_EXISTS' || error.statusCode == 409) {
      return true;
    }
    final message = error.message.toLowerCase();
    if (message.contains('active help session')) {
      return true;
    }
  }
  return false;
}

bool isHelpSessionNotFoundError(Object error) {
  if (error is! ApiException) {
    return false;
  }
  if (error.code == 'PROJECT_HELP_SESSION_NOT_FOUND' ||
      error.code == CommonApiErrorCodes.notFound) {
    return true;
  }
  return error.statusCode == 404;
}

/// Verifies a help-session detail deep-link target still exists.
///
/// When the session is missing, returns the role list route so callers can
/// avoid opening a broken detail page.
Future<({String route, bool targetMissing})>
    resolveHelpSessionNotificationOpenRoute({
  required ProjectHelpSessionsApi api,
  required String route,
}) async {
  final learnerMatch =
      RegExp(r'^/learner/help-sessions/([^/]+)$').firstMatch(route);
  if (learnerMatch != null) {
    final sessionId = learnerMatch.group(1)!;
    try {
      await api.fetchSession(sessionId);
      return (route: route, targetMissing: false);
    } catch (error) {
      if (isHelpSessionNotFoundError(error)) {
        return (route: learnerHelpSessionsRoute, targetMissing: true);
      }
      return (route: route, targetMissing: false);
    }
  }

  final authorMatch =
      RegExp(r'^/creator/help-sessions/([^/]+)$').firstMatch(route);
  if (authorMatch != null) {
    final sessionId = authorMatch.group(1)!;
    try {
      await api.fetchAuthorSession(sessionId);
      return (route: route, targetMissing: false);
    } catch (error) {
      if (isHelpSessionNotFoundError(error)) {
        return (route: creatorHelpSessionsRoute, targetMissing: true);
      }
      return (route: route, targetMissing: false);
    }
  }

  return (route: route, targetMissing: false);
}

/// Best-effort success feedback from a stable host context (never the modal).
void showHelpSessionMutationSuccess(
  BuildContext hostContext,
  String message,
) {
  if (!hostContext.mounted) {
    return;
  }
  try {
    showSuccessSnackBar(hostContext, message);
  } catch (error, stackTrace) {
    if (kDebugMode) {
      debugPrint('help-session success feedback failed: $error\n$stackTrace');
    }
  }
}

void prepareHelpSessionDetailNavigation(
  WidgetRef ref, {
  required String sessionId,
  required bool authorView,
}) {
  ref
      .read(projectHelpSessionCanonicalCacheProvider.notifier)
      .removeForSession(sessionId);
  if (authorView) {
    ref.invalidate(authorHelpSessionDetailProvider(sessionId));
    return;
  }
  ref.invalidate(learnerHelpSessionDetailProvider(sessionId));
}

/// Successful create boundary — close modal before any best-effort UI work.
void completeLearnerHelpSessionRequestCreation({
  required BuildContext modalContext,
  required BuildContext hostContext,
  required WidgetRef ref,
  required ProjectHelpSession session,
  required String buildId,
  VoidCallback? onSubmitted,
}) {
  if (modalContext.mounted) {
    Navigator.of(modalContext).pop(session);
  }
  synchronizeLearnerHelpSessionMutation(ref, session: session);
  onSubmitted?.call();
  showHelpSessionMutationSuccess(
    hostContext,
    ProjectHelpSessionsL10n.requestSubmittedSuccess.resolve(hostContext),
  );
}

/// Recovery when the server reports an active session already exists.
void recoverActiveHelpSessionRequestExists({
  required BuildContext modalContext,
  required BuildContext hostContext,
  required WidgetRef ref,
  required String buildId,
  ProjectHelpSession? session,
}) {
  if (session != null) {
    synchronizeLearnerHelpSessionMutation(ref, session: session);
  } else {
    invalidateLearnerHelpSessionMutationTargets(ref, buildId: buildId);
  }
  if (modalContext.mounted) {
    Navigator.of(modalContext).pop(session);
  }
  showHelpSessionMutationSuccess(
    hostContext,
    ProjectHelpSessionsL10n.requestAlreadySubmitted.resolve(hostContext),
  );
}

/// Best-effort recovery when create failed in UI but a session may exist server-side.
Future<bool> tryRecoverExistingHelpSessionRequest({
  required BuildContext modalContext,
  required BuildContext hostContext,
  required WidgetRef ref,
  required String buildId,
}) async {
  invalidateLearnerHelpSessionMutationTargets(ref, buildId: buildId);
  try {
    final existing =
        await ref.read(activeHelpSessionForBuildProvider(buildId).future);
    if (existing == null || !modalContext.mounted) {
      return false;
    }
    recoverActiveHelpSessionRequestExists(
      modalContext: modalContext,
      hostContext: hostContext,
      ref: ref,
      buildId: buildId,
      session: existing,
    );
    return true;
  } catch (error, stackTrace) {
    if (kDebugMode) {
      debugPrint(
        'help-session active recovery lookup failed: $error\n$stackTrace',
      );
    }
    return false;
  }
}

/// Post-success refresh work must never convert a successful mutation into UI failure.
Future<void> refreshHelpSessionDetailBestEffort(
  Future<void> Function() refresh,
) async {
  try {
    await refresh();
  } catch (error, stackTrace) {
    if (kDebugMode) {
      debugPrint('help-session refresh after mutation failed: $error\n$stackTrace');
    }
  }
}
