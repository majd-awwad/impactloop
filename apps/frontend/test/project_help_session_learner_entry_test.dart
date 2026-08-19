import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/learner_builds/data/models/learner_build_models.dart';
import 'package:frontend/features/learner_builds/presentation/widgets/learner_build_list_widgets.dart';
import 'package:frontend/features/learning_hub/application/learning_hub_providers.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/project_help_sessions/application/open_learner_help_session_entry.dart';
import 'package:frontend/features/project_help_sessions/application/project_help_sessions_providers.dart';
import 'package:frontend/features/project_help_sessions/data/models/project_help_session_models.dart';
import 'package:frontend/features/project_help_sessions/presentation/widgets/build_help_session_compact_action.dart';
import 'package:frontend/features/project_help_sessions/presentation/widgets/build_help_session_icon_button.dart';

ProjectBuild _testBuild({
  ProjectBuildStatus status = ProjectBuildStatus.inProgress,
}) {
  return ProjectBuild(
    id: 'build-1',
    projectId: 'project-1',
    status: status,
    project: const ProjectBuildProject(
      id: 'project-1',
      title: 'Solar Lamp',
      shortDescription: 'Build a lamp',
    ),
    progress: const ProjectBuildProgress(total: 3, ready: 1, percent: 33),
    materialReadiness: const ProjectBuildMaterialReadiness(
      ready: 0,
      linked: 0,
      reserved: 0,
      missing: 1,
      total: 1,
    ),
    stepProgress: const ProjectBuildStepProgress(
      completed: 0,
      total: 1,
      percent: 0,
      steps: [
        ProjectBuildStepView(
          stepId: 'step-1',
          stepNumber: 1,
          title: 'Wire the panel',
          description: 'Wire safely',
          state: ProjectBuildStepState.current,
        ),
      ],
    ),
    items: const [],
    attemptNumber: 1,
    startedAt: DateTime.utc(2026, 1, 1),
    updatedAt: DateTime.utc(2026, 1, 2),
  );
}

ProjectHelpSession _session({
  ProjectHelpSessionStatus status = ProjectHelpSessionStatus.pending,
}) {
  return ProjectHelpSession(
    id: 'session-1',
    status: status,
    project: const ProjectHelpSessionProjectSummary(
      id: 'project-1',
      title: 'Solar Lamp',
    ),
    build: const ProjectHelpSessionBuildSummary(
      id: 'build-1',
      attemptNumber: 1,
    ),
    learner: const ProjectHelpSessionUserSummary(
      id: 'learner-1',
      displayName: 'Learner One',
    ),
    author: const ProjectHelpSessionUserSummary(
      id: 'author-1',
      displayName: 'Creator',
    ),
    problemDescription: 'I cannot finish wiring the panel safely.',
    durationMinutes: 30,
    learnerTimeZone: 'Asia/Hebron',
    timeOptions: const [],
    learnerAllowedActions: ProjectHelpSessionLearnerAllowedActions.empty,
    authorAllowedActions: ProjectHelpSessionAuthorAllowedActions.empty,
    createdAt: DateTime.utc(2026, 2, 1),
    updatedAt: DateTime.utc(2026, 2, 1),
    meetingReady: false,
  );
}

const _available = ProjectHelpSessionAvailability(
  available: true,
  allowedDurations: [15, 30],
  authorDisplayName: 'Creator',
);

const _authorUnavailable = ProjectHelpSessionAvailability(
  available: false,
  reason: 'AUTHOR_UNAVAILABLE',
);

const _disabled = ProjectHelpSessionAvailability(
  available: false,
  reason: 'DISABLED',
);

class _AuthController extends AuthController {
  @override
  AuthState build() => AuthState(
    user: User(
      id: 'learner-1',
      email: 'learner@test.com',
      displayName: 'Learner',
      accountStatus: 'ACTIVE',
      activeRole: 'LEARNER',
      roles: const ['LEARNER'],
      createdAt: DateTime.utc(2026),
    ),
    accessToken: 'token',
    hasBootstrapped: true,
  );
}

LearnerBuildListItem _listItem({
  ProjectBuildStatus status = ProjectBuildStatus.inProgress,
}) {
  return LearnerBuildListItem(
    id: 'build-1',
    projectId: 'project-1',
    attemptNumber: 1,
    status: status,
    project: const LearnerBuildListProject(
      id: 'project-1',
      title: 'Solar Lamp',
      shortDescription: 'Build a lamp',
    ),
    startedAt: DateTime.utc(2026, 8, 1),
    updatedAt: DateTime.utc(2026, 8, 2),
  );
}

Future<GoRouter> _pumpEntry({
  required WidgetTester tester,
  required Widget child,
  List overrides = const [],
  Locale locale = const Locale('en'),
  Size viewport = const Size(800, 1200),
}) async {
  tester.view.physicalSize = viewport;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);

  final router = GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => Scaffold(body: child),
      ),
      GoRoute(
        path: '/learner/help-sessions/:sessionId',
        builder: (context, state) => Scaffold(
          body: Text('session:${state.pathParameters['sessionId']}'),
        ),
      ),
      GoRoute(
        path: '/learning/:id/build',
        builder: (context, state) => Scaffold(
          body: Text('build:${state.pathParameters['id']}'),
        ),
      ),
      GoRoute(
        path: '/learner/builds/:buildId/notebook',
        builder: (context, state) => const Scaffold(body: Text('notebook')),
      ),
    ],
  );

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authControllerProvider.overrideWith(_AuthController.new),
        ...overrides,
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

Future<void> _pumpOpen(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
  await tester.pump(const Duration(milliseconds: 300));
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('backend-aligned eligibility is in-progress or paused only', () {
    expect(
      isLearnerHelpSessionBuildEligible(ProjectBuildStatus.inProgress),
      isTrue,
    );
    expect(
      isLearnerHelpSessionBuildEligible(ProjectBuildStatus.paused),
      isTrue,
    );
    expect(
      isLearnerHelpSessionBuildEligible(ProjectBuildStatus.completed),
      isFalse,
    );
    expect(
      isLearnerHelpSessionBuildEligible(ProjectBuildStatus.archived),
      isFalse,
    );
  });

  testWidgets('eligible My Builds help icon opens the request screen', (
    tester,
  ) async {
    await _pumpEntry(
      tester: tester,
      child: LearnerBuildListCard(item: _listItem()),
      overrides: [
        activeHelpSessionForBuildProvider(
          'build-1',
        ).overrideWith((ref) async => null),
        projectBuildProvider(
          'project-1',
        ).overrideWith((ref) async => _testBuild()),
        projectHelpSessionAvailabilityProvider(
          'project-1',
        ).overrideWith((ref) async => _available),
      ],
    );

    await tester.tap(find.byKey(const Key('build-help-session-icon')));
    await _pumpOpen(tester);

    expect(find.text('Request a 1-on-1 help session'), findsOneWidget);
    expect(find.text('What do you need help with?'), findsOneWidget);
    expect(find.text('build:project-1'), findsNothing);
  });

  testWidgets('ineligible My Builds help icon shows feedback instead of no-op', (
    tester,
  ) async {
    await _pumpEntry(
      tester: tester,
      child: LearnerBuildListCard(item: _listItem()),
      overrides: [
        activeHelpSessionForBuildProvider(
          'build-1',
        ).overrideWith((ref) async => null),
        projectBuildProvider(
          'project-1',
        ).overrideWith((ref) async => _testBuild()),
        projectHelpSessionAvailabilityProvider(
          'project-1',
        ).overrideWith((ref) async => _disabled),
      ],
    );

    await tester.tap(find.byKey(const Key('build-help-session-icon')));
    await _pumpOpen(tester);

    expect(
      find.text(
        'The project creator is not accepting help-session requests right now.',
      ),
      findsOneWidget,
    );
    expect(find.text('Request a 1-on-1 help session'), findsNothing);
    expect(find.text('build:project-1'), findsNothing);
  });

  testWidgets('project owner cannot open a self-help request', (tester) async {
    await _pumpEntry(
      tester: tester,
      child: LearnerBuildListCard(item: _listItem()),
      overrides: [
        activeHelpSessionForBuildProvider(
          'build-1',
        ).overrideWith((ref) async => null),
        projectBuildProvider(
          'project-1',
        ).overrideWith((ref) async => _testBuild()),
        projectHelpSessionAvailabilityProvider(
          'project-1',
        ).overrideWith((ref) async => _authorUnavailable),
      ],
    );

    await tester.tap(find.byKey(const Key('build-help-session-icon')));
    await _pumpOpen(tester);

    expect(
      find.text('Help sessions are unavailable for this project.'),
      findsOneWidget,
    );
    expect(find.text('Request a 1-on-1 help session'), findsNothing);
    expect(find.text('session:session-1'), findsNothing);
  });

  testWidgets('active existing session opens detail instead of a new request', (
    tester,
  ) async {
    await _pumpEntry(
      tester: tester,
      child: LearnerBuildListCard(item: _listItem()),
      overrides: [
        activeHelpSessionForBuildProvider(
          'build-1',
        ).overrideWith((ref) async => _session()),
        projectHelpSessionAvailabilityProvider(
          'project-1',
        ).overrideWith((ref) async => _available),
      ],
    );

    await tester.tap(find.byKey(const Key('build-help-session-icon')));
    await _pumpOpen(tester);

    expect(find.text('session:session-1'), findsOneWidget);
    expect(find.text('Request a 1-on-1 help session'), findsNothing);
  });

  testWidgets('PREPARE-status in-progress build still exposes help entry', (
    tester,
  ) async {
    await _pumpEntry(
      tester: tester,
      child: BuildHelpSessionCompactAction(buildRecord: _testBuild()),
      overrides: [
        activeHelpSessionForBuildProvider(
          'build-1',
        ).overrideWith((ref) async => null),
        projectHelpSessionAvailabilityProvider(
          'project-1',
        ).overrideWith((ref) async => _available),
      ],
    );

    expect(find.text('Request a help session'), findsOneWidget);
    await tester.tap(find.byKey(const Key('build-help-session-compact-action')));
    await _pumpOpen(tester);
    expect(find.text('Request a 1-on-1 help session'), findsOneWidget);
  });

  testWidgets('completed build hides learner help entry', (tester) async {
    await _pumpEntry(
      tester: tester,
      child: Column(
        children: [
          BuildHelpSessionIconButton(
            buildId: 'build-1',
            projectId: 'project-1',
            status: ProjectBuildStatus.completed,
          ),
          BuildHelpSessionCompactAction(
            buildRecord: _testBuild(status: ProjectBuildStatus.completed),
          ),
        ],
      ),
    );

    expect(find.byKey(const Key('build-help-session-icon')), findsNothing);
    expect(
      find.byKey(const Key('build-help-session-compact-action')),
      findsNothing,
    );
    expect(find.text('Request a help session'), findsNothing);
  });

  testWidgets('Arabic RTL compact help action stays valid', (tester) async {
    await _pumpEntry(
      tester: tester,
      locale: const Locale('ar'),
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: BuildHelpSessionCompactAction(buildRecord: _testBuild()),
      ),
    );

    expect(find.text('طلب جلسة مساعدة'), findsOneWidget);
    final text = tester.widget<Text>(find.text('طلب جلسة مساعدة'));
    expect(text.maxLines, 1);
    expect(
      tester.takeException(),
      isNull,
    );
  });
}
