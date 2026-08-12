import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/core/auth/access_token_holder.dart';
import 'package:frontend/core/auth/auth_session_refresh.dart';
import 'package:frontend/core/auth/auth_interceptor.dart';
import 'package:frontend/core/auth/token_storage.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/application/auth_providers.dart';
import 'package:frontend/features/auth/data/auth_api.dart';
import 'package:frontend/features/auth/data/auth_repository.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/project_help_sessions/application/project_help_session_canonical_cache.dart';
import 'package:frontend/features/project_help_sessions/application/project_help_session_zoom_launcher.dart';
import 'package:frontend/features/project_help_sessions/application/project_help_sessions_providers.dart';
import 'package:frontend/features/project_help_sessions/data/models/project_help_session_models.dart';
import 'package:frontend/features/project_help_sessions/data/project_help_sessions_api.dart';
import 'package:frontend/features/project_help_sessions/presentation/l10n/project_help_sessions_l10n.dart';
import 'package:frontend/features/project_help_sessions/presentation/pages/creator_help_session_detail_page.dart';
import 'package:frontend/features/project_help_sessions/presentation/pages/learner_help_session_detail_page.dart';

User _user(String id) => User(
  id: id,
  displayName: id,
  email: '$id@example.test',
  accountStatus: 'ACTIVE',
  roles: const ['LEARNER'],
  createdAt: DateTime.utc(2026),
);

ProjectHelpSession _session({
  required String learnerId,
  String id = 'session-1',
  bool learnerCanJoin = true,
  bool authorCanJoin = false,
}) => ProjectHelpSession(
  id: id,
  status: ProjectHelpSessionStatus.scheduled,
  project: const ProjectHelpSessionProjectSummary(
    id: 'project-1',
    title: 'Private PHS',
  ),
  build: const ProjectHelpSessionBuildSummary(id: 'build-1', attemptNumber: 1),
  learner: ProjectHelpSessionUserSummary(id: learnerId, displayName: learnerId),
  author: const ProjectHelpSessionUserSummary(
    id: 'author-1',
    displayName: 'Author',
  ),
  problemDescription: 'Private help session details',
  durationMinutes: 15,
  learnerTimeZone: 'UTC',
  timeOptions: const [],
  learnerAllowedActions: ProjectHelpSessionLearnerAllowedActions(
    canAcceptAlternative: false,
    canRejectAlternative: false,
    canCancel: true,
    canJoin: learnerCanJoin,
  ),
  authorAllowedActions: ProjectHelpSessionAuthorAllowedActions(
    canAcceptOption: false,
    canProposeAlternative: false,
    canDecline: false,
    canCancel: true,
    canJoin: authorCanJoin,
    canRetryZoom: false,
    canComplete: false,
  ),
  selectedStartsAt: DateTime.utc(2026, 8, 12, 12),
  createdAt: DateTime.utc(2026, 8, 1),
  updatedAt: DateTime.utc(2026, 8, 1),
  meetingReady: true,
);

class _MemoryTokenStorage implements TokenStorage {
  String? value;

  @override
  Future<void> clearRefreshToken() async => value = null;
  @override
  Future<String?> readRefreshToken() async => value;
  @override
  Future<void> saveRefreshToken(String refreshToken) async =>
      value = refreshToken;
}

class _SwitchingAuthRepository extends AuthRepository {
  _SwitchingAuthRepository(this.currentUser)
    : super(
        api: AuthApi(Dio()),
        tokenStorage: _MemoryTokenStorage(),
        accessTokenHolder: AccessTokenHolder(),
        sessionRefresher: AuthSessionRefresher(
          refreshClient: Dio(),
          tokenStorage: _MemoryTokenStorage(),
          accessTokenHolder: AccessTokenHolder(),
        ),
      );

  User? currentUser;
  String? token = 'token-a';

  @override
  String? get accessToken => token;
  @override
  Future<User> restoreSession() async => currentUser!;
  @override
  Future<void> logout() async {
    currentUser = null;
    token = null;
  }

  @override
  Future<User> login({required String email, required String password}) async {
    currentUser = _user('majd');
    token = 'token-b';
    return currentUser!;
  }

  @override
  Future<User> me() async => currentUser!;
}

class _MutableAuthController extends AuthController {
  _MutableAuthController(this.initialState);
  final AuthState initialState;
  @override
  AuthState build() => initialState;
  void replaceUser(User? user, {String? token}) {
    state = AuthState(user: user, accessToken: token, hasBootstrapped: true);
  }
}

class _FakePhsApi extends ProjectHelpSessionsApi {
  _FakePhsApi({this.learnerCompleter, this.authorCompleter}) : super(Dio());

  final Completer<ProjectHelpSessionJoinResult>? learnerCompleter;
  final Completer<ProjectHelpSessionJoinResult>? authorCompleter;
  int learnerJoinCalls = 0;
  int authorJoinCalls = 0;

  ProjectHelpSessionJoinResult get _result => ProjectHelpSessionJoinResult(
    joinUrl: 'https://zoom.test/private-join',
    startsAt: DateTime.utc(2026, 8, 12, 12),
    durationMinutes: 15,
  );

  @override
  Future<ProjectHelpSessionJoinResult> joinZoom(String sessionId) {
    learnerJoinCalls += 1;
    return learnerCompleter?.future ?? Future.value(_result);
  }

  @override
  Future<ProjectHelpSessionJoinResult> joinAuthorZoom(String sessionId) {
    authorJoinCalls += 1;
    return authorCompleter?.future ?? Future.value(_result);
  }
}

Widget _wrap({
  required Widget child,
  required _MutableAuthController auth,
  required ProjectHelpSessionsApi api,
  required ProjectHelpSession session,
  required Future<bool> Function(String) launcher,
}) => ProviderScope(
  overrides: [
    authControllerProvider.overrideWith(() => auth),
    projectHelpSessionsApiProvider.overrideWithValue(api),
    learnerHelpSessionDetailProvider(
      session.id,
    ).overrideWith((ref) async => session),
    authorHelpSessionDetailProvider(
      session.id,
    ).overrideWith((ref) async => session),
    projectHelpSessionZoomJoinLauncherProvider.overrideWithValue(launcher),
  ],
  child: MaterialApp(
    localizationsDelegates: const [
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
    ],
    supportedLocales: const [Locale('en')],
    home: Scaffold(body: child),
  ),
);

Future<void> _tapJoin(WidgetTester tester) async {
  final button = find.widgetWithText(
    FilledButton,
    ProjectHelpSessionsL10n.joinZoom.en,
  );
  await tester.ensureVisible(button);
  await tester.pump();
  await tester.tap(button);
}

void main() {
  test(
    'learner and author Join are private POST actions without auth replay',
    () async {
      final adapter = _PrivateZoomActionAdapter();
      final dio = Dio()..httpClientAdapter = adapter;
      final api = ProjectHelpSessionsApi(dio);
      await api.joinZoom('session-1');
      await api.joinAuthorZoom('session-1');
      expect(adapter.requests.map((request) => request.method), [
        'POST',
        'POST',
      ]);
      expect(adapter.requests.map((request) => request.path), [
        '/api/project-help-sessions/learner/session-1/zoom/join',
        '/api/project-help-sessions/author/session-1/zoom/join',
      ]);
      for (final request in adapter.requests) {
        expect(request.extra[AuthInterceptor.skipAuthRefreshExtraKey], isTrue);
      }
    },
  );

  test(
    'logout clears PHS caches and User B refetches the same family key',
    () async {
      final repository = _SwitchingAuthRepository(_user('israa'));
      final api = _IdentityRecordingApi(repository);
      final container = ProviderContainer(
        overrides: [
          authRepositoryProvider.overrideWithValue(repository),
          projectHelpSessionsApiProvider.overrideWithValue(api),
        ],
      );
      addTearDown(container.dispose);
      await container.read(authControllerProvider.notifier).bootstrapSession();
      final first = await container.read(
        learnerHelpSessionDetailProvider('same-session').future,
      );
      container
          .read(projectHelpSessionCanonicalCacheProvider.notifier)
          .put(first, authorView: false);
      container
          .read(activeHelpSessionByBuildCacheProvider.notifier)
          .apply(first);
      await container.read(authControllerProvider.notifier).logout();
      expect(container.read(projectHelpSessionCanonicalCacheProvider), isEmpty);
      expect(container.read(activeHelpSessionByBuildCacheProvider), isEmpty);
      await container
          .read(authControllerProvider.notifier)
          .login(email: 'majd@example.test', password: 'password');
      final second = await container.read(
        learnerHelpSessionDetailProvider('same-session').future,
      );
      expect(second.learner.id, 'majd');
      expect(api.fetchIdentities, ['israa', 'majd']);
    },
  );

  testWidgets('learner always POSTs Join and launches the returned URL once', (
    tester,
  ) async {
    final api = _FakePhsApi();
    final launched = <String>[];
    final session = _session(learnerId: 'israa');
    await tester.pumpWidget(
      _wrap(
        child: const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
        auth: _MutableAuthController(
          AuthState(
            user: _user('israa'),
            accessToken: 'a',
            hasBootstrapped: true,
          ),
        ),
        api: api,
        session: session,
        launcher: (url) async {
          launched.add(url);
          return true;
        },
      ),
    );
    await tester.pumpAndSettle();
    await _tapJoin(tester);
    await tester.pumpAndSettle();
    expect(api.learnerJoinCalls, 1);
    expect(launched, ['https://zoom.test/private-join']);
  });

  testWidgets('author always POSTs Join and launches the returned URL once', (
    tester,
  ) async {
    final api = _FakePhsApi();
    final launched = <String>[];
    final session = _session(
      learnerId: 'israa',
      learnerCanJoin: false,
      authorCanJoin: true,
    );
    await tester.pumpWidget(
      _wrap(
        child: const CreatorHelpSessionDetailPage(sessionId: 'session-1'),
        auth: _MutableAuthController(
          AuthState(
            user: _user('author-1'),
            accessToken: 'a',
            hasBootstrapped: true,
          ),
        ),
        api: api,
        session: session,
        launcher: (url) async {
          launched.add(url);
          return true;
        },
      ),
    );
    await tester.pumpAndSettle();
    await _tapJoin(tester);
    await tester.pumpAndSettle();
    expect(api.authorJoinCalls, 1);
    expect(launched, ['https://zoom.test/private-join']);
  });

  for (final authorView in [false, true]) {
    testWidgets(
      '${authorView ? 'author' : 'learner'} duplicate Join tap sends and launches once',
      (tester) async {
        final completer = Completer<ProjectHelpSessionJoinResult>();
        final api = authorView
            ? _FakePhsApi(authorCompleter: completer)
            : _FakePhsApi(learnerCompleter: completer);
        final session = _session(
          learnerId: 'israa',
          learnerCanJoin: !authorView,
          authorCanJoin: authorView,
        );
        final launched = <String>[];
        await tester.pumpWidget(
          _wrap(
            child: authorView
                ? const CreatorHelpSessionDetailPage(sessionId: 'session-1')
                : const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
            auth: _MutableAuthController(
              AuthState(
                user: _user(authorView ? 'author-1' : 'israa'),
                accessToken: 'a',
                hasBootstrapped: true,
              ),
            ),
            api: api,
            session: session,
            launcher: (url) async {
              launched.add(url);
              return true;
            },
          ),
        );
        await tester.pumpAndSettle();
        final button = find.widgetWithText(
          FilledButton,
          ProjectHelpSessionsL10n.joinZoom.en,
        );
        await tester.ensureVisible(button);
        final onPressed = tester.widget<FilledButton>(button).onPressed!;
        onPressed();
        onPressed();
        await tester.pump();
        expect(authorView ? api.authorJoinCalls : api.learnerJoinCalls, 1);
        completer.complete(api._result);
        await tester.pumpAndSettle();
        expect(launched, ['https://zoom.test/private-join']);
      },
    );

    testWidgets(
      '${authorView ? 'author' : 'learner'} stale Join response cannot launch after auth switch',
      (tester) async {
        final completer = Completer<ProjectHelpSessionJoinResult>();
        final api = authorView
            ? _FakePhsApi(authorCompleter: completer)
            : _FakePhsApi(learnerCompleter: completer);
        final auth = _MutableAuthController(
          AuthState(
            user: _user(authorView ? 'author-1' : 'israa'),
            accessToken: 'token-a',
            hasBootstrapped: true,
          ),
        );
        final launched = <String>[];
        final session = _session(
          learnerId: 'israa',
          learnerCanJoin: !authorView,
          authorCanJoin: authorView,
        );
        await tester.pumpWidget(
          _wrap(
            child: authorView
                ? const CreatorHelpSessionDetailPage(sessionId: 'session-1')
                : const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
            auth: auth,
            api: api,
            session: session,
            launcher: (url) async {
              launched.add(url);
              return true;
            },
          ),
        );
        await tester.pumpAndSettle();
        await _tapJoin(tester);
        await tester.pump();
        auth.replaceUser(_user('majd'), token: 'token-b');
        completer.complete(api._result);
        await tester.pumpAndSettle();
        expect(launched, isEmpty);
      },
    );
  }

  test('normal session model does not retain capability URLs', () {
    final session = ProjectHelpSession.fromJson({
      'id': 'session-1',
      'status': 'SCHEDULED',
      'joinUrl': 'https://zoom.test/must-be-ignored',
      'startUrl': 'https://zoom.test/must-also-be-ignored',
      'project': {'id': 'p', 'title': 'P'},
      'build': {'id': 'b', 'attemptNumber': 1},
      'learner': {'id': 'l', 'displayName': 'L'},
      'author': {'id': 'a', 'displayName': 'A'},
      'problemDescription': 'problem',
      'durationMinutes': 15,
      'learnerTimeZone': 'UTC',
      'timeOptions': <Object>[],
      'allowedActions': {'canJoin': true},
      'createdAt': '2026-08-12T00:00:00.000Z',
      'updatedAt': '2026-08-12T00:00:00.000Z',
      'meetingReady': true,
    });
    expect(session.toString(), isNot(contains('zoom.test')));
  });
}

class _IdentityRecordingApi extends ProjectHelpSessionsApi {
  _IdentityRecordingApi(this.repository) : super(Dio());
  final _SwitchingAuthRepository repository;
  final List<String> fetchIdentities = [];
  @override
  Future<ProjectHelpSession> fetchSession(String sessionId) async {
    final identity = repository.currentUser!.id;
    fetchIdentities.add(identity);
    return _session(id: sessionId, learnerId: identity);
  }
}

class _PrivateZoomActionAdapter implements HttpClientAdapter {
  final List<RequestOptions> requests = [];
  @override
  void close({bool force = false}) {}
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return ResponseBody.fromString(
      jsonEncode({
        'success': true,
        'data': {
          'joinUrl': 'https://zoom.test/private-join',
          'startsAt': '2026-08-12T12:00:00.000Z',
          'durationMinutes': 15,
        },
      }),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }
}
