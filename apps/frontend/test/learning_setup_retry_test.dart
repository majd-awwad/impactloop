import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/learning_hub/application/learning_hub_providers.dart';
import 'package:frontend/features/learning_hub/application/learning_session_providers.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_session.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/learning_hub/presentation/l10n/learning_session_l10n.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/start_knowledge_check_section.dart';

import 'support/learning_hub_test_support.dart';

ProjectBuild _build(ProjectBuildLearningSetup setup) {
  return ProjectBuild(
    id: 'build-1',
    projectId: 'project-1',
    status: ProjectBuildStatus.inProgress,
    project: const ProjectBuildProject(
      id: 'project-1',
      title: 'Simple LED Circuit',
      shortDescription: 'Short',
    ),
    progress: const ProjectBuildProgress(total: 1, ready: 0, percent: 0),
    items: const [],
    materialReadiness: const ProjectBuildMaterialReadiness(
      ready: 0,
      linked: 0,
      reserved: 0,
      missing: 1,
      total: 1,
    ),
    stepProgress: const ProjectBuildStepProgress(
      completed: 0,
      total: 1,
      percent: 0,
      nextAction: ProjectBuildNextAction.completeCurrentStep,
      steps: [],
    ),
    learningSetup: setup,
  );
}

void main() {
  testWidgets('unavailable retryable state shows Retry learning setup', (
    tester,
  ) async {
    const setup = ProjectBuildLearningSetup(
      status: LearningSetupStatus.unavailable,
      reasonCode: 'LEARNING_PACK_VALIDATION_FAILED',
      retryable: true,
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          learningHubRepositoryProvider.overrideWithValue(
            emptyLearningHubRepository,
          ),
          buildLearningSessionProvider('project-1').overrideWith(
            (ref) async => const LearningSessionBundle(
              session: null,
              learningSetup: setup,
            ),
          ),
        ],
        child: MaterialApp(
          home: Scaffold(
            body: StartKnowledgeCheckSection(
              projectId: 'project-1',
              buildRecord: _build(setup),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text(LearningSessionL10n.unavailable.en), findsOneWidget);
    expect(find.text(LearningSessionL10n.retrySetup.en), findsOneWidget);
  });

  testWidgets('ineligible unavailable state hides Retry', (tester) async {
    const setup = ProjectBuildLearningSetup(
      status: LearningSetupStatus.unavailable,
      reasonCode: 'PROJECT_NOT_ELIGIBLE',
      retryable: false,
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          learningHubRepositoryProvider.overrideWithValue(
            emptyLearningHubRepository,
          ),
          buildLearningSessionProvider('project-1').overrideWith(
            (ref) async => const LearningSessionBundle(
              session: null,
              learningSetup: setup,
            ),
          ),
        ],
        child: MaterialApp(
          home: Scaffold(
            body: StartKnowledgeCheckSection(
              projectId: 'project-1',
              buildRecord: _build(setup),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text(LearningSessionL10n.ineligible.en), findsOneWidget);
    expect(find.text(LearningSessionL10n.retrySetup.en), findsNothing);
  });

  testWidgets('START check stays compact on the build page', (tester) async {
    const setup = ProjectBuildLearningSetup(
      status: LearningSetupStatus.ready,
      sessionId: 'session-1',
    );
    final session = BuildLearningSession(
      id: 'session-1',
      buildId: 'build-1',
      packId: 'pack-1',
      assignments: [
        LearningAssignment(
          id: 'a1',
          stage: 'START',
          status: LearningAssignmentStatus.notAttempted,
          displayOrder: 1,
          question: LearningQuestion(
            id: 'q1',
            stage: 'START',
            questionType: 'MULTIPLE_CHOICE',
            promptEn: 'Why is a resistor used with the LED?',
            promptAr: 'لماذا؟',
            explanationEn: 'To limit current.',
            explanationAr: 'لتحديد التيار.',
            hintEn: 'Think about current.',
            hintAr: 'فكر في التيار.',
            options: const [
              LearningQuestionOption(
                optionKey: 'a',
                textEn: 'To limit current and protect the LED.',
                textAr: 'لتحديد التيار.',
                displayOrder: 1,
              ),
            ],
          ),
          answerAttempts: const [],
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          learningHubRepositoryProvider.overrideWithValue(
            emptyLearningHubRepository,
          ),
          buildLearningSessionProvider('project-1').overrideWith(
            (ref) async => LearningSessionBundle(
              session: session,
              learningSetup: setup,
            ),
          ),
        ],
        child: MaterialApp(
          home: Scaffold(
            body: StartKnowledgeCheckSection(
              projectId: 'project-1',
              buildRecord: _build(setup),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text(LearningSessionL10n.title.en), findsOneWidget);
    expect(find.text(LearningSessionL10n.beginCheck.en), findsOneWidget);
    expect(
      find.text('Why is a resistor used with the LED?'),
      findsNothing,
    );
    expect(find.text(LearningSessionL10n.skipQuestion.en), findsNothing);
    expect(LearningSessionL10n.skipQuestion.en, 'Skip for now');
    expect(LearningSessionL10n.finishCheck.en, 'Finish check');
    expect(LearningSessionL10n.answerSaved.en, 'Answer saved');
    expect(LearningSessionL10n.completed.en, 'You’re ready to begin');
  });
}
