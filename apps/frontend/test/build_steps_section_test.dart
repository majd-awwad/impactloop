import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/app/theme/app_theme.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/build_steps/build_step_compact_row.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/build_steps/build_step_current_card.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/build_steps/build_step_number_badge.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/build_steps/build_steps_section.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/build_journey/build_active_phase.dart';
import 'package:frontend/l10n/app_localizations.dart';

const _steps = [
  ProjectBuildStepView(
    stepId: 'step-1',
    stepNumber: 1,
    title: 'Plan and inspect materials',
    description: 'Review the component list and prepare a safe workspace.',
    state: ProjectBuildStepState.current,
  ),
  ProjectBuildStepView(
    stepId: 'step-2',
    stepNumber: 2,
    title: 'Prepare the main parts',
    description: 'Cut and organize the main parts before assembly.',
    state: ProjectBuildStepState.locked,
  ),
  ProjectBuildStepView(
    stepId: 'step-3',
    stepNumber: 3,
    title: 'Assemble and connect',
    description: 'Assemble the frame and connect the electronics.',
    state: ProjectBuildStepState.locked,
  ),
  ProjectBuildStepView(
    stepId: 'step-4',
    stepNumber: 4,
    title: 'Test and improve',
    description: 'Test the build and improve anything that is unstable.',
    state: ProjectBuildStepState.locked,
  ),
];

ProjectBuild _buildWithSteps({
  List<ProjectBuildStepView> steps = _steps,
  int completed = 0,
  ProjectBuildNextAction? nextAction =
      ProjectBuildNextAction.completeCurrentStep,
}) {
  return ProjectBuild(
    id: 'build-1',
    projectId: 'project-1',
    status: ProjectBuildStatus.inProgress,
    project: const ProjectBuildProject(
      id: 'project-1',
      title: 'Demo',
      shortDescription: 'Demo',
    ),
    progress: const ProjectBuildProgress(total: 1, ready: 1, percent: 100),
    materialReadiness: const ProjectBuildMaterialReadiness(
      ready: 1,
      linked: 1,
      reserved: 0,
      missing: 0,
      total: 1,
    ),
    stepProgress: ProjectBuildStepProgress(
      completed: completed,
      total: steps.length,
      percent: steps.isEmpty ? 0 : ((completed / steps.length) * 100).round(),
      nextAction: nextAction,
      currentStep: steps
          .where((step) => step.state == ProjectBuildStepState.current)
          .map(
            (step) => ProjectBuildCurrentStep(
              stepId: step.stepId,
              stepNumber: step.stepNumber,
              title: step.title,
            ),
          )
          .firstOrNull,
      steps: steps,
    ),
    items: const [],
  );
}

Widget _harness({
  required Widget child,
  Locale locale = const Locale('en'),
  Size? viewport,
}) {
  return MaterialApp(
    locale: locale,
    supportedLocales: const [Locale('en'), Locale('ar')],
    localizationsDelegates: const [
      AppLocalizations.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    theme: AppTheme.lightFor(locale.languageCode),
    home: MediaQuery(
      data: MediaQueryData(size: viewport ?? const Size(390, 844)),
      child: Scaffold(body: child),
    ),
  );
}

void main() {
  testWidgets('current step is expanded while locked steps stay compact', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(
      _harness(
        child: Align(
          alignment: Alignment.topCenter,
          child: BuildStepsSection(
            projectId: 'project-1',
            buildRecord: _buildWithSteps(),
            completingStepIds: const {},
            isEditingLocked: false,
            onCompleteCurrentStep: () {},
            onOpenStepCheck: (_) async {},
          ),
        ),
      ),
    );

    expect(find.text('Build steps'), findsOneWidget);
    expect(find.text('0/4'), findsOneWidget);
    expect(find.byType(BuildStepCurrentCard), findsOneWidget);
    expect(find.byType(BuildStepCompactRow), findsNWidgets(3));
    expect(find.text('I finished this step'), findsOneWidget);
    expect(
      find.text('Review the component list and prepare a safe workspace.'),
      findsOneWidget,
    );
    expect(
      find.text('Cut and organize the main parts before assembly.'),
      findsNothing,
    );
    expect(find.text('1. Plan and inspect materials'), findsNothing);
    expect(find.text('.1'), findsNothing);
    expect(tester.takeException(), isNull);
    expect(
      tester.getSize(find.byType(BuildStepsSection)).height,
      lessThan(620),
    );
  });

  testWidgets('locked step reveals description only after tap', (tester) async {
    await tester.pumpWidget(
      _harness(
        child: BuildStepsSection(
          projectId: 'project-1',
          buildRecord: _buildWithSteps(),
          completingStepIds: const {},
          isEditingLocked: false,
          onCompleteCurrentStep: () {},
          onOpenStepCheck: (_) async {},
        ),
      ),
    );

    expect(
      find.text('Cut and organize the main parts before assembly.'),
      findsNothing,
    );

    await tester.tap(find.text('Prepare the main parts'));
    await tester.pump();

    expect(
      find.text('Cut and organize the main parts before assembly.'),
      findsOneWidget,
    );
  });

  testWidgets('completed step stays compact until expanded', (tester) async {
    const completedSteps = [
      ProjectBuildStepView(
        stepId: 'step-1',
        stepNumber: 1,
        title: 'Plan and inspect materials',
        description: 'Review the component list and prepare a safe workspace.',
        state: ProjectBuildStepState.completed,
      ),
      ProjectBuildStepView(
        stepId: 'step-2',
        stepNumber: 2,
        title: 'Prepare the main parts',
        description: 'Cut and organize the main parts before assembly.',
        state: ProjectBuildStepState.current,
      ),
    ];

    await tester.pumpWidget(
      _harness(
        child: BuildStepsSection(
          projectId: 'project-1',
          buildRecord: _buildWithSteps(steps: completedSteps, completed: 1),
          completingStepIds: const {},
          isEditingLocked: false,
          onCompleteCurrentStep: () {},
          onOpenStepCheck: (_) async {},
        ),
      ),
    );

    expect(find.text('Done'), findsOneWidget);
    expect(find.text('Current'), findsOneWidget);
    expect(
      find.text('Review the component list and prepare a safe workspace.'),
      findsNothing,
    );
    expect(find.text('I finished this step'), findsOneWidget);
  });

  testWidgets('RTL keeps step numbers and English punctuation intact', (
    tester,
  ) async {
    await tester.pumpWidget(
      _harness(
        locale: const Locale('ar'),
        child: Directionality(
          textDirection: TextDirection.rtl,
          child: BuildStepsSection(
            projectId: 'project-1',
            buildRecord: _buildWithSteps(),
            completingStepIds: const {},
            isEditingLocked: false,
            onCompleteCurrentStep: () {},
            onOpenStepCheck: (_) async {},
          ),
        ),
      ),
    );

    expect(find.text('خطوات البناء'), findsOneWidget);
    expect(find.text('أنهيت هذه الخطوة'), findsOneWidget);
    expect(find.text('الحالية'), findsOneWidget);
    expect(find.text('لاحقًا'), findsWidgets);
    expect(find.text('1. Plan and inspect materials'), findsNothing);
    expect(find.text('.1'), findsNothing);
    expect(find.byType(BuildStepNumberBadge), findsNWidgets(4));

    final title = tester.widget<Text>(find.text('Plan and inspect materials'));
    expect(title.textDirection, TextDirection.ltr);

    final description = tester.widget<Text>(
      find.text('Review the component list and prepare a safe workspace.'),
    );
    expect(description.textDirection, TextDirection.ltr);
    expect(tester.takeException(), isNull);
  });

  testWidgets('complete step callback is preserved', (tester) async {
    var completed = false;

    await tester.pumpWidget(
      _harness(
        child: BuildStepsSection(
          projectId: 'project-1',
          buildRecord: _buildWithSteps(),
          completingStepIds: const {},
          isEditingLocked: false,
          onCompleteCurrentStep: () => completed = true,
          onOpenStepCheck: (_) async {},
        ),
      ),
    );

    await tester.tap(find.text('I finished this step'));
    expect(completed, isTrue);
  });

  testWidgets('long Arabic current-step copy does not overflow on a phone', (
    tester,
  ) async {
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

    const steps = [
      ProjectBuildStepView(
        stepId: 'step-1',
        stepNumber: 1,
        title:
            'جهّز مساحة العمل وراجع قائمة المواد الطويلة جداً قبل القص والتجميع',
        description:
            'اقرأ التعليمات كاملة، رتّب الأدوات، وتأكد أن كل مادة جاهزة للاستخدام قبل الانتقال للخطوة التالية حتى لا يتوقف العمل في منتصف البناء.',
        state: ProjectBuildStepState.current,
      ),
      ProjectBuildStepView(
        stepId: 'step-2',
        stepNumber: 2,
        title: 'قص القطع الرئيسية ورتّبها حسب ترتيب التجميع النهائي',
        description: 'خطوة مقفلة',
        state: ProjectBuildStepState.locked,
      ),
    ];

    await tester.pumpWidget(
      _harness(
        locale: const Locale('ar'),
        viewport: const Size(360, 800),
        child: Directionality(
          textDirection: TextDirection.rtl,
          child: BuildStepsSection(
            projectId: 'project-1',
            buildRecord: _buildWithSteps(steps: steps),
            completingStepIds: const {},
            isEditingLocked: false,
            onCompleteCurrentStep: () {},
            onOpenStepCheck: (_) async {},
          ),
        ),
      ),
    );

    expect(find.text('الحالية'), findsOneWidget);
    expect(find.text('أنهيت هذه الخطوة'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'current step keeps complete primary with optional help and check',
    (tester) async {
      var helpTaps = 0;
      var checkTaps = 0;

      await tester.pumpWidget(
        _harness(
          child: SingleChildScrollView(
            child: BuildActivePhase(
              projectId: 'project-1',
              buildRecord: _buildWithSteps(),
              completingStepIds: const {},
              updatingItemIds: const {},
              isEditingLocked: false,
              showResumeBanner: false,
              openingGuide: false,
              onCompleteCurrentStep: () {},
              onOpenStepCheck: (_) async => checkTaps += 1,
              onNeedHelp: () => helpTaps += 1,
              onOpenBuildGuide: () {},
              onOpenNotebook: () {},
              onOpenSmartPlan: () {},
              onStatusChanged: (item, {required status, learnerNote}) async {},
              onEditNote: (_) {},
              onFindMaterials: (_) {},
              onRequestMaterial: (_) {},
              onShowMaterialCandidates: (_) {},
              onUnlinkMaterial: (_) {},
              onViewLinkedMaterial: (_) {},
              onReserveLinkedMaterial: (_) {},
              onViewReservation: (_) {},
            ),
          ),
        ),
      );

      expect(find.text('I finished this step'), findsOneWidget);
      expect(find.text('Need help?'), findsOneWidget);
      expect(find.text('Quick knowledge check'), findsOneWidget);
      expect(find.text('Welcome back'), findsNothing);

      await tester.tap(find.text('Need help?'));
      await tester.tap(find.text('Quick knowledge check'));
      expect(helpTaps, 1);
      expect(checkTaps, 1);
    },
  );
}
