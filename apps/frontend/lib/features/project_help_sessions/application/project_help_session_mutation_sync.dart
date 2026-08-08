import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/project_help_session_models.dart';
import 'project_help_session_canonical_cache.dart';
import 'project_help_sessions_providers.dart';

void applyCanonicalHelpSession(
  WidgetRef ref,
  ProjectHelpSession session, {
  required bool authorView,
}) {
  ref
      .read(projectHelpSessionCanonicalCacheProvider.notifier)
      .put(session, authorView: authorView);
  ref.read(activeHelpSessionByBuildCacheProvider.notifier).apply(session);
}

void applyCanonicalHelpSessionSettings(
  WidgetRef ref,
  ProjectHelpSessionSettings settings,
) {
  ref.read(projectHelpSessionSettingsCanonicalCacheProvider.notifier).put(settings);
}

void invalidateLearnerHelpSessionMutationTargets(
  WidgetRef ref, {
  required String buildId,
  String? sessionId,
}) {
  invalidateBuildHelpSessionProviders(ref, buildId);
  invalidateLearnerHelpSessionProviders(ref, sessionId: sessionId);
}

void invalidateAuthorHelpSessionMutationTargets(
  WidgetRef ref, {
  String? sessionId,
}) {
  invalidateAuthorHelpSessionProviders(ref, sessionId: sessionId);
}

void synchronizeLearnerHelpSessionMutation(
  WidgetRef ref, {
  required ProjectHelpSession session,
}) {
  applyCanonicalHelpSession(ref, session, authorView: false);
  try {
    invalidateLearnerHelpSessionMutationTargets(
      ref,
      buildId: session.build.id,
      sessionId: session.id,
    );
  } catch (error, stackTrace) {
    if (kDebugMode) {
      debugPrint(
        'help-session learner sync invalidation failed: $error\n$stackTrace',
      );
    }
  }
}

void synchronizeAuthorHelpSessionMutation(
  WidgetRef ref, {
  required ProjectHelpSession session,
}) {
  applyCanonicalHelpSession(ref, session, authorView: true);
  try {
    invalidateAuthorHelpSessionMutationTargets(ref, sessionId: session.id);
  } catch (error, stackTrace) {
    if (kDebugMode) {
      debugPrint(
        'help-session author sync invalidation failed: $error\n$stackTrace',
      );
    }
  }
}

void synchronizeHelpSessionSettingsMutation(
  WidgetRef ref, {
  required ProjectHelpSessionSettings settings,
}) {
  applyCanonicalHelpSessionSettings(ref, settings);
  try {
    invalidateProjectHelpSessionSettings(ref, settings.projectId);
  } catch (error, stackTrace) {
    if (kDebugMode) {
      debugPrint(
        'help-session settings sync invalidation failed: $error\n$stackTrace',
      );
    }
  }
}
