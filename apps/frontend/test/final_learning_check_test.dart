import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_session.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/learning_hub/presentation/l10n/final_learning_check_l10n.dart';
import 'package:frontend/features/learning_hub/presentation/l10n/project_build_page_l10n.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/final_learning_check_section.dart';

void main() {
  test('areRequiredBuildStepsComplete hides final check before completion', () {
    final incomplete = ProjectBuild(
      id: 'build-1',
      projectId: 'project-1',
      status: ProjectBuildStatus.inProgress,
      project: const ProjectBuildProject(
        id: 'project-1',
        title: 'LED',
        shortDescription: '',
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
      stepProgress: const ProjectBuildStepProgress(
        completed: 0,
        total: 1,
        percent: 0,
        steps: [
          ProjectBuildStepView(
            stepId: 'step-1',
            stepNumber: 1,
            title: 'Step 1',
            description: 'Desc',
            state: ProjectBuildStepState.current,
          ),
        ],
      ),
    );

    expect(areRequiredBuildStepsComplete(incomplete), isFalse);
  });

  test('areRequiredBuildStepsComplete true when all steps completed', () {
    final complete = ProjectBuild(
      id: 'build-1',
      projectId: 'project-1',
      status: ProjectBuildStatus.completed,
      project: const ProjectBuildProject(
        id: 'project-1',
        title: 'LED',
        shortDescription: '',
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
      stepProgress: const ProjectBuildStepProgress(
        completed: 1,
        total: 1,
        percent: 100,
        nextAction: ProjectBuildNextAction.buildCompleted,
        steps: [
          ProjectBuildStepView(
            stepId: 'step-1',
            stepNumber: 1,
            title: 'Step 1',
            description: 'Desc',
            state: ProjectBuildStepState.completed,
          ),
        ],
      ),
    );

    expect(areRequiredBuildStepsComplete(complete), isTrue);
  });

  testWidgets('learning summary hides empty sections', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: LearningSummarySection(
            summary: BuildLearningSummary(
              schemaVersion: 1,
              generatedAt: DateTime.utc(2026, 8, 4),
              startCheck: const LearningCheckProgress(
                total: 0,
                answered: 0,
                correct: 0,
                skipped: 0,
                remaining: 0,
                handled: 0,
              ),
              stepChecks: const LearningCheckProgress(
                total: 0,
                answered: 0,
                correct: 0,
                skipped: 0,
                remaining: 0,
                handled: 0,
              ),
              finalCheck: const LearningCheckProgress(
                total: 0,
                answered: 0,
                correct: 0,
                skipped: 0,
                remaining: 0,
                handled: 0,
              ),
              understoodConcepts: const [],
              reviewConcepts: const [],
              uncheckedConceptCount: 0,
            ),
          ),
        ),
      ),
    );

    expect(find.text(FinalLearningCheckL10n.summaryTitle.en), findsNothing);
  });

  testWidgets('learning summary shows understood concepts without grades', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: LearningSummarySection(
            summary: BuildLearningSummary(
              schemaVersion: 1,
              generatedAt: DateTime.utc(2026, 8, 4),
              startCheck: const LearningCheckProgress(
                total: 1,
                answered: 1,
                correct: 1,
                skipped: 0,
                remaining: 0,
                handled: 1,
              ),
              stepChecks: const LearningCheckProgress(
                total: 1,
                answered: 1,
                correct: 1,
                skipped: 0,
                remaining: 0,
                handled: 1,
              ),
              finalCheck: const LearningCheckProgress(
                total: 1,
                answered: 0,
                correct: 0,
                skipped: 0,
                remaining: 1,
                handled: 0,
              ),
              understoodConcepts: const [
                LearningSummaryConcept(
                  conceptKey: 'safe_power',
                  labelEn: 'Power safety',
                  labelAr: 'سلامة الطاقة',
                ),
              ],
              reviewConcepts: const [],
              uncheckedConceptCount: 1,
            ),
          ),
        ),
      ),
    );

    expect(find.text(FinalLearningCheckL10n.summaryTitle.en), findsOneWidget);
    expect(find.textContaining('Power safety'), findsOneWidget);
    expect(find.textContaining('pass'), findsNothing);
    expect(find.textContaining('grade'), findsNothing);
  });

  test('Arabic summary labels and concept labels resolve without concept keys', () {
    expect(FinalLearningCheckL10n.summaryTitle.ar, 'ملخص التعلم');
    expect(FinalLearningCheckL10n.reviewConcepts.ar, 'مفاهيم يُنصح بمراجعتها');
    const concept = LearningSummaryConcept(
      conceptKey: 'motor_driver',
      labelEn: 'Motor driver purpose',
      labelAr: 'غرض مشغل المحرك',
    );
    expect(concept.labelFor('ar'), 'غرض مشغل المحرك');
    expect(concept.labelFor('ar'), isNot(contains('motor_driver')));
  });

  test('hasRemainingFinalQuestions is true when FINAL incomplete', () {
    final session = BuildLearningSession(
      id: 'session-1',
      buildId: 'build-1',
      packId: 'pack-1',
      learningGoal: null,
      confidenceBefore: null,
      confidenceAfter: null,
      finalReflection: null,
      goalOutcome: null,
      learningSummary: null,
      assignments: [
        LearningAssignment(
          id: 'a1',
          stage: 'FINAL',
          status: LearningAssignmentStatus.notAttempted,
          displayOrder: 1,
          question: const LearningQuestion(
            id: 'q1',
            stage: 'FINAL',
            questionType: 'SINGLE_CHOICE',
            promptEn: 'Q',
            promptAr: 'س',
            explanationEn: '',
            explanationAr: '',
            hintEn: '',
            hintAr: '',
            options: [],
          ),
          answerAttempts: const [],
        ),
      ],
    );

    expect(session.hasRemainingFinalQuestions, isTrue);
  });

  test('completion dialog copy remains optional and non-blocking', () {
    expect(FinalLearningCheckL10n.completeDialogTitle.en, 'Final learning check');
    expect(
      FinalLearningCheckL10n.completeDialogBody.en,
      contains('do not prevent you from completing'),
    );
    expect(FinalLearningCheckL10n.reviewFinalCheck.en, 'Review final check');
    expect(FinalLearningCheckL10n.completeAnyway.en, 'Complete build anyway');
    expect(FinalLearningCheckL10n.reviewFinalCheck.ar, 'مراجعة التحقق النهائي');
    expect(
      FinalLearningCheckL10n.completeAnyway.ar,
      'إكمال المشروع على أي حال',
    );
  });

  testWidgets('confidence before/after renders chronologically in LTR and RTL', (
    tester,
  ) async {
    Widget buildApp(Locale locale) {
      const before = 2;
      const after = 4;
      final text = locale.languageCode == 'ar'
          ? 'مستوى المعرفة: $before ← $after'
          : 'Confidence: $before → $after';
      return MaterialApp(
        locale: locale,
        home: Scaffold(body: Text(text)),
      );
    }

    await tester.pumpWidget(buildApp(const Locale('en')));
    expect(find.textContaining('2 → 4'), findsOneWidget);

    await tester.pumpWidget(buildApp(const Locale('ar')));
    expect(find.textContaining('2 ← 4'), findsOneWidget);
  });

  test('final check action labels enforce sequential flow copy', () {
    expect(FinalLearningCheckL10n.start.en, 'Start final check');
    expect(FinalLearningCheckL10n.start.ar, 'بدء التحقق النهائي');
    expect(FinalLearningCheckL10n.continueCheck.en, 'Continue final check');
    expect(FinalLearningCheckL10n.continueCheck.ar, 'متابعة التحقق النهائي');
    expect(FinalLearningCheckL10n.reviewFinalCheck.en, 'Review final check');
    expect(FinalLearningCheckL10n.reviewFinalCheck.ar, 'مراجعة التحقق النهائي');
    expect(FinalLearningCheckL10n.skipForNow.en, 'Skip for now');
    expect(FinalLearningCheckL10n.skipForNow.ar, 'تخطي مؤقتًا');
    expect(FinalLearningCheckL10n.nextQuestion.en, 'Next question');
    expect(FinalLearningCheckL10n.finishCheck.en, 'Finish check');
    expect(FinalLearningCheckL10n.answerSaved.en, 'Answer saved');
    expect(FinalLearningCheckL10n.answerSaved.ar, 'تم حفظ الإجابة');
    expect(
      FinalLearningCheckL10n.celebrationTitle.en,
      'Great work — learning check completed!',
    );
    expect(
      FinalLearningCheckL10n.reflectionSavedDestination.en,
      contains('private Portfolio'),
    );
    expect(
      FinalLearningCheckL10n.reflectionDestination.en,
      contains('private Portfolio'),
    );
    expect(FinalLearningCheckL10n.savingReflection.en, 'Saving…');
    expect(FinalLearningCheckL10n.savedReflection.en, 'Saved');
    expect(FinalLearningCheckL10n.addReflection.en, 'Add learning reflection');
    expect(FinalLearningCheckL10n.addReflection.ar, 'إضافة مراجعة التعلم');
    expect(FinalLearningCheckL10n.buildCompletedTitle.en, 'Project completed!');
  });

  test('completed review final check action resolves by build state', () {
    final completedBuild = ProjectBuild(
      id: 'build-1',
      projectId: 'project-1',
      status: ProjectBuildStatus.completed,
      project: const ProjectBuildProject(
        id: 'project-1',
        title: 'Kit',
        shortDescription: 'Done',
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
        completed: 2,
        total: 2,
        percent: 100,
        steps: [],
        nextAction: ProjectBuildNextAction.buildCompleted,
      ),
      items: const [],
    );
    final archivedBuild = ProjectBuild(
      id: 'build-1',
      projectId: 'project-1',
      status: ProjectBuildStatus.archived,
      project: completedBuild.project,
      progress: completedBuild.progress,
      materialReadiness: completedBuild.materialReadiness,
      stepProgress: completedBuild.stepProgress,
      items: completedBuild.items,
    );
    const question = LearningQuestion(
      id: 'q-final',
      stage: 'FINAL',
      questionType: 'MULTIPLE_CHOICE',
      promptEn: 'Prompt',
      promptAr: 'سؤال',
      explanationEn: 'exp',
      explanationAr: 'شرح',
      hintEn: 'hint',
      hintAr: 'تلميح',
      options: [],
    );
    final sessionWithRemaining = BuildLearningSession(
      id: 'session-1',
      buildId: 'build-1',
      packId: 'pack-1',
      assignments: [
        LearningAssignment(
          id: 'a1',
          stage: 'FINAL',
          status: LearningAssignmentStatus.answered,
          displayOrder: 1,
          question: question,
          answerAttempts: [
            LearningAnswerAttempt(
              id: 't1',
              attemptNumber: 1,
              selectedOptionKey: 'a',
              isCorrect: true,
              submittedAt: DateTime(2026, 1, 15),
            ),
          ],
        ),
        LearningAssignment(
          id: 'a2',
          stage: 'FINAL',
          status: LearningAssignmentStatus.notAttempted,
          displayOrder: 2,
          question: question,
          answerAttempts: const [],
        ),
      ],
    );
    final sessionComplete = BuildLearningSession(
      id: 'session-1',
      buildId: 'build-1',
      packId: 'pack-1',
      assignments: [
        LearningAssignment(
          id: 'a1',
          stage: 'FINAL',
          status: LearningAssignmentStatus.answered,
          displayOrder: 1,
          question: question,
          answerAttempts: [
            LearningAnswerAttempt(
              id: 't1',
              attemptNumber: 1,
              selectedOptionKey: 'a',
              isCorrect: true,
              submittedAt: DateTime(2026, 1, 15),
            ),
          ],
        ),
      ],
    );

    expect(
      resolveCompletedReviewFinalCheckUi(
        buildRecord: completedBuild,
        session: sessionWithRemaining,
        learningSetup: const ProjectBuildLearningSetup(
          status: LearningSetupStatus.ready,
        ),
      ).actionLabel,
      FinalLearningCheckL10n.continueCheck,
    );
    expect(
      resolveCompletedReviewFinalCheckUi(
        buildRecord: completedBuild,
        session: sessionComplete,
        learningSetup: const ProjectBuildLearningSetup(
          status: LearningSetupStatus.ready,
        ),
      ).actionLabel,
      FinalLearningCheckL10n.reviewFinalCheck,
    );
    expect(
      resolveCompletedReviewFinalCheckUi(
        buildRecord: archivedBuild,
        session: sessionWithRemaining,
        learningSetup: const ProjectBuildLearningSetup(
          status: LearningSetupStatus.ready,
        ),
      ).actionLabel,
      FinalLearningCheckL10n.reviewFinalCheck,
    );
    expect(
      resolveCompletedReviewFinalCheckUi(
        buildRecord: completedBuild,
        session: sessionWithRemaining,
        learningSetup: const ProjectBuildLearningSetup(
          status: LearningSetupStatus.unavailable,
        ),
      ).compactNotice,
      ProjectBuildPageL10n.finalCheckUnavailable,
    );
  });

  testWidgets('summary concepts use concise labels not full question prompts', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: LearningSummarySection(
            summary: BuildLearningSummary(
              schemaVersion: 1,
              generatedAt: DateTime.utc(2026, 8, 4),
              startCheck: const LearningCheckProgress(
                total: 1,
                answered: 1,
                correct: 1,
                skipped: 0,
                remaining: 0,
                handled: 1,
              ),
              stepChecks: const LearningCheckProgress(
                total: 0,
                answered: 0,
                correct: 0,
                skipped: 0,
                remaining: 0,
                handled: 0,
              ),
              finalCheck: const LearningCheckProgress(
                total: 0,
                answered: 0,
                correct: 0,
                skipped: 0,
                remaining: 0,
                handled: 0,
              ),
              understoodConcepts: const [
                LearningSummaryConcept(
                  conceptKey: 'component_purpose',
                  labelEn: 'Component purpose',
                  labelAr: 'غرض المكون',
                ),
              ],
              reviewConcepts: const [],
              uncheckedConceptCount: 0,
            ),
          ),
        ),
      ),
    );

    expect(find.textContaining('Component purpose'), findsOneWidget);
    expect(
      find.textContaining('Why is a resistor connected'),
      findsNothing,
    );
  });
}
