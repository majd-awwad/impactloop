import {
  mapLearnerLearningAnswerAttempt,
  mapLearnerLearningAssignment,
  mapLearnerLearningQuestion,
  type LearnerLearningAnswerAttemptDto,
  type LearnerLearningAssignmentDto,
} from './project-learning.dto.js';

export type StepLearningCheckUiState =
  | 'NOT_ATTEMPTED'
  | 'INCORRECT'
  | 'CORRECT'
  | 'SKIPPED'
  | 'REVIEWED';

export type LearnerStepLearningCheckDto = {
  assignmentId: string;
  stepId: string;
  stage: 'STEP';
  questionType: string;
  displayOrder: number;
  status: string;
  uiState: StepLearningCheckUiState;
  attemptCount: number;
  hintViewed: boolean;
  hintViewedAt: string | null;
  unclearReported: boolean;
  mayRetry: boolean;
  isReadOnly: boolean;
  latestSelectedOptionKey: string | null;
  hasCorrectAttempt: boolean;
  question: ReturnType<typeof mapLearnerLearningQuestion>;
  answerAttempts: LearnerLearningAnswerAttemptDto[];
  correctOptionKey: string | null;
  latestResult: {
    selectedOptionKey: string;
    isCorrect: boolean;
    attemptNumber: number;
    explanationEn: string;
    explanationAr: string;
    correctOptionKey: string | null;
    mayRetry: boolean;
  } | null;
};

type StepAssignmentRecord = {
  id: string;
  questionId: string;
  stage: string;
  projectStepId: string | null;
  orderScopeKey: string;
  status: string;
  displayOrder: number;
  hintViewedAt: Date | null;
  question: Parameters<typeof mapLearnerLearningQuestion>[0] & {
    correctOptionKey: string;
    questionType: string;
    explanationEn: string;
    explanationAr: string;
  };
  answerAttempts: Array<{
    id: string;
    attemptNumber: number;
    selectedOptionKey: string;
    isCorrect: boolean;
    submittedAt: Date;
  }>;
  feedback?: ReadonlyArray<{ id?: string; clearedAt?: Date | null }>;
};

export const deriveStepLearningCheckUiState = (
  assignment: StepAssignmentRecord,
  options?: { readOnlyReview?: boolean },
): StepLearningCheckUiState => {
  const hasCorrect = assignment.answerAttempts.some((attempt) => attempt.isCorrect);

  if (hasCorrect) {
    return options?.readOnlyReview ? 'REVIEWED' : 'CORRECT';
  }

  if (assignment.status === 'SKIPPED' && assignment.answerAttempts.length === 0) {
    return 'SKIPPED';
  }

  if (assignment.answerAttempts.length > 0) {
    return 'INCORRECT';
  }

  return 'NOT_ATTEMPTED';
};

export const mapLearnerStepLearningCheck = (
  assignment: StepAssignmentRecord,
  input: {
    stepId: string;
    isReadOnly: boolean;
  },
): LearnerStepLearningCheckDto => {
  const mappedAssignment = mapLearnerLearningAssignment(
    assignment as Parameters<typeof mapLearnerLearningAssignment>[0],
  );
  const uiState = deriveStepLearningCheckUiState(assignment, {
    readOnlyReview: input.isReadOnly,
  });
  const hasCorrectAttempt = assignment.answerAttempts.some(
    (attempt) => attempt.isCorrect,
  );
  const latestAttempt = assignment.answerAttempts.length
    ? assignment.answerAttempts[assignment.answerAttempts.length - 1]!
    : null;
  const mayRetry = !input.isReadOnly && !hasCorrectAttempt;

  const exposeCorrectOptionKey =
    latestAttempt != null || assignment.status === 'SKIPPED';

  return {
    assignmentId: assignment.id,
    stepId: input.stepId,
    stage: 'STEP',
    questionType: assignment.question.questionType,
    displayOrder: assignment.displayOrder,
    status: assignment.status,
    uiState,
    attemptCount: assignment.answerAttempts.length,
    hintViewed: assignment.hintViewedAt != null,
    hintViewedAt: assignment.hintViewedAt?.toISOString() ?? null,
    unclearReported: mappedAssignment.unclearReported,
    mayRetry,
    isReadOnly: input.isReadOnly,
    latestSelectedOptionKey: latestAttempt?.selectedOptionKey ?? null,
    hasCorrectAttempt,
    question: mappedAssignment.question,
    answerAttempts: mappedAssignment.answerAttempts,
    correctOptionKey:
      exposeCorrectOptionKey && hasCorrectAttempt
        ? assignment.question.correctOptionKey
        : null,
    latestResult:
      latestAttempt == null
        ? null
        : {
            selectedOptionKey: latestAttempt.selectedOptionKey,
            isCorrect: latestAttempt.isCorrect,
            attemptNumber: latestAttempt.attemptNumber,
            explanationEn: assignment.question.explanationEn,
            explanationAr: assignment.question.explanationAr,
            correctOptionKey: latestAttempt.isCorrect
              ? null
              : assignment.question.correctOptionKey,
            mayRetry: !input.isReadOnly && !latestAttempt.isCorrect,
          },
  };
};

export type StepLearningCheckAiHandoffDto = {
  suggestedPromptEn: string;
  suggestedPromptAr: string;
  context: {
    projectId: string;
    projectTitle: string;
    buildId: string;
    stepId: string;
    stepTitle: string;
    stepDescription: string;
    questionPromptEn: string;
    questionPromptAr: string;
    selectedOptionKey: string;
    selectedOptionTextEn: string;
    selectedOptionTextAr: string;
    isCorrect: boolean;
    conceptKey: string;
    explanationEn: string;
    explanationAr: string;
  };
};

export const stepLearningCheckDtoExcludesCorrectAnswerBeforeSubmission = (
  dto: LearnerStepLearningCheckDto,
): boolean => {
  if (dto.attemptCount > 0 || dto.status === 'SKIPPED') {
    return true;
  }

  return dto.correctOptionKey == null && dto.latestResult == null;
};
