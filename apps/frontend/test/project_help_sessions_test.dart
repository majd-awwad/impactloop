import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/app/router/navigation_extensions.dart';
import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/notifications/application/notification_display.dart';
import 'package:frontend/features/notifications/data/models/app_notification.dart';
import 'package:frontend/features/project_help_sessions/application/project_help_session_timezone.dart';
import 'package:frontend/features/project_help_sessions/application/project_help_sessions_providers.dart';
import 'package:frontend/features/project_help_sessions/data/models/project_help_session_models.dart';
import 'package:frontend/features/project_help_sessions/presentation/pages/learner_help_session_detail_page.dart';
import 'package:frontend/features/project_help_sessions/presentation/pages/learner_help_sessions_page.dart';
import 'package:frontend/features/project_help_sessions/presentation/widgets/build_help_session_section.dart';
import 'package:frontend/features/project_help_sessions/presentation/widgets/help_session_request_form.dart';
import 'package:frontend/features/profile/presentation/widgets/learner_profile_dashboard_widgets.dart';

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
      missing: 0,
      total: 0,
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
  ProjectHelpSessionLearnerAllowedActions learnerAllowedActions =
      ProjectHelpSessionLearnerAllowedActions.empty,
  ProjectHelpSessionAuthorAllowedActions authorAllowedActions =
      ProjectHelpSessionAuthorAllowedActions.empty,
  DateTime? selectedStartsAt,
  DateTime? joinAvailableAt,
  List<ProjectHelpSessionTimeOption> timeOptions = const [],
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
    timeOptions: timeOptions,
    learnerAllowedActions: learnerAllowedActions,
    authorAllowedActions: authorAllowedActions,
    createdAt: DateTime.utc(2026, 2, 1),
    updatedAt: DateTime.utc(2026, 2, 1),
    meetingReady: false,
    selectedStartsAt: selectedStartsAt,
    joinAvailableAt: joinAvailableAt,
  );
}

const _available = ProjectHelpSessionAvailability(
  available: true,
  allowedDurations: [15, 30],
  authorDisplayName: 'Creator',
);

const _disabled = ProjectHelpSessionAvailability(
  available: false,
  reason: 'DISABLED',
);

const _authorUnavailable = ProjectHelpSessionAvailability(
  available: false,
  reason: 'AUTHOR_UNAVAILABLE',
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

Widget _wrap(Widget child, {List overrides = const []}) {
  return ProviderScope(
    overrides: [
      authControllerProvider.overrideWith(_AuthController.new),
      ...overrides,
    ],
    child: MaterialApp(
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('en'), Locale('ar')],
      home: Scaffold(body: child),
    ),
  );
}

Widget _requestForm({
  ProjectBuild? build,
  ProjectHelpSessionAvailability? availability,
  bool isCompact = false,
}) {
  return Builder(
    builder: (context) => ProjectHelpSessionRequestForm(
      hostContext: context,
      build: build ?? _testBuild(),
      availability: availability ?? _available,
      isCompact: isCompact,
    ),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('timezone and errors', () {
    test('converts local wall clock to UTC for Asia/Hebron', () {
      final local = DateTime(2026, 3, 10, 14, 30);
      final utc = projectHelpSessionLocalToUtc(local, 'Asia/Hebron');
      expect(utc.toIso8601String(), '2026-03-10T12:30:00.000Z');
    });

    test('maps validation envelope from ApiException', () {
      const error = ApiException(
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: {
          'issues': [
            {
              'path': 'proposedTimes',
              'message': 'Proposed times must be distinct.',
            },
          ],
        },
      );
      expect(
        resolveProjectHelpSessionErrorFromObject(error, isArabic: false),
        'Proposed times must be distinct.',
      );
    });

    test('maps known backend codes to Arabic messages', () {
      expect(
        resolveProjectHelpSessionErrorMessage(
          'ACTIVE_SESSION_EXISTS',
          isArabic: true,
        ),
        contains('طلب جلسة نشط'),
      );
      expect(
        resolveProjectHelpSessionErrorMessage(
          'ZOOM_CREATE_FAILED',
          isArabic: false,
        ),
        contains('Meeting setup is delayed'),
      );
      expect(
        resolveProjectHelpSessionErrorMessage('TIMEOUT', isArabic: false),
        contains('longer than usual'),
      );
    });
  });

  group('build help session section', () {
    testWidgets('shows request CTA when available', (tester) async {
      await tester.pumpWidget(
        _wrap(
          BuildHelpSessionSection(buildRecord: _testBuild()),
          overrides: [
            projectHelpSessionAvailabilityProvider(
              'project-1',
            ).overrideWith((ref) async => _available),
            activeHelpSessionForBuildProvider(
              'build-1',
            ).overrideWith((ref) async => null),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Request a 1-on-1 help session'), findsOneWidget);
    });

    testWidgets('hides request CTA when disabled', (tester) async {
      await tester.pumpWidget(
        _wrap(
          BuildHelpSessionSection(buildRecord: _testBuild()),
          overrides: [
            projectHelpSessionAvailabilityProvider(
              'project-1',
            ).overrideWith((ref) async => _disabled),
            activeHelpSessionForBuildProvider(
              'build-1',
            ).overrideWith((ref) async => null),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Request a 1-on-1 help session'), findsNothing);
      expect(
        find.text(
          'The project creator is not accepting help-session requests right now.',
        ),
        findsOneWidget,
      );
    });

    testWidgets('shows unavailable copy for author unavailable', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(
          BuildHelpSessionSection(buildRecord: _testBuild()),
          overrides: [
            projectHelpSessionAvailabilityProvider(
              'project-1',
            ).overrideWith((ref) async => _authorUnavailable),
            activeHelpSessionForBuildProvider(
              'build-1',
            ).overrideWith((ref) async => null),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.text('Help sessions are unavailable for this project.'),
        findsOneWidget,
      );
    });

    testWidgets('active session replaces request CTA', (tester) async {
      await tester.pumpWidget(
        _wrap(
          BuildHelpSessionSection(buildRecord: _testBuild()),
          overrides: [
            projectHelpSessionAvailabilityProvider(
              'project-1',
            ).overrideWith((ref) async => _available),
            activeHelpSessionForBuildProvider('build-1').overrideWith(
              (ref) async => _session(status: ProjectHelpSessionStatus.pending),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Request a 1-on-1 help session'), findsNothing);
      expect(find.text('View session'), findsOneWidget);
      expect(find.text('Pending'), findsOneWidget);
    });

    testWidgets('completed build does not show section', (tester) async {
      await tester.pumpWidget(
        _wrap(
          BuildHelpSessionSection(
            buildRecord: _testBuild(status: ProjectBuildStatus.completed),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Request a 1-on-1 help session'), findsNothing);
    });
  });

  group('request form validation', () {
    testWidgets('rejects short problem description', (tester) async {
      await tester.binding.setSurfaceSize(const Size(900, 1600));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.pumpWidget(_wrap(_requestForm()));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField).first, 'too short');
      await tester.ensureVisible(find.text('Send session request'));
      await tester.tap(find.text('Send session request'));
      await tester.pump();

      expect(find.textContaining('minimum 20'), findsOneWidget);
    });

    testWidgets('shows only allowed durations', (tester) async {
      await tester.pumpWidget(
        _wrap(
          _requestForm(
            availability: const ProjectHelpSessionAvailability(
              available: true,
              allowedDurations: [15],
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('15 min'), findsOneWidget);
      expect(find.text('30 min'), findsNothing);
    });

    testWidgets('Arabic labels render', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            locale: const Locale('ar'),
            localizationsDelegates: const [
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: const [Locale('ar'), Locale('en')],
            home: Scaffold(body: _requestForm()),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('طلب جلسة مساعدة فردية'), findsOneWidget);
      expect(find.text('الموعد الأول'), findsOneWidget);
    });
  });

  group('list and detail', () {
    testWidgets('list empty state', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const LearnerHelpSessionsPage(),
          overrides: [
            learnerHelpSessionsProvider.overrideWith(
              (ref) async => const ProjectHelpSessionListResult(
                items: [],
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 0,
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('No help sessions yet'), findsOneWidget);
    });

    testWidgets('detail shows zoom pending without join', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
          overrides: [
            learnerHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async =>
                  _session(status: ProjectHelpSessionStatus.zoomPending),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Meeting is being prepared.'), findsWidgets);
      expect(find.widgetWithText(FilledButton, 'Join Zoom'), findsNothing);
    });

    testWidgets('detail disables join before window', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
          overrides: [
            learnerHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(
                status: ProjectHelpSessionStatus.scheduled,
                selectedStartsAt: DateTime.now().toUtc().add(
                  const Duration(days: 1, minutes: 15),
                ),
                joinAvailableAt: DateTime.now().toUtc().add(
                  const Duration(days: 1),
                ),
                learnerAllowedActions:
                    const ProjectHelpSessionLearnerAllowedActions(
                      canAcceptAlternative: false,
                      canRejectAlternative: false,
                      canCancel: true,
                      canJoin: false,
                    ),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.widgetWithText(FilledButton, 'Join Zoom'), findsOneWidget);
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Join Zoom'),
            )
            .onPressed,
        isNull,
      );
    });

    testWidgets('detail shows join when allowed', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
          overrides: [
            learnerHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(
                status: ProjectHelpSessionStatus.scheduled,
                learnerAllowedActions:
                    const ProjectHelpSessionLearnerAllowedActions(
                      canAcceptAlternative: false,
                      canRejectAlternative: false,
                      canCancel: true,
                      canJoin: true,
                    ),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.widgetWithText(FilledButton, 'Join Zoom'), findsOneWidget);
    });
  });

  group('profile quick action', () {
    testWidgets('opens help sessions list label', (tester) async {
      String? opened;
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authorHelpSessionsEntryVisibleProvider.overrideWith(
              (ref) async => false,
            ),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: DashboardQuickActions(
                onOpen: (route, {bool refreshOnReturn = false}) {
                  opened = route;
                },
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Help sessions'), findsOneWidget);
      await tester.tap(find.text('Help sessions'));
      expect(opened, learnerHelpSessionsRoute);
    });
  });

  group('routing and notifications', () {
    test('canonical routes', () {
      expect(learnerHelpSessionsRoute, '/learner/help-sessions');
      expect(
        learnerHelpSessionDetailRoute('abc'),
        '/learner/help-sessions/abc',
      );
    });

    test('notification deep links to detail route', () {
      final notification = AppNotification(
        id: 'n1',
        notificationType: 'PROJECT_HELP_SESSION_ACCEPTED',
        title: 'Accepted',
        body: 'Your session was accepted',
        relatedEntityType: 'PROJECT_HELP_SESSION',
        relatedEntityId: 'session-99',
        metadata: const {'sessionId': 'session-99'},
        isRead: false,
        createdAt: DateTime.utc(2026),
      );

      expect(
        projectHelpSessionNotificationRoute(notification),
        '/learner/help-sessions/session-99',
      );
      expect(
        notificationOpenRoute(
          notification,
          isSupplierMode: false,
          isDriverMode: false,
        ),
        '/learner/help-sessions/session-99',
      );
    });

    testWidgets('router resolves help session detail path', (tester) async {
      final router = GoRouter(
        routes: [
          GoRoute(
            path: '/',
            builder: (context, state) => const SizedBox.shrink(),
          ),
          GoRoute(
            path: '/learner/help-sessions',
            builder: (context, state) => const LearnerHelpSessionsPage(),
          ),
          GoRoute(
            path: '/learner/help-sessions/:sessionId',
            builder: (context, state) => LearnerHelpSessionDetailPage(
              sessionId: state.pathParameters['sessionId']!,
            ),
          ),
        ],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith(_AuthController.new),
            learnerHelpSessionDetailProvider(
              'session-1',
            ).overrideWith((ref) async => _session()),
          ],
          child: MaterialApp.router(
            routerConfig: router,
            localizationsDelegates: const [
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
            ],
            supportedLocales: const [Locale('en')],
          ),
        ),
      );

      router.go('/learner/help-sessions/session-1');
      await tester.pumpAndSettle();

      expect(find.byType(LearnerHelpSessionDetailPage), findsOneWidget);
    });
  });

  group('privacy', () {
    test('session model has no zoom join url field in JSON mapping', () {
      final session = ProjectHelpSession.fromJson({
        'id': 's1',
        'status': 'SCHEDULED',
        'project': {'id': 'p1', 'title': 'T'},
        'build': {'id': 'b1', 'attemptNumber': 1},
        'learner': {'id': 'l1', 'displayName': 'L'},
        'author': {'id': 'a1', 'displayName': 'A'},
        'problemDescription': 'help',
        'durationMinutes': 15,
        'learnerTimeZone': 'UTC',
        'timeOptions': [],
        'allowedActions': {
          'canAcceptAlternative': false,
          'canRejectAlternative': false,
          'canCancel': true,
          'canJoin': true,
        },
        'createdAt': '2026-01-01T00:00:00.000Z',
        'updatedAt': '2026-01-01T00:00:00.000Z',
        'meetingReady': true,
        'zoomJoinUrl': 'https://zoom.example/join',
        'startUrl': 'https://zoom.example/start',
      });

      expect(session.id, 's1');
      expect(session.allowedActions.canJoin, isTrue);
    });
  });
}
