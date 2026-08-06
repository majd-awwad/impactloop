import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../learner_builds/application/learner_builds_providers.dart';
import '../../learning_hub/application/learning_hub_providers.dart';
import '../../learning_hub/domain/models/learning_project_submission.dart';
import '../data/models/project_help_session_models.dart';
import '../data/project_help_sessions_api.dart';

final projectHelpSessionsApiProvider = Provider<ProjectHelpSessionsApi>((ref) {
  return ProjectHelpSessionsApi(ref.watch(apiClientProvider));
});

enum LearnerHelpSessionListFilter {
  all,
  active,
  scheduled,
  completed,
  closed,
}

class LearnerHelpSessionsQuery {
  const LearnerHelpSessionsQuery({
    this.filter = LearnerHelpSessionListFilter.all,
    this.page = 1,
    this.limit = 20,
  });

  final LearnerHelpSessionListFilter filter;
  final int page;
  final int limit;

  String? get apiStatus => switch (filter) {
        LearnerHelpSessionListFilter.scheduled => 'SCHEDULED',
        LearnerHelpSessionListFilter.completed => 'COMPLETED',
        _ => null,
      };
}

final learnerHelpSessionsQueryProvider =
    NotifierProvider<LearnerHelpSessionsQueryNotifier, LearnerHelpSessionsQuery>(
  LearnerHelpSessionsQueryNotifier.new,
);

class LearnerHelpSessionsQueryNotifier extends Notifier<LearnerHelpSessionsQuery> {
  @override
  LearnerHelpSessionsQuery build() => const LearnerHelpSessionsQuery();

  void setFilter(LearnerHelpSessionListFilter filter) {
    state = LearnerHelpSessionsQuery(filter: filter, page: 1, limit: state.limit);
  }

  void setPage(int page) {
    state = LearnerHelpSessionsQuery(
      filter: state.filter,
      page: page,
      limit: state.limit,
    );
  }
}

bool _matchesClientFilter(
  ProjectHelpSession session,
  LearnerHelpSessionListFilter filter,
) {
  return switch (filter) {
    LearnerHelpSessionListFilter.all => true,
    LearnerHelpSessionListFilter.active => session.status.isActive,
    LearnerHelpSessionListFilter.scheduled =>
      session.status == ProjectHelpSessionStatus.scheduled,
    LearnerHelpSessionListFilter.completed =>
      session.status == ProjectHelpSessionStatus.completed,
    LearnerHelpSessionListFilter.closed =>
      session.status == ProjectHelpSessionStatus.cancelled ||
      session.status == ProjectHelpSessionStatus.declined,
  };
}

final learnerHelpSessionsProvider =
    FutureProvider.autoDispose<ProjectHelpSessionListResult>((ref) async {
  await ensureLearnerBuildsSessionReady(ref);
  final query = ref.watch(learnerHelpSessionsQueryProvider);
  final api = ref.read(projectHelpSessionsApiProvider);
  final result = await api.fetchSessions(
    page: query.page,
    limit: query.limit,
    status: query.apiStatus,
  );
  if (query.filter == LearnerHelpSessionListFilter.all ||
      query.filter == LearnerHelpSessionListFilter.scheduled ||
      query.filter == LearnerHelpSessionListFilter.completed) {
    return result;
  }
  final filtered = result.items
      .where((session) => _matchesClientFilter(session, query.filter))
      .toList();
  return ProjectHelpSessionListResult(
    items: filtered,
    page: result.page,
    limit: result.limit,
    total: filtered.length,
    totalPages: 1,
  );
});

final learnerHelpSessionDetailProvider = FutureProvider.autoDispose
    .family<ProjectHelpSession, String>((ref, sessionId) async {
  await ensureLearnerBuildsSessionReady(ref);
  return ref.read(projectHelpSessionsApiProvider).fetchSession(sessionId);
});

final projectHelpSessionAvailabilityProvider = FutureProvider.autoDispose
    .family<ProjectHelpSessionAvailability, String>((ref, projectId) async {
  await ensureLearnerBuildsSessionReady(ref);
  return ref.read(projectHelpSessionsApiProvider).fetchAvailability(projectId);
});

final activeHelpSessionForBuildProvider = FutureProvider.autoDispose
    .family<ProjectHelpSession?, String>((ref, buildId) async {
  await ensureLearnerBuildsSessionReady(ref);
  final result = await ref.read(projectHelpSessionsApiProvider).fetchSessions(
        page: 1,
        limit: 5,
        buildId: buildId,
      );
  final matches = result.items.where((session) => session.status.isActive).toList();
  if (matches.isEmpty) {
    return null;
  }
  matches.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
  return matches.first;
});

void invalidateLearnerHelpSessionProviders(WidgetRef ref, {String? sessionId}) {
  ref.invalidate(learnerHelpSessionsProvider);
  if (sessionId != null) {
    ref.invalidate(learnerHelpSessionDetailProvider(sessionId));
  }
}

void invalidateBuildHelpSessionProviders(WidgetRef ref, String buildId) {
  ref.invalidate(activeHelpSessionForBuildProvider(buildId));
  ref.invalidate(learnerHelpSessionsProvider);
}

class ProjectHelpSessionActionController extends Notifier<bool> {
  @override
  bool build() => false;

  Future<T?> _guard<T>(Future<T> Function() action) async {
    if (state) {
      return null;
    }
    state = true;
    try {
      return await action();
    } finally {
      state = false;
    }
  }

  Future<ProjectHelpSession?> createRequest({
    required String buildId,
    required CreateProjectHelpSessionRequestPayload payload,
  }) {
    return _guard(
      () => ref.read(projectHelpSessionsApiProvider).createRequest(
            buildId: buildId,
            payload: payload,
          ),
    );
  }

  Future<ProjectHelpSession?> acceptAlternative(String sessionId) {
    return _guard(
      () => ref.read(projectHelpSessionsApiProvider).acceptAlternative(sessionId),
    );
  }

  Future<ProjectHelpSession?> rejectAlternative(String sessionId) {
    return _guard(
      () => ref.read(projectHelpSessionsApiProvider).rejectAlternative(sessionId),
    );
  }

  Future<ProjectHelpSession?> cancelSession({
    required String sessionId,
    String? reason,
  }) {
    return _guard(
      () => ref.read(projectHelpSessionsApiProvider).cancelSession(
            sessionId: sessionId,
            reason: reason,
          ),
    );
  }

  Future<ProjectHelpSessionJoinResult?> joinZoom(String sessionId) {
    return _guard(
      () => ref.read(projectHelpSessionsApiProvider).joinZoom(sessionId),
    );
  }

  Future<ProjectHelpSession?> acceptOption({
    required String sessionId,
    required String timeOptionId,
  }) {
    return _guard(
      () => ref.read(projectHelpSessionsApiProvider).acceptOption(
            sessionId: sessionId,
            timeOptionId: timeOptionId,
          ),
    );
  }

  Future<ProjectHelpSession?> proposeAlternative({
    required String sessionId,
    required DateTime startsAtUtc,
  }) {
    return _guard(
      () => ref.read(projectHelpSessionsApiProvider).proposeAlternative(
            sessionId: sessionId,
            startsAtUtc: startsAtUtc,
          ),
    );
  }

  Future<ProjectHelpSession?> declineSession({
    required String sessionId,
    String? reason,
  }) {
    return _guard(
      () => ref.read(projectHelpSessionsApiProvider).declineSession(
            sessionId: sessionId,
            reason: reason,
          ),
    );
  }

  Future<ProjectHelpSession?> cancelAuthorSession({
    required String sessionId,
    String? reason,
  }) {
    return _guard(
      () => ref.read(projectHelpSessionsApiProvider).cancelAuthorSession(
            sessionId: sessionId,
            reason: reason,
          ),
    );
  }

  Future<ProjectHelpSession?> retryZoom(String sessionId) {
    return _guard(
      () => ref.read(projectHelpSessionsApiProvider).retryZoom(sessionId),
    );
  }

  Future<ProjectHelpSessionStartResult?> startZoom(String sessionId) {
    return _guard(
      () => ref.read(projectHelpSessionsApiProvider).startZoom(sessionId),
    );
  }

  Future<ProjectHelpSession?> completeSession(String sessionId) {
    return _guard(
      () => ref.read(projectHelpSessionsApiProvider).completeSession(sessionId),
    );
  }

  Future<ProjectHelpSessionNotebookHandoff?> ensureNotebookNotes({
    required String sessionId,
    required String localeCode,
  }) {
    return _guard(
      () => ref.read(projectHelpSessionsApiProvider).ensureNotebookNotes(
            sessionId: sessionId,
            localeCode: localeCode,
          ),
    );
  }

  Future<ProjectHelpSessionSettings?> saveSettings({
    required String projectId,
    required ProjectHelpSessionSettings settings,
  }) {
    return _guard(
      () => ref.read(projectHelpSessionsApiProvider).updateSettings(
            projectId: projectId,
            settings: settings,
          ),
    );
  }
}

final projectHelpSessionActionControllerProvider =
    NotifierProvider.autoDispose<ProjectHelpSessionActionController, bool>(
  ProjectHelpSessionActionController.new,
);

enum AuthorHelpSessionListFilter {
  all,
  newRequests,
  waitingForLearner,
  scheduled,
  needsAction,
  closed,
}

class AuthorHelpSessionsQuery {
  const AuthorHelpSessionsQuery({
    this.filter = AuthorHelpSessionListFilter.all,
    this.page = 1,
    this.limit = 20,
    this.projectId,
  });

  final AuthorHelpSessionListFilter filter;
  final int page;
  final int limit;
  final String? projectId;

  String? get apiStatus => switch (filter) {
        AuthorHelpSessionListFilter.scheduled => 'SCHEDULED',
        _ => null,
      };
}

final authorHelpSessionsQueryProvider =
    NotifierProvider<AuthorHelpSessionsQueryNotifier, AuthorHelpSessionsQuery>(
  AuthorHelpSessionsQueryNotifier.new,
);

class AuthorHelpSessionsQueryNotifier extends Notifier<AuthorHelpSessionsQuery> {
  @override
  AuthorHelpSessionsQuery build() => const AuthorHelpSessionsQuery();

  void setFilter(AuthorHelpSessionListFilter filter) {
    state = AuthorHelpSessionsQuery(
      filter: filter,
      page: 1,
      limit: state.limit,
      projectId: state.projectId,
    );
  }

  void setProjectId(String? projectId) {
    final normalized = projectId?.trim();
    state = AuthorHelpSessionsQuery(
      filter: state.filter,
      page: 1,
      limit: state.limit,
      projectId: normalized == null || normalized.isEmpty ? null : normalized,
    );
  }
}

int _authorSessionPriority(ProjectHelpSessionStatus status) => switch (status) {
      ProjectHelpSessionStatus.pending => 0,
      ProjectHelpSessionStatus.alternativeProposed => 1,
      ProjectHelpSessionStatus.schedulingFailed => 2,
      ProjectHelpSessionStatus.scheduled => 3,
      ProjectHelpSessionStatus.zoomPending => 3,
      _ => 10,
    };

bool _matchesAuthorClientFilter(
  ProjectHelpSession session,
  AuthorHelpSessionListFilter filter,
) {
  return switch (filter) {
    AuthorHelpSessionListFilter.all => true,
    AuthorHelpSessionListFilter.newRequests =>
      session.status == ProjectHelpSessionStatus.pending,
    AuthorHelpSessionListFilter.waitingForLearner =>
      session.status == ProjectHelpSessionStatus.alternativeProposed,
    AuthorHelpSessionListFilter.scheduled =>
      session.status == ProjectHelpSessionStatus.scheduled,
    AuthorHelpSessionListFilter.needsAction =>
      session.status == ProjectHelpSessionStatus.pending ||
      session.status == ProjectHelpSessionStatus.schedulingFailed,
    AuthorHelpSessionListFilter.closed =>
      session.status == ProjectHelpSessionStatus.cancelled ||
      session.status == ProjectHelpSessionStatus.declined ||
      session.status == ProjectHelpSessionStatus.completed,
  };
}

final authorHelpSessionsProvider =
    FutureProvider.autoDispose<ProjectHelpSessionListResult>((ref) async {
  await ensureLearnerBuildsSessionReady(ref);
  final query = ref.watch(authorHelpSessionsQueryProvider);
  final api = ref.read(projectHelpSessionsApiProvider);
  final result = await api.fetchAuthorSessions(
    page: query.page,
    limit: query.limit,
    status: query.apiStatus,
    projectId: query.projectId,
  );
  Iterable<ProjectHelpSession> items = result.items;
  if (query.filter != AuthorHelpSessionListFilter.all &&
      query.filter != AuthorHelpSessionListFilter.scheduled) {
    items = items.where((s) => _matchesAuthorClientFilter(s, query.filter));
  }
  final sorted = items.toList()
    ..sort((a, b) {
      final priority = _authorSessionPriority(a.status)
          .compareTo(_authorSessionPriority(b.status));
      if (priority != 0) {
        return priority;
      }
      return b.updatedAt.compareTo(a.updatedAt);
    });
  return ProjectHelpSessionListResult(
    items: sorted,
    page: result.page,
    limit: result.limit,
    total: query.filter == AuthorHelpSessionListFilter.all ||
            query.filter == AuthorHelpSessionListFilter.scheduled
        ? result.total
        : sorted.length,
    totalPages: query.filter == AuthorHelpSessionListFilter.all ||
            query.filter == AuthorHelpSessionListFilter.scheduled
        ? result.totalPages
        : 1,
  );
});

final authorHelpSessionDetailProvider = FutureProvider.autoDispose
    .family<ProjectHelpSession, String>((ref, sessionId) async {
  await ensureLearnerBuildsSessionReady(ref);
  return ref.read(projectHelpSessionsApiProvider).fetchAuthorSession(sessionId);
});

final projectHelpSessionSettingsProvider = FutureProvider.autoDispose
    .family<ProjectHelpSessionSettings, String>((ref, projectId) async {
  await ensureLearnerBuildsSessionReady(ref);
  return ref.read(projectHelpSessionsApiProvider).fetchSettings(projectId);
});

final hasAuthoredProjectSubmissionsProvider =
    FutureProvider.autoDispose<bool>((ref) async {
  final submissions = await ref.read(
    myLearningProjectSubmissionsProvider(
      const LearningProjectSubmissionsQuery(page: 1, limit: 1),
    ).future,
  );
  return submissions.total > 0;
});

final authorHelpSessionsEntryVisibleProvider =
    FutureProvider.autoDispose<bool>((ref) async {
  await ensureLearnerBuildsSessionReady(ref);
  if (await ref.watch(hasAuthoredProjectSubmissionsProvider.future)) {
    return true;
  }
  final sessions = await ref
      .watch(projectHelpSessionsApiProvider)
      .fetchAuthorSessions(page: 1, limit: 1);
  return sessions.total > 0;
});

void invalidateAuthorHelpSessionProviders(WidgetRef ref, {String? sessionId}) {
  ref.invalidate(authorHelpSessionsProvider);
  ref.invalidate(authorHelpSessionsEntryVisibleProvider);
  if (sessionId != null) {
    ref.invalidate(authorHelpSessionDetailProvider(sessionId));
  }
}

void invalidateProjectHelpSessionSettings(WidgetRef ref, String projectId) {
  ref.invalidate(projectHelpSessionSettingsProvider(projectId));
  ref.invalidate(projectHelpSessionAvailabilityProvider(projectId));
}
