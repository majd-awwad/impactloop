import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/app/router/navigation_extensions.dart';
import 'package:frontend/app/theme/app_theme.dart';
import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/notifications/application/notification_display.dart';
import 'package:frontend/features/notifications/application/notifications_provider.dart';
import 'package:frontend/features/notifications/data/models/app_notification.dart';
import 'package:frontend/features/notifications/data/notifications_api.dart';
import 'package:frontend/features/notifications/presentation/pages/user_notifications_page.dart';
import 'package:frontend/features/project_help_sessions/application/project_help_sessions_providers.dart';
import 'package:frontend/features/project_help_sessions/data/models/project_help_session_models.dart';
import 'package:frontend/features/project_help_sessions/data/project_help_sessions_api.dart';
import 'package:frontend/features/project_help_sessions/presentation/pages/learner_help_session_detail_page.dart';
import 'package:frontend/features/project_help_sessions/presentation/widgets/help_session_boundary_refresh.dart';
import 'package:frontend/l10n/app_localizations.dart';

ProjectHelpSession _session({
  ProjectHelpSessionStatus status = ProjectHelpSessionStatus.pending,
  ProjectHelpSessionLearnerAllowedActions learnerAllowedActions =
      const ProjectHelpSessionLearnerAllowedActions(
    canAcceptAlternative: false,
    canRejectAlternative: false,
    canCancel: true,
    canJoin: false,
  ),
}) {
  return ProjectHelpSession(
    id: 'session-1',
    status: status,
    project: const ProjectHelpSessionProjectSummary(
      id: 'project-1',
      title: 'Electronic LED Dice',
    ),
    build: const ProjectHelpSessionBuildSummary(id: 'build-1', attemptNumber: 1),
    learner: const ProjectHelpSessionUserSummary(
      id: 'learner-1',
      displayName: 'Israa Learner',
    ),
    author: const ProjectHelpSessionUserSummary(
      id: 'author-1',
      displayName: 'Majd Learner',
    ),
    problemDescription: 'Need help with wiring.',
    durationMinutes: 30,
    learnerTimeZone: 'Asia/Hebron',
    timeOptions: const [],
    learnerAllowedActions: learnerAllowedActions,
    authorAllowedActions: ProjectHelpSessionAuthorAllowedActions.empty,
    createdAt: DateTime.utc(2026),
    updatedAt: DateTime.utc(2026),
    meetingReady: false,
  );
}

class _LearnerAuth extends AuthController {
  @override
  AuthState build() => AuthState(
        user: User(
          id: 'learner-1',
          email: 'israa@learner.com',
          displayName: 'Israa Learner',
          accountStatus: 'ACTIVE',
          activeRole: 'LEARNER',
          roles: const ['LEARNER'],
          createdAt: DateTime.utc(2026),
        ),
        accessToken: 'token',
        hasBootstrapped: true,
      );
}

class _FakeCancelActionController extends ProjectHelpSessionActionController {
  _FakeCancelActionController({required this.onCancel});

  final Future<ProjectHelpSession?> Function({
    required String sessionId,
    String? reason,
  }) onCancel;

  @override
  Future<ProjectHelpSession?> cancelSession({
    required String sessionId,
    String? reason,
  }) {
    return onCancel(sessionId: sessionId, reason: reason);
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('PHS-10 cancellation API', () {
    test('cancelSession omits empty reason from request body', () async {
      Map<String, dynamic>? capturedBody;
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            capturedBody = options.data as Map<String, dynamic>?;
            handler.resolve(
              Response<Map<String, dynamic>>(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'success': true,
                  'message': 'ok',
                  'data': {
                    'id': 'session-1',
                    'status': 'CANCELLED',
                    'project': {'id': 'p', 'title': 'T'},
                    'build': {'id': 'b', 'attemptNumber': 1},
                    'learner': {'id': 'l', 'displayName': 'L'},
                    'author': {'id': 'a', 'displayName': 'A'},
                    'problemDescription': 'x',
                    'durationMinutes': 30,
                    'learnerTimeZone': 'UTC',
                    'timeOptions': [],
                    'allowedActions': {
                      'canAcceptAlternative': false,
                      'canRejectAlternative': false,
                      'canCancel': false,
                      'canJoin': false,
                    },
                    'createdAt': '2026-01-01T00:00:00.000Z',
                    'updatedAt': '2026-01-01T00:00:00.000Z',
                  },
                },
              ),
            );
          },
        ),
      );
      final api = ProjectHelpSessionsApi(dio);
      await api.cancelSession(sessionId: 'session-1');
      expect(capturedBody, isEmpty);
    });
  });

  group('PHS-10 learner cancellation UI', () {
    testWidgets('PENDING shows Cancel request not Confirm cancellation', (
      tester,
    ) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith(_LearnerAuth.new),
            learnerHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(),
            ),
          ],
          child: MaterialApp(
            localizationsDelegates: const [
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: const [Locale('en')],
            home: const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Cancel request'), findsOneWidget);
      expect(find.text('Confirm cancellation'), findsNothing);
    });

    testWidgets('tap opens confirmation dialog with optional reason', (
      tester,
    ) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith(_LearnerAuth.new),
            learnerHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(),
            ),
          ],
          child: MaterialApp(
            localizationsDelegates: const [
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: const [Locale('en')],
            home: const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.binding.setSurfaceSize(const Size(1280, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.ensureVisible(find.text('Cancel request'));
      await tester.tap(find.text('Cancel request'));
      await tester.pumpAndSettle();
      expect(find.text('Cancel help session?'), findsOneWidget);
      expect(find.text('Reason (optional)'), findsOneWidget);
      expect(find.text('Confirm cancellation'), findsOneWidget);
    });

    testWidgets('successful cancellation updates detail and hides action', (
      tester,
    ) async {
      var status = ProjectHelpSessionStatus.pending;
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith(_LearnerAuth.new),
            learnerHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(
                status: status,
                learnerAllowedActions: status == ProjectHelpSessionStatus.pending
                    ? const ProjectHelpSessionLearnerAllowedActions(
                        canAcceptAlternative: false,
                        canRejectAlternative: false,
                        canCancel: true,
                        canJoin: false,
                      )
                    : ProjectHelpSessionLearnerAllowedActions.empty,
              ),
            ),
            projectHelpSessionActionControllerProvider.overrideWith(
              () => _FakeCancelActionController(
                onCancel: ({required sessionId, reason}) async {
                  expect(sessionId, 'session-1');
                  expect(reason, isNull);
                  status = ProjectHelpSessionStatus.cancelled;
                  return _session(
                    status: ProjectHelpSessionStatus.cancelled,
                    learnerAllowedActions:
                        ProjectHelpSessionLearnerAllowedActions.empty,
                  );
                },
              ),
            ),
          ],
          child: MaterialApp(
            localizationsDelegates: const [
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: const [Locale('en')],
            home: const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.binding.setSurfaceSize(const Size(1280, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.ensureVisible(find.text('Cancel request'));
      await tester.tap(find.text('Cancel request'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Confirm cancellation'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      await tester.pumpAndSettle();
      expect(status, ProjectHelpSessionStatus.cancelled);
      expect(find.text('Cancel request'), findsNothing);
    });

    testWidgets('failure keeps dialog open with localized stable error', (
      tester,
    ) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith(_LearnerAuth.new),
            learnerHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(),
            ),
            projectHelpSessionActionControllerProvider.overrideWith(
              () => _FakeCancelActionController(
                onCancel: ({required sessionId, reason}) async {
                  throw const ApiException(
                    message: 'invalid',
                    code: 'INVALID_SESSION_STATE',
                  );
                },
              ),
            ),
          ],
          child: MaterialApp(
            localizationsDelegates: const [
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: const [Locale('en')],
            home: const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.binding.setSurfaceSize(const Size(1280, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.ensureVisible(find.text('Cancel request'));
      await tester.tap(find.text('Cancel request'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'keep me');
      await tester.tap(find.text('Confirm cancellation'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      await tester.pumpAndSettle();
      expect(find.text('Cancel help session?'), findsOneWidget);
      expect(
        find.textContaining('cannot be cancelled'),
        findsOneWidget,
      );
      expect(find.text('keep me'), findsOneWidget);
    });

    testWidgets('terminal session hides cancel action', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith(_LearnerAuth.new),
            learnerHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(
                status: ProjectHelpSessionStatus.cancelled,
                learnerAllowedActions:
                    ProjectHelpSessionLearnerAllowedActions.empty,
              ),
            ),
          ],
          child: MaterialApp(
            localizationsDelegates: const [
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: const [Locale('en')],
            home: const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Cancel request'), findsNothing);
      expect(find.text('Confirm cancellation'), findsNothing);
    });
  });

  group('PHS-10 notification navigation', () {
    testWidgets('learner notification navigates once to learner detail', (
      tester,
    ) async {
      final router = GoRouter(
        initialLocation: '/notifications',
        routes: [
          GoRoute(
            path: '/notifications',
            builder: (context, state) => const UserNotificationsPage(),
          ),
          GoRoute(
            path: '/learner/help-sessions/:sessionId',
            builder: (context, state) => LearnerHelpSessionDetailPage(
              sessionId: state.pathParameters['sessionId']!,
            ),
          ),
        ],
      );
      var fetchCount = 0;
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith(_LearnerAuth.new),
            notificationsListProvider.overrideWith(
              () => _SingleNotificationListNotifier(
                AppNotification(
                  id: 'n-learner-1',
                  notificationType: 'PROJECT_HELP_SESSION_ACCEPTED',
                  title: 'Session accepted',
                  body: 'Your help session was accepted.',
                  relatedEntityType: 'PROJECT_HELP_SESSION',
                  relatedEntityId: 'session-1',
                  metadata: const {
                    'sessionId': 'session-1',
                    'recipientRole': 'LEARNER',
                  },
                  isRead: false,
                  createdAt: DateTime.utc(2026),
                ),
              ),
            ),
            myNotificationUnreadCountProvider.overrideWith(
              () => _FixedUnreadCountNotifier(1),
            ),
            notificationReadFilterProvider.overrideWith(
              NotificationReadFilterNotifier.new,
            ),
            notificationsApiProvider.overrideWithValue(
              _MarkReadTrackingApi(onMarkRead: () {}),
            ),
            learnerHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async {
                fetchCount += 1;
                return _session();
              },
            ),
          ],
          child: MaterialApp.router(
            theme: AppTheme.light,
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: AppLocalizations.supportedLocales,
            routerConfig: router,
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Session accepted'));
      await tester.pumpAndSettle();
      expect(router.state.uri.path, '/learner/help-sessions/session-1');
      expect(find.byType(LearnerHelpSessionDetailPage), findsOneWidget);
      expect(fetchCount, greaterThanOrEqualTo(1));
    });

    testWidgets('mark-read failure does not block learner navigation', (
      tester,
    ) async {
      final router = GoRouter(
        initialLocation: '/notifications',
        routes: [
          GoRoute(
            path: '/notifications',
            builder: (context, state) => const UserNotificationsPage(),
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
            authControllerProvider.overrideWith(_LearnerAuth.new),
            notificationsListProvider.overrideWith(
              () => _SingleNotificationListNotifier(
                AppNotification(
                  id: 'n-learner-2',
                  notificationType: 'PROJECT_HELP_SESSION_ACCEPTED',
                  title: 'Session accepted',
                  body: 'Accepted.',
                  relatedEntityType: 'PROJECT_HELP_SESSION',
                  relatedEntityId: 'session-1',
                  metadata: const {
                    'sessionId': 'session-1',
                    'recipientRole': 'LEARNER',
                  },
                  isRead: false,
                  createdAt: DateTime.utc(2026),
                ),
              ),
            ),
            myNotificationUnreadCountProvider.overrideWith(
              () => _FixedUnreadCountNotifier(1),
            ),
            notificationReadFilterProvider.overrideWith(
              NotificationReadFilterNotifier.new,
            ),
            notificationsApiProvider.overrideWithValue(
              _MarkReadTrackingApi(
                onMarkRead: () => throw Exception('mark-read failed'),
              ),
            ),
            learnerHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(),
            ),
          ],
          child: MaterialApp.router(
            theme: AppTheme.light,
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: AppLocalizations.supportedLocales,
            routerConfig: router,
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Session accepted'));
      await tester.pumpAndSettle();
      expect(router.state.uri.path, '/learner/help-sessions/session-1');
    });

    test('missing sessionId falls back to learner list route', () {
      final notification = AppNotification(
        id: 'n-missing',
        notificationType: 'PROJECT_HELP_SESSION_ACCEPTED',
        title: 'Title',
        body: 'Body',
        relatedEntityType: 'PROJECT_HELP_SESSION',
        relatedEntityId: null,
        metadata: const {'recipientRole': 'LEARNER'},
        isRead: false,
        createdAt: DateTime.utc(2026),
      );
      expect(
        projectHelpSessionNotificationRoute(notification),
        learnerHelpSessionsRoute,
      );
    });
  });

  group('PHS-10 boundary refresh', () {
    testWidgets('past boundary schedules one catch-up refresh', (tester) async {
      var boundaryCalls = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: HelpSessionBoundaryRefresh(
            boundaryAt: DateTime.now().subtract(const Duration(minutes: 5)),
            isBoundaryReached: false,
            onBoundary: () => boundaryCalls += 1,
            child: const Text('child'),
          ),
        ),
      );
      await tester.pump();
      expect(boundaryCalls, 0);
      await tester.pump(const Duration(milliseconds: 600));
      expect(boundaryCalls, 1);
      await tester.pump(const Duration(seconds: 1));
      expect(boundaryCalls, 1);
    });
  });
}

class _FixedUnreadCountNotifier extends NotificationUnreadCountNotifier {
  _FixedUnreadCountNotifier(this.count);

  final int count;

  @override
  Future<int> build() async => count;
}

class _SingleNotificationListNotifier extends NotificationsListNotifier {
  _SingleNotificationListNotifier(this.notification);

  final AppNotification notification;

  @override
  Future<NotificationsListState> build() async {
    return NotificationsListState(
      items: [notification],
      page: 1,
      totalPages: 1,
      total: 1,
      unreadCount: notification.isRead ? 0 : 1,
      isLoadingMore: false,
      filter: NotificationReadFilter.all,
    );
  }

  @override
  Future<void> markReadLocal(String notificationId) async {
    await ref.read(notificationsApiProvider).markRead(notificationId);
    applyReadLocal(notificationId);
  }
}

class _MarkReadTrackingApi extends NotificationsApi {
  _MarkReadTrackingApi({required this.onMarkRead}) : super(Dio());

  final VoidCallback onMarkRead;

  @override
  Future<AppNotification> markRead(String notificationId) async {
    onMarkRead();
    return AppNotification(
      id: notificationId,
      notificationType: 'PROJECT_HELP_SESSION_ACCEPTED',
      title: 'Title',
      body: 'Body',
      isRead: true,
      createdAt: DateTime.utc(2026),
    );
  }
}
