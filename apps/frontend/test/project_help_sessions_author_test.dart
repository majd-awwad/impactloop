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
import 'package:frontend/features/project_help_sessions/presentation/pages/creator_help_sessions_page.dart';
import 'package:frontend/features/project_help_sessions/presentation/pages/creator_project_help_session_settings_page.dart';

ProjectHelpSession _authorSession({
  ProjectHelpSessionStatus status = ProjectHelpSessionStatus.pending,
  ProjectHelpSessionAuthorAllowedActions authorAllowedActions =
      const ProjectHelpSessionAuthorAllowedActions(
    canAcceptOption: true,
    canProposeAlternative: true,
    canDecline: true,
    canCancel: false,
    canJoin: false,
    canRetryZoom: false,
    canComplete: false,
  ),
  List<ProjectHelpSessionTimeOption> timeOptions = const [],
}) {
  return ProjectHelpSession(
    id: 'session-author-1',
    status: status,
    project: const ProjectHelpSessionProjectSummary(
      id: 'project-1',
      title: 'Solar Lamp',
    ),
    build: const ProjectHelpSessionBuildSummary(id: 'build-1', attemptNumber: 1),
    learner: const ProjectHelpSessionUserSummary(
      id: 'learner-1',
      displayName: 'Learner One',
    ),
    author: const ProjectHelpSessionUserSummary(
      id: 'author-1',
      displayName: 'Creator',
    ),
    problemDescription: 'Need help with wiring.',
    durationMinutes: 30,
    learnerTimeZone: 'Asia/Hebron',
    timeOptions: timeOptions,
    learnerAllowedActions: ProjectHelpSessionLearnerAllowedActions.empty,
    authorAllowedActions: authorAllowedActions,
    createdAt: DateTime.utc(2026, 2, 1),
    updatedAt: DateTime.utc(2026, 2, 1),
    meetingReady: false,
  );
}

class _AuthController extends AuthController {
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
      ],
      supportedLocales: const [Locale('en'), Locale('ar')],
      home: Scaffold(body: child),
    ),
  );
}

void main() {
  group('author routes', () {
    test('canonical creator routes', () {
      expect(creatorHelpSessionsRoute, '/creator/help-sessions');
      expect(
        creatorHelpSessionDetailRoute('abc'),
        '/creator/help-sessions/abc',
      );
      expect(
        creatorProjectHelpSessionSettingsRoute('proj'),
        '/creator/projects/proj/help-sessions/settings',
      );
    });
  });

  group('author list', () {
    testWidgets('loading then empty state', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const CreatorHelpSessionsPage(),
          overrides: [
            authorHelpSessionsProvider.overrideWith(
              (ref) async => const ProjectHelpSessionListResult(
                items: [],
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 1,
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('No help session requests yet'), findsOneWidget);
    });

    testWidgets('PENDING card renders', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const CreatorHelpSessionsPage(),
          overrides: [
            authorHelpSessionsProvider.overrideWith(
              (ref) async => ProjectHelpSessionListResult(
                items: [
                  _authorSession(
                    timeOptions: [
                      ProjectHelpSessionTimeOption(
                        id: 'opt-1',
                        type: ProjectHelpSessionTimeOptionType.learnerProposed,
                        startsAt: DateTime.utc(2026, 3, 1, 8),
                        proposedBy: const ProjectHelpSessionUserSummary(
                          id: 'learner-1',
                          displayName: 'Learner One',
                        ),
                      ),
                    ],
                  ),
                ],
                page: 1,
                limit: 20,
                total: 1,
                totalPages: 1,
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Learner One'), findsOneWidget);
      expect(find.text('Pending'), findsOneWidget);
    });
  });

  group('author detail', () {
    testWidgets('selecting time enables accept', (tester) async {
      final options = [
        ProjectHelpSessionTimeOption(
          id: 'opt-1',
          type: ProjectHelpSessionTimeOptionType.learnerProposed,
          startsAt: DateTime.utc(2026, 3, 1, 8),
          proposedBy: const ProjectHelpSessionUserSummary(
            id: 'learner-1',
            displayName: 'Learner One',
          ),
        ),
      ];
      await tester.pumpWidget(
        _wrap(
          const CreatorHelpSessionDetailPage(sessionId: 'session-author-1'),
          overrides: [
            authorHelpSessionDetailProvider('session-author-1').overrideWith(
              (ref) async => _authorSession(
                timeOptions: options,
                authorAllowedActions: const ProjectHelpSessionAuthorAllowedActions(
                  canAcceptOption: true,
                  canProposeAlternative: true,
                  canDecline: true,
                  canCancel: false,
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
      await tester.pump();
      final acceptButton = find.widgetWithText(
        FilledButton,
        ProjectHelpSessionsL10n.acceptSelectedTime.en,
      );
      expect(tester.widget<FilledButton>(acceptButton).onPressed, isNotNull);
    });

    testWidgets('SCHEDULING_FAILED shows retry', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const CreatorHelpSessionDetailPage(sessionId: 'session-author-1'),
          overrides: [
            authorHelpSessionDetailProvider('session-author-1').overrideWith(
              (ref) async => _authorSession(
                status: ProjectHelpSessionStatus.schedulingFailed,
                authorAllowedActions: const ProjectHelpSessionAuthorAllowedActions(
                  canAcceptOption: false,
                  canProposeAlternative: false,
                  canDecline: false,
                  canCancel: true,
                  canJoin: false,
                  canRetryZoom: true,
                  canComplete: false,
                ),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.text(ProjectHelpSessionsL10n.zoomRetryAction.en),
        findsWidgets,
      );
    });

    testWidgets('SCHEDULED shows disabled Join when canJoin is false', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const CreatorHelpSessionDetailPage(sessionId: 'session-author-1'),
          overrides: [
            authorHelpSessionDetailProvider('session-author-1').overrideWith(
              (ref) async => _authorSession(
                status: ProjectHelpSessionStatus.scheduled,
                authorAllowedActions: const ProjectHelpSessionAuthorAllowedActions(
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
      final joinButton = find.widgetWithText(
        FilledButton,
        ProjectHelpSessionsL10n.joinZoom.en,
      );
      expect(tester.widget<FilledButton>(joinButton).onPressed, isNull);
      expect(
        find.text(ProjectHelpSessionsL10n.joinOpensLater.en),
        findsWidgets,
      );
    });

    testWidgets('detail hides learner email', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const CreatorHelpSessionDetailPage(sessionId: 'session-author-1'),
          overrides: [
            authorHelpSessionDetailProvider('session-author-1').overrideWith(
              (ref) async => _authorSession(),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(find.textContaining('@'), findsNothing);
      expect(find.textContaining('zoom.us'), findsNothing);
    });
  });

  group('settings', () {
    testWidgets('disabled default shown', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const CreatorProjectHelpSessionSettingsPage(projectId: 'project-1'),
          overrides: [
            projectHelpSessionSettingsProvider('project-1').overrideWith(
              (ref) async => const ProjectHelpSessionSettings(
                projectId: 'project-1',
                isEnabled: false,
                allow15Minutes: true,
                allow30Minutes: true,
                weeklyLimit: 3,
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      final toggle = tester.widget<SwitchListTile>(find.byType(SwitchListTile));
      expect(toggle.value, isFalse);
    });
  });

  group('notifications', () {
    test('requested notification routes to author detail', () {
      final route = projectHelpSessionNotificationRoute(
        AppNotification(
          id: 'n1',
          notificationType: 'PROJECT_HELP_SESSION_REQUESTED',
          title: 'New request',
          body: 'Body',
          isRead: false,
          createdAt: DateTime.utc(2026, 1, 1),
          relatedEntityType: 'PROJECT_HELP_SESSION',
          relatedEntityId: 'session-1',
          metadata: const {'sessionId': 'session-1'},
        ),
      );
      expect(route, creatorHelpSessionDetailRoute('session-1'));
    });

    test('learner accepted notification routes to learner detail', () {
      final route = projectHelpSessionNotificationRoute(
        AppNotification(
          id: 'n2',
          notificationType: 'PROJECT_HELP_SESSION_ACCEPTED',
          title: 'Accepted',
          body: 'Body',
          isRead: false,
          createdAt: DateTime.utc(2026, 1, 1),
          relatedEntityType: 'PROJECT_HELP_SESSION',
          relatedEntityId: 'session-1',
          metadata: const {
            'sessionId': 'session-1',
            'recipientRole': 'LEARNER',
          },
        ),
      );
      expect(route, learnerHelpSessionDetailRoute('session-1'));
    });

    test('zoom failure notification routes to author detail', () {
      final route = projectHelpSessionNotificationRoute(
        AppNotification(
          id: 'n3',
          notificationType: 'PROJECT_HELP_SESSION_ZOOM_SCHEDULING_FAILED',
          title: 'Failed',
          body: 'Body',
          isRead: false,
          createdAt: DateTime.utc(2026, 1, 1),
          relatedEntityType: 'PROJECT_HELP_SESSION',
          relatedEntityId: 'session-1',
          metadata: const {'sessionId': 'session-1'},
        ),
      );
      expect(route, creatorHelpSessionDetailRoute('session-1'));
    });
  });
}
