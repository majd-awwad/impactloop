import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/app/router/navigation_extensions.dart';
import 'package:frontend/app/theme/app_theme.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/learning_hub/application/learning_hub_providers.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_project_submission.dart';
import 'package:frontend/features/learning_hub/presentation/pages/learning_project_submissions_page.dart';
import 'package:frontend/features/notifications/application/notification_display.dart';
import 'package:frontend/features/notifications/application/notifications_provider.dart';
import 'package:frontend/features/notifications/data/models/app_notification.dart';
import 'package:frontend/features/notifications/data/notifications_api.dart';
import 'package:frontend/features/notifications/presentation/pages/user_notifications_page.dart';
import 'package:frontend/features/profile/presentation/widgets/learner_profile_dashboard_widgets.dart';
import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/core/errors/common_api_error_codes.dart';
import 'package:frontend/features/project_help_sessions/application/help_session_mutation_feedback.dart';
import 'package:frontend/features/project_help_sessions/application/project_help_sessions_providers.dart';
import 'package:frontend/features/project_help_sessions/data/models/project_help_session_models.dart';
import 'package:frontend/features/project_help_sessions/data/project_help_sessions_api.dart';
import 'package:frontend/features/project_help_sessions/presentation/l10n/project_help_sessions_l10n.dart';
import 'package:frontend/features/project_help_sessions/presentation/pages/creator_help_session_detail_page.dart';
import 'package:frontend/features/project_help_sessions/presentation/pages/creator_help_sessions_page.dart';
import 'package:frontend/features/project_help_sessions/presentation/widgets/author_help_session_list_card.dart';
import 'package:frontend/features/project_help_sessions/presentation/widgets/submission_help_session_settings_entry.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:frontend/l10n/app_localizations_ar.dart';
import 'package:frontend/shared/models/localized_text.dart';

LearningProjectSubmission _submission({
  String id = 'project-1',
  LearningProjectSubmissionStatus status =
      LearningProjectSubmissionStatus.published,
}) {
  return LearningProjectSubmission(
    id: id,
    title: 'LED Dice',
    shortDescription: 'Electronic LED Dice project.',
    status: status,
    category: const LocalizedText(en: 'Electronics', ar: 'إلكترونيات'),
    difficulty: 'BEGINNER',
    availableActions: const LearningProjectSubmissionActions(
      canView: true,
      canEdit: false,
      canResubmit: false,
      canViewPublic: true,
    ),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('PHS notification routing', () {
    AppNotification phsNotification({
      required String type,
      String? sessionId,
      String? relatedEntityId,
      String? recipientRole,
      String? projectTitle,
      bool isRead = false,
    }) {
      return AppNotification(
        id: 'n-$type-$sessionId',
        notificationType: type,
        title: 'Title',
        body: 'Body',
        relatedEntityType: 'PROJECT_HELP_SESSION',
        relatedEntityId: relatedEntityId ?? sessionId,
        metadata: {
          if (sessionId != null) 'sessionId': sessionId,
          if (recipientRole != null) 'recipientRole': recipientRole,
          if (projectTitle != null) 'projectTitle': projectTitle,
        },
        isRead: isRead,
        createdAt: DateTime.utc(2026),
      );
    }

    test('author requested notification resolves to creator detail', () {
      final notification = phsNotification(
        type: 'PROJECT_HELP_SESSION_REQUESTED',
        sessionId: 'session-1',
        recipientRole: 'AUTHOR',
      );
      expect(
        projectHelpSessionNotificationRoute(notification),
        creatorHelpSessionDetailRoute('session-1'),
      );
    });

    test('missing author session deep-link resolves to creator list', () async {
      final resolved = await resolveHelpSessionNotificationOpenRoute(
        api: _MissingAuthorSessionApi(),
        route: creatorHelpSessionDetailRoute('missing-session'),
      );
      expect(resolved.route, creatorHelpSessionsRoute);
      expect(resolved.targetMissing, isTrue);
    });

    test('living author session deep-link keeps creator detail', () async {
      final resolved = await resolveHelpSessionNotificationOpenRoute(
        api: _LivingAuthorSessionApi(),
        route: creatorHelpSessionDetailRoute('session-1'),
      );
      expect(resolved.route, creatorHelpSessionDetailRoute('session-1'));
      expect(resolved.targetMissing, isFalse);
    });

    test('learner notification still resolves to learner detail', () {
      final notification = phsNotification(
        type: 'PROJECT_HELP_SESSION_ACCEPTED',
        sessionId: 'session-1',
        recipientRole: 'LEARNER',
      );
      expect(
        projectHelpSessionNotificationRoute(notification),
        learnerHelpSessionDetailRoute('session-1'),
      );
    });

    test('shared zoom scheduled routes by recipientRole', () {
      final author = phsNotification(
        type: 'PROJECT_HELP_SESSION_ZOOM_SCHEDULED',
        sessionId: 'session-1',
        recipientRole: 'AUTHOR',
      );
      final learner = phsNotification(
        type: 'PROJECT_HELP_SESSION_ZOOM_SCHEDULED',
        sessionId: 'session-1',
        recipientRole: 'LEARNER',
      );
      expect(
        projectHelpSessionNotificationRoute(author),
        creatorHelpSessionDetailRoute('session-1'),
      );
      expect(
        projectHelpSessionNotificationRoute(learner),
        learnerHelpSessionDetailRoute('session-1'),
      );
    });

    test('shared cancelled routes by recipientRole', () {
      final author = phsNotification(
        type: 'PROJECT_HELP_SESSION_CANCELLED',
        sessionId: 'session-1',
        recipientRole: 'AUTHOR',
      );
      final learner = phsNotification(
        type: 'PROJECT_HELP_SESSION_CANCELLED',
        sessionId: 'session-1',
        recipientRole: 'LEARNER',
      );
      expect(
        projectHelpSessionNotificationRoute(author),
        creatorHelpSessionDetailRoute('session-1'),
      );
      expect(
        projectHelpSessionNotificationRoute(learner),
        learnerHelpSessionDetailRoute('session-1'),
      );
    });

    test('metadata.sessionId takes precedence over relatedEntityId', () {
      final notification = AppNotification(
        id: 'n-priority',
        notificationType: 'PROJECT_HELP_SESSION_REQUESTED',
        title: 'Title',
        body: 'Body',
        relatedEntityType: 'PROJECT_HELP_SESSION',
        relatedEntityId: 'related-session',
        metadata: const {
          'sessionId': 'metadata-session',
          'recipientRole': 'AUTHOR',
        },
        isRead: false,
        createdAt: DateTime.utc(2026),
      );
      expect(
        projectHelpSessionNotificationRoute(notification),
        creatorHelpSessionDetailRoute('metadata-session'),
      );
    });

    test('missing sessionId falls back safely to author list', () {
      final notification = phsNotification(
        type: 'PROJECT_HELP_SESSION_REQUESTED',
        recipientRole: 'AUTHOR',
      );
      expect(
        projectHelpSessionNotificationRoute(notification),
        creatorHelpSessionsRoute,
      );
    });

    test('notification displays project title when metadata contains it', () {
      final notification = phsNotification(
        type: 'PROJECT_HELP_SESSION_REQUESTED',
        sessionId: 'session-1',
        recipientRole: 'AUTHOR',
        projectTitle: 'Electronic LED Dice',
      );
      final ar = AppLocalizationsAr();
      final copy = localizedNotificationCopy(notification, ar);
      expect(copy.body, contains('Electronic LED Dice'));
      expect(copy.body, isNot(contains('مشروع تعليمي')));
    });
  });

  group('PHS notification navigation UI', () {
    late GoRouter router;
    var markReadCalls = 0;
    var shouldFailMarkRead = false;

    AppNotification authorNotification({bool isRead = false}) {
      return AppNotification(
        id: 'phs-author-1',
        notificationType: 'PROJECT_HELP_SESSION_REQUESTED',
        title: 'New help session request',
        body: 'Israa Learner requested a help session for Electronic LED Dice.',
        relatedEntityType: 'PROJECT_HELP_SESSION',
        relatedEntityId: 'session-author-1',
        metadata: const {
          'sessionId': 'session-author-1',
          'recipientRole': 'AUTHOR',
          'projectTitle': 'Electronic LED Dice',
        },
        isRead: isRead,
        createdAt: DateTime.utc(2026),
      );
    }

    Future<void> pumpNotifications(WidgetTester tester) async {
      router = GoRouter(
        initialLocation: '/notifications',
        routes: [
          GoRoute(
            path: '/notifications',
            builder: (context, state) => const UserNotificationsPage(),
          ),
          GoRoute(
            path: '/creator/help-sessions',
            builder: (context, state) => const CreatorHelpSessionsPage(),
          ),
          GoRoute(
            path: '/creator/help-sessions/:sessionId',
            builder: (context, state) => CreatorHelpSessionDetailPage(
              sessionId: state.pathParameters['sessionId']!,
            ),
          ),
        ],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith(_AuthorAuth.new),
            notificationsListProvider.overrideWith(
              () => _SingleNotificationListNotifier(authorNotification()),
            ),
            myNotificationUnreadCountProvider.overrideWith(
              () => _FixedUnreadCountNotifier(1),
            ),
            notificationReadFilterProvider.overrideWith(
              NotificationReadFilterNotifier.new,
            ),
            notificationsApiProvider.overrideWithValue(
              _MarkReadTrackingApi(
                onMarkRead: () {
                  markReadCalls += 1;
                  if (shouldFailMarkRead) {
                    throw Exception('mark-read failed');
                  }
                },
              ),
            ),
            projectHelpSessionsApiProvider.overrideWithValue(
              _LivingAuthorSessionApi(),
            ),
            authorHelpSessionDetailProvider('session-author-1').overrideWith(
              (ref) async => _LivingAuthorSessionApi().fetchAuthorSession(
                'session-author-1',
              ),
            ),
          ],
          child: MaterialApp.router(
            theme: AppTheme.light,
            locale: const Locale('en'),
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
    }

    setUp(() {
      markReadCalls = 0;
      shouldFailMarkRead = false;
    });

    testWidgets('clicking notification card navigates to creator detail', (
      tester,
    ) async {
      await pumpNotifications(tester);
      await tester.tap(find.text('New help session request'));
      await tester.pumpAndSettle();
      expect(router.state.uri.path, '/creator/help-sessions/session-author-1');
      expect(find.byType(CreatorHelpSessionDetailPage), findsOneWidget);
    });

    testWidgets('clicking Open navigates to creator detail', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await pumpNotifications(tester);
      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();
      expect(router.state.uri.path, '/creator/help-sessions/session-author-1');
    });

    testWidgets('mark-read failure does not block navigation', (tester) async {
      shouldFailMarkRead = true;
      await pumpNotifications(tester);
      await tester.tap(find.text('New help session request'));
      await tester.pumpAndSettle();
      expect(router.state.uri.path, '/creator/help-sessions/session-author-1');
      expect(markReadCalls, 1);
    });

    testWidgets('no duplicate navigation occurs', (tester) async {
      await pumpNotifications(tester);
      await tester.tap(find.text('New help session request'));
      await tester.tap(find.text('New help session request'));
      await tester.pumpAndSettle();
      expect(router.state.uri.path, '/creator/help-sessions/session-author-1');
    });

    testWidgets('already-read notification still navigates', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith(_AuthorAuth.new),
            notificationsListProvider.overrideWith(
              () => _SingleNotificationListNotifier(
                authorNotification(isRead: true),
              ),
            ),
            myNotificationUnreadCountProvider.overrideWith(
              () => _FixedUnreadCountNotifier(0),
            ),
            notificationReadFilterProvider.overrideWith(
              NotificationReadFilterNotifier.new,
            ),
            notificationsApiProvider.overrideWithValue(
              _MarkReadTrackingApi(onMarkRead: () {}),
            ),
            projectHelpSessionsApiProvider.overrideWithValue(
              _LivingAuthorSessionApi(),
            ),
            authorHelpSessionDetailProvider('session-author-1').overrideWith(
              (ref) async => _LivingAuthorSessionApi().fetchAuthorSession(
                'session-author-1',
              ),
            ),
          ],
          child: MaterialApp.router(
            theme: AppTheme.light,
            locale: const Locale('en'),
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: AppLocalizations.supportedLocales,
            routerConfig: GoRouter(
              initialLocation: '/notifications',
              routes: [
                GoRoute(
                  path: '/notifications',
                  builder: (context, state) => const UserNotificationsPage(),
                ),
                GoRoute(
                  path: '/creator/help-sessions/:sessionId',
                  builder: (context, state) => CreatorHelpSessionDetailPage(
                    sessionId: state.pathParameters['sessionId']!,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('New help session request'));
      await tester.pumpAndSettle();
      expect(find.byType(CreatorHelpSessionDetailPage), findsOneWidget);
    });

    testWidgets('missing session notification opens creator list', (
      tester,
    ) async {
      late final GoRouter orphanRouter;
      orphanRouter = GoRouter(
        initialLocation: '/notifications',
        routes: [
          GoRoute(
            path: '/notifications',
            builder: (context, state) => const UserNotificationsPage(),
          ),
          GoRoute(
            path: '/creator/help-sessions',
            builder: (context, state) => const CreatorHelpSessionsPage(),
          ),
          GoRoute(
            path: '/creator/help-sessions/:sessionId',
            builder: (context, state) => CreatorHelpSessionDetailPage(
              sessionId: state.pathParameters['sessionId']!,
            ),
          ),
        ],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith(_AuthorAuth.new),
            notificationsListProvider.overrideWith(
              () => _SingleNotificationListNotifier(authorNotification()),
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
            projectHelpSessionsApiProvider.overrideWithValue(
              _MissingAuthorSessionApi(),
            ),
            authorHelpSessionsProvider.overrideWith(
              (ref) async => const ProjectHelpSessionListResult(
                items: [],
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 0,
              ),
            ),
          ],
          child: MaterialApp.router(
            theme: AppTheme.light,
            locale: const Locale('en'),
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: AppLocalizations.supportedLocales,
            routerConfig: orphanRouter,
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('New help session request'));
      await tester.pumpAndSettle();
      expect(orphanRouter.state.uri.path, '/creator/help-sessions');
      expect(find.byType(CreatorHelpSessionDetailPage), findsNothing);
      expect(find.text('The help session could not be found.'), findsOneWidget);
    });
  });

  group('PHS author entry points', () {
    testWidgets('submissions page shows Project help requests entry', (
      tester,
    ) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            myLearningProjectSubmissionsProvider(
              const LearningProjectSubmissionsQuery(page: 1, limit: 12),
            ).overrideWith(
              (ref) async => LearningProjectSubmissionsResult(
                items: [_submission()],
                page: 1,
                limit: 12,
                total: 1,
                totalPages: 1,
              ),
            ),
            hasAuthoredProjectSubmissionsProvider.overrideWith(
              (ref) async => true,
            ),
          ],
          child: const MaterialApp(
            home: Scaffold(body: LearningProjectSubmissionsPage()),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Project help requests'), findsOneWidget);
    });

    testWidgets('submission detail shows View help requests', (tester) async {
      final submission = _submission();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            projectHelpSessionSettingsProvider('project-1').overrideWith(
              (ref) async => const ProjectHelpSessionSettings(
                projectId: 'project-1',
                isEnabled: true,
                allow15Minutes: true,
                allow30Minutes: true,
                weeklyLimit: 3,
              ),
            ),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: SubmissionHelpSessionSettingsEntry(submission: submission),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('View help requests'), findsOneWidget);
    });

    testWidgets(
      'profile author quick action is visible with authored project',
      (tester) async {
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              authorHelpSessionsEntryVisibleProvider.overrideWith(
                (ref) async => true,
              ),
            ],
            child: MaterialApp(
              home: Scaffold(
                body: AuthorHelpSessionsQuickActionRow(
                  onOpen: (_, {refreshOnReturn = false}) {},
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('Project help requests'), findsOneWidget);
      },
    );

    testWidgets('user without authored projects hides author quick action', (
      tester,
    ) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authorHelpSessionsEntryVisibleProvider.overrideWith(
              (ref) async => false,
            ),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: AuthorHelpSessionsQuickActionRow(
                onOpen: (_, {refreshOnReturn = false}) {},
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Project help requests'), findsNothing);
    });
  });

  group('PHS author list', () {
    testWidgets('author list displays pending session and opens detail', (
      tester,
    ) async {
      final session = ProjectHelpSession(
        id: 'session-author-1',
        status: ProjectHelpSessionStatus.pending,
        project: const ProjectHelpSessionProjectSummary(
          id: 'project-1',
          title: 'Electronic LED Dice',
        ),
        build: const ProjectHelpSessionBuildSummary(
          id: 'build-1',
          attemptNumber: 1,
        ),
        learner: const ProjectHelpSessionUserSummary(
          id: 'learner-1',
          displayName: 'Israa Learner',
        ),
        author: const ProjectHelpSessionUserSummary(
          id: 'author-1',
          displayName: 'Majd Learner',
        ),
        problemDescription: 'Need help.',
        durationMinutes: 30,
        learnerTimeZone: 'Asia/Hebron',
        timeOptions: const [],
        learnerAllowedActions: ProjectHelpSessionLearnerAllowedActions.empty,
        authorAllowedActions: const ProjectHelpSessionAuthorAllowedActions(
          canAcceptOption: true,
          canProposeAlternative: true,
          canDecline: true,
          canCancel: true,
          canJoin: false,
          canRetryZoom: false,
          canComplete: false,
        ),
        createdAt: DateTime.utc(2026),
        updatedAt: DateTime.utc(2026),
        meetingReady: false,
      );

      final router = GoRouter(
        initialLocation: '/creator/help-sessions',
        routes: [
          GoRoute(
            path: '/creator/help-sessions',
            builder: (context, state) => const CreatorHelpSessionsPage(),
          ),
          GoRoute(
            path: '/creator/help-sessions/:sessionId',
            builder: (context, state) => CreatorHelpSessionDetailPage(
              sessionId: state.pathParameters['sessionId']!,
            ),
          ),
        ],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith(_AuthorAuth.new),
            authorHelpSessionsProvider.overrideWith(
              (ref) async => ProjectHelpSessionListResult(
                items: [session],
                page: 1,
                limit: 20,
                total: 1,
                totalPages: 1,
              ),
            ),
            authorHelpSessionDetailProvider(
              'session-author-1',
            ).overrideWith((ref) async => session),
          ],
          child: MaterialApp.router(
            theme: AppTheme.light,
            routerConfig: router,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Electronic LED Dice'), findsWidgets);
      expect(find.text('Israa Learner'), findsWidgets);
      await tester.tap(find.byType(AuthorHelpSessionListCard));
      await tester.pumpAndSettle();
      expect(router.state.uri.path, '/creator/help-sessions/session-author-1');
      expect(find.byType(CreatorHelpSessionDetailPage), findsOneWidget);
    });

    testWidgets('Arabic labels render without overflow on mobile', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(360, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            myLearningProjectSubmissionsProvider(
              const LearningProjectSubmissionsQuery(page: 1, limit: 12),
            ).overrideWith(
              (ref) async => LearningProjectSubmissionsResult(
                items: [_submission()],
                page: 1,
                limit: 12,
                total: 1,
                totalPages: 1,
              ),
            ),
            hasAuthoredProjectSubmissionsProvider.overrideWith(
              (ref) async => true,
            ),
          ],
          child: MaterialApp(
            locale: const Locale('ar'),
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: AppLocalizations.supportedLocales,
            home: const Scaffold(body: LearningProjectSubmissionsPage()),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('طلبات جلسات المشاريع'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });
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
      notificationType: 'PROJECT_HELP_SESSION_REQUESTED',
      title: 'Title',
      body: 'Body',
      isRead: true,
      createdAt: DateTime.utc(2026),
    );
  }
}

class _MissingAuthorSessionApi extends ProjectHelpSessionsApi {
  _MissingAuthorSessionApi() : super(Dio());

  @override
  Future<ProjectHelpSession> fetchAuthorSession(String sessionId) {
    throw const ApiException(
      message: 'Help session not found.',
      code: CommonApiErrorCodes.notFound,
      statusCode: 404,
    );
  }
}

class _LivingAuthorSessionApi extends ProjectHelpSessionsApi {
  _LivingAuthorSessionApi() : super(Dio());

  @override
  Future<ProjectHelpSession> fetchAuthorSession(String sessionId) async {
    return ProjectHelpSession(
      id: sessionId,
      status: ProjectHelpSessionStatus.pending,
      project: const ProjectHelpSessionProjectSummary(
        id: 'project-1',
        title: 'LED Dice',
      ),
      build: const ProjectHelpSessionBuildSummary(
        id: 'build-1',
        attemptNumber: 1,
      ),
      learner: const ProjectHelpSessionUserSummary(
        id: 'learner-1',
        displayName: 'Learner',
      ),
      author: const ProjectHelpSessionUserSummary(
        id: 'author-1',
        displayName: 'Author',
      ),
      problemDescription: 'Need help with wiring.',
      durationMinutes: 15,
      learnerTimeZone: 'Asia/Hebron',
      timeOptions: const [],
      learnerAllowedActions: ProjectHelpSessionLearnerAllowedActions.empty,
      authorAllowedActions: ProjectHelpSessionAuthorAllowedActions.empty,
      createdAt: DateTime.utc(2026),
      updatedAt: DateTime.utc(2026),
      meetingReady: false,
    );
  }
}
