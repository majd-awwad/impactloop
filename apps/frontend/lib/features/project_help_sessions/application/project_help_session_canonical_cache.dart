import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/project_help_session_models.dart';

String helpSessionCanonicalCacheKey(String sessionId, {required bool authorView}) {
  return authorView ? '$sessionId:author' : '$sessionId:learner';
}

/// Immediate canonical session DTOs returned from successful mutations.
class ProjectHelpSessionCanonicalCache extends Notifier<Map<String, ProjectHelpSession>> {
  @override
  Map<String, ProjectHelpSession> build() => const {};

  void put(
    ProjectHelpSession session, {
    required bool authorView,
  }) {
    final key = helpSessionCanonicalCacheKey(session.id, authorView: authorView);
    state = {...state, key: session};
  }

  void removeForSession(String sessionId) {
    final authorKey = helpSessionCanonicalCacheKey(sessionId, authorView: true);
    final learnerKey = helpSessionCanonicalCacheKey(sessionId, authorView: false);
    if (!state.containsKey(authorKey) && !state.containsKey(learnerKey)) {
      return;
    }
    final next = Map<String, ProjectHelpSession>.from(state);
    next.remove(authorKey);
    next.remove(learnerKey);
    state = next;
  }

  ProjectHelpSession? peek(
    String sessionId, {
    required bool authorView,
  }) =>
      state[helpSessionCanonicalCacheKey(sessionId, authorView: authorView)];
}

final projectHelpSessionCanonicalCacheProvider =
    NotifierProvider<ProjectHelpSessionCanonicalCache, Map<String, ProjectHelpSession>>(
  ProjectHelpSessionCanonicalCache.new,
);

/// Active session per build — updated immediately after learner mutations.
class ActiveHelpSessionByBuildCache
    extends Notifier<Map<String, ProjectHelpSession?>> {
  @override
  Map<String, ProjectHelpSession?> build() => const {};

  void apply(ProjectHelpSession session) {
    if (session.status.isActive) {
      state = {...state, session.build.id: session};
      return;
    }
    clear(session.build.id);
  }

  void clear(String buildId) {
    if (!state.containsKey(buildId)) {
      return;
    }
    final next = Map<String, ProjectHelpSession?>.from(state);
    next.remove(buildId);
    state = next;
  }

  ProjectHelpSession? peek(String buildId) => state[buildId];
}

final activeHelpSessionByBuildCacheProvider =
    NotifierProvider<ActiveHelpSessionByBuildCache, Map<String, ProjectHelpSession?>>(
  ActiveHelpSessionByBuildCache.new,
);

class ProjectHelpSessionSettingsCanonicalCache
    extends Notifier<Map<String, ProjectHelpSessionSettings>> {
  @override
  Map<String, ProjectHelpSessionSettings> build() => const {};

  void put(ProjectHelpSessionSettings settings) {
    state = {...state, settings.projectId: settings};
  }

  ProjectHelpSessionSettings? peek(String projectId) => state[projectId];
}

final projectHelpSessionSettingsCanonicalCacheProvider = NotifierProvider<
    ProjectHelpSessionSettingsCanonicalCache,
    Map<String, ProjectHelpSessionSettings>>(
  ProjectHelpSessionSettingsCanonicalCache.new,
);

bool shouldPreferCachedHelpSession(
  ProjectHelpSession cached,
  ProjectHelpSession fetched,
) {
  return !cached.updatedAt.isBefore(fetched.updatedAt);
}

ProjectHelpSession resolveCanonicalHelpSession(
  WidgetRef ref,
  String sessionId,
  ProjectHelpSession fetched, {
  required bool authorView,
}) {
  final cached = ref.watch(
    projectHelpSessionCanonicalCacheProvider.select(
      (cache) => cache[helpSessionCanonicalCacheKey(sessionId, authorView: authorView)],
    ),
  );
  if (cached == null) {
    return fetched;
  }
  if (shouldPreferCachedHelpSession(cached, fetched)) {
    return cached;
  }
  return fetched;
}

ProjectHelpSession? resolveCanonicalActiveHelpSessionForBuild(
  WidgetRef ref,
  String buildId,
  ProjectHelpSession? fetched,
) {
  final cached = ref.watch(
    activeHelpSessionByBuildCacheProvider.select((cache) => cache[buildId]),
  );
  if (fetched == null) {
    return cached != null && cached.status.isActive ? cached : null;
  }
  if (cached == null) {
    return fetched.status.isActive ? fetched : null;
  }
  if (shouldPreferCachedHelpSession(cached, fetched)) {
    return cached.status.isActive ? cached : null;
  }
  return fetched.status.isActive ? fetched : null;
}

ProjectHelpSessionSettings resolveCanonicalHelpSessionSettings(
  WidgetRef ref,
  String projectId,
  ProjectHelpSessionSettings fetched,
) {
  return ref.watch(
        projectHelpSessionSettingsCanonicalCacheProvider.select(
          (cache) => cache[projectId],
        ),
      ) ??
      fetched;
}
