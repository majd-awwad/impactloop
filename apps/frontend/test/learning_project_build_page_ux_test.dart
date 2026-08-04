import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/learning_hub/application/learning_hub_providers.dart';
import 'package:frontend/features/learning_hub/domain/learning_project_repository.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/learning_hub/presentation/l10n/project_build_page_l10n.dart';
import 'package:frontend/features/learning_hub/presentation/pages/learning_project_build_page.dart';
import 'package:frontend/features/learner_builds/application/learner_builds_providers.dart';
import 'package:frontend/features/learner_builds/data/learner_builds_api.dart';
import 'package:frontend/features/notifications/application/notifications_provider.dart';
import 'package:frontend/shared/widgets/app_feedback.dart';

void main() {
  testWidgets('IN_PROGRESS build shows a visible Build actions control', (
    tester,
  ) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.inProgress),
      viewport: const Size(1024, 900),
    );

    expect(find.text('Build actions'), findsOneWidget);
    expect(find.text('Back to project'), findsOneWidget);
    expect(find.text('My builds'), findsOneWidget);
    expect(find.text('Progress is saved automatically.'), findsOneWidget);
    expect(find.text('In progress'), findsOneWidget);
  });

  testWidgets('Build actions menu contains Pause build and Archive build', (
    tester,
  ) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.inProgress),
      viewport: const Size(1024, 900),
    );

    await tester.tap(find.text('Build actions'));
    await tester.pumpAndSettle();

    expect(find.text('Pause build'), findsOneWidget);
    expect(find.text('Archive'), findsOneWidget);
  });

  testWidgets('PAUSED build shows Resume build', (tester) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.paused),
      viewport: const Size(1024, 900),
    );

    expect(find.text('Paused'), findsOneWidget);
    expect(find.text('Resume build'), findsWidgets);
  });

  testWidgets('COMPLETED build menu shows only valid actions', (tester) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.completed),
      viewport: const Size(1024, 900),
    );

    await tester.tap(find.text('Build actions'));
    await tester.pumpAndSettle();

    expect(find.text('Edit completion story'), findsOneWidget);
    expect(find.text('Build again'), findsOneWidget);
    expect(find.text('Pause build'), findsNothing);
    expect(find.text('Archive'), findsNothing);
  });

  testWidgets('ARCHIVED build menu shows only Build again', (tester) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.archived),
      viewport: const Size(1024, 900),
    );

    await tester.tap(find.text('Build actions'));
    await tester.pumpAndSettle();

    expect(find.text('Build again'), findsOneWidget);
    expect(find.text('Pause build'), findsNothing);
    expect(find.text('Resume build'), findsNothing);
    expect(find.text('Archive'), findsNothing);
  });

  testWidgets('desktop does not rely on an unlabeled three-dots icon', (
    tester,
  ) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.inProgress),
      viewport: const Size(1024, 900),
    );

    expect(find.text('Build actions'), findsOneWidget);
    expect(find.byIcon(Icons.more_vert_rounded), findsWidgets);
  });

  testWidgets('mobile lifecycle menu has tooltip and semantic label', (
    tester,
  ) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.inProgress),
      viewport: const Size(390, 844),
    );

    expect(find.text('Build actions'), findsNothing);
    expect(find.byTooltip('Build actions'), findsOneWidget);
    expect(
      find.bySemanticsLabel('Build actions'),
      findsOneWidget,
    );
  });

  testWidgets('Back to project opens the correct Project ID', (tester) async {
    final router = await _pumpBuildPage(
      tester,
      build: _sampleBuild(),
      viewport: const Size(1024, 900),
    );

    await tester.tap(find.text('Back to project'));
    await tester.pumpAndSettle();

    expect(
      router.routerDelegate.currentConfiguration.uri.path,
      '/learning/project-1',
    );
  });

  testWidgets('My builds opens /learner/builds', (tester) async {
    final router = await _pumpBuildPage(
      tester,
      build: _sampleBuild(),
      viewport: const Size(1024, 900),
      extraRoutes: [
        GoRoute(
          path: '/learner/builds',
          builder: (context, state) =>
              const Scaffold(body: Text('my builds page')),
        ),
      ],
    );

    await tester.tap(find.text('My builds'));
    await tester.pumpAndSettle();

    expect(
      router.routerDelegate.currentConfiguration.uri.path,
      '/learner/builds',
    );
  });

  testWidgets('pause updates the page to Paused without hard refresh', (
    tester,
  ) async {
    final repository = _UpdatingBuildRepository(
      _sampleBuild(status: ProjectBuildStatus.inProgress),
      paused: _sampleBuild(status: ProjectBuildStatus.paused),
    );
    final api = _RecordingLearnerBuildsApi(
      paused: _sampleBuild(status: ProjectBuildStatus.paused),
      repository: repository,
    );

    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.inProgress),
      repository: repository,
      learnerBuildsApi: api,
      viewport: const Size(1024, 900),
    );

    await tester.tap(find.text('Build actions'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Pause build'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirm'));
    await tester.pumpAndSettle();

    expect(api.pauseCalls, 1);
    expect(find.text('Paused'), findsOneWidget);
    expect(find.text('Resume build'), findsWidgets);
  });

  testWidgets('Paused page displays Resume build', (tester) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.paused),
      viewport: const Size(1024, 900),
    );

    expect(find.text('Resume build'), findsWidgets);
  });

  testWidgets('Resume returns the page to In progress', (tester) async {
    final repository = _UpdatingBuildRepository(
      _sampleBuild(status: ProjectBuildStatus.paused),
      paused: _sampleBuild(status: ProjectBuildStatus.paused),
      resumed: _sampleBuild(status: ProjectBuildStatus.inProgress),
    );
    final api = _RecordingLearnerBuildsApi(
      paused: _sampleBuild(status: ProjectBuildStatus.paused),
      resumed: _sampleBuild(status: ProjectBuildStatus.inProgress),
      repository: repository,
    );

    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.paused),
      repository: repository,
      learnerBuildsApi: api,
      viewport: const Size(1024, 900),
    );

    await tester.tap(find.text('Resume build').first);
    await tester.pumpAndSettle();

    expect(api.resumeCalls, 1);
    expect(find.text('In progress'), findsOneWidget);
    expect(find.text('Paused'), findsNothing);
  });

  testWidgets('Pause failure displays action-specific error', (tester) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.inProgress),
      learnerBuildsApi: _FailingLearnerBuildsApi(
        onPause: () => throw const ApiException(
          message: 'Request failed',
          code: 'UNKNOWN',
        ),
      ),
      viewport: const Size(1024, 900),
    );

    await tester.tap(find.text('Build actions'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Pause build'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirm'));
    await tester.pumpAndSettle();

    expect(
      find.text(ProjectBuildPageL10n.errorPauseBuild.en),
      findsOneWidget,
    );
    expect(find.text('Request failed'), findsNothing);
  });

  testWidgets('Resume failure displays action-specific error', (tester) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.paused),
      learnerBuildsApi: _FailingLearnerBuildsApi(
        onResume: () => throw const ApiException(
          message: 'Request failed',
          code: 'UNKNOWN',
        ),
      ),
      viewport: const Size(1024, 900),
    );

    await tester.tap(find.text('Resume build').first);
    await tester.pumpAndSettle();

    expect(
      find.text(ProjectBuildPageL10n.errorResumeBuild.en),
      findsOneWidget,
    );
    expect(find.text('Request failed'), findsNothing);
  });

  testWidgets('Archive failure displays action-specific error', (tester) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.inProgress),
      learnerBuildsApi: _FailingLearnerBuildsApi(
        onArchive: () => throw ApiException(
          message: 'Request failed',
          code: 'BUILD_ARCHIVE_BLOCKED',
          details: {
            'blockers': [
              {
                'message':
                    'This build can’t be archived while it has active reservations.',
              },
            ],
          },
        ),
      ),
      viewport: const Size(1024, 900),
    );

    await tester.tap(find.text('Build actions'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Archive'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirm'));
    await tester.pumpAndSettle();

    expect(
      find.text(ProjectBuildPageL10n.errorArchiveBuild.en),
      findsOneWidget,
    );
    expect(find.text('Request failed'), findsNothing);
  });

  test('material request failure uses material-request-specific error', () {
    const error = ApiException(message: 'Request failed', code: 'UNKNOWN');

    expect(
      ProjectBuildPageL10n.lifecycleErrorMessage(
        error,
        ProjectBuildLifecycleErrorAction.materialRequest,
        'en',
      ),
      ProjectBuildPageL10n.errorMaterialRequest.en,
    );
  });

  testWidgets('background refresh failure does not show generic snackbar', (
    tester,
  ) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.inProgress),
      repository: _AlwaysFailingBuildRepository(),
      viewport: const Size(1024, 900),
    );

    expect(find.text('Request failed'), findsNothing);
    expect(find.text('Unable to load checklist'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
  });

  testWidgets('desktop snackbar is bounded and does not overflow', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) {
            return Scaffold(
              body: Center(
                child: ElevatedButton(
                  onPressed: () => showErrorSnackBar(
                    context,
                    const ApiException(message: 'Pause failed'),
                    message: 'Couldn’t pause this build.',
                  ),
                  child: const Text('show'),
                ),
              ),
            );
          },
        ),
      ),
    );
    tester.view.physicalSize = const Size(1200, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);

    await tester.tap(find.text('show'));
    await tester.pumpAndSettle();

    final snackBar = tester.widget<SnackBar>(find.byType(SnackBar));
    expect(snackBar.width, 480);
    expect(snackBar.behavior, SnackBarBehavior.floating);
  });

  testWidgets('Arabic labels render correctly', (tester) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.paused),
      locale: const Locale('ar'),
      viewport: const Size(1024, 900),
    );

    expect(find.text('العودة إلى المشروع'), findsOneWidget);
    expect(find.text('مشاريعي'), findsOneWidget);
    expect(find.text('إجراءات المشروع'), findsOneWidget);
    expect(find.text('متوقف مؤقتًا'), findsOneWidget);
    expect(find.text('يتم حفظ تقدمك تلقائيًا.'), findsOneWidget);
  });

  testWidgets('RTL action row does not overflow horizontally', (tester) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.inProgress),
      locale: const Locale('ar'),
      viewport: const Size(390, 844),
    );

    expect(tester.takeException(), isNull);
    expect(find.byType(OverflowBar), findsNothing);
  });
}

Future<GoRouter> _pumpBuildPage(
  WidgetTester tester, {
  required ProjectBuild build,
  Locale locale = const Locale('en'),
  Size viewport = const Size(1024, 900),
  LearnerBuildsApi? learnerBuildsApi,
  LearningProjectRepository? repository,
  List<GoRoute> extraRoutes = const [],
}) async {
  tester.view.physicalSize = viewport;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);

  final router = GoRouter(
    initialLocation: '/learning/project-1/build',
    routes: [
      GoRoute(
        path: '/learning/:id',
        builder: (context, state) =>
            Scaffold(body: Text('project ${state.pathParameters['id']}')),
      ),
      GoRoute(
        path: '/learning/:id/build',
        builder: (context, state) => LearningProjectBuildPage(
          projectId: state.pathParameters['id']!,
        ),
      ),
      ...extraRoutes,
    ],
  );

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authControllerProvider.overrideWith(_TestAuthController.new),
        learningHubRepositoryProvider.overrideWithValue(
          repository ?? _StaticBuildRepository(build),
        ),
        learnerBuildsApiProvider.overrideWithValue(
          learnerBuildsApi ?? _NoopLearnerBuildsApi(build),
        ),
        myNotificationUnreadCountProvider.overrideWith(
          () => _ZeroUnreadCount(),
        ),
      ],
      child: MaterialApp.router(
        routerConfig: router,
        locale: locale,
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [Locale('en'), Locale('ar')],
      ),
    ),
  );
  await tester.pumpAndSettle();
  return router;
}

ProjectBuild _sampleBuild({
  ProjectBuildStatus status = ProjectBuildStatus.inProgress,
}) {
  return ProjectBuild(
    id: 'build-1',
    projectId: 'project-1',
    status: status,
    project: const ProjectBuildProject(
      id: 'project-1',
      title: 'PVC Plant Stand',
      shortDescription: 'A simple plant stand build',
    ),
    progress: const ProjectBuildProgress(total: 2, ready: 1, percent: 50),
    materialReadiness: const ProjectBuildMaterialReadiness(
      ready: 1,
      linked: 1,
      reserved: 0,
      missing: 1,
      total: 2,
    ),
    stepProgress: const ProjectBuildStepProgress(
      completed: 0,
      total: 2,
      percent: 0,
      steps: [],
    ),
    items: const [],
  );
}

class _TestAuthController extends AuthController {
  @override
  AuthState build() {
    return AuthState(
      user: User(
        id: 'learner-1',
        email: 'learner@example.com',
        displayName: 'Learner',
        accountStatus: 'ACTIVE',
        activeRole: 'LEARNER',
        roles: const ['LEARNER'],
        createdAt: DateTime(2026),
      ),
      accessToken: 'token',
      hasBootstrapped: true,
    );
  }
}

class _StaticBuildRepository implements LearningProjectRepository {
  const _StaticBuildRepository(this.build);

  final ProjectBuild build;

  @override
  Future<ProjectBuild?> fetchMyBuild(String projectId) async => build;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _AlwaysFailingBuildRepository implements LearningProjectRepository {
  @override
  Future<ProjectBuild?> fetchMyBuild(String projectId) async {
    throw const ApiException(message: 'Request failed', code: 'UNKNOWN');
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _NoopLearnerBuildsApi implements LearnerBuildsApi {
  _NoopLearnerBuildsApi(this.build);

  final ProjectBuild build;

  @override
  Future<ProjectBuild> pauseBuild(String buildId) async =>
      build.copyWith(status: ProjectBuildStatus.paused);

  @override
  Future<ProjectBuild> resumeBuild(String buildId) async =>
      build.copyWith(status: ProjectBuildStatus.inProgress);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _UpdatingBuildRepository implements LearningProjectRepository {
  _UpdatingBuildRepository(
    this._current, {
    required this.paused,
    this.resumed,
  });

  ProjectBuild _current;
  final ProjectBuild paused;
  final ProjectBuild? resumed;

  void markPaused() {
    _current = paused;
  }

  void markResumed() {
    if (resumed != null) {
      _current = resumed!;
    }
  }

  @override
  Future<ProjectBuild?> fetchMyBuild(String projectId) async => _current;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _RecordingLearnerBuildsApi implements LearnerBuildsApi {
  _RecordingLearnerBuildsApi({
    required this.paused,
    this.resumed,
    this.repository,
  });

  final ProjectBuild paused;
  final ProjectBuild? resumed;
  final _UpdatingBuildRepository? repository;
  int pauseCalls = 0;
  int resumeCalls = 0;

  @override
  Future<ProjectBuild> pauseBuild(String buildId) async {
    pauseCalls += 1;
    repository?.markPaused();
    return paused;
  }

  @override
  Future<ProjectBuild> resumeBuild(String buildId) async {
    resumeCalls += 1;
    repository?.markResumed();
    return resumed ?? paused.copyWith(status: ProjectBuildStatus.inProgress);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _FailingLearnerBuildsApi implements LearnerBuildsApi {
  _FailingLearnerBuildsApi({this.onPause, this.onResume, this.onArchive});

  final Future<ProjectBuild> Function()? onPause;
  final Future<ProjectBuild> Function()? onResume;
  final Future<ProjectBuild> Function()? onArchive;

  @override
  Future<ProjectBuild> pauseBuild(String buildId) {
    return onPause?.call() ??
        Future.error(const ApiException(message: 'Request failed'));
  }

  @override
  Future<ProjectBuild> resumeBuild(String buildId) {
    return onResume?.call() ??
        Future.error(const ApiException(message: 'Request failed'));
  }

  @override
  Future<ProjectBuild> archiveBuild(String buildId) {
    return onArchive?.call() ??
        Future.error(const ApiException(message: 'Request failed'));
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _ZeroUnreadCount extends NotificationUnreadCountNotifier {
  @override
  Future<int> build() async => 0;
}

extension on ProjectBuild {
  ProjectBuild copyWith({ProjectBuildStatus? status}) {
    return ProjectBuild(
      id: id,
      projectId: projectId,
      status: status ?? this.status,
      project: project,
      progress: progress,
      materialReadiness: materialReadiness,
      stepProgress: stepProgress,
      items: items,
      isReadOnly: isReadOnly,
    );
  }
}
