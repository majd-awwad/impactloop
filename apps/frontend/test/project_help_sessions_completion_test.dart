import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/app/router/navigation_extensions.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/notifications/application/notification_display.dart';
import 'package:frontend/features/notifications/data/models/app_notification.dart';
import 'package:frontend/features/project_help_sessions/application/project_help_sessions_providers.dart';
import 'package:frontend/features/project_help_sessions/data/models/project_help_session_models.dart';
import 'package:frontend/features/project_help_sessions/presentation/l10n/project_help_sessions_l10n.dart';
import 'package:frontend/features/project_help_sessions/presentation/pages/creator_help_session_detail_page.dart';
import 'package:frontend/features/project_help_sessions/presentation/pages/learner_help_session_detail_page.dart';
import 'package:frontend/features/project_help_sessions/presentation/widgets/help_session_boundary_refresh.dart';

ProjectHelpSession _session({
  required ProjectHelpSessionStatus status,
  ProjectHelpSessionAuthorAllowedActions authorActions =
      ProjectHelpSessionAuthorAllowedActions.empty,
  ProjectHelpSessionLearnerAllowedActions learnerActions =
      ProjectHelpSessionLearnerAllowedActions.empty,
  DateTime? completionAvailableAt,
  DateTime? completedAt,
  DateTime? selectedStartsAt,
}) {
  return ProjectHelpSession(
    id: 'session-1',
    status: status,
    project: const ProjectHelpSessionProjectSummary(
      id: 'project-1',
      title: 'Solar Lamp',
    ),
    build: const ProjectHelpSessionBuildSummary(id: 'build-1', attemptNumber: 1),
    learner: const ProjectHelpSessionUserSummary(
      id: 'learner-1',
      displayName: 'Learner',
    ),
    author: const ProjectHelpSessionUserSummary(
      id: 'author-1',
      displayName: 'Author',
    ),
    problemDescription: 'Need help with wiring.',
    durationMinutes: 30,
    learnerTimeZone: 'UTC',
    timeOptions: const [],
    learnerAllowedActions: learnerActions,
    authorAllowedActions: authorActions,
    createdAt: DateTime.utc(2026, 2, 1, 10),
    updatedAt: DateTime.utc(2026, 2, 1, 10),
    selectedStartsAt: selectedStartsAt ?? DateTime.utc(2026, 2, 1, 12),
    completedAt: completedAt,
    completionAvailableAt: completionAvailableAt,
    meetingReady: status == ProjectHelpSessionStatus.scheduled,
  );
}

class _LearnerAuth extends AuthController {
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

class _AuthorAuth extends AuthController {
  @override
  AuthState build() => AuthState(
        user: User(
          id: 'author-1',
          email: 'author@test.com',
          displayName: 'Author',
          accountStatus: 'ACTIVE',
          activeRole: 'LEARNER',
          roles: const ['LEARNER'],
          createdAt: DateTime.utc(2026),
        ),
        accessToken: 'token',
        hasBootstrapped: true,
      );
}

Widget _wrap(
  Widget child, {
  required AuthController Function() auth,
  List overrides = const [],
}) {
  return ProviderScope(
    overrides: [
      authControllerProvider.overrideWith(auth),
      ...overrides,
    ],
    child: MaterialApp(
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ],
      supportedLocales: const [Locale('en'), Locale('ar')],
      home: Scaffold(body: child),
    ),
  );
}

void main() {
  group('PHS-06 author completion', () {
    testWidgets('scheduled before end disables complete and shows availability',
        (tester) async {
      final availableAt = DateTime.now().toUtc().add(const Duration(hours: 1));
      await tester.pumpWidget(
        _wrap(
          const CreatorHelpSessionDetailPage(sessionId: 'session-1'),
          auth: _AuthorAuth.new,
          overrides: [
            authorHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(
                status: ProjectHelpSessionStatus.scheduled,
                completionAvailableAt: availableAt,
                authorActions: const ProjectHelpSessionAuthorAllowedActions(
                  canAcceptOption: false,
                  canProposeAlternative: false,
                  canDecline: false,
                  canCancel: true,
                  canJoin: false,
                  canRetryZoom: false,
                  canComplete: false,
                ),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      final button = find.widgetWithText(
        OutlinedButton,
        ProjectHelpSessionsL10n.markSessionCompleted.en,
      );
      expect(button, findsOneWidget);
      expect(tester.widget<OutlinedButton>(button).onPressed, isNull);
      expect(find.textContaining('Completion available at'), findsOneWidget);
    });

    testWidgets('canComplete enables completion action', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const CreatorHelpSessionDetailPage(sessionId: 'session-1'),
          auth: _AuthorAuth.new,
          overrides: [
            authorHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(
                status: ProjectHelpSessionStatus.scheduled,
                completionAvailableAt: DateTime.now().toUtc(),
                authorActions: const ProjectHelpSessionAuthorAllowedActions(
                  canAcceptOption: false,
                  canProposeAlternative: false,
                  canDecline: false,
                  canCancel: true,
                  canJoin: true,
                  canRetryZoom: false,
                  canComplete: true,
                ),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      final button = find.widgetWithText(
        OutlinedButton,
        ProjectHelpSessionsL10n.markSessionCompleted.en,
      );
      expect(tester.widget<OutlinedButton>(button).onPressed, isNotNull);
    });

    testWidgets('boundary refresh schedules one-shot timer', (tester) async {
      var boundaryCalls = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: HelpSessionBoundaryRefresh(
            boundaryAt: DateTime.now().add(const Duration(milliseconds: 40)),
            isBoundaryReached: false,
            onBoundary: () => boundaryCalls++,
            child: const Text('body'),
          ),
        ),
      );
      await tester.pump();
      expect(boundaryCalls, 0);
      await tester.pump(const Duration(milliseconds: 60));
      expect(boundaryCalls, 1);
      await tester.pump(const Duration(seconds: 1));
      expect(boundaryCalls, 1);
    });
  });

  group('PHS-06 learner completed', () {
    testWidgets('completed state shows notebook CTA only when completed',
        (tester) async {
      await tester.pumpWidget(
        _wrap(
          const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
          auth: _LearnerAuth.new,
          overrides: [
            learnerHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(
                status: ProjectHelpSessionStatus.completed,
                completedAt: DateTime.utc(2026, 2, 1, 13),
                learnerActions: ProjectHelpSessionLearnerAllowedActions.empty,
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.text(ProjectHelpSessionsL10n.addSessionNotesToNotebook.en),
        findsOneWidget,
      );
      expect(find.text(ProjectHelpSessionsL10n.joinZoom.en), findsNothing);
    });

    testWidgets('scheduled state hides notebook CTA', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
          auth: _LearnerAuth.new,
          overrides: [
            learnerHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(
                status: ProjectHelpSessionStatus.scheduled,
                learnerActions: const ProjectHelpSessionLearnerAllowedActions(
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
      expect(
        find.text(ProjectHelpSessionsL10n.addSessionNotesToNotebook.en),
        findsNothing,
      );
    });

    test('completed notification routes to learner detail', () {
      final route = projectHelpSessionNotificationRoute(
        AppNotification(
          id: 'n1',
          notificationType: 'PROJECT_HELP_SESSION_COMPLETED',
          title: 'Done',
          body: 'Done',
          isRead: false,
          createdAt: DateTime.utc(2026),
          relatedEntityType: 'PROJECT_HELP_SESSION',
          relatedEntityId: 'session-1',
          metadata: const {'recipientRole': 'LEARNER', 'sessionId': 'session-1'},
        ),
      );
      expect(route, learnerHelpSessionDetailRoute('session-1'));
    });
  });

  group('PHS-06 notebook navigation', () {
    test('notebook route supports pageId query', () {
      expect(
        learnerBuildNotebookRoute('build-1', pageId: 'page-abc'),
        '/learner/builds/build-1/notebook?pageId=page-abc',
      );
    });
  });
}
