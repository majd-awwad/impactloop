import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/app/router/navigation_extensions.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/notifications/application/notification_display.dart';
import 'package:frontend/features/notifications/data/models/app_notification.dart';
import 'package:frontend/features/project_help_sessions/application/project_help_sessions_providers.dart';
import 'package:frontend/features/project_help_sessions/data/models/project_help_session_models.dart';
import 'package:frontend/features/project_help_sessions/presentation/pages/creator_help_session_detail_page.dart';
import 'package:frontend/features/project_help_sessions/presentation/pages/learner_help_session_detail_page.dart';
import 'package:frontend/features/project_help_sessions/presentation/widgets/build_help_session_section.dart';

List<ProjectHelpSessionTimeOption> _threeOptions() => [
  ProjectHelpSessionTimeOption(
    id: 'opt-1',
    type: ProjectHelpSessionTimeOptionType.learnerProposed,
    startsAt: DateTime.utc(2026, 3, 1, 8),
    proposedBy: const ProjectHelpSessionUserSummary(
      id: 'learner-1',
      displayName: 'Learner One',
    ),
  ),
  ProjectHelpSessionTimeOption(
    id: 'opt-2',
    type: ProjectHelpSessionTimeOptionType.learnerProposed,
    startsAt: DateTime.utc(2026, 3, 2, 8),
    proposedBy: const ProjectHelpSessionUserSummary(
      id: 'learner-1',
      displayName: 'Learner One',
    ),
  ),
  ProjectHelpSessionTimeOption(
    id: 'opt-3',
    type: ProjectHelpSessionTimeOptionType.learnerProposed,
    startsAt: DateTime.utc(2026, 3, 3, 8),
    proposedBy: const ProjectHelpSessionUserSummary(
      id: 'learner-1',
      displayName: 'Learner One',
    ),
  ),
];

ProjectHelpSession _session({
  String id = 'session-1',
  ProjectHelpSessionStatus status = ProjectHelpSessionStatus.pending,
  ProjectHelpSessionLearnerAllowedActions learnerAllowedActions =
      const ProjectHelpSessionLearnerAllowedActions(
        canAcceptAlternative: false,
        canRejectAlternative: false,
        canCancel: true,
        canJoin: false,
      ),
  ProjectHelpSessionAuthorAllowedActions authorAllowedActions =
      ProjectHelpSessionAuthorAllowedActions.empty,
  List<ProjectHelpSessionTimeOption> timeOptions = const [],
  DateTime? selectedStartsAt,
  DateTime? joinAvailableAt,
  DateTime? joinClosesAt,
  DateTime? noShowReportedAt,
  DateTime? completionAvailableAt,
  DateTime? scheduledEndsAt,
  DateTime? autoFinalizeAt,
  bool autoFinalizationBlocked = false,
  DateTime? completedAt,
  DateTime? cancelledAt,
  ProjectHelpSessionCancelledByRole? cancelledByRole,
  String? cancellationReason,
  String? declinedReason,
  String problemDescription =
      'I cannot finish wiring the panel safely with verylongunbrokentextthatshouldwrapwithoutoverflow.',
}) {
  return ProjectHelpSession(
    id: id,
    status: status,
    project: const ProjectHelpSessionProjectSummary(
      id: 'project-1',
      title: 'Electronic LED Dice with a very long project title for layout',
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
    problemDescription: problemDescription,
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
    joinClosesAt: joinClosesAt,
    noShowReportedAt: noShowReportedAt,
    completionAvailableAt: completionAvailableAt,
    scheduledEndsAt: scheduledEndsAt,
    autoFinalizeAt: autoFinalizeAt,
    autoFinalizationBlocked: autoFinalizationBlocked,
    completedAt: completedAt,
    cancelledAt: cancelledAt,
    cancelledByRole: cancelledByRole,
    cancellationReason: cancellationReason,
    declinedReason: declinedReason,
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

class _AuthorAuth extends AuthController {
  @override
  AuthState build() => AuthState(
    user: User(
      id: 'author-1',
      email: 'author@test.com',
      displayName: 'Majd Learner',
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
  List overrides = const [],
  Locale locale = const Locale('en'),
  Size size = const Size(1280, 900),
}) {
  return ProviderScope(
    overrides: [
      authControllerProvider.overrideWith(_LearnerAuth.new),
      ...overrides,
    ],
    child: MaterialApp(
      locale: locale,
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('en'), Locale('ar')],
      home: MediaQuery(
        data: MediaQueryData(size: size),
        child: Scaffold(body: child),
      ),
    ),
  );
}

Widget _authorWrap(Widget child, {List overrides = const []}) {
  return ProviderScope(
    overrides: [
      authControllerProvider.overrideWith(_AuthorAuth.new),
      ...overrides,
    ],
    child: MaterialApp(
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ],
      supportedLocales: const [Locale('en'), Locale('ar')],
      home: MediaQuery(
        data: const MediaQueryData(size: Size(1280, 900)),
        child: Scaffold(body: child),
      ),
    ),
  );
}

ProjectBuild _testBuild() {
  return ProjectBuild(
    id: 'build-1',
    projectId: 'project-1',
    status: ProjectBuildStatus.inProgress,
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
      steps: [],
    ),
    items: const [],
    attemptNumber: 1,
    startedAt: DateTime.utc(2026, 1, 1),
    updatedAt: DateTime.utc(2026, 1, 2),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('PHS-11 shared structure', () {
    testWidgets('compact header back navigation metadata', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
          overrides: [
            learnerHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(timeOptions: _threeOptions()),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Back'), findsOneWidget);
      expect(find.text('Back to project'), findsOneWidget);
      expect(find.text('Attempt #1'), findsOneWidget);
      expect(find.text('30 min'), findsOneWidget);
      expect(find.textContaining('Asia/Hebron'), findsWidgets);
    });

    testWidgets('long text wraps without overflow', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
          overrides: [
            learnerHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(timeOptions: _threeOptions()),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.textContaining('verylongunbrokentext'), findsOneWidget);
    });

    testWidgets('mobile stacks at 390px', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
          size: const Size(390, 844),
          overrides: [
            learnerHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(
                status: ProjectHelpSessionStatus.scheduled,
                selectedStartsAt: DateTime.utc(2026, 6, 1, 12),
                learnerAllowedActions:
                    const ProjectHelpSessionLearnerAllowedActions(
                      canCancel: true,
                      canJoin: false,
                      canAcceptAlternative: false,
                      canRejectAlternative: false,
                    ),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Next step'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('Arabic RTL renders', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
          locale: const Locale('ar'),
          overrides: [
            learnerHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(timeOptions: _threeOptions()),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('رجوع'), findsOneWidget);
      expect(find.text('المشكلة'), findsOneWidget);
    });
  });

  group('PHS-11 learner states', () {
    testWidgets('PENDING shows waiting overview and cancel', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
          overrides: [
            learnerHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(timeOptions: _threeOptions()),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.textContaining('Waiting for the project creator'),
        findsWidgets,
      );
      expect(find.text('Cancel request'), findsOneWidget);
      expect(find.text('Join Zoom'), findsNothing);
    });

    testWidgets('ALTERNATIVE_PROPOSED accept and reject', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
          overrides: [
            learnerHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(
                status: ProjectHelpSessionStatus.alternativeProposed,
                timeOptions: [
                  ..._threeOptions(),
                  ProjectHelpSessionTimeOption(
                    id: 'alt-1',
                    type: ProjectHelpSessionTimeOptionType.authorAlternative,
                    startsAt: DateTime.utc(2026, 3, 5, 8),
                    proposedBy: const ProjectHelpSessionUserSummary(
                      id: 'author-1',
                      displayName: 'Majd Learner',
                    ),
                  ),
                ],
                learnerAllowedActions:
                    const ProjectHelpSessionLearnerAllowedActions(
                      canAcceptAlternative: true,
                      canRejectAlternative: true,
                      canCancel: true,
                      canJoin: false,
                    ),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.text('The project creator suggested a different time.'),
        findsWidgets,
      );
      expect(find.text('Confirm time'), findsOneWidget);
      expect(find.text('Reject time'), findsOneWidget);
    });

    testWidgets('ZOOM_PENDING no join', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
          overrides: [
            learnerHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(
                status: ProjectHelpSessionStatus.zoomPending,
                selectedStartsAt: DateTime.utc(2026, 6, 1, 12),
                learnerAllowedActions:
                    const ProjectHelpSessionLearnerAllowedActions(
                      canCancel: true,
                      canJoin: false,
                      canAcceptAlternative: false,
                      canRejectAlternative: false,
                    ),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Meeting is being prepared.'), findsWidgets);
      expect(find.text('Join Zoom'), findsNothing);
      expect(find.text('Retry'), findsNothing);
    });

    testWidgets('SCHEDULING_FAILED no retry', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
          overrides: [
            learnerHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(
                status: ProjectHelpSessionStatus.schedulingFailed,
                selectedStartsAt: DateTime.utc(2026, 6, 1, 12),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Retry creating meeting'), findsNothing);
    });

    testWidgets('SCHEDULED before window disabled join', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
          overrides: [
            learnerHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(
                status: ProjectHelpSessionStatus.scheduled,
                selectedStartsAt: DateTime.utc(2026, 6, 1, 12),
                joinAvailableAt: DateTime.utc(2026, 6, 1, 11, 45),
                learnerAllowedActions:
                    const ProjectHelpSessionLearnerAllowedActions(
                      canJoin: false,
                      canCancel: true,
                      canAcceptAlternative: false,
                      canRejectAlternative: false,
                    ),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.text('Join opens closer to the session start time.'),
        findsWidgets,
      );
    });

    testWidgets('SCHEDULED inside window join', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
          overrides: [
            learnerHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(
                status: ProjectHelpSessionStatus.scheduled,
                selectedStartsAt: DateTime.utc(2026, 6, 1, 12),
                learnerAllowedActions:
                    const ProjectHelpSessionLearnerAllowedActions(
                      canJoin: true,
                      canCancel: true,
                      canAcceptAlternative: false,
                      canRejectAlternative: false,
                    ),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(find.widgetWithText(FilledButton, 'Join Zoom'), findsOneWidget);
    });

    testWidgets('SCHEDULED active window hides cancel and shows no-show hint', (
      tester,
    ) async {
      final now = DateTime.now().toUtc();
      await tester.pumpWidget(
        _wrap(
          const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
          overrides: [
            learnerHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(
                status: ProjectHelpSessionStatus.scheduled,
                joinAvailableAt: now.subtract(const Duration(minutes: 1)),
                joinClosesAt: now.add(const Duration(minutes: 30)),
                learnerAllowedActions:
                    const ProjectHelpSessionLearnerAllowedActions(
                      canJoin: true,
                      canCancel: false,
                      canAcceptAlternative: false,
                      canRejectAlternative: false,
                    ),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(find.widgetWithText(FilledButton, 'Join Zoom'), findsOneWidget);
      expect(find.text('Cancel request'), findsNothing);
      expect(
        find.textContaining('reporting will become available'),
        findsOneWidget,
      );
    });

    testWidgets('SCHEDULED after window shows author no-show action only', (
      tester,
    ) async {
      final now = DateTime.now().toUtc();
      await tester.pumpWidget(
        _wrap(
          const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
          overrides: [
            learnerHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(
                status: ProjectHelpSessionStatus.scheduled,
                joinAvailableAt: now.subtract(const Duration(hours: 2)),
                joinClosesAt: now.subtract(const Duration(minutes: 1)),
                scheduledEndsAt: now.subtract(const Duration(hours: 1)),
                autoFinalizeAt: now.add(const Duration(hours: 23)),
                learnerAllowedActions:
                    const ProjectHelpSessionLearnerAllowedActions(
                      canJoin: false,
                      canCancel: false,
                      canReportNoShow: true,
                      canAcceptAlternative: false,
                      canRejectAlternative: false,
                    ),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Join Zoom'), findsNothing);
      expect(find.text('Cancel request'), findsNothing);
      expect(
        find.text('Report that the project creator did not attend'),
        findsOneWidget,
      );
      expect(
        find.text(
          'If you take no action, the session will close automatically after 24 hours.',
        ),
        findsOneWidget,
      );
    });

    testWidgets('DECLINED terminal', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
          overrides: [
            learnerHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(
                status: ProjectHelpSessionStatus.declined,
                declinedReason: 'Not available this week',
                learnerAllowedActions:
                    ProjectHelpSessionLearnerAllowedActions.empty,
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Not available this week'), findsOneWidget);
      expect(find.text('Cancel request'), findsNothing);
    });

    testWidgets('CANCELLED terminal', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
          overrides: [
            learnerHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(
                status: ProjectHelpSessionStatus.cancelled,
                cancelledByRole: ProjectHelpSessionCancelledByRole.learner,
                cancelledAt: DateTime.utc(2026, 2, 2),
                cancellationReason: 'Changed plans',
                learnerAllowedActions:
                    ProjectHelpSessionLearnerAllowedActions.empty,
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Cancelled by you'), findsOneWidget);
      expect(find.text('Changed plans'), findsOneWidget);
    });

    testWidgets('COMPLETED shows summary without sidebar actions', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(
          const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
          overrides: [
            learnerHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(
                status: ProjectHelpSessionStatus.completed,
                completedAt: DateTime.utc(2026, 6, 1, 13),
                selectedStartsAt: DateTime.utc(2026, 6, 1, 12),
                learnerAllowedActions:
                    ProjectHelpSessionLearnerAllowedActions.empty,
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Help session completed'), findsWidgets);
      expect(find.text('Join Zoom'), findsNothing);
      expect(find.text('Cancel request'), findsNothing);
      expect(find.text('Mark session as completed'), findsNothing);
      expect(
        find.text('Report that the project creator did not attend'),
        findsNothing,
      );
    });
  });

  group('PHS-11 creator states', () {
    testWidgets('PENDING selectable options accept disabled until selection', (
      tester,
    ) async {
      await tester.pumpWidget(
        _authorWrap(
          const CreatorHelpSessionDetailPage(sessionId: 'session-1'),
          overrides: [
            authorHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(
                timeOptions: _threeOptions(),
                authorAllowedActions:
                    const ProjectHelpSessionAuthorAllowedActions(
                      canAcceptOption: true,
                      canProposeAlternative: true,
                      canDecline: true,
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
      await tester.binding.setSurfaceSize(const Size(1280, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.pumpAndSettle();
      await tester.pump();
      expect(find.text('Accept selected time'), findsOneWidget);
      final accept = tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, 'Accept selected time'),
      );
      expect(accept.onPressed, isNotNull);
      expect(
        find.text('Select one of the proposed times to enable acceptance.'),
        findsNothing,
      );
    });

    testWidgets('creator receives the same normal Join action', (tester) async {
      await tester.pumpWidget(
        _authorWrap(
          const CreatorHelpSessionDetailPage(sessionId: 'session-1'),
          overrides: [
            authorHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(
                status: ProjectHelpSessionStatus.scheduled,
                selectedStartsAt: DateTime.utc(2026, 6, 1, 12),
                authorAllowedActions:
                    const ProjectHelpSessionAuthorAllowedActions(
                      canJoin: true,
                      canComplete: false,
                      canCancel: true,
                      canAcceptOption: false,
                      canProposeAlternative: false,
                      canDecline: false,
                      canRetryZoom: false,
                    ),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Join Zoom'), findsWidgets);
      expect(find.widgetWithText(FilledButton, 'Join Zoom'), findsOneWidget);
    });

    testWidgets('SCHEDULING_FAILED retry', (tester) async {
      await tester.pumpWidget(
        _authorWrap(
          const CreatorHelpSessionDetailPage(sessionId: 'session-1'),
          overrides: [
            authorHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(
                status: ProjectHelpSessionStatus.schedulingFailed,
                selectedStartsAt: DateTime.utc(2026, 6, 1, 12),
                authorAllowedActions:
                    const ProjectHelpSessionAuthorAllowedActions(
                      canRetryZoom: true,
                      canCancel: true,
                      canAcceptOption: false,
                      canProposeAlternative: false,
                      canDecline: false,
                      canJoin: false,
                      canComplete: false,
                    ),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Retry creating meeting'), findsOneWidget);
    });

    testWidgets('complete hidden before end', (tester) async {
      await tester.pumpWidget(
        _authorWrap(
          const CreatorHelpSessionDetailPage(sessionId: 'session-1'),
          overrides: [
            authorHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(
                status: ProjectHelpSessionStatus.scheduled,
                selectedStartsAt: DateTime.utc(2026, 6, 1, 12),
                completionAvailableAt: DateTime.utc(2026, 6, 1, 12, 30),
                authorAllowedActions:
                    const ProjectHelpSessionAuthorAllowedActions(
                      canJoin: false,
                      canComplete: false,
                      canCancel: true,
                      canAcceptOption: false,
                      canProposeAlternative: false,
                      canDecline: false,
                      canRetryZoom: false,
                    ),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Mark session as completed'), findsNothing);
    });

    testWidgets('complete available after end', (tester) async {
      await tester.pumpWidget(
        _authorWrap(
          const CreatorHelpSessionDetailPage(sessionId: 'session-1'),
          overrides: [
            authorHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(
                status: ProjectHelpSessionStatus.scheduled,
                selectedStartsAt: DateTime.utc(2026, 6, 1, 12),
                authorAllowedActions:
                    const ProjectHelpSessionAuthorAllowedActions(
                      canJoin: false,
                      canComplete: true,
                      canCancel: false,
                      canAcceptOption: false,
                      canProposeAlternative: false,
                      canDecline: false,
                      canRetryZoom: false,
                    ),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      final complete = tester.widget<OutlinedButton>(
        find.widgetWithText(OutlinedButton, 'Mark session as completed'),
      );
      expect(complete.onPressed, isNotNull);
    });

    testWidgets(
      'SCHEDULED author before window shows disabled Join and cancel',
      (tester) async {
        final now = DateTime.now().toUtc();
        await tester.pumpWidget(
          _authorWrap(
            const CreatorHelpSessionDetailPage(sessionId: 'session-1'),
            overrides: [
              authorHelpSessionDetailProvider('session-1').overrideWith(
                (ref) async => _session(
                  status: ProjectHelpSessionStatus.scheduled,
                  joinAvailableAt: now.add(const Duration(hours: 1)),
                  joinClosesAt: now.add(const Duration(hours: 2)),
                  authorAllowedActions:
                      const ProjectHelpSessionAuthorAllowedActions(
                        canJoin: false,
                        canComplete: false,
                        canCancel: true,
                        canAcceptOption: false,
                        canProposeAlternative: false,
                        canDecline: false,
                        canRetryZoom: false,
                      ),
                ),
              ),
            ],
          ),
        );
        await tester.pumpAndSettle();
        final join = tester.widget<FilledButton>(
          find.widgetWithText(FilledButton, 'Join Zoom'),
        );
        expect(join.onPressed, isNull);
        expect(find.text('Cancel request'), findsOneWidget);
        expect(find.text('Mark session as completed'), findsNothing);
      },
    );

    testWidgets('SCHEDULED author active window joins without cancel', (
      tester,
    ) async {
      final now = DateTime.now().toUtc();
      await tester.pumpWidget(
        _authorWrap(
          const CreatorHelpSessionDetailPage(sessionId: 'session-1'),
          overrides: [
            authorHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(
                status: ProjectHelpSessionStatus.scheduled,
                joinAvailableAt: now.subtract(const Duration(minutes: 1)),
                joinClosesAt: now.add(const Duration(minutes: 30)),
                authorAllowedActions:
                    const ProjectHelpSessionAuthorAllowedActions(
                      canJoin: true,
                      canComplete: false,
                      canCancel: false,
                      canAcceptOption: false,
                      canProposeAlternative: false,
                      canDecline: false,
                      canRetryZoom: false,
                    ),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(find.widgetWithText(FilledButton, 'Join Zoom'), findsOneWidget);
      expect(find.text('Cancel request'), findsNothing);
      expect(
        find.textContaining('reporting will become available'),
        findsOneWidget,
      );
    });

    testWidgets('SCHEDULED author after window shows complete and no-show', (
      tester,
    ) async {
      final now = DateTime.now().toUtc();
      await tester.pumpWidget(
        _authorWrap(
          const CreatorHelpSessionDetailPage(sessionId: 'session-1'),
          overrides: [
            authorHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(
                status: ProjectHelpSessionStatus.scheduled,
                joinAvailableAt: now.subtract(const Duration(hours: 2)),
                joinClosesAt: now.subtract(const Duration(minutes: 1)),
                scheduledEndsAt: now.subtract(const Duration(hours: 1)),
                autoFinalizeAt: now.add(const Duration(hours: 23)),
                authorAllowedActions:
                    const ProjectHelpSessionAuthorAllowedActions(
                      canJoin: false,
                      canComplete: true,
                      canCancel: false,
                      canReportNoShow: true,
                      canAcceptOption: false,
                      canProposeAlternative: false,
                      canDecline: false,
                      canRetryZoom: false,
                    ),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Join Zoom'), findsNothing);
      expect(find.text('Cancel request'), findsNothing);
      expect(find.text('Mark session as completed'), findsOneWidget);
      expect(
        find.text('Report that the learner did not attend'),
        findsOneWidget,
      );
      expect(
        find.text(
          'If you take no action, the session will close automatically after 24 hours.',
        ),
        findsOneWidget,
      );
    });
  });

  group('PHS-11 action matrix', () {
    testWidgets('learner never sees Start Retry Complete', (tester) async {
      for (final status in ProjectHelpSessionStatus.values) {
        await tester.pumpWidget(
          _wrap(
            const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
            overrides: [
              learnerHelpSessionDetailProvider('session-1').overrideWith(
                (ref) async => _session(
                  status: status,
                  selectedStartsAt: DateTime.utc(2026, 6, 1, 12),
                  timeOptions: _threeOptions(),
                ),
              ),
            ],
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('Join Zoom'), findsNothing);
        expect(find.text('Retry creating meeting'), findsNothing);
        expect(find.text('Mark session as completed'), findsNothing);
      }
    });

    testWidgets('allowedActions false hides join even when scheduled', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(
          const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
          overrides: [
            learnerHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(
                status: ProjectHelpSessionStatus.scheduled,
                learnerAllowedActions:
                    const ProjectHelpSessionLearnerAllowedActions(
                      canJoin: false,
                      canCancel: false,
                      canAcceptAlternative: false,
                      canRejectAlternative: false,
                    ),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(find.widgetWithText(FilledButton, 'Join Zoom'), findsOneWidget);
      final join = tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, 'Join Zoom'),
      );
      expect(join.onPressed, isNull);
    });
  });

  group('PHS-11 build card', () {
    testWidgets('active card summary desktop', (tester) async {
      await tester.pumpWidget(
        _wrap(
          BuildHelpSessionSection(buildRecord: _testBuild()),
          overrides: [
            projectHelpSessionAvailabilityProvider('project-1').overrideWith(
              (ref) async => const ProjectHelpSessionAvailability(
                available: true,
                allowedDurations: [30],
              ),
            ),
            activeHelpSessionForBuildProvider('build-1').overrideWith(
              (ref) async => _session(
                timeOptions: _threeOptions(),
                learnerAllowedActions:
                    const ProjectHelpSessionLearnerAllowedActions(
                      canCancel: true,
                      canJoin: false,
                      canAcceptAlternative: false,
                      canRejectAlternative: false,
                    ),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Help session request'), findsOneWidget);
      expect(
        find.textContaining('Waiting for the project creator'),
        findsOneWidget,
      );
      expect(find.text('3 proposed times'), findsOneWidget);
      final button = tester.widget<OutlinedButton>(
        find.widgetWithText(OutlinedButton, 'View session'),
      );
      expect(button, isNotNull);
    });

    testWidgets('build card mobile', (tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.pumpWidget(
        _wrap(
          BuildHelpSessionSection(buildRecord: _testBuild()),
          size: const Size(390, 844),
          overrides: [
            projectHelpSessionAvailabilityProvider('project-1').overrideWith(
              (ref) async => const ProjectHelpSessionAvailability(
                available: true,
                allowedDurations: [30],
              ),
            ),
            activeHelpSessionForBuildProvider('build-1').overrideWith(
              (ref) async => _session(
                status: ProjectHelpSessionStatus.scheduled,
                selectedStartsAt: DateTime.utc(2026, 6, 1, 12),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('View session'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });

  group('PHS-11 timeline privacy', () {
    testWidgets('timeline shows request sent no raw enum', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
          overrides: [
            learnerHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(
                status: ProjectHelpSessionStatus.pending,
                timeOptions: _threeOptions(),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Request sent'), findsOneWidget);
      expect(find.text('PENDING'), findsNothing);
      expect(find.textContaining('@'), findsNothing);
      expect(find.textContaining('zoom.us'), findsNothing);
    });

    test('notification route still resolves', () {
      final notification = AppNotification(
        id: 'n1',
        notificationType: 'PROJECT_HELP_SESSION_ACCEPTED',
        title: 'Accepted',
        body: 'Accepted',
        relatedEntityType: 'PROJECT_HELP_SESSION',
        relatedEntityId: 'session-99',
        metadata: const {'sessionId': 'session-99'},
        isRead: false,
        createdAt: DateTime.utc(2026),
      );
      expect(
        projectHelpSessionNotificationRoute(notification),
        learnerHelpSessionDetailRoute('session-99'),
      );
    });
  });
}
