import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/app/router/navigation_extensions.dart';
import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/project_help_sessions/application/project_help_sessions_providers.dart';
import 'package:frontend/features/project_help_sessions/application/project_help_session_timezone.dart';
import 'package:frontend/features/project_help_sessions/data/models/project_help_session_models.dart';
import 'package:frontend/features/project_help_sessions/data/project_help_sessions_api.dart';
import 'package:frontend/features/project_help_sessions/presentation/pages/creator_project_help_session_settings_page.dart';
import 'package:frontend/features/project_help_sessions/presentation/widgets/build_help_session_section.dart';
import 'package:frontend/features/project_help_sessions/presentation/widgets/help_session_request_form.dart';

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

const _available = ProjectHelpSessionAvailability(
  available: true,
  allowedDurations: [15, 30],
  authorDisplayName: 'Israa Learner',
);

Widget _requestForm({bool isCompact = false}) {
  return Builder(
    builder: (context) => ProjectHelpSessionRequestForm(
      hostContext: context,
      build: _testBuild(),
      availability: _available,
      isCompact: isCompact,
    ),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('PHS-08 settings navigation', () {
    testWidgets('successful save returns to previous submission detail', (tester) async {
      await tester.binding.setSurfaceSize(const Size(1200, 900));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      late GoRouter router;
      router = GoRouter(
        routes: [
          GoRoute(
            path: '/learning/submissions/:id',
            builder: (_, state) => Scaffold(
              body: Text('detail-${state.pathParameters['id']}'),
            ),
          ),
          GoRoute(
            path: '/creator/projects/:projectId/help-sessions/settings',
            builder: (_, state) => CreatorProjectHelpSessionSettingsPage(
              projectId: state.pathParameters['projectId']!,
            ),
          ),
        ],
        initialLocation: '/learning/submissions/project-1',
      );

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
            projectHelpSessionsApiProvider.overrideWith(
              (ref) => _FakeSettingsApi(
                onUpdate: (_) async => const ProjectHelpSessionSettings(
                  projectId: 'project-1',
                  isEnabled: true,
                  allow15Minutes: true,
                  allow30Minutes: false,
                  weeklyLimit: 4,
                ),
              ),
            ),
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
      await tester.pumpAndSettle();

      router.push('/creator/projects/project-1/help-sessions/settings');
      await tester.pumpAndSettle();

      await tester.ensureVisible(find.text('Save settings'));
      await tester.tap(find.text('Save settings'));
      await tester.pumpAndSettle();

      expect(find.text('detail-project-1'), findsOneWidget);
      expect(find.text('Help session settings saved.'), findsOneWidget);
    });

    testWidgets('direct settings URL falls back to canonical submission detail', (tester) async {
      await tester.binding.setSurfaceSize(const Size(1200, 900));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      late GoRouter router;
      router = GoRouter(
        routes: [
          GoRoute(
            path: learningProjectSubmissionDetailRoute(':id'),
            builder: (_, state) => Scaffold(
              body: Text('detail-${state.pathParameters['id']}'),
            ),
          ),
          GoRoute(
            path: creatorProjectHelpSessionSettingsRoute(':projectId'),
            builder: (_, state) => CreatorProjectHelpSessionSettingsPage(
              projectId: state.pathParameters['projectId']!,
            ),
          ),
        ],
        initialLocation: creatorProjectHelpSessionSettingsRoute('project-1'),
      );

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
            projectHelpSessionsApiProvider.overrideWith(
              (ref) => _FakeSettingsApi(
                onUpdate: (_) async => const ProjectHelpSessionSettings(
                  projectId: 'project-1',
                  isEnabled: true,
                  allow15Minutes: true,
                  allow30Minutes: true,
                  weeklyLimit: 3,
                ),
              ),
            ),
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
      await tester.pumpAndSettle();

      await tester.ensureVisible(find.text('Save settings'));
      await tester.tap(find.text('Save settings'));
      await tester.pumpAndSettle();

      expect(find.text('detail-project-1'), findsOneWidget);
    });
  });

  group('PHS-08 build CTA', () {
    testWidgets('only allowed durations rendered', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            projectHelpSessionAvailabilityProvider('project-1').overrideWith(
              (ref) async => const ProjectHelpSessionAvailability(
                available: true,
                allowedDurations: [30],
              ),
            ),
            activeHelpSessionForBuildProvider('build-1')
                .overrideWith((ref) async => null),
          ],
          child: MaterialApp(
            home: Scaffold(body: BuildHelpSessionSection(buildRecord: _testBuild())),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('30 min'), findsOneWidget);
      expect(find.text('15 min'), findsNothing);
      expect(find.text('Private session with the project creator'), findsOneWidget);
    });

    testWidgets('desktop CTA is not full width', (tester) async {
      await tester.binding.setSurfaceSize(const Size(1200, 900));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            projectHelpSessionAvailabilityProvider('project-1')
                .overrideWith((ref) async => _available),
            activeHelpSessionForBuildProvider('build-1')
                .overrideWith((ref) async => null),
          ],
          child: MaterialApp(
            home: Scaffold(body: BuildHelpSessionSection(buildRecord: _testBuild())),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final button = tester.getRect(find.text('Send session request'));
      expect(button.width, lessThan(1200 * 0.9));
    });
  });

  group('PHS-08 request dialog', () {
    testWidgets('inline error remains visible in open dialog', (tester) async {
      await tester.binding.setSurfaceSize(const Size(900, 900));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(body: _requestForm()),
        ),
      );
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField).first, 'short');
      await tester.tap(find.text('Send session request'));
      await tester.pumpAndSettle();

      expect(find.textContaining('minimum 20'), findsOneWidget);
      expect(find.text('Send session request'), findsOneWidget);
    });

    testWidgets('slot shows select date and time before selection', (tester) async {
      await tester.pumpWidget(
        MaterialApp(home: Scaffold(body: _requestForm())),
      );
      await tester.pumpAndSettle();

      expect(find.text('Select date and time'), findsNWidgets(6));
    });

    testWidgets('mobile layout fits at 390px', (tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('ar'),
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [Locale('ar')],
          home: Scaffold(
            body: SizedBox(
              height: 844,
              child: _requestForm(isCompact: true),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('إرسال طلب الجلسة'), findsOneWidget);
    });
  });

  group('PHS-08 request contract', () {
    test('project and build ids differ in payload contract', () {
      final build = _testBuild();
      expect(build.id, isNot(build.projectId));
      expect(build.id, 'build-1');
      expect(build.projectId, 'project-1');
    });

    test('request JSON matches backend schema', () {
      final utcTimes = List.generate(
        3,
        (index) => DateTime.utc(2026, 8, 10, 9 + index),
      );
      final payload = CreateProjectHelpSessionRequestPayload(
        problemDescription: 'Need help finishing the LED dice wiring safely.',
        durationMinutes: 30,
        learnerTimeZone: 'Asia/Hebron',
        projectStepId: '3b5a9309-8039-4f69-802b-61ec1bde2902',
        proposedTimes: utcTimes,
      );

      final json = payload.toJson();

      expect(json.keys, containsAll([
        'problemDescription',
        'projectStepId',
        'durationMinutes',
        'learnerTimeZone',
        'proposedTimes',
      ]));
      expect(json['durationMinutes'], 30);
      expect(json['learnerTimeZone'], 'Asia/Hebron');
      expect(json['proposedTimes'], hasLength(3));
      for (final value in json['proposedTimes'] as List) {
        expect(value, matches(RegExp(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}')));
        expect(value.toString().endsWith('Z'), isTrue);
      }
    });

    test('validation envelope maps projectStepId field issue', () {
      const error = ApiException(
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        details: {
          'issues': [
            {'path': 'projectStepId', 'message': 'Invalid cuid'},
          ],
        },
      );

      final message = resolveProjectHelpSessionErrorFromObject(
        error,
        isArabic: false,
      );

      expect(message, contains('selected step'));
      expect(message, isNot(contains('Invalid cuid')));
    });
  });
}

class _FakeSettingsApi extends ProjectHelpSessionsApi {
  _FakeSettingsApi({required this.onUpdate}) : super(Dio());

  final Future<ProjectHelpSessionSettings> Function(
    ProjectHelpSessionSettings settings,
  ) onUpdate;

  @override
  Future<ProjectHelpSessionSettings> updateSettings({
    required String projectId,
    required ProjectHelpSessionSettings settings,
  }) {
    return onUpdate(settings);
  }
}
