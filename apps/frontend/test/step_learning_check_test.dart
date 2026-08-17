import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/app/theme/app_theme.dart';
import 'package:frontend/features/learning_hub/application/learning_hub_providers.dart';
import 'package:frontend/features/learning_hub/application/learning_session_providers.dart';
import 'package:frontend/features/learning_hub/domain/learning_project_repository.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_session.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/learning_hub/presentation/l10n/step_learning_check_l10n.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/step_learning_check_sheet.dart';
import 'package:frontend/l10n/app_localizations.dart';

void main() {
  testWidgets('completed step status row shows compact learning label', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          buildLearningSessionProvider('project-1').overrideWith(
            (ref) async => LearningSessionBundle(
              session: BuildLearningSession(
                id: 'session-1',
                buildId: 'build-1',
                packId: 'pack-1',
                assignments: [_stepAssignment()],
              ),
              learningSetup: const ProjectBuildLearningSetup(
                status: LearningSetupStatus.ready,
              ),
            ),
          ),
        ],
        child: MaterialApp(
          home: Scaffold(
            body: StepLearningCheckStatusRow(
              projectId: 'project-1',
              buildRecord: _buildRecord(),
              step: _completedStep(),
              onOpenCheck: () {},
            ),
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(
      find.text(StepLearningCheckL10n.statusNotAttempted.en),
      findsOneWidget,
    );
    expect(find.text(StepLearningCheckL10n.actionStart.en), findsOneWidget);
  });

  testWidgets('incomplete step hides learning status row', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          buildLearningSessionProvider('project-1').overrideWith(
            (ref) async => LearningSessionBundle(
              session: BuildLearningSession(
                id: 'session-1',
                buildId: 'build-1',
                packId: 'pack-1',
                assignments: [_stepAssignment()],
              ),
              learningSetup: const ProjectBuildLearningSetup(
                status: LearningSetupStatus.ready,
              ),
            ),
          ),
        ],
        child: MaterialApp(
          home: Scaffold(
            body: StepLearningCheckStatusRow(
              projectId: 'project-1',
              buildRecord: _buildRecord(),
              step: const ProjectBuildStepView(
                stepId: 'step-1',
                stepNumber: 1,
                title: 'Step 1',
                description: 'Description',
                state: ProjectBuildStepState.current,
              ),
              onOpenCheck: () {},
            ),
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();
    expect(
      find.text(StepLearningCheckL10n.statusNotAttempted.en),
      findsNothing,
    );
  });

  test(
    'step check copy removes duplicate skip and exposes finish/saved states',
    () {
      expect(StepLearningCheckL10n.skipForNow.en, 'Skip for now');
      expect(StepLearningCheckL10n.skipForNow.ar, 'تخطي مؤقتًا');
      expect(StepLearningCheckL10n.finishCheck.en, 'Finish check');
      expect(StepLearningCheckL10n.answerSaved.en, 'Answer saved');
      expect(
        StepLearningCheckL10n.stepCheckCompletedBody.en,
        contains('main idea'),
      );
      expect(
        StepLearningCheckL10n.skipForNow.en,
        isNot(equals('Skip question')),
      );
    },
  );

  testWidgets('Arabic step check actions do not overflow on a phone', (
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

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          learningHubRepositoryProvider.overrideWithValue(_StepCheckRepo()),
        ],
        child: MaterialApp(
          locale: const Locale('ar'),
          supportedLocales: const [Locale('ar'), Locale('en')],
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          theme: AppTheme.lightFor('ar'),
          home: MediaQuery(
            data: const MediaQueryData(size: Size(360, 800)),
            child: Scaffold(
              body: StepLearningCheckSheet(
                projectId: 'project-1',
                buildRecord: _buildRecord(),
                step: _completedStep(),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('إرسال الإجابة'), findsOneWidget);
    expect(find.text('عرض تلميح'), findsOneWidget);
    expect(find.text('تخطي مؤقتًا'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'Arabic knowledge check keeps step number separate from English title',
    (tester) async {
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

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            learningHubRepositoryProvider.overrideWithValue(
              _GeneratedStepCheckRepo(),
            ),
          ],
          child: MaterialApp(
            locale: const Locale('ar'),
            supportedLocales: const [Locale('ar'), Locale('en')],
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            theme: AppTheme.lightFor('ar'),
            home: MediaQuery(
              data: const MediaQueryData(size: Size(360, 800)),
              child: Scaffold(
                body: StepLearningCheckSheet(
                  projectId: 'project-1',
                  buildRecord: _buildRecord(),
                  step: const ProjectBuildStepView(
                    stepId: 'step-1',
                    stepNumber: 1,
                    title: 'Plan and inspect materials',
                    description:
                        'Review the component list, check dimensions and condition, and prepare a safe workspace.',
                    state: ProjectBuildStepState.current,
                  ),
                ),
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('تحقق سريع من فهمك'), findsOneWidget);
      expect(find.text('الخطوة 1'), findsOneWidget);
      expect(find.text('Plan and inspect materials'), findsOneWidget);
      expect(find.text('Plan and inspect materials .1'), findsNothing);
      expect(find.textContaining('.1'), findsNothing);
      expect(find.text('لماذا هذه الخطوة مهمة؟'), findsOneWidget);
      expect(
        find.textContaining('في الخطوة 1 ("Plan and inspect materials")'),
        findsNothing,
      );
      expect(find.textContaining('يحقق نتيجة الخطوة:'), findsNothing);
      expect(find.byType(Spacer), findsNothing);

      final sheetSize = tester.getSize(find.byType(StepLearningCheckSheet));
      expect(sheetSize.height, lessThan(560));

      final menu = find.byType(PopupMenuButton<String>);
      expect(menu, findsOneWidget);
      expect(
        tester.getCenter(menu).dy,
        lessThan(tester.getCenter(find.text('إرسال الإجابة')).dy),
      );

      await tester.tap(find.text('Review the component list, check dimensions and condition, and prepare a safe workspace.'));
      await tester.pump();
      await tester.tap(find.text('إرسال الإجابة'));
      await tester.pumpAndSettle();

      expect(find.text('✓ إجابة صحيحة'), findsOneWidget);
      expect(find.text('فهمك لهذه الخطوة صحيح.'), findsOneWidget);
      expect(find.text('تم'), findsOneWidget);
      expect(find.textContaining('الخيار الصحيح يطابق'), findsNothing);
      expect(
        find.text(
          'Review the component list, check dimensions and condition, and prepare a safe workspace.',
        ),
        findsOneWidget,
      );
      expect(find.text('إنهاء التحقق'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
}

LearningAssignment _stepAssignment() {
  return const LearningAssignment(
    id: 'assignment-1',
    stage: 'STEP',
    status: LearningAssignmentStatus.notAttempted,
    displayOrder: 1,
    projectStepId: 'step-1',
    question: LearningQuestion(
      id: 'question-1',
      stage: 'STEP',
      questionType: 'MULTIPLE_CHOICE',
      promptEn: 'What matters in step 1?',
      promptAr: 'ما الأهم في الخطوة 1؟',
      explanationEn: 'Follow the step carefully.',
      explanationAr: 'اتبع الخطوة بعناية.',
      hintEn: 'Read the step description.',
      hintAr: 'اقرأ وصف الخطوة.',
      options: [
        LearningQuestionOption(
          optionKey: 'a',
          textEn: 'Follow carefully',
          textAr: 'اتبع بعناية',
          displayOrder: 1,
        ),
      ],
    ),
    answerAttempts: [],
  );
}

ProjectBuild _buildRecord() {
  return ProjectBuild(
    id: 'build-1',
    projectId: 'project-1',
    status: ProjectBuildStatus.inProgress,
    project: const ProjectBuildProject(
      id: 'project-1',
      title: 'LED project',
      shortDescription: 'Short',
    ),
    progress: const ProjectBuildProgress(total: 1, ready: 1, percent: 100),
    items: const [],
    materialReadiness: const ProjectBuildMaterialReadiness(
      ready: 1,
      linked: 0,
      reserved: 0,
      missing: 0,
      total: 1,
    ),
    stepProgress: ProjectBuildStepProgress(
      completed: 1,
      total: 1,
      percent: 100,
      nextAction: ProjectBuildNextAction.completeCurrentStep,
      steps: [_completedStep()],
    ),
    learningSetup: const ProjectBuildLearningSetup(
      status: LearningSetupStatus.ready,
      sessionId: 'session-1',
    ),
  );
}

ProjectBuildStepView _completedStep() {
  return const ProjectBuildStepView(
    stepId: 'step-1',
    stepNumber: 1,
    title: 'Step 1',
    description: 'Description',
    state: ProjectBuildStepState.completed,
  );
}

class _StepCheckRepo implements LearningProjectRepository {
  @override
  Future<StepLearningCheck?> fetchStepLearningCheck(
    String projectId,
    String stepId,
  ) async {
    return StepLearningCheck(
      assignmentId: 'assignment-1',
      stepId: stepId,
      stage: 'STEP',
      questionType: 'MULTIPLE_CHOICE',
      displayOrder: 1,
      status: LearningAssignmentStatus.notAttempted,
      uiState: StepLearningCheckUiState.notAttempted,
      attemptCount: 0,
      hintViewed: false,
      mayRetry: true,
      isReadOnly: false,
      question: _stepAssignment().question,
      answerAttempts: const [],
      hasCorrectAttempt: false,
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _GeneratedStepCheckRepo implements LearningProjectRepository {
  static const _longOutcome =
      'Review the component list, check dimensions and condition, and prepare a safe workspace.';

  StepLearningCheck _check = StepLearningCheck(
    assignmentId: 'assignment-1',
    stepId: 'step-1',
    stage: 'STEP',
    questionType: 'MULTIPLE_CHOICE',
    displayOrder: 1,
    status: LearningAssignmentStatus.notAttempted,
    uiState: StepLearningCheckUiState.notAttempted,
    attemptCount: 0,
    hintViewed: false,
    mayRetry: true,
    isReadOnly: false,
    question: const LearningQuestion(
      id: 'question-1',
      stage: 'STEP',
      questionType: 'MULTIPLE_CHOICE',
      promptEn:
          'In step 1 ("Plan and inspect materials"), why does this action matter?',
      promptAr:
          'في الخطوة 1 ("Plan and inspect materials")، لماذا يهم هذا الإجراء؟',
      explanationEn:
          'The correct choice matches the step intent: $_longOutcome',
      explanationAr: 'الخيار الصحيح يطابق قصد الخطوة: $_longOutcome',
      hintEn: 'Read the step description.',
      hintAr: 'اقرأ وصف الخطوة.',
      options: [
        LearningQuestionOption(
          optionKey: 'a',
          textEn: 'It achieves the step outcome: $_longOutcome',
          textAr: 'يحقق نتيجة الخطوة: $_longOutcome',
          displayOrder: 1,
        ),
        LearningQuestionOption(
          optionKey: 'b',
          textEn: 'Skip the inspection',
          textAr: 'تخطي الفحص',
          displayOrder: 2,
        ),
      ],
    ),
    answerAttempts: const [],
    hasCorrectAttempt: false,
  );

  @override
  Future<StepLearningCheck?> fetchStepLearningCheck(
    String projectId,
    String stepId,
  ) async => _check;

  @override
  Future<LearningSessionBundle> fetchLearningSession(String projectId) async {
    return const LearningSessionBundle(
      session: null,
      learningSetup: ProjectBuildLearningSetup(
        status: LearningSetupStatus.ready,
      ),
    );
  }

  @override
  Future<StepLearningCheckAnswerSubmission> submitStepLearningCheckAnswer(
    String projectId,
    String stepId, {
    required String selectedOptionKey,
  }) async {
    final attempt = LearningAnswerAttempt(
      id: 'attempt-1',
      attemptNumber: 1,
      selectedOptionKey: selectedOptionKey,
      isCorrect: true,
      submittedAt: DateTime(2026, 1, 1),
    );
    _check = StepLearningCheck(
      assignmentId: _check.assignmentId,
      stepId: _check.stepId,
      stage: _check.stage,
      questionType: _check.questionType,
      displayOrder: _check.displayOrder,
      status: LearningAssignmentStatus.answered,
      uiState: StepLearningCheckUiState.correct,
      attemptCount: 1,
      hintViewed: false,
      mayRetry: false,
      isReadOnly: false,
      question: _check.question,
      answerAttempts: [attempt],
      latestSelectedOptionKey: selectedOptionKey,
      hasCorrectAttempt: true,
      correctOptionKey: 'a',
      latestResult: const StepLearningCheckResult(
        selectedOptionKey: 'a',
        isCorrect: true,
        attemptNumber: 1,
        explanationEn:
            'The correct choice matches the step intent: $_longOutcome',
        explanationAr: 'الخيار الصحيح يطابق قصد الخطوة: $_longOutcome',
        correctOptionKey: 'a',
        mayRetry: false,
      ),
    );
    return StepLearningCheckAnswerSubmission(attempt: attempt, check: _check);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
