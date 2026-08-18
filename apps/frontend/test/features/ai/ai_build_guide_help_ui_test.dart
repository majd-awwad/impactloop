import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/features/ai/domain/ai_models.dart';
import 'package:frontend/features/ai/presentation/l10n/ai_l10n.dart';
import 'package:frontend/features/ai/presentation/widgets/ai_assistant_shell.dart';
import 'package:frontend/features/ai/presentation/widgets/ai_content_blocks.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';

void main() {
  Widget buildHarness(Widget child, {Locale locale = const Locale('ar')}) {
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => Scaffold(body: child),
        ),
      ],
    );

    return ProviderScope(
      child: MaterialApp.router(
        locale: locale,
        supportedLocales: const [Locale('en'), Locale('ar')],
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        routerConfig: router,
      ),
    );
  }

  BuildGuideContext plantStandBannerContext() {
    return const BuildGuideContext(
      buildId: 'build-plant',
      projectId: 'project-plant',
      projectTitle: 'PVC Plant Stand',
      buildStatus: ProjectBuildStatus.inProgress,
      materialReadiness: ProjectBuildMaterialReadiness(
        ready: 4,
        linked: 4,
        reserved: 0,
        missing: 0,
        total: 4,
      ),
      stepProgress: ProjectBuildStepProgressSummary(
        completed: 1,
        total: 4,
        percent: 25,
      ),
      currentStep: ProjectBuildCurrentStep(
        stepId: 'step-2',
        stepNumber: 2,
        title: 'Prepare the main parts',
      ),
    );
  }

  testWidgets('Arabic build banner localizes chrome and keeps English titles', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      buildHarness(
        SizedBox(
          width: 360,
          child: AiBuildGuideContextBanner(
            buildContext: plantStandBannerContext(),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('PVC Plant Stand'), findsOneWidget);
    expect(find.text('المواد: 4 من 4 جاهزة'), findsOneWidget);
    expect(find.text('الخطوة 2: Prepare the main parts'), findsOneWidget);
    expect(find.textContaining('Materials:'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Arabic timeout error is localized and never shows English raw text', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final block = AiContentBlock.fromJson({
      'type': 'error',
      'code': 'AI_PROVIDER_TIMEOUT',
      'message': 'The learning assistant timed out. Please try again.',
      'retryable': true,
    });

    await tester.pumpWidget(
      buildHarness(
        SizedBox(
          width: 360,
          child: AiContentBlockView(
            block: block,
            messageBlocks: [block],
            blockIndex: 0,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.text('استغرق المساعد وقتًا أطول من المتوقع. حاول مرة أخرى.'),
      findsOneWidget,
    );
    expect(find.textContaining('The learning assistant timed out'), findsNothing);
    expect(find.text(AiL10n.proposalGenerationTimeout.ar), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('step card separates completed count from current step and avoids %25', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final block = AiContentBlock.fromJson({
      'type': 'build_step_guide',
      'projectBuildId': 'build-plant',
      'projectId': 'project-plant',
      'projectTitle': 'PVC Plant Stand',
      'projectStepId': 'step-2',
      'stepNumber': 2,
      'totalSteps': 4,
      'title': 'Prepare the main parts',
      'description': 'Measure, clean, cut, or sort the reusable materials.',
      'progressPercent': 25,
      'completedSteps': 1,
    });

    await tester.pumpWidget(
      buildHarness(
        SizedBox(
          width: 360,
          child: AiContentBlockView(
            block: block,
            messageBlocks: [block],
            blockIndex: 0,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('الخطوة الحالية: 2 من 4'), findsOneWidget);
    expect(find.text('أنجزت 1 من 4 خطوات · 25%'), findsOneWidget);
    expect(find.textContaining('التقدم: 1 من 4'), findsNothing);
    expect(find.textContaining('%25'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
