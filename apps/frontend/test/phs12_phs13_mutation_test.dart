import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/core/network/api_response.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/project_help_sessions/application/help_session_mutation_feedback.dart';
import 'package:frontend/features/project_help_sessions/application/project_help_sessions_providers.dart';
import 'package:frontend/features/project_help_sessions/data/models/project_help_session_models.dart';
import 'package:frontend/features/project_help_sessions/presentation/pages/creator_help_session_detail_page.dart';
import 'package:frontend/features/project_help_sessions/presentation/pages/learner_help_session_detail_page.dart';
import 'package:frontend/features/project_help_sessions/presentation/widgets/help_session_cancel_dialog.dart';
import 'package:frontend/features/project_help_sessions/presentation/widgets/help_session_status_utils.dart';

const _createResponseEnvelope = {
  'success': true,
  'message': 'Project help session request created successfully',
  'data': {
    'id': 'session-created-1',
    'status': 'PENDING',
    'project': {'id': 'project-1', 'title': 'Solar Lamp'},
    'build': {'id': 'build-1', 'attemptNumber': 1},
    'learner': {'id': 'learner-1', 'displayName': 'Learner One'},
    'author': {'id': 'author-1', 'displayName': 'Creator'},
    'problemDescription': 'Need help wiring the panel safely today please.',
    'durationMinutes': 30,
    'learnerTimeZone': 'Asia/Hebron',
    'timeOptions': [
      {
        'id': 'opt-1',
        'type': 'LEARNER_PROPOSED',
        'startsAt': '2026-03-10T08:00:00.000Z',
        'proposedBy': {'id': 'learner-1', 'displayName': 'Learner One'},
      },
      {
        'id': 'opt-2',
        'type': 'LEARNER_PROPOSED',
        'startsAt': '2026-03-11T08:00:00.000Z',
        'proposedBy': {'id': 'learner-1', 'displayName': 'Learner One'},
      },
      {
        'id': 'opt-3',
        'type': 'LEARNER_PROPOSED',
        'startsAt': '2026-03-12T08:00:00.000Z',
        'proposedBy': {'id': 'learner-1', 'displayName': 'Learner One'},
      },
    ],
    'allowedActions': {
      'canAcceptAlternative': false,
      'canRejectAlternative': false,
      'canCancel': true,
      'canJoin': false,
    },
    'createdAt': '2026-02-01T00:00:00.000Z',
    'updatedAt': '2026-02-01T00:00:00.000Z',
    'meetingReady': false,
  },
};

ProjectHelpSession _createdSession() {
  return ProjectHelpSession.fromJson(
    (_createResponseEnvelope['data'] as Map).cast<String, dynamic>(),
  );
}

ProjectHelpSession _session({
  ProjectHelpSessionStatus status = ProjectHelpSessionStatus.pending,
  ProjectHelpSessionCancelledByRole? cancelledByRole,
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
      title: 'Solar Lamp',
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
    createdAt: DateTime.utc(2026, 2, 1),
    updatedAt: DateTime.utc(2026, 2, 1),
    meetingReady: false,
    cancelledByRole: cancelledByRole,
    cancelledAt: cancelledByRole != null ? DateTime.utc(2026, 2, 2) : null,
    cancellationReason: cancelledByRole != null ? 'Changed plans' : null,
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

class _FakeCancelController extends ProjectHelpSessionActionController {
  _FakeCancelController(this.onCancel);

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

class _RequestSuccessHarness extends ConsumerWidget {
  const _RequestSuccessHarness();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return TextButton(
      onPressed: () {
        showDialog<void>(
          context: context,
          builder: (modalContext) => AlertDialog(
            content: FilledButton(
              onPressed: () {
                completeLearnerHelpSessionRequestCreation(
                  modalContext: modalContext,
                  hostContext: context,
                  ref: ref,
                  session: _createdSession(),
                  buildId: 'build-1',
                );
              },
              child: const Text('Simulate success'),
            ),
          ),
        );
      },
      child: const Text('Open request dialog'),
    );
  }
}

class _ActiveExistsHarness extends ConsumerWidget {
  const _ActiveExistsHarness();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return TextButton(
      onPressed: () {
        showDialog<void>(
          context: context,
          builder: (modalContext) => AlertDialog(
            content: FilledButton(
              onPressed: () {
                recoverActiveHelpSessionRequestExists(
                  modalContext: modalContext,
                  hostContext: context,
                  ref: ref,
                  buildId: 'build-1',
                );
              },
              child: const Text('Simulate exists'),
            ),
          ),
        );
      },
      child: const Text('Open request dialog'),
    );
  }
}

Widget _wrap(Widget child, {List overrides = const []}) {
  return ProviderScope(
    overrides: [
      authControllerProvider.overrideWith(_LearnerAuth.new),
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

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('PHS-12 create response handling', () {
    test('HTTP 201 envelope parses canonical session', () async {
      final response = Response<Map<String, dynamic>>(
        data: _createResponseEnvelope,
        statusCode: 201,
        requestOptions: RequestOptions(path: '/request'),
      );
      final session = await unwrapApiResponse(
        Future.value(response),
        ProjectHelpSession.fromJson,
      );
      expect(session.status, ProjectHelpSessionStatus.pending);
      expect(session.timeOptions.length, 3);
      expect(session.id, 'session-created-1');
    });
  });

  group('PHS-12 request false-success regression', () {
    testWidgets('successful create closes modal without inline error', (
      tester,
    ) async {
      await tester.pumpWidget(_wrap(const _RequestSuccessHarness()));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Open request dialog'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Simulate success'));
      await tester.pumpAndSettle();

      expect(find.byType(AlertDialog), findsNothing);
      expect(find.text('Something went wrong. Please try again.'), findsNothing);
      expect(find.text('Help session request sent.'), findsOneWidget);
    });

    testWidgets('provider refresh failure after success does not show error', (
      tester,
    ) async {
      var refreshFailed = false;
      await tester.pumpWidget(
        _wrap(
          const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
          overrides: [
            learnerHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async {
                if (refreshFailed) {
                  throw const ApiException(
                    message: 'refresh failed',
                    code: 'INTERNAL_ERROR',
                  );
                }
                return _session();
              },
            ),
            projectHelpSessionActionControllerProvider.overrideWith(
              () => _FakeCancelController(
                ({required sessionId, reason}) async {
                  refreshFailed = true;
                  return _session(
                    status: ProjectHelpSessionStatus.cancelled,
                    cancelledByRole: ProjectHelpSessionCancelledByRole.learner,
                    learnerAllowedActions:
                        ProjectHelpSessionLearnerAllowedActions.empty,
                  );
                },
              ),
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
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pumpAndSettle();

      expect(find.text('Cancel help session?'), findsNothing);
      expect(find.text('Something went wrong. Please try again.'), findsNothing);
    });

    testWidgets('ACTIVE_SESSION_EXISTS closes flow with safe message', (
      tester,
    ) async {
      await tester.pumpWidget(_wrap(const _ActiveExistsHarness()));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Open request dialog'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Simulate exists'));
      await tester.pumpAndSettle();

      expect(find.byType(AlertDialog), findsNothing);
      expect(
        find.text('Your session request was already submitted.'),
        findsOneWidget,
      );
    });

    testWidgets('actual create failure keeps dialog open', (tester) async {
      await tester.pumpWidget(
        _wrap(
          Builder(
            builder: (context) => TextButton(
              onPressed: () {
                showHelpSessionCancelDialog(
                  context: context,
                  requiresReason: false,
                  showConfirmedWarning: false,
                  onSubmit: (_) async {
                    throw const ApiException(
                      message: 'failed',
                      code: 'INTERNAL_ERROR',
                    );
                  },
                );
              },
              child: const Text('Open cancel'),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Open cancel'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Confirm cancellation'));
      await tester.pumpAndSettle();

      expect(find.text('Cancel help session?'), findsOneWidget);
      expect(
        find.text('Something unexpected went wrong. Please try again.'),
        findsOneWidget,
      );
    });
  });

  group('PHS-13 cancellation attribution', () {
    test('learner viewer sees cancelled by you when learner cancelled', () {
      final session = _session(
        status: ProjectHelpSessionStatus.cancelled,
        cancelledByRole: ProjectHelpSessionCancelledByRole.learner,
      );
      expect(
        cancellationActorLabel(session: session, viewerIsLearner: true),
        'Cancelled by you',
      );
    });

    test('learner viewer sees cancelled by project creator when author cancelled',
        () {
      final session = _session(
        status: ProjectHelpSessionStatus.cancelled,
        cancelledByRole: ProjectHelpSessionCancelledByRole.author,
      );
      expect(
        cancellationActorLabel(session: session, viewerIsLearner: true),
        'Cancelled by project creator',
      );
    });

    test('creator viewer sees cancelled by learner', () {
      final session = _session(
        status: ProjectHelpSessionStatus.cancelled,
        cancelledByRole: ProjectHelpSessionCancelledByRole.learner,
      );
      expect(
        cancellationActorLabel(session: session, viewerIsLearner: false),
        'Cancelled by learner',
      );
    });

    testWidgets('learner cancelled terminal page shows viewer-correct label', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(
          const LearnerHelpSessionDetailPage(sessionId: 'session-1'),
          overrides: [
            learnerHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(
                status: ProjectHelpSessionStatus.cancelled,
                cancelledByRole: ProjectHelpSessionCancelledByRole.learner,
                learnerAllowedActions:
                    ProjectHelpSessionLearnerAllowedActions.empty,
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Cancelled by you'), findsOneWidget);
      expect(find.text('Project creator'), findsNothing);
    });

    testWidgets('creator sees cancelled by learner when learner cancelled', (
      tester,
    ) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authorHelpSessionDetailProvider('session-1').overrideWith(
              (ref) async => _session(
                status: ProjectHelpSessionStatus.cancelled,
                cancelledByRole: ProjectHelpSessionCancelledByRole.learner,
              ),
            ),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: const CreatorHelpSessionDetailPage(sessionId: 'session-1'),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Cancelled by learner'), findsOneWidget);
    });
  });
}
