import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/learning_hub/application/learning_session_providers.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_session.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/learning_hub/presentation/l10n/step_learning_check_l10n.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/step_learning_check_sheet.dart';

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
    expect(find.text(StepLearningCheckL10n.statusNotAttempted.en), findsNothing);
  });

  test('step check copy removes duplicate skip and exposes finish/saved states', () {
    expect(StepLearningCheckL10n.skipForNow.en, 'Skip for now');
    expect(StepLearningCheckL10n.skipForNow.ar, 'تخطي مؤقتًا');
    expect(StepLearningCheckL10n.finishCheck.en, 'Finish check');
    expect(StepLearningCheckL10n.answerSaved.en, 'Answer saved');
    expect(StepLearningCheckL10n.stepCheckCompletedBody.en, contains('main idea'));
    expect(StepLearningCheckL10n.skipForNow.en, isNot(equals('Skip question')));
  });
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
      steps: [
        _completedStep(),
      ],
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
