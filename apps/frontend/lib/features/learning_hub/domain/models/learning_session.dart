enum LearningSetupStatus { ready, preparing, unavailable, notRequested }

class ProjectBuildLearningSetup {
  const ProjectBuildLearningSetup({
    required this.status,
    this.sessionId,
    this.packVersion,
    this.startQuestionCount = 0,
    this.reasonCode,
    this.retryAfterSeconds,
    this.retryable = false,
  });

  final LearningSetupStatus status;
  final String? sessionId;
  final int? packVersion;
  final int startQuestionCount;
  final String? reasonCode;
  final int? retryAfterSeconds;
  final bool retryable;

  bool get isReady => status == LearningSetupStatus.ready;
  bool get isPreparing => status == LearningSetupStatus.preparing;
  bool get isUnavailable => status == LearningSetupStatus.unavailable;
}

enum LearningAssignmentStatus { notAttempted, answered, skipped }

class LearningQuestionOption {
  const LearningQuestionOption({
    required this.optionKey,
    required this.textEn,
    required this.textAr,
    required this.displayOrder,
  });

  final String optionKey;
  final String textEn;
  final String textAr;
  final int displayOrder;

  String promptFor(String languageCode) =>
      languageCode == 'ar' ? textAr : textEn;
}

class LearningQuestion {
  const LearningQuestion({
    required this.id,
    required this.stage,
    required this.questionType,
    required this.promptEn,
    required this.promptAr,
    required this.explanationEn,
    required this.explanationAr,
    required this.hintEn,
    required this.hintAr,
    required this.options,
  });

  final String id;
  final String stage;
  final String questionType;
  final String promptEn;
  final String promptAr;
  final String explanationEn;
  final String explanationAr;
  final String hintEn;
  final String hintAr;
  final List<LearningQuestionOption> options;

  String promptFor(String languageCode) =>
      languageCode == 'ar' ? promptAr : promptEn;

  String explanationFor(String languageCode) =>
      languageCode == 'ar' ? explanationAr : explanationEn;

  String hintFor(String languageCode) => languageCode == 'ar' ? hintAr : hintEn;
}

class LearningAnswerAttempt {
  const LearningAnswerAttempt({
    required this.id,
    required this.attemptNumber,
    required this.selectedOptionKey,
    required this.isCorrect,
    required this.submittedAt,
  });

  final String id;
  final int attemptNumber;
  final String selectedOptionKey;
  final bool isCorrect;
  final DateTime submittedAt;
}

class LearningAssignment {
  const LearningAssignment({
    required this.id,
    required this.stage,
    required this.status,
    required this.displayOrder,
    required this.question,
    required this.answerAttempts,
    this.projectStepId,
    this.hintViewedAt,
    this.unclearReported = false,
    this.stepTitle,
    this.reviewCorrectOptionKey,
  });

  final String id;
  final String stage;
  final LearningAssignmentStatus status;
  final int displayOrder;
  final String? projectStepId;
  final String? stepTitle;
  final String? reviewCorrectOptionKey;
  final LearningQuestion question;
  final List<LearningAnswerAttempt> answerAttempts;
  final DateTime? hintViewedAt;
  final bool unclearReported;

  int get attemptCount => answerAttempts.length;

  LearningAnswerAttempt? get latestAttempt =>
      answerAttempts.isEmpty ? null : answerAttempts.last;

  bool get isStartStage => stage == 'START';
  bool get isStepStage => stage == 'STEP';
  bool get isComplete =>
      status == LearningAssignmentStatus.answered ||
      status == LearningAssignmentStatus.skipped;
  bool get hasCorrectAnswer =>
      answerAttempts.any((attempt) => attempt.isCorrect);
  bool get hintViewed => hintViewedAt != null;

  StepLearningCheckUiState uiState({bool readOnly = false}) {
    if (hasCorrectAnswer) {
      return readOnly
          ? StepLearningCheckUiState.reviewed
          : StepLearningCheckUiState.correct;
    }
    if (status == LearningAssignmentStatus.skipped && answerAttempts.isEmpty) {
      return StepLearningCheckUiState.skipped;
    }
    if (answerAttempts.isNotEmpty) {
      return StepLearningCheckUiState.incorrect;
    }
    return StepLearningCheckUiState.notAttempted;
  }
}

enum StepLearningCheckUiState {
  notAttempted,
  incorrect,
  correct,
  skipped,
  reviewed,
}

class StepLearningCheckResult {
  const StepLearningCheckResult({
    required this.selectedOptionKey,
    required this.isCorrect,
    required this.attemptNumber,
    required this.explanationEn,
    required this.explanationAr,
    this.correctOptionKey,
    required this.mayRetry,
  });

  final String selectedOptionKey;
  final bool isCorrect;
  final int attemptNumber;
  final String explanationEn;
  final String explanationAr;
  final String? correctOptionKey;
  final bool mayRetry;

  String explanationFor(String languageCode) =>
      languageCode == 'ar' ? explanationAr : explanationEn;
}

class StepLearningCheck {
  const StepLearningCheck({
    required this.assignmentId,
    required this.stepId,
    required this.stage,
    required this.questionType,
    required this.displayOrder,
    required this.status,
    required this.uiState,
    required this.attemptCount,
    required this.hintViewed,
    this.unclearReported = false,
    required this.mayRetry,
    required this.isReadOnly,
    required this.question,
    required this.answerAttempts,
    this.latestSelectedOptionKey,
    required this.hasCorrectAttempt,
    this.correctOptionKey,
    this.latestResult,
  });

  final String assignmentId;
  final String stepId;
  final String stage;
  final String questionType;
  final int displayOrder;
  final LearningAssignmentStatus status;
  final StepLearningCheckUiState uiState;
  final int attemptCount;
  final bool hintViewed;
  final bool unclearReported;
  final bool mayRetry;
  final bool isReadOnly;
  final LearningQuestion question;
  final List<LearningAnswerAttempt> answerAttempts;
  final String? latestSelectedOptionKey;
  final bool hasCorrectAttempt;
  final String? correctOptionKey;
  final StepLearningCheckResult? latestResult;
}

class StepLearningCheckAnswerSubmission {
  const StepLearningCheckAnswerSubmission({
    required this.attempt,
    required this.check,
  });

  final LearningAnswerAttempt attempt;
  final StepLearningCheck check;
}

class StepLearningCheckAiHandoff {
  const StepLearningCheckAiHandoff({
    required this.suggestedPromptEn,
    required this.suggestedPromptAr,
    required this.context,
  });

  final String suggestedPromptEn;
  final String suggestedPromptAr;
  final StepLearningCheckAiHandoffContext context;

  String suggestedPromptFor(String languageCode) =>
      languageCode == 'ar' ? suggestedPromptAr : suggestedPromptEn;
}

class StepLearningCheckAiHandoffContext {
  const StepLearningCheckAiHandoffContext({
    required this.projectId,
    required this.projectTitle,
    required this.buildId,
    required this.stepId,
    required this.stepTitle,
    required this.stepDescription,
    required this.questionPromptEn,
    required this.questionPromptAr,
    required this.selectedOptionKey,
    required this.selectedOptionTextEn,
    required this.selectedOptionTextAr,
    required this.isCorrect,
    required this.conceptKey,
    required this.explanationEn,
    required this.explanationAr,
  });

  final String projectId;
  final String projectTitle;
  final String buildId;
  final String stepId;
  final String stepTitle;
  final String stepDescription;
  final String questionPromptEn;
  final String questionPromptAr;
  final String selectedOptionKey;
  final String selectedOptionTextEn;
  final String selectedOptionTextAr;
  final bool isCorrect;
  final String conceptKey;
  final String explanationEn;
  final String explanationAr;
}

class BuildLearningSession {
  const BuildLearningSession({
    required this.id,
    required this.buildId,
    required this.packId,
    required this.assignments,
    this.learningGoal,
    this.confidenceBefore,
    this.confidenceAfter,
    this.goalOutcome,
    this.finalReflection,
    this.learningSummary,
  });

  final String id;
  final String buildId;
  final String packId;
  final String? learningGoal;
  final int? confidenceBefore;
  final int? confidenceAfter;
  final LearningGoalOutcome? goalOutcome;
  final String? finalReflection;
  final BuildLearningSummary? learningSummary;
  final List<LearningAssignment> assignments;

  List<LearningAssignment> get startAssignments {
    final items = assignments
        .where((assignment) => assignment.isStartStage)
        .toList(growable: true);
    items.sort(
      (left, right) => left.displayOrder.compareTo(right.displayOrder),
    );
    return List.unmodifiable(items);
  }

  List<LearningAssignment> get stepAssignments {
    final items = assignments
        .where((assignment) => assignment.isStepStage)
        .toList(growable: true);
    items.sort(
      (left, right) => left.displayOrder.compareTo(right.displayOrder),
    );
    return List.unmodifiable(items);
  }

  List<LearningAssignment> get finalAssignments {
    final items = assignments
        .where((assignment) => assignment.stage == 'FINAL')
        .toList(growable: true);
    items.sort(
      (left, right) => left.displayOrder.compareTo(right.displayOrder),
    );
    return List.unmodifiable(items);
  }

  LearningAssignment? assignmentForStep(String stepId) {
    for (final assignment in stepAssignments) {
      if (assignment.projectStepId == stepId) {
        return assignment;
      }
    }
    return null;
  }

  bool get isStartCheckComplete =>
      startAssignments.isEmpty ||
      startAssignments.every((assignment) => assignment.isComplete);

  bool get hasRemainingFinalQuestions =>
      finalAssignments.any((assignment) => !assignment.isComplete);
}

enum LearningGoalOutcome { achieved, partiallyAchieved, notYetAchieved }

class LearningCheckProgress {
  const LearningCheckProgress({
    required this.total,
    required this.answered,
    required this.correct,
    required this.skipped,
    required this.remaining,
    required this.handled,
  });

  final int total;
  final int answered;
  final int correct;
  final int skipped;
  final int remaining;
  final int handled;
}

class LearningSummaryConcept {
  const LearningSummaryConcept({
    required this.conceptKey,
    required this.labelEn,
    required this.labelAr,
  });

  final String conceptKey;
  final String labelEn;
  final String labelAr;

  String labelFor(String languageCode) =>
      languageCode == 'ar' ? labelAr : labelEn;
}

class BuildLearningSummary {
  const BuildLearningSummary({
    required this.schemaVersion,
    required this.generatedAt,
    required this.startCheck,
    required this.stepChecks,
    required this.finalCheck,
    required this.understoodConcepts,
    required this.reviewConcepts,
    required this.uncheckedConceptCount,
    this.confidenceBefore,
    this.confidenceAfter,
    this.goalOutcome,
  });

  final int schemaVersion;
  final DateTime generatedAt;
  final LearningCheckProgress startCheck;
  final LearningCheckProgress stepChecks;
  final LearningCheckProgress finalCheck;
  final List<LearningSummaryConcept> understoodConcepts;
  final List<LearningSummaryConcept> reviewConcepts;
  final int uncheckedConceptCount;
  final int? confidenceBefore;
  final int? confidenceAfter;
  final LearningGoalOutcome? goalOutcome;
}

class FinalLearningAssignment {
  const FinalLearningAssignment({
    required this.assignmentId,
    required this.questionId,
    required this.stage,
    required this.questionType,
    required this.displayOrder,
    required this.status,
    required this.uiState,
    required this.attemptCount,
    required this.hintViewed,
    this.unclearReported = false,
    required this.mayRetry,
    required this.isReadOnly,
    required this.question,
    required this.answerAttempts,
    required this.hasCorrectAttempt,
    this.latestSelectedOptionKey,
    this.correctOptionKey,
    this.latestResult,
  });

  final String assignmentId;
  final String questionId;
  final String stage;
  final String questionType;
  final int displayOrder;
  final LearningAssignmentStatus status;
  final StepLearningCheckUiState uiState;
  final int attemptCount;
  final bool hintViewed;
  final bool unclearReported;
  final bool mayRetry;
  final bool isReadOnly;
  final LearningQuestion question;
  final List<LearningAnswerAttempt> answerAttempts;
  final String? latestSelectedOptionKey;
  final bool hasCorrectAttempt;
  final String? correctOptionKey;
  final StepLearningCheckResult? latestResult;
}

class FinalLearningCheck {
  const FinalLearningCheck({
    required this.available,
    required this.isReadOnly,
    required this.progress,
    required this.assignments,
    this.learningSummary,
  });

  final bool available;
  final bool isReadOnly;
  final LearningCheckProgress progress;
  final List<FinalLearningAssignment> assignments;
  final BuildLearningSummary? learningSummary;
}

class FinalLearningCheckAnswerSubmission {
  const FinalLearningCheckAnswerSubmission({
    required this.assignment,
    this.attempt,
    this.progress,
    this.learningSummary,
  });

  final LearningAnswerAttempt? attempt;
  final FinalLearningAssignment assignment;
  final LearningCheckProgress? progress;
  final BuildLearningSummary? learningSummary;
}

class FinalLearningCheckAiHandoff {
  const FinalLearningCheckAiHandoff({
    required this.suggestedPromptEn,
    required this.suggestedPromptAr,
    required this.context,
  });

  final String suggestedPromptEn;
  final String suggestedPromptAr;
  final FinalLearningCheckAiHandoffContext context;

  String suggestedPromptFor(String languageCode) =>
      languageCode == 'ar' ? suggestedPromptAr : suggestedPromptEn;
}

class FinalLearningCheckAiHandoffContext {
  const FinalLearningCheckAiHandoffContext({
    required this.projectId,
    required this.projectTitle,
    required this.buildId,
    required this.assignmentId,
    required this.questionPromptEn,
    required this.questionPromptAr,
    required this.selectedOptionKey,
    required this.selectedOptionTextEn,
    required this.selectedOptionTextAr,
    required this.isCorrect,
    required this.conceptKey,
    required this.explanationEn,
    required this.explanationAr,
    this.learningGoal,
  });

  final String projectId;
  final String projectTitle;
  final String buildId;
  final String assignmentId;
  final String questionPromptEn;
  final String questionPromptAr;
  final String selectedOptionKey;
  final String selectedOptionTextEn;
  final String selectedOptionTextAr;
  final bool isCorrect;
  final String conceptKey;
  final String explanationEn;
  final String explanationAr;
  final String? learningGoal;
}

class LearningCompletionReflectionResult {
  const LearningCompletionReflectionResult({
    required this.session,
    this.learningSummary,
  });

  final BuildLearningSession session;
  final BuildLearningSummary? learningSummary;
}

class LearningSessionBundle {
  const LearningSessionBundle({
    required this.session,
    required this.learningSetup,
  });

  final BuildLearningSession? session;
  final ProjectBuildLearningSetup learningSetup;
}

class LearningAnswerSubmissionResult {
  const LearningAnswerSubmissionResult({
    required this.attempt,
    required this.assignment,
  });

  final LearningAnswerAttempt attempt;
  final LearningAssignment assignment;
}
