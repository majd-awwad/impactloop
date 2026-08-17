import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/app/router/navigation_extensions.dart';
import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/learning_hub/application/learning_hub_providers.dart';
import 'package:frontend/features/learning_hub/application/learning_session_providers.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_session.dart';
import 'package:frontend/features/learning_hub/domain/learning_project_repository.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/learning_hub/presentation/l10n/final_learning_check_l10n.dart';
import 'package:frontend/features/learning_hub/presentation/l10n/project_build_page_l10n.dart';
import 'package:frontend/features/learning_hub/presentation/pages/learning_project_build_page.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/final_learning_check_section.dart';
import 'package:frontend/features/learner_builds/application/learner_builds_providers.dart';
import 'package:frontend/features/learner_builds/data/learner_builds_api.dart';
import 'package:frontend/features/learner_builds/data/models/learner_build_models.dart';
import 'package:frontend/features/notifications/application/notifications_provider.dart';
import 'package:frontend/shared/widgets/app_back_action.dart';
import 'package:frontend/shared/widgets/app_feedback.dart';

void main() {
  testWidgets('IN_PROGRESS build shows a visible Build actions control', (
    tester,
  ) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.inProgress),
      viewport: const Size(1024, 900),
    );

    expect(find.text('Build actions'), findsOneWidget);
    expect(find.text('My builds'), findsOneWidget);
    expect(find.text('Progress is saved automatically.'), findsOneWidget);
    expect(find.text('In progress'), findsOneWidget);
    expect(find.text('Prepare materials'), findsOneWidget);
    expect(find.text('Preparing the project'), findsNothing);
    expect(find.textContaining('ready in your build'), findsNothing);
    expect(find.byType(LinearProgressIndicator), findsOneWidget);
  });

  testWidgets('started build focuses the current step', (tester) async {
    await _pumpBuildPage(
      tester,
      build: _buildWithLastStepRemaining(),
      sessionBundle: _sampleSessionBundle(),
      viewport: const Size(390, 844),
    );

    expect(find.text('I finished this step'), findsOneWidget);
    expect(find.text('Final assembly'), findsWidgets);
    expect(find.text('Need help?'), findsOneWidget);
    expect(find.text('Prepare materials'), findsNothing);
    expect(find.text('Preparing the project'), findsNothing);
  });

  testWidgets(
    'BUILD shows one compact step-progress header without the project dashboard',
    (tester) async {
      await _pumpBuildPage(
        tester,
        build: _buildAtFirstPracticalStep(),
        sessionBundle: _sampleSessionBundle(),
        viewport: const Size(390, 844),
      );

      expect(find.text('PVC Plant Stand'), findsOneWidget);
      expect(find.text('Step 1 of 2 · 0%'), findsOneWidget);
      expect(find.text('A simple plant stand build'), findsNothing);
      expect(find.text('Progress is saved automatically.'), findsNothing);
      expect(find.textContaining('ready in your build'), findsNothing);
      expect(find.text('Prepare materials'), findsNothing);
      expect(find.text('Ask AI'), findsNothing);
      expect(find.text('I finished this step'), findsOneWidget);
      expect(find.text('Need help?'), findsOneWidget);
      expect(find.text('Quick knowledge check'), findsOneWidget);
      expect(find.text('Show materials'), findsOneWidget);
      expect(find.text('Build tools'), findsOneWidget);
      expect(find.byType(LinearProgressIndicator), findsOneWidget);
    },
  );

  testWidgets('reopening a progressed BUILD can show Welcome back', (
    tester,
  ) async {
    await _pumpBuildPage(
      tester,
      build: _buildWithLastStepRemaining(),
      sessionBundle: _sampleSessionBundle(),
      viewport: const Size(390, 844),
    );

    expect(find.text('Welcome back'), findsOneWidget);
    expect(find.text('You left off at step 2 of 2'), findsOneWidget);
  });

  testWidgets('completing a step does not show Welcome back', (tester) async {
    final first = _buildAtFirstPracticalStep();
    final second = _buildWithLastStepRemaining();
    final repository = _CompletingBuildRepository(first, second);

    await _pumpBuildPage(
      tester,
      build: first,
      repository: repository,
      sessionBundle: _sampleSessionBundle(),
      viewport: const Size(390, 844),
    );

    expect(find.text('Welcome back'), findsNothing);

    await tester.tap(find.text('I finished this step'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();

    expect(find.text('✓ Step 1 is done'), findsOneWidget);
    expect(find.text('Next:'), findsOneWidget);
    expect(find.text('Final assembly'), findsWidgets);
    expect(
      find.text('An optional question to help the idea stick.'),
      findsNothing,
    );

    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();

    expect(find.text('Welcome back'), findsNothing);
    expect(find.text('You left off at step 2 of 2'), findsNothing);
    expect(find.text('Step 2 of 2 · 50%'), findsOneWidget);
    expect(find.text('I finished this step'), findsOneWidget);
  });

  testWidgets('BUILD tools keep Ask AI and materials reachable', (
    tester,
  ) async {
    await _pumpBuildPage(
      tester,
      build: _buildAtFirstPracticalStep(),
      sessionBundle: _sampleSessionBundle(),
      viewport: const Size(390, 844),
    );

    await tester.tap(find.text('Show materials'));
    await tester.pumpAndSettle();
    expect(find.text('Hide materials'), findsOneWidget);

    await tester.tap(find.text('Build tools'));
    await tester.pumpAndSettle();
    expect(find.text('Ask AI'), findsOneWidget);
    expect(find.text('Project notebook'), findsOneWidget);
    expect(find.text('Find best material plan'), findsOneWidget);
  });

  testWidgets('BUILD 360px Arabic layout does not overflow', (tester) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    FlutterError.onError = (details) {
      final message = details.exceptionAsString();
      if (message.contains('RenderFlex overflowed') ||
          message.contains('overflowed by')) {
        fail('Layout overflow: $message');
      }
      FlutterError.presentError(details);
    };

    await _pumpBuildPage(
      tester,
      build: _buildAtFirstPracticalStep(),
      sessionBundle: _sampleSessionBundle(),
      locale: const Locale('ar'),
      viewport: const Size(360, 800),
    );

    expect(find.text('أنهيت هذه الخطوة'), findsOneWidget);
    expect(find.text('تحتاج مساعدة؟'), findsOneWidget);
    expect(find.text('تحقق سريع من فهمك'), findsOneWidget);
    expect(find.text('أدوات البناء'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Build actions menu contains Pause build and Archive build', (
    tester,
  ) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.inProgress),
      viewport: const Size(1024, 900),
    );

    await _tapBuildActionsMenu(tester);

    expect(find.text('Pause build'), findsOneWidget);
    expect(find.text('Archive'), findsOneWidget);
  });

  testWidgets('PAUSED build shows Resume build', (tester) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.paused),
      viewport: const Size(1024, 900),
    );

    expect(find.text('Paused'), findsOneWidget);
    expect(find.text('Resume build'), findsWidgets);
  });

  testWidgets('COMPLETED build menu shows only valid actions', (tester) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.completed),
      sessionBundle: _sampleSessionBundle(),
      viewport: const Size(1024, 900),
    );

    expect(find.text('Completed'), findsOneWidget);
    expect(find.text('Complete step'), findsNothing);
    expect(find.text('Pause build'), findsNothing);
    expect(find.text('View achievement portfolio'), findsWidgets);
    expect(find.text('Build again'), findsWidgets);
  });

  testWidgets('ARCHIVED build menu shows only Build again', (tester) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.archived),
      sessionBundle: _sampleSessionBundle(),
      viewport: const Size(1024, 900),
    );

    expect(find.text('Pause build'), findsNothing);
    expect(find.text('Resume build'), findsNothing);
    expect(find.text('Archive'), findsNothing);
    expect(find.text('Build again'), findsWidgets);
  });

  testWidgets('desktop does not rely on an unlabeled three-dots icon', (
    tester,
  ) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.inProgress),
      viewport: const Size(1024, 900),
    );

    expect(find.text('Build actions'), findsOneWidget);
    expect(find.byIcon(Icons.more_vert_rounded), findsWidgets);
  });

  testWidgets('mobile lifecycle menu has tooltip and semantic label', (
    tester,
  ) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.inProgress),
      viewport: const Size(390, 844),
    );

    expect(find.text('Build actions'), findsNothing);
    expect(find.byTooltip('Build actions'), findsOneWidget);
    expect(find.bySemanticsLabel('Build actions'), findsOneWidget);
  });

  testWidgets('Back action opens the correct Project ID', (tester) async {
    final router = await _pumpBuildPage(
      tester,
      build: _sampleBuild(),
      viewport: const Size(1024, 900),
    );

    await tester.tap(find.byType(AppBackAction));
    await tester.pumpAndSettle();

    expect(
      router.routerDelegate.currentConfiguration.uri.path,
      '/learning/project-1',
    );
  });

  testWidgets('My builds opens /learner/builds', (tester) async {
    final router = await _pumpBuildPage(
      tester,
      build: _sampleBuild(),
      viewport: const Size(1024, 900),
      extraRoutes: [
        GoRoute(
          path: '/learner/builds',
          builder: (context, state) =>
              const Scaffold(body: Text('my builds page')),
        ),
      ],
    );

    await tester.tap(find.text('My builds'));
    await tester.pumpAndSettle();

    expect(
      router.routerDelegate.currentConfiguration.uri.path,
      '/learner/builds',
    );
  });

  testWidgets('pause updates the page to Paused without hard refresh', (
    tester,
  ) async {
    final repository = _UpdatingBuildRepository(
      _sampleBuild(status: ProjectBuildStatus.inProgress),
      paused: _sampleBuild(status: ProjectBuildStatus.paused),
    );
    final api = _RecordingLearnerBuildsApi(
      paused: _sampleBuild(status: ProjectBuildStatus.paused),
      repository: repository,
    );

    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.inProgress),
      repository: repository,
      learnerBuildsApi: api,
      viewport: const Size(1024, 900),
    );

    await _tapBuildActionsMenu(tester);
    await tester.tap(find.text('Pause build'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirm'));
    await tester.pumpAndSettle();

    expect(api.pauseCalls, 1);
    expect(find.text('Paused'), findsOneWidget);
    expect(find.text('Resume build'), findsWidgets);
  });

  testWidgets('Paused page displays Resume build', (tester) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.paused),
      viewport: const Size(1024, 900),
    );

    expect(find.text('Resume build'), findsWidgets);
  });

  testWidgets('Resume returns the page to In progress', (tester) async {
    final repository = _UpdatingBuildRepository(
      _sampleBuild(status: ProjectBuildStatus.paused),
      paused: _sampleBuild(status: ProjectBuildStatus.paused),
      resumed: _sampleBuild(status: ProjectBuildStatus.inProgress),
    );
    final api = _RecordingLearnerBuildsApi(
      paused: _sampleBuild(status: ProjectBuildStatus.paused),
      resumed: _sampleBuild(status: ProjectBuildStatus.inProgress),
      repository: repository,
    );

    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.paused),
      repository: repository,
      learnerBuildsApi: api,
      viewport: const Size(1024, 900),
    );

    await tester.tap(find.text('Resume build').first);
    await tester.pumpAndSettle();

    expect(api.resumeCalls, 1);
    expect(find.text('In progress'), findsOneWidget);
    expect(find.text('Paused'), findsNothing);
  });

  testWidgets('Pause failure displays action-specific error', (tester) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.inProgress),
      learnerBuildsApi: _FailingLearnerBuildsApi(
        onPause: () => throw const ApiException(
          message: 'Request failed',
          code: 'UNKNOWN',
        ),
      ),
      viewport: const Size(1024, 900),
    );

    await _tapBuildActionsMenu(tester);
    await tester.tap(find.text('Pause build'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirm'));
    await tester.pumpAndSettle();

    expect(find.text(ProjectBuildPageL10n.errorPauseBuild.en), findsOneWidget);
    expect(find.text('Request failed'), findsNothing);
  });

  testWidgets('Resume failure displays action-specific error', (tester) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.paused),
      learnerBuildsApi: _FailingLearnerBuildsApi(
        onResume: () => throw const ApiException(
          message: 'Request failed',
          code: 'UNKNOWN',
        ),
      ),
      viewport: const Size(1024, 900),
    );

    await tester.tap(find.text('Resume build').first);
    await tester.pumpAndSettle();

    expect(find.text(ProjectBuildPageL10n.errorResumeBuild.en), findsOneWidget);
    expect(find.text('Request failed'), findsNothing);
  });

  testWidgets('Archive failure displays action-specific error', (tester) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.inProgress),
      learnerBuildsApi: _FailingLearnerBuildsApi(
        onArchive: () => throw ApiException(
          message: 'Request failed',
          code: 'BUILD_ARCHIVE_BLOCKED',
          details: {
            'blockers': [
              {
                'message':
                    'This build can’t be archived while it has active reservations.',
              },
            ],
          },
        ),
      ),
      viewport: const Size(1024, 900),
    );

    await _tapBuildActionsMenu(tester);
    await tester.tap(find.text('Archive'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirm'));
    await tester.pumpAndSettle();

    expect(
      find.text(ProjectBuildPageL10n.errorArchiveBuild.en),
      findsOneWidget,
    );
    expect(find.text('Request failed'), findsNothing);
  });

  test('material request failure uses material-request-specific error', () {
    const error = ApiException(message: 'Request failed', code: 'UNKNOWN');

    expect(
      ProjectBuildPageL10n.lifecycleErrorMessage(
        error,
        ProjectBuildLifecycleErrorAction.materialRequest,
        'en',
      ),
      ProjectBuildPageL10n.errorMaterialRequest.en,
    );
  });

  testWidgets('background refresh failure does not show generic snackbar', (
    tester,
  ) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.inProgress),
      repository: _AlwaysFailingBuildRepository(),
      viewport: const Size(1024, 900),
    );

    expect(find.text('Request failed'), findsNothing);
    expect(find.text('Unable to load checklist'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
  });

  testWidgets('desktop snackbar is bounded and does not overflow', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) {
            return Scaffold(
              body: Center(
                child: ElevatedButton(
                  onPressed: () => showErrorSnackBar(
                    context,
                    const ApiException(message: 'Pause failed'),
                    message: 'Couldn’t pause this build.',
                  ),
                  child: const Text('show'),
                ),
              ),
            );
          },
        ),
      ),
    );
    tester.view.physicalSize = const Size(1200, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);

    await tester.tap(find.text('show'));
    await tester.pumpAndSettle();

    final snackBar = tester.widget<SnackBar>(find.byType(SnackBar));
    expect(snackBar.width, 420);
    expect(snackBar.behavior, SnackBarBehavior.floating);
  });

  testWidgets('Arabic labels render correctly', (tester) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.paused),
      locale: const Locale('ar'),
      viewport: const Size(1024, 900),
    );

    expect(find.byType(AppBackAction), findsOneWidget);
    expect(find.text('مشاريعي'), findsOneWidget);
    expect(find.text('إجراءات المشروع'), findsOneWidget);
    expect(find.text('متوقف مؤقتًا'), findsOneWidget);
    expect(find.text('يتم حفظ تقدمك تلقائيًا.'), findsOneWidget);
  });

  testWidgets('RTL action row does not overflow horizontally', (tester) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.inProgress),
      locale: const Locale('ar'),
      viewport: const Size(390, 844),
    );

    expect(tester.takeException(), isNull);
    expect(find.byType(OverflowBar), findsNothing);
  });

  testWidgets('successful complete build action triggers project celebration', (
    tester,
  ) async {
    final inProgress = _buildWithLastStepRemaining();
    final completed = _buildCompletedFrom(inProgress);
    final repository = _CompletingBuildRepository(inProgress, completed);

    await _pumpBuildPage(
      tester,
      build: inProgress,
      repository: repository,
      sessionBundle: _sampleSessionBundle(),
      viewport: const Size(1024, 900),
    );

    await tester.scrollUntilVisible(
      find.text('I finished this step'),
      400,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('I finished this step'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();

    expect(find.text('Project completed!'), findsOneWidget);
    expect(find.text('Review completed project'), findsOneWidget);
    expect(find.text('Great work — learning check completed!'), findsNothing);
    expect(find.byType(AlertDialog), findsOneWidget);
  });

  testWidgets('failed complete build does not trigger congratulations', (
    tester,
  ) async {
    await _pumpBuildPage(
      tester,
      build: _buildWithLastStepRemaining(),
      repository: _FailingCompleteBuildRepository(),
      sessionBundle: _sampleSessionBundle(),
      viewport: const Size(1024, 900),
    );

    await tester.scrollUntilVisible(
      find.text('I finished this step'),
      400,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('I finished this step'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();

    expect(find.text('Project completed!'), findsNothing);
    expect(find.byType(AlertDialog), findsNothing);
  });

  testWidgets('completed page does not dump question rows inline', (
    tester,
  ) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.completed),
      sessionBundle: _sampleSessionBundle(),
      viewport: const Size(1024, 900),
    );

    expect(find.text('What is the first step?'), findsNothing);
    expect(find.text('Review answers'), findsWidgets);
  });

  testWidgets('project celebration does not show final check celebration', (
    tester,
  ) async {
    final inProgress = _buildWithLastStepRemaining();
    final completed = _buildCompletedFrom(inProgress);
    final repository = _CompletingBuildRepository(inProgress, completed);

    await _pumpBuildPage(
      tester,
      build: inProgress,
      repository: repository,
      sessionBundle: _sampleSessionBundle(),
      viewport: const Size(1024, 900),
    );

    await tester.scrollUntilVisible(
      find.text('I finished this step'),
      400,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('I finished this step'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();

    expect(find.text('Project completed!'), findsOneWidget);
    expect(find.text('Great work — learning check completed!'), findsNothing);
  });

  testWidgets('already completed build does not replay celebration dialog', (
    tester,
  ) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(
        status: ProjectBuildStatus.completed,
        completedAt: DateTime(2026, 1, 15),
      ),
      sessionBundle: _sampleSessionBundle(),
      viewport: const Size(1024, 900),
    );
    await tester.pumpAndSettle();

    expect(find.text('Project completed!'), findsNothing);
    expect(find.byType(AlertDialog), findsNothing);
  });

  testWidgets('COMPLETED build renders completed-review header', (
    tester,
  ) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(
        status: ProjectBuildStatus.completed,
        completedAt: DateTime(2026, 1, 15),
        stepsCompleted: 2,
      ),
      sessionBundle: _sampleSessionBundle(),
      viewport: const Size(1024, 900),
    );

    expect(find.text('Completed'), findsOneWidget);
    expect(
      find.textContaining('You finished the practical build'),
      findsOneWidget,
    );
    expect(find.text('Pause build'), findsNothing);
    expect(find.text('Complete step'), findsNothing);
    expect(find.text('I finished this step'), findsNothing);
  });

  testWidgets('ARCHIVED build hides mutation controls in review mode', (
    tester,
  ) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.archived),
      sessionBundle: _sampleSessionBundle(),
      viewport: const Size(1024, 900),
    );

    expect(find.text('Pause build'), findsNothing);
    expect(find.text('Resume build'), findsNothing);
  });

  test('learnerPortfolioRoute is the canonical private portfolio path', () {
    expect(learnerPortfolioRoute, '/learner/portfolio');
    expect(learnerPortfolioRoute, isNot('/portfolio'));
  });

  testWidgets('View achievement portfolio resolves to registered route', (
    tester,
  ) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.completed),
      sessionBundle: _sampleSessionBundle(),
      viewport: const Size(1024, 900),
    );

    expect(
      find.widgetWithText(FilledButton, 'View achievement portfolio'),
      findsOneWidget,
    );
    expect(find.text('View achievement portfolio'), findsOneWidget);
  });

  testWidgets('mobile completed review keeps sections collapsed initially', (
    tester,
  ) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.completed),
      sessionBundle: _sampleSessionBundle(),
      viewport: const Size(390, 844),
    );

    expect(find.text('Learning journey'), findsWidgets);
    expect(find.text('Start check'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('check review shows skipped and incorrect labels', (
    tester,
  ) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.completed),
      sessionBundle: _sampleSessionBundle(),
      viewport: const Size(1024, 900),
    );

    await tester.scrollUntilVisible(
      find.text('Review answers').first,
      500,
      scrollable: find.byType(Scrollable).last,
    );
    await tester.tap(find.text('Review answers').first);
    await tester.pumpAndSettle();

    expect(find.text('Skipped for now'), findsOneWidget);
    expect(find.text('Your answer needs review'), findsOneWidget);
    expect(find.textContaining('%'), findsNothing);
    expect(find.textContaining('pass'), findsNothing);
  });

  testWidgets('Arabic completed review renders RTL labels', (tester) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(
        status: ProjectBuildStatus.completed,
        stepsCompleted: 2,
      ),
      sessionBundle: _sampleSessionBundleWithRemainingFinal(),
      locale: const Locale('ar'),
      viewport: const Size(1024, 3000),
    );

    expect(find.text('مكتملة'), findsOneWidget);
    expect(find.text('متابعة التحقق النهائي'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'COMPLETED build with remaining final shows Continue final check',
    (tester) async {
      await _pumpBuildPage(
        tester,
        build: _sampleBuild(
          status: ProjectBuildStatus.completed,
          stepsCompleted: 2,
        ),
        sessionBundle: _sampleSessionBundleWithRemainingFinal(),
        viewport: const Size(1024, 3000),
      );

      expect(find.text('Continue final check'), findsOneWidget);
      expect(find.text('Start final check'), findsNothing);
    },
  );

  testWidgets('pressing Continue final check opens existing Final Check UI', (
    tester,
  ) async {
    final completedAt = DateTime(2026, 1, 15, 12);
    final build = _sampleBuild(
      status: ProjectBuildStatus.completed,
      completedAt: completedAt,
      stepsCompleted: 2,
    );
    final repository = _FinalCheckRepository(build);

    await _pumpBuildPage(
      tester,
      build: build,
      repository: repository,
      sessionBundle: _sampleSessionBundleWithRemainingFinal(),
      viewport: const Size(1024, 3000),
    );

    await _openContinueFinalCheck(tester);

    expect(find.byType(FinalLearningCheckSheet), findsOneWidget);
    expect(repository.fetchFinalCheckCalls, 1);
  });

  testWidgets('final answer after completion keeps build completed', (
    tester,
  ) async {
    final completedAt = DateTime(2026, 1, 15, 12);
    const completionStory = ProjectBuildCompletionStory(
      reflection: 'Built a sturdy stand.',
      caption: 'My plant stand',
      updatedAt: null,
    );
    final build = ProjectBuild(
      id: 'build-1',
      projectId: 'project-1',
      status: ProjectBuildStatus.completed,
      completedAt: completedAt,
      completionStory: completionStory,
      project: const ProjectBuildProject(
        id: 'project-1',
        title: 'PVC Plant Stand',
        shortDescription: 'A simple plant stand build',
      ),
      progress: const ProjectBuildProgress(total: 2, ready: 1, percent: 50),
      materialReadiness: const ProjectBuildMaterialReadiness(
        ready: 1,
        linked: 1,
        reserved: 0,
        missing: 1,
        total: 2,
      ),
      stepProgress: const ProjectBuildStepProgress(
        completed: 2,
        total: 2,
        percent: 100,
        nextAction: ProjectBuildNextAction.buildCompleted,
        steps: [],
      ),
      items: const [],
    );
    final sessionHolder = _SessionBundleHolder(
      _sampleSessionBundleWithRemainingFinal(),
    );
    final repository = _InteractiveFinalCheckRepository(build, sessionHolder);

    final router = await _pumpBuildPage(
      tester,
      build: build,
      repository: repository,
      sessionHolder: sessionHolder,
      viewport: const Size(1024, 3000),
    );

    await _openContinueFinalCheck(tester);
    await tester.tap(find.text('Planning'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Submit answer'));
    await tester.pumpAndSettle();

    expect(repository.submitCalls, 1);
    final updatedBuild = await repository.fetchMyBuild('project-1');
    expect(updatedBuild?.status, ProjectBuildStatus.completed);
    expect(updatedBuild?.completedAt, completedAt);
    expect(updatedBuild?.completionStory, completionStory);

    await tester.tap(find.text('Finish check'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('View learning summary'));
    await tester.pumpAndSettle();

    expect(
      router.routerDelegate.currentConfiguration.uri.path,
      '/learning/project-1/build',
    );
    expect(find.text('Continue final check'), findsNothing);
    expect(find.text('Great work — learning check completed!'), findsNothing);
    expect(find.text('Project completed!'), findsNothing);
  });

  testWidgets('completed check review keeps start and step groups read-only', (
    tester,
  ) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(status: ProjectBuildStatus.completed),
      sessionBundle: _sampleSessionBundle(),
      viewport: const Size(1024, 1400),
    );

    await tester.scrollUntilVisible(
      find.text('Review answers').first,
      400,
      scrollable: find.byType(Scrollable).last,
    );
    await tester.tap(find.text('Review answers').first);
    await tester.pumpAndSettle();

    expect(find.text('Submit answer'), findsNothing);
    expect(find.text('Show hint'), findsNothing);
    expect(find.text('Skip for now'), findsNothing);
    expect(find.text('Try again'), findsNothing);
  });

  testWidgets('finished final check shows Review final check action', (
    tester,
  ) async {
    await _pumpBuildPage(
      tester,
      build: _sampleBuild(
        status: ProjectBuildStatus.completed,
        stepsCompleted: 2,
      ),
      sessionBundle: _sampleSessionBundleWithCompletedFinal(),
      viewport: const Size(1024, 1400),
    );

    expect(find.text('Review final check'), findsOneWidget);
    expect(find.text('Continue final check'), findsNothing);
  });

  testWidgets(
    'ARCHIVED build shows review only without final mutation action',
    (tester) async {
      await _pumpBuildPage(
        tester,
        build: _sampleBuild(status: ProjectBuildStatus.archived),
        sessionBundle: _sampleSessionBundleWithRemainingFinal(),
        viewport: const Size(1024, 1400),
      );

      expect(find.text('Review final check'), findsOneWidget);
      expect(find.text('Continue final check'), findsNothing);
      expect(find.text('Start final check'), findsNothing);
    },
  );

  testWidgets('mobile completed review final action has no overflow', (
    tester,
  ) async {
    final build = _sampleBuild(
      status: ProjectBuildStatus.completed,
      stepsCompleted: 2,
    );
    final sessionBundle = _sampleSessionBundleWithRemainingFinal();

    await _pumpBuildPage(
      tester,
      build: build,
      sessionBundle: sessionBundle,
      viewport: const Size(390, 844),
    );

    expect(find.text('Check review'), findsOneWidget);
    expect(find.text('Continue final check'), findsNothing);

    final ui = resolveCompletedReviewFinalCheckUi(
      buildRecord: build,
      session: sessionBundle.session,
      learningSetup: sessionBundle.learningSetup,
    );
    expect(ui.actionLabel, FinalLearningCheckL10n.continueCheck);
    expect(tester.takeException(), isNull);
  });
}

Future<void> _scrollToContinueFinalCheck(WidgetTester tester) async {
  final button = find.ancestor(
    of: find.text('Continue final check'),
    matching: find.byType(FilledButton),
  );
  await tester.scrollUntilVisible(
    button,
    200,
    scrollable: find.byType(Scrollable).first,
  );
}

Future<void> _tapBuildActionsMenu(WidgetTester tester) async {
  final target = find.bySemanticsLabel('Build actions').first;
  await tester.ensureVisible(target);
  await tester.tap(target);
  await tester.pumpAndSettle();
}

Future<void> _openContinueFinalCheck(WidgetTester tester) async {
  await _scrollToContinueFinalCheck(tester);
  final button = find.ancestor(
    of: find.text('Continue final check'),
    matching: find.byType(FilledButton),
  );
  final widget = tester.widget<FilledButton>(button);
  expect(widget.onPressed, isNotNull);
  widget.onPressed!.call();
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 300));
}

Future<GoRouter> _pumpBuildPage(
  WidgetTester tester, {
  required ProjectBuild build,
  Locale locale = const Locale('en'),
  Size viewport = const Size(1024, 900),
  LearnerBuildsApi? learnerBuildsApi,
  LearningProjectRepository? repository,
  LearningSessionBundle? sessionBundle,
  _SessionBundleHolder? sessionHolder,
  List<GoRoute> extraRoutes = const [],
}) async {
  tester.view.physicalSize = viewport;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);

  final router = GoRouter(
    initialLocation: '/learning/project-1/build',
    routes: [
      GoRoute(
        path: '/learning/:id',
        builder: (context, state) =>
            Scaffold(body: Text('project ${state.pathParameters['id']}')),
      ),
      GoRoute(
        path: '/learning/:id/build',
        builder: (context, state) =>
            LearningProjectBuildPage(projectId: state.pathParameters['id']!),
      ),
      ...extraRoutes,
    ],
  );

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authControllerProvider.overrideWith(_TestAuthController.new),
        learningHubRepositoryProvider.overrideWithValue(
          repository ?? _StaticBuildRepository(build),
        ),
        learnerBuildsApiProvider.overrideWithValue(
          learnerBuildsApi ?? _NoopLearnerBuildsApi(build),
        ),
        myNotificationUnreadCountProvider.overrideWith(
          () => _ZeroUnreadCount(),
        ),
        learnerPortfolioProvider.overrideWith(
          (ref) async => const LearnerBuildListResult(
            items: [],
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
          ),
        ),
        if (sessionHolder != null)
          buildLearningSessionProvider(
            'project-1',
          ).overrideWith((ref) async => sessionHolder.bundle)
        else if (sessionBundle != null)
          buildLearningSessionProvider(
            'project-1',
          ).overrideWith((ref) async => sessionBundle),
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

ProjectBuild _buildAtFirstPracticalStep() {
  return ProjectBuild(
    id: 'build-1',
    projectId: 'project-1',
    status: ProjectBuildStatus.inProgress,
    project: const ProjectBuildProject(
      id: 'project-1',
      title: 'PVC Plant Stand',
      shortDescription: 'A simple plant stand build',
    ),
    progress: const ProjectBuildProgress(total: 2, ready: 2, percent: 100),
    materialReadiness: const ProjectBuildMaterialReadiness(
      ready: 2,
      linked: 2,
      reserved: 0,
      missing: 0,
      total: 2,
    ),
    stepProgress: const ProjectBuildStepProgress(
      completed: 0,
      total: 2,
      percent: 0,
      currentStep: ProjectBuildCurrentStep(
        stepId: 'step-1',
        stepNumber: 1,
        title: 'Cut PVC',
      ),
      steps: [
        ProjectBuildStepView(
          stepId: 'step-1',
          stepNumber: 1,
          title: 'Cut PVC',
          description: 'Cut the PVC pipes.',
          state: ProjectBuildStepState.current,
        ),
        ProjectBuildStepView(
          stepId: 'step-2',
          stepNumber: 2,
          title: 'Final assembly',
          description: 'Assemble the stand.',
          state: ProjectBuildStepState.locked,
        ),
      ],
    ),
    items: const [],
    learningSetup: const ProjectBuildLearningSetup(
      status: LearningSetupStatus.ready,
      sessionId: 'session-1',
    ),
  );
}

ProjectBuild _buildWithLastStepRemaining() {
  return ProjectBuild(
    id: 'build-1',
    projectId: 'project-1',
    status: ProjectBuildStatus.inProgress,
    project: const ProjectBuildProject(
      id: 'project-1',
      title: 'PVC Plant Stand',
      shortDescription: 'A simple plant stand build',
    ),
    progress: const ProjectBuildProgress(total: 2, ready: 2, percent: 100),
    materialReadiness: const ProjectBuildMaterialReadiness(
      ready: 2,
      linked: 2,
      reserved: 0,
      missing: 0,
      total: 2,
    ),
    stepProgress: ProjectBuildStepProgress(
      completed: 1,
      total: 2,
      percent: 50,
      currentStep: const ProjectBuildCurrentStep(
        stepId: 'step-2',
        stepNumber: 2,
        title: 'Final assembly',
      ),
      steps: const [
        ProjectBuildStepView(
          stepId: 'step-1',
          stepNumber: 1,
          title: 'Cut PVC',
          description: 'Cut the PVC pipes.',
          state: ProjectBuildStepState.completed,
        ),
        ProjectBuildStepView(
          stepId: 'step-2',
          stepNumber: 2,
          title: 'Final assembly',
          description: 'Assemble the stand.',
          state: ProjectBuildStepState.current,
        ),
      ],
    ),
    items: const [],
    learningSetup: const ProjectBuildLearningSetup(
      status: LearningSetupStatus.ready,
      sessionId: 'session-1',
    ),
  );
}

ProjectBuild _buildCompletedFrom(ProjectBuild source) {
  return ProjectBuild(
    id: source.id,
    projectId: source.projectId,
    status: ProjectBuildStatus.completed,
    completedAt: DateTime(2026, 1, 15),
    project: source.project,
    progress: source.progress,
    materialReadiness: source.materialReadiness,
    stepProgress: ProjectBuildStepProgress(
      completed: 2,
      total: 2,
      percent: 100,
      steps: const [
        ProjectBuildStepView(
          stepId: 'step-1',
          stepNumber: 1,
          title: 'Cut PVC',
          description: 'Cut the PVC pipes.',
          state: ProjectBuildStepState.completed,
        ),
        ProjectBuildStepView(
          stepId: 'step-2',
          stepNumber: 2,
          title: 'Final assembly',
          description: 'Assemble the stand.',
          state: ProjectBuildStepState.completed,
        ),
      ],
    ),
    items: source.items,
    learningSetup: source.learningSetup,
  );
}

ProjectBuild _sampleBuild({
  ProjectBuildStatus status = ProjectBuildStatus.inProgress,
  DateTime? completedAt,
  int stepsCompleted = 0,
}) {
  final totalSteps = 2;
  return ProjectBuild(
    id: 'build-1',
    projectId: 'project-1',
    status: status,
    completedAt: completedAt,
    project: const ProjectBuildProject(
      id: 'project-1',
      title: 'PVC Plant Stand',
      shortDescription: 'A simple plant stand build',
    ),
    progress: const ProjectBuildProgress(total: 2, ready: 1, percent: 50),
    materialReadiness: const ProjectBuildMaterialReadiness(
      ready: 1,
      linked: 1,
      reserved: 0,
      missing: 1,
      total: 2,
    ),
    stepProgress: ProjectBuildStepProgress(
      completed: stepsCompleted,
      total: totalSteps,
      percent: stepsCompleted == 0 ? 0 : 100,
      steps: const [],
    ),
    items: const [],
  );
}

LearningSessionBundle _sampleSessionBundle() {
  const question = LearningQuestion(
    id: 'q-1',
    stage: 'START',
    questionType: 'MULTIPLE_CHOICE',
    promptEn: 'What is the first step?',
    promptAr: 'ما الخطوة الأولى؟',
    explanationEn: 'Review the plan first.',
    explanationAr: 'راجع الخطة أولًا.',
    hintEn: 'hint',
    hintAr: 'تلميح',
    options: [
      LearningQuestionOption(
        optionKey: 'a',
        textEn: 'Plan',
        textAr: 'خطة',
        displayOrder: 1,
      ),
      LearningQuestionOption(
        optionKey: 'b',
        textEn: 'Skip',
        textAr: 'تخطي',
        displayOrder: 2,
      ),
    ],
  );

  return LearningSessionBundle(
    session: BuildLearningSession(
      id: 'session-1',
      buildId: 'build-1',
      packId: 'pack-1',
      learningGoal: 'Understand plant stand basics',
      confidenceBefore: 2,
      confidenceAfter: 4,
      goalOutcome: LearningGoalOutcome.partiallyAchieved,
      assignments: [
        LearningAssignment(
          id: 'assign-start-skipped',
          stage: 'START',
          status: LearningAssignmentStatus.skipped,
          displayOrder: 1,
          question: question,
          answerAttempts: const [],
        ),
        LearningAssignment(
          id: 'assign-start-wrong',
          stage: 'START',
          status: LearningAssignmentStatus.answered,
          displayOrder: 2,
          question: question,
          answerAttempts: [
            LearningAnswerAttempt(
              id: 'attempt-1',
              attemptNumber: 1,
              selectedOptionKey: 'b',
              isCorrect: false,
              submittedAt: DateTime(2026, 1, 15),
            ),
          ],
          reviewCorrectOptionKey: 'a',
        ),
      ],
    ),
    learningSetup: const ProjectBuildLearningSetup(
      status: LearningSetupStatus.ready,
      sessionId: 'session-1',
    ),
  );
}

LearningQuestion _sampleFinalQuestion() {
  return const LearningQuestion(
    id: 'q-final',
    stage: 'FINAL',
    questionType: 'MULTIPLE_CHOICE',
    promptEn: 'What did you learn most?',
    promptAr: 'ما الذي تعلمته أكثر؟',
    explanationEn: 'Reflect on the core idea.',
    explanationAr: 'فكّر في الفكرة الأساسية.',
    hintEn: 'hint',
    hintAr: 'تلميح',
    options: [
      LearningQuestionOption(
        optionKey: 'a',
        textEn: 'Planning',
        textAr: 'التخطيط',
        displayOrder: 1,
      ),
      LearningQuestionOption(
        optionKey: 'b',
        textEn: 'Assembly',
        textAr: 'التجميع',
        displayOrder: 2,
      ),
    ],
  );
}

LearningSessionBundle _sampleSessionBundleWithRemainingFinal() {
  final question = _sampleFinalQuestion();
  return LearningSessionBundle(
    session: BuildLearningSession(
      id: 'session-1',
      buildId: 'build-1',
      packId: 'pack-1',
      assignments: [
        LearningAssignment(
          id: 'assign-final-done',
          stage: 'FINAL',
          status: LearningAssignmentStatus.answered,
          displayOrder: 1,
          question: question,
          answerAttempts: [
            LearningAnswerAttempt(
              id: 'attempt-final-1',
              attemptNumber: 1,
              selectedOptionKey: 'a',
              isCorrect: true,
              submittedAt: DateTime(2026, 1, 15),
            ),
          ],
        ),
        LearningAssignment(
          id: 'assign-final-open',
          stage: 'FINAL',
          status: LearningAssignmentStatus.notAttempted,
          displayOrder: 2,
          question: question,
          answerAttempts: const [],
        ),
      ],
    ),
    learningSetup: const ProjectBuildLearningSetup(
      status: LearningSetupStatus.ready,
      sessionId: 'session-1',
    ),
  );
}

LearningSessionBundle _sampleSessionBundleWithCompletedFinal() {
  final question = _sampleFinalQuestion();
  return LearningSessionBundle(
    session: BuildLearningSession(
      id: 'session-1',
      buildId: 'build-1',
      packId: 'pack-1',
      assignments: [
        LearningAssignment(
          id: 'assign-final-done',
          stage: 'FINAL',
          status: LearningAssignmentStatus.answered,
          displayOrder: 1,
          question: question,
          answerAttempts: [
            LearningAnswerAttempt(
              id: 'attempt-final-1',
              attemptNumber: 1,
              selectedOptionKey: 'a',
              isCorrect: true,
              submittedAt: DateTime(2026, 1, 15),
            ),
          ],
        ),
      ],
    ),
    learningSetup: const ProjectBuildLearningSetup(
      status: LearningSetupStatus.ready,
      sessionId: 'session-1',
    ),
  );
}

FinalLearningCheck _sampleFinalLearningCheck({bool readOnly = false}) {
  final question = _sampleFinalQuestion();
  return FinalLearningCheck(
    available: true,
    isReadOnly: readOnly,
    progress: const LearningCheckProgress(
      total: 1,
      answered: 0,
      correct: 0,
      skipped: 0,
      remaining: 1,
      handled: 0,
    ),
    assignments: [
      FinalLearningAssignment(
        assignmentId: 'assign-final-open',
        questionId: question.id,
        stage: 'FINAL',
        questionType: 'MULTIPLE_CHOICE',
        displayOrder: 2,
        status: LearningAssignmentStatus.notAttempted,
        uiState: StepLearningCheckUiState.notAttempted,
        attemptCount: 0,
        hintViewed: false,
        mayRetry: !readOnly,
        isReadOnly: readOnly,
        question: question,
        answerAttempts: const [],
        hasCorrectAttempt: false,
      ),
    ],
  );
}

class _SessionBundleHolder {
  _SessionBundleHolder(this.bundle);

  LearningSessionBundle bundle;
}

class _FinalCheckRepository extends _StaticBuildRepository {
  _FinalCheckRepository(super.build);

  int fetchFinalCheckCalls = 0;

  @override
  Future<FinalLearningCheck> fetchFinalLearningCheck(String projectId) async {
    fetchFinalCheckCalls += 1;
    return _sampleFinalLearningCheck();
  }
}

class _InteractiveFinalCheckRepository extends _FinalCheckRepository {
  _InteractiveFinalCheckRepository(super.build, this._sessionHolder);

  final _SessionBundleHolder _sessionHolder;
  int submitCalls = 0;

  @override
  Future<LearningSessionBundle> fetchLearningSession(String projectId) async {
    return _sessionHolder.bundle;
  }

  @override
  Future<FinalLearningCheckAnswerSubmission> submitFinalLearningCheckAnswer(
    String projectId,
    String assignmentId, {
    required String selectedOptionKey,
  }) async {
    submitCalls += 1;
    final question = _sampleFinalQuestion();
    final attempt = LearningAnswerAttempt(
      id: 'attempt-final-2',
      attemptNumber: 1,
      selectedOptionKey: selectedOptionKey,
      isCorrect: true,
      submittedAt: DateTime(2026, 1, 16),
    );
    final updatedAssignment = FinalLearningAssignment(
      assignmentId: 'assign-final-open',
      questionId: question.id,
      stage: 'FINAL',
      questionType: 'MULTIPLE_CHOICE',
      displayOrder: 2,
      status: LearningAssignmentStatus.answered,
      uiState: StepLearningCheckUiState.correct,
      attemptCount: 1,
      hintViewed: false,
      mayRetry: true,
      isReadOnly: false,
      question: question,
      answerAttempts: [attempt],
      hasCorrectAttempt: true,
      latestSelectedOptionKey: selectedOptionKey,
      correctOptionKey: 'a',
      latestResult: const StepLearningCheckResult(
        selectedOptionKey: 'a',
        isCorrect: true,
        attemptNumber: 1,
        explanationEn: 'Reflect on the core idea.',
        explanationAr: 'فكّر في الفكرة الأساسية.',
        correctOptionKey: 'a',
        mayRetry: false,
      ),
    );
    _sessionHolder.bundle = _sampleSessionBundleWithCompletedFinal();
    return FinalLearningCheckAnswerSubmission(
      assignment: updatedAssignment,
      attempt: attempt,
      progress: const LearningCheckProgress(
        total: 1,
        answered: 1,
        correct: 1,
        skipped: 0,
        remaining: 0,
        handled: 1,
      ),
    );
  }
}

class _TestAuthController extends AuthController {
  @override
  AuthState build() {
    return AuthState(
      user: User(
        id: 'learner-1',
        email: 'learner@example.com',
        displayName: 'Learner',
        accountStatus: 'ACTIVE',
        activeRole: 'LEARNER',
        roles: const ['LEARNER'],
        createdAt: DateTime(2026),
      ),
      accessToken: 'token',
      hasBootstrapped: true,
    );
  }
}

class _CompletingBuildRepository implements LearningProjectRepository {
  _CompletingBuildRepository(ProjectBuild inProgress, ProjectBuild completed)
    : _completed = completed,
      _current = inProgress;

  final ProjectBuild _completed;
  ProjectBuild _current;

  @override
  Future<ProjectBuild?> fetchMyBuild(String projectId) async => _current;

  @override
  Future<ProjectBuild> completeBuildStep(
    String projectId,
    String stepId,
  ) async {
    _current = _completed;
    return _completed;
  }

  @override
  Future<StepLearningCheck?> fetchStepLearningCheck(
    String projectId,
    String stepId,
  ) async => null;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _FailingCompleteBuildRepository implements LearningProjectRepository {
  _FailingCompleteBuildRepository();

  @override
  Future<ProjectBuild?> fetchMyBuild(String projectId) async =>
      _buildWithLastStepRemaining();

  @override
  Future<ProjectBuild> completeBuildStep(
    String projectId,
    String stepId,
  ) async {
    throw const ApiException(message: 'Complete failed', code: 'UNKNOWN');
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _StaticBuildRepository implements LearningProjectRepository {
  const _StaticBuildRepository(this.build);

  final ProjectBuild build;

  @override
  Future<ProjectBuild?> fetchMyBuild(String projectId) async => build;

  @override
  Future<StepLearningCheck?> fetchStepLearningCheck(
    String projectId,
    String stepId,
  ) async => null;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _AlwaysFailingBuildRepository implements LearningProjectRepository {
  @override
  Future<ProjectBuild?> fetchMyBuild(String projectId) async {
    throw const ApiException(message: 'Request failed', code: 'UNKNOWN');
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _NoopLearnerBuildsApi implements LearnerBuildsApi {
  _NoopLearnerBuildsApi(this.build);

  final ProjectBuild build;

  @override
  Future<ProjectBuild> pauseBuild(String buildId) async =>
      build.copyWith(status: ProjectBuildStatus.paused);

  @override
  Future<ProjectBuild> resumeBuild(String buildId) async =>
      build.copyWith(status: ProjectBuildStatus.inProgress);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _UpdatingBuildRepository implements LearningProjectRepository {
  _UpdatingBuildRepository(this._current, {required this.paused, this.resumed});

  ProjectBuild _current;
  final ProjectBuild paused;
  final ProjectBuild? resumed;

  void markPaused() {
    _current = paused;
  }

  void markResumed() {
    if (resumed != null) {
      _current = resumed!;
    }
  }

  @override
  Future<ProjectBuild?> fetchMyBuild(String projectId) async => _current;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _RecordingLearnerBuildsApi implements LearnerBuildsApi {
  _RecordingLearnerBuildsApi({
    required this.paused,
    this.resumed,
    this.repository,
  });

  final ProjectBuild paused;
  final ProjectBuild? resumed;
  final _UpdatingBuildRepository? repository;
  int pauseCalls = 0;
  int resumeCalls = 0;

  @override
  Future<ProjectBuild> pauseBuild(String buildId) async {
    pauseCalls += 1;
    repository?.markPaused();
    return paused;
  }

  @override
  Future<ProjectBuild> resumeBuild(String buildId) async {
    resumeCalls += 1;
    repository?.markResumed();
    return resumed ?? paused.copyWith(status: ProjectBuildStatus.inProgress);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _FailingLearnerBuildsApi implements LearnerBuildsApi {
  _FailingLearnerBuildsApi({this.onPause, this.onResume, this.onArchive});

  final Future<ProjectBuild> Function()? onPause;
  final Future<ProjectBuild> Function()? onResume;
  final Future<ProjectBuild> Function()? onArchive;

  @override
  Future<ProjectBuild> pauseBuild(String buildId) {
    return onPause?.call() ??
        Future.error(const ApiException(message: 'Request failed'));
  }

  @override
  Future<ProjectBuild> resumeBuild(String buildId) {
    return onResume?.call() ??
        Future.error(const ApiException(message: 'Request failed'));
  }

  @override
  Future<ProjectBuild> archiveBuild(String buildId) {
    return onArchive?.call() ??
        Future.error(const ApiException(message: 'Request failed'));
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _ZeroUnreadCount extends NotificationUnreadCountNotifier {
  @override
  Future<int> build() async => 0;
}

extension on ProjectBuild {
  ProjectBuild copyWith({ProjectBuildStatus? status}) {
    return ProjectBuild(
      id: id,
      projectId: projectId,
      status: status ?? this.status,
      project: project,
      progress: progress,
      materialReadiness: materialReadiness,
      stepProgress: stepProgress,
      items: items,
      isReadOnly: isReadOnly,
    );
  }
}
