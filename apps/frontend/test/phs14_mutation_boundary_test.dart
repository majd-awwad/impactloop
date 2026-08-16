import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/project_help_sessions/application/project_help_session_canonical_cache.dart';
import 'package:frontend/features/project_help_sessions/application/project_help_session_mutation.dart';
import 'package:frontend/features/project_help_sessions/application/project_help_sessions_providers.dart';
import 'package:frontend/features/project_help_sessions/data/models/project_help_session_models.dart';
import 'package:frontend/features/project_help_sessions/presentation/pages/creator_help_session_detail_page.dart';
import 'package:frontend/features/project_help_sessions/presentation/pages/creator_project_help_session_settings_page.dart';
import 'package:frontend/features/project_help_sessions/presentation/pages/learner_help_session_detail_page.dart';
import 'package:frontend/features/project_help_sessions/presentation/widgets/build_help_session_section.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';

class _AuthorAuth extends AuthController {
  @override
  AuthState build() => AuthState(
    user: User(
      id: 'author-1',
      email: 'majd@learner.com',
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

final _slot1 = DateTime.utc(2026, 8, 7, 7);

ProjectHelpSession _session({
  ProjectHelpSessionStatus status = ProjectHelpSessionStatus.pending,
  ProjectHelpSessionAuthorAllowedActions authorAllowedActions =
      const ProjectHelpSessionAuthorAllowedActions(
        canAcceptOption: true,
        canProposeAlternative: true,
        canDecline: true,
        canCancel: true,
        canJoin: false,
        canRetryZoom: false,
        canComplete: false,
      ),
  ProjectHelpSessionLearnerAllowedActions learnerAllowedActions =
      const ProjectHelpSessionLearnerAllowedActions(
        canAcceptAlternative: false,
        canRejectAlternative: false,
        canCancel: true,
        canJoin: false,
      ),
  ProjectHelpSessionCancelledByRole? cancelledByRole,
  List<ProjectHelpSessionTimeOption>? timeOptions,
  DateTime? selectedStartsAt,
  String? selectedTimeOptionId,
  DateTime? updatedAt,
}) {
  return ProjectHelpSession(
    id: 'session-1',
    status: status,
    project: const ProjectHelpSessionProjectSummary(
      id: 'project-1',
      title: 'Fabric Pencil Case',
    ),
    build: const ProjectHelpSessionBuildSummary(
      id: 'build-1',
      attemptNumber: 1,
    ),
    learner: const ProjectHelpSessionUserSummary(
      id: 'learner-1',
      displayName: 'Majd Learner',
    ),
    author: const ProjectHelpSessionUserSummary(
      id: 'author-1',
      displayName: 'Israa Learner',
    ),
    problemDescription: 'Need help with the fabric layout.',
    durationMinutes: 15,
    learnerTimeZone: 'Asia/Hebron',
    timeOptions:
        timeOptions ??
        [
          ProjectHelpSessionTimeOption(
            id: 'opt-1',
            type: ProjectHelpSessionTimeOptionType.learnerProposed,
            startsAt: _slot1,
            proposedBy: const ProjectHelpSessionUserSummary(
              id: 'learner-1',
              displayName: 'Majd Learner',
            ),
          ),
        ],
    selectedTimeOptionId: selectedTimeOptionId,
    selectedStartsAt: selectedStartsAt,
    learnerAllowedActions: learnerAllowedActions,
    authorAllowedActions: authorAllowedActions,
    createdAt: DateTime.utc(2026, 8, 6),
    updatedAt: updatedAt ?? DateTime.utc(2026, 8, 6),
    meetingReady: false,
    cancelledByRole: cancelledByRole,
    cancelledAt: cancelledByRole != null ? DateTime.utc(2026, 8, 7) : null,
    cancellationReason: cancelledByRole != null ? 'Changed plans' : null,
  );
}

class _FakeCancelController extends ProjectHelpSessionActionController {
  @override
  Future<ProjectHelpSession?> cancelSession({
    required String sessionId,
    String? reason,
  }) async {
    throw const ApiException(message: 'failed', code: 'INTERNAL_ERROR');
  }
}

class _RecoveringCancelController extends ProjectHelpSessionActionController {
  @override
  Future<ProjectHelpSession?> cancelSession({
    required String sessionId,
    String? reason,
  }) async {
    _cancelRecoveryReady = true;
    throw const ApiException(message: 'failed', code: 'INTERNAL_ERROR');
  }
}

class _RecoveringProposeController extends ProjectHelpSessionActionController {
  @override
  Future<ProjectHelpSession?> proposeAlternative({
    required String sessionId,
    required DateTime startsAtUtc,
  }) async {
    _cancelRecoveryReady = true;
    throw const ApiException(message: 'failed', code: 'INTERNAL_ERROR');
  }
}

var _cancelRecoveryReady = false;

class _FakeSettingsController extends ProjectHelpSessionActionController {
  @override
  Future<ProjectHelpSessionSettings?> saveSettings({
    required String projectId,
    required ProjectHelpSessionSettings settings,
  }) async {
    return settings;
  }
}

Widget _wrap(Widget child, {List overrides = const []}) {
  return ProviderScope(
    overrides: [
      authControllerProvider.overrideWith(_AuthorAuth.new),
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

ProjectBuild _buildRecord() {
  return ProjectBuild(
    id: 'build-1',
    projectId: 'project-1',
    status: ProjectBuildStatus.inProgress,
    project: const ProjectBuildProject(
      id: 'project-1',
      title: 'Fabric Pencil Case',
      shortDescription: 'Case',
    ),
    progress: const ProjectBuildProgress(total: 1, ready: 0, percent: 0),
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
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    _cancelRecoveryReady = false;
  });

  group('PHS-14 mutation boundary', () {
    test('runProjectHelpSessionMutation wraps only API failures', () async {
      await expectLater(
        runProjectHelpSessionMutation(() async {
          throw const ApiException(message: 'nope', code: 'INTERNAL_ERROR');
        }),
        throwsA(isA<ProjectHelpSessionMutationFailure>()),
      );
    });

    test('canonical cache applies returned DTO immediately', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final scheduled = _session(
        status: ProjectHelpSessionStatus.scheduled,
        selectedTimeOptionId: 'opt-1',
        selectedStartsAt: _slot1,
      );
      container
          .read(projectHelpSessionCanonicalCacheProvider.notifier)
          .put(scheduled, authorView: true);
      expect(
        container
            .read(
              projectHelpSessionCanonicalCacheProvider,
            )[helpSessionCanonicalCacheKey('session-1', authorView: true)]
            ?.status,
        ProjectHelpSessionStatus.scheduled,
      );
      container
          .read(activeHelpSessionByBuildCacheProvider.notifier)
          .apply(scheduled);
      expect(
        container
            .read(activeHelpSessionByBuildCacheProvider)['build-1']
            ?.status,
        ProjectHelpSessionStatus.scheduled,
      );
    });

    test('effectiveLearnerAllowedActions recovers alternative buttons', () {
      final session = _session(
        status: ProjectHelpSessionStatus.alternativeProposed,
        authorAllowedActions: const ProjectHelpSessionAuthorAllowedActions(
          canAcceptOption: false,
          canProposeAlternative: false,
          canDecline: false,
          canCancel: true,
          canJoin: false,
          canRetryZoom: false,
          canComplete: false,
        ),
      );
      final actions = effectiveLearnerAllowedActions(session);
      expect(actions.canAcceptAlternative, isTrue);
      expect(actions.canRejectAlternative, isTrue);
    });

    testWidgets('creator detail renders canonical cache without refetch', (
      tester,
    ) async {
      final scheduled = _session(
        status: ProjectHelpSessionStatus.scheduled,
        authorAllowedActions: const ProjectHelpSessionAuthorAllowedActions(
          canAcceptOption: false,
          canProposeAlternative: false,
          canDecline: false,
          canCancel: true,
          canJoin: true,
          canRetryZoom: false,
          canComplete: false,
        ),
        selectedTimeOptionId: 'opt-1',
        selectedStartsAt: _slot1,
      );

      await tester.pumpWidget(
        _wrap(
          const CreatorHelpSessionDetailPage(sessionId: 'session-1'),
          overrides: [
            authorHelpSessionDetailProvider(
              'session-1',
            ).overrideWith((ref) async => _session()),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Pending'), findsWidgets);

      final element = tester.element(find.byType(CreatorHelpSessionDetailPage));
      final container = ProviderScope.containerOf(element);
      container
          .read(projectHelpSessionCanonicalCacheProvider.notifier)
          .put(scheduled, authorView: true);
      await tester.pump();

      expect(find.text('Scheduled'), findsWidgets);
      expect(find.text('Accept selected time'), findsNothing);
      expect(
        find.text('Something went wrong. Please try again.'),
        findsNothing,
      );
    });

    testWidgets('build section shows cached active session immediately', (
      tester,
    ) async {
      final pending = _session();
      await tester.pumpWidget(
        _wrap(
          BuildHelpSessionSection(buildRecord: _buildRecord()),
          overrides: [
            projectHelpSessionAvailabilityProvider('project-1').overrideWith(
              (ref) async => const ProjectHelpSessionAvailability(
                available: true,
                allowedDurations: [15, 30],
              ),
            ),
            activeHelpSessionForBuildProvider(
              'build-1',
            ).overrideWith((ref) async => null),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Send session request'), findsOneWidget);

      final element = tester.element(find.byType(BuildHelpSessionSection));
      final container = ProviderScope.containerOf(element);
      container
          .read(activeHelpSessionByBuildCacheProvider.notifier)
          .apply(pending);
      await tester.pump();

      expect(find.text('Send session request'), findsNothing);
      expect(find.text('View session'), findsOneWidget);
    });

    test('shouldPreferCachedHelpSession prefers newer server state', () {
      final pending = _session(updatedAt: DateTime.utc(2026, 8, 6, 10));
      final cancelled = _session(
        status: ProjectHelpSessionStatus.cancelled,
        cancelledByRole: ProjectHelpSessionCancelledByRole.learner,
        updatedAt: DateTime.utc(2026, 8, 6, 11),
      );
      expect(shouldPreferCachedHelpSession(pending, cancelled), isFalse);
      expect(shouldPreferCachedHelpSession(cancelled, pending), isTrue);
    });

    testWidgets('creator detail auto-selects first proposed time', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(
          const CreatorHelpSessionDetailPage(sessionId: 'session-1'),
          overrides: [
            authorHelpSessionDetailProvider(
              'session-1',
            ).overrideWith((ref) async => _session()),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.text('Select one of the proposed times to enable acceptance.'),
        findsNothing,
      );
      expect(
        find.widgetWithText(FilledButton, 'Accept selected time'),
        findsOneWidget,
      );
      final button = tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, 'Accept selected time'),
      );
      expect(button.onPressed, isNotNull);
    });

    testWidgets(
      'completeLearnerHelpSessionCancel recovers server-side cancel',
      (tester) async {
        final container = ProviderContainer(
          overrides: [
            learnerHelpSessionDetailProvider('session-1').overrideWith((
              ref,
            ) async {
              if (_cancelRecoveryReady) {
                return _session(
                  status: ProjectHelpSessionStatus.cancelled,
                  cancelledByRole: ProjectHelpSessionCancelledByRole.learner,
                  updatedAt: DateTime.utc(2026, 8, 6, 12),
                );
              }
              return _session();
            }),
            projectHelpSessionActionControllerProvider.overrideWith(
              _RecoveringCancelController.new,
            ),
          ],
        );
        addTearDown(container.dispose);

        late WidgetRef widgetRef;
        await tester.pumpWidget(
          UncontrolledProviderScope(
            container: container,
            child: Consumer(
              builder: (context, ref, _) {
                widgetRef = ref;
                return const SizedBox.shrink();
              },
            ),
          ),
        );

        final result = await completeLearnerHelpSessionCancel(
          ref: widgetRef,
          sessionId: 'session-1',
          mutate: () => widgetRef
              .read(projectHelpSessionActionControllerProvider.notifier)
              .cancelSession(sessionId: 'session-1'),
        );

        expect(result?.status, ProjectHelpSessionStatus.cancelled);
        expect(
          container
              .read(
                projectHelpSessionCanonicalCacheProvider,
              )[helpSessionCanonicalCacheKey('session-1', authorView: false)]
              ?.status,
          ProjectHelpSessionStatus.cancelled,
        );
      },
    );

    testWidgets('learner cancel recovers when server already cancelled', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(
          const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
          overrides: [
            learnerHelpSessionDetailProvider('session-1').overrideWith((
              ref,
            ) async {
              if (_cancelRecoveryReady) {
                return _session(
                  status: ProjectHelpSessionStatus.cancelled,
                  cancelledByRole: ProjectHelpSessionCancelledByRole.learner,
                  learnerAllowedActions:
                      const ProjectHelpSessionLearnerAllowedActions(
                        canAcceptAlternative: false,
                        canRejectAlternative: false,
                        canCancel: false,
                        canJoin: false,
                      ),
                  updatedAt: DateTime.utc(2026, 8, 6, 12),
                );
              }
              return _session();
            }),
            projectHelpSessionActionControllerProvider.overrideWith(
              _RecoveringCancelController.new,
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      await tester.binding.setSurfaceSize(const Size(1280, 1200));
      await tester.ensureVisible(find.text('Cancel request'));
      await tester.tap(find.text('Cancel request'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Confirm cancellation'));
      await tester.pumpAndSettle();

      expect(find.text('Cancel help session?'), findsNothing);
      expect(find.text('Cancelled'), findsWidgets);
      expect(
        find.text('Something went wrong. Please try again.'),
        findsNothing,
      );
    });

    testWidgets(
      'runProjectHelpSessionMutationWithRecovery recovers alternative propose',
      (tester) async {
        final container = ProviderContainer(
          overrides: [
            authorHelpSessionDetailProvider('session-1').overrideWith((
              ref,
            ) async {
              if (_cancelRecoveryReady) {
                return _session(
                  status: ProjectHelpSessionStatus.alternativeProposed,
                  timeOptions: [
                    ProjectHelpSessionTimeOption(
                      id: 'opt-alt',
                      type: ProjectHelpSessionTimeOptionType.authorAlternative,
                      startsAt: DateTime.utc(2026, 8, 8, 7),
                      proposedBy: const ProjectHelpSessionUserSummary(
                        id: 'author-1',
                        displayName: 'Israa Learner',
                      ),
                    ),
                  ],
                  updatedAt: DateTime.utc(2026, 8, 6, 12),
                );
              }
              return _session();
            }),
            projectHelpSessionActionControllerProvider.overrideWith(
              _RecoveringProposeController.new,
            ),
          ],
        );
        addTearDown(container.dispose);

        late WidgetRef widgetRef;
        await tester.pumpWidget(
          UncontrolledProviderScope(
            container: container,
            child: Consumer(
              builder: (context, ref, _) {
                widgetRef = ref;
                return const SizedBox.shrink();
              },
            ),
          ),
        );

        final result = await runProjectHelpSessionMutationWithRecovery(
          ref: widgetRef,
          sessionId: 'session-1',
          authorView: true,
          mutate: () => widgetRef
              .read(projectHelpSessionActionControllerProvider.notifier)
              .proposeAlternative(
                sessionId: 'session-1',
                startsAtUtc: DateTime.utc(2026, 8, 8, 7),
              ),
          recoveryMatches: helpSessionRecoveryAlternativeProposed,
        );

        expect(result?.status, ProjectHelpSessionStatus.alternativeProposed);
        expect(helpSessionHasAuthorAlternative(result!), isTrue);
      },
    );

    testWidgets('real API failure keeps cancel dialog open', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
          overrides: [
            learnerHelpSessionDetailProvider(
              'session-1',
            ).overrideWith((ref) async => _session()),
            projectHelpSessionActionControllerProvider.overrideWith(
              _FakeCancelController.new,
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      await tester.binding.setSurfaceSize(const Size(1280, 1200));
      await tester.ensureVisible(find.text('Cancel request'));
      await tester.tap(find.text('Cancel request'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Confirm cancellation'));
      await tester.pumpAndSettle();

      expect(find.text('Cancel help session?'), findsOneWidget);
      expect(
        find.text('Something unexpected went wrong. Please try again.'),
        findsOneWidget,
      );
    });

    testWidgets('settings save succeeds without inline error', (tester) async {
      await tester.binding.setSurfaceSize(const Size(1280, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final router = GoRouter(
        initialLocation: '/creator/projects/project-1/help-sessions/settings',
        routes: [
          GoRoute(
            path: '/creator/projects/:projectId/help-sessions/settings',
            builder: (context, state) => CreatorProjectHelpSessionSettingsPage(
              projectId: state.pathParameters['projectId']!,
            ),
          ),
          GoRoute(
            path: '/learning/submissions/:projectId',
            builder: (context, state) => Scaffold(
              body: Text('Submission ${state.pathParameters['projectId']}'),
            ),
          ),
        ],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith(_AuthorAuth.new),
            projectHelpSessionSettingsProvider('project-1').overrideWith(
              (ref) async => const ProjectHelpSessionSettings(
                projectId: 'project-1',
                isEnabled: true,
                allow15Minutes: true,
                allow30Minutes: true,
                weeklyLimit: 3,
              ),
            ),
            projectHelpSessionActionControllerProvider.overrideWith(
              _FakeSettingsController.new,
            ),
          ],
          child: MaterialApp.router(
            routerConfig: router,
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
      await tester.ensureVisible(find.text('Save settings'));
      await tester.tap(find.text('Save settings'));
      await tester.pumpAndSettle();

      expect(
        find.text('Something went wrong. Please try again.'),
        findsNothing,
      );
      expect(find.text('Help session settings saved.'), findsOneWidget);
      expect(router.state.uri.path, '/learning/submissions/project-1');
    });
  });
}
