import type { Prisma } from '../../generated/prisma/client.js';

import {
  mapLearnerLearningQuestion,
  type LearnerLearningAnswerAttemptDto,
} from './project-learning.dto.js';
import {
  computeStageProgress,
  type BuildLearningSummaryDto,
  type LearningCheckProgressDto,
} from './project-learning-summary.service.js';

export type FinalLearningCheckUiState =
  | 'NOT_ATTEMPTED'
  | 'INCORRECT'
  | 'CORRECT'
  | 'SKIPPED'
  | 'REVIEWED';

export type LearnerFinalLearningAssignmentDto = {
  assignmentId: string;
  questionId: string;
  stage: 'FINAL';
  questionType: string;
  displayOrder: number;
  status: string;
  uiState: FinalLearningCheckUiState;
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
    submittedAt: string;
    explanationEn: string;
    explanationAr: string;
    correctOptionKey: string | null;
    mayRetry: boolean;
  } | null;
};

export type LearnerFinalLearningCheckDto = {
  available: boolean;
  isReadOnly: boolean;
  progress: LearningCheckProgressDto;
  assignments: LearnerFinalLearningAssignmentDto[];
  learningSummary: BuildLearningSummaryDto | null;
};

type FinalAssignmentRecord = {
  id: string;
  questionId: string;
  stage: string;
  projectStepId?: string | null;
  status: string;
  displayOrder: number;
  hintViewedAt: Date | null;
  question: Parameters<typeof mapLearnerLearningQuestion>[0] & {
    correctOptionKey: string;
    questionType: string;
    conceptKey: string;
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

export const deriveFinalLearningCheckUiState = (
  assignment: FinalAssignmentRecord,
  options?: { readOnlyReview?: boolean },
): FinalLearningCheckUiState => {
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

export const mapLearnerFinalLearningAssignment = (
  assignment: FinalAssignmentRecord,
  input: { isReadOnly: boolean },
): LearnerFinalLearningAssignmentDto => {
  const uiState = deriveFinalLearningCheckUiState(assignment, {
    readOnlyReview: input.isReadOnly,
  });
  const hasCorrectAttempt = assignment.answerAttempts.some(
    (attempt) => attempt.isCorrect,
  );
  const latestAttempt = assignment.answerAttempts.length
    ? [...assignment.answerAttempts].sort(
        (left, right) => left.attemptNumber - right.attemptNumber,
      )[assignment.answerAttempts.length - 1]!
    : null;
  const sortedAttempts = assignment.answerAttempts
    .slice()
    .sort((left, right) => left.attemptNumber - right.attemptNumber);

  return {
    assignmentId: assignment.id,
    questionId: assignment.questionId,
    stage: 'FINAL',
    questionType: assignment.question.questionType,
    displayOrder: assignment.displayOrder,
    status: assignment.status,
    uiState,
    attemptCount: assignment.answerAttempts.length,
    hintViewed: assignment.hintViewedAt != null,
    hintViewedAt: assignment.hintViewedAt?.toISOString() ?? null,
    unclearReported: Array.isArray(assignment.feedback)
      ? assignment.feedback.length > 0
      : false,
    mayRetry: !input.isReadOnly && !hasCorrectAttempt,
    isReadOnly: input.isReadOnly,
    latestSelectedOptionKey: latestAttempt?.selectedOptionKey ?? null,
    hasCorrectAttempt,
    question: mapLearnerLearningQuestion(assignment.question),
    answerAttempts: sortedAttempts.map((attempt) => ({
      id: attempt.id,
      attemptNumber: attempt.attemptNumber,
      selectedOptionKey: attempt.selectedOptionKey,
      isCorrect: attempt.isCorrect,
      submittedAt: attempt.submittedAt.toISOString(),
    })),
    correctOptionKey:
      latestAttempt != null && hasCorrectAttempt
        ? assignment.question.correctOptionKey
        : null,
    latestResult:
      latestAttempt == null
        ? null
        : {
            selectedOptionKey: latestAttempt.selectedOptionKey,
            isCorrect: latestAttempt.isCorrect,
            attemptNumber: latestAttempt.attemptNumber,
            submittedAt: latestAttempt.submittedAt.toISOString(),
            explanationEn: assignment.question.explanationEn,
            explanationAr: assignment.question.explanationAr,
            correctOptionKey: latestAttempt.isCorrect
              ? null
              : assignment.question.correctOptionKey,
            mayRetry: !input.isReadOnly && !latestAttempt.isCorrect,
          },
  };
};

export const mapLearnerFinalLearningCheck = (input: {
  assignments: FinalAssignmentRecord[];
  isReadOnly: boolean;
  learningSummary: BuildLearningSummaryDto | null;
}): LearnerFinalLearningCheckDto => {
  const mapped = input.assignments
    .slice()
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map((assignment) =>
      mapLearnerFinalLearningAssignment(assignment, {
        isReadOnly: input.isReadOnly,
      }),
    );

  return {
    available: true,
    isReadOnly: input.isReadOnly,
    progress: computeStageProgress(input.assignments),
    assignments: mapped,
    learningSummary: input.learningSummary,
  };
};

export type FinalLearningCheckAiHandoffDto = {
  suggestedPromptEn: string;
  suggestedPromptAr: string;
  context: {
    projectId: string;
    projectTitle: string;
    buildId: string;
    assignmentId: string;
    questionPromptEn: string;
    questionPromptAr: string;
    selectedOptionKey: string;
    selectedOptionTextEn: string;
    selectedOptionTextAr: string;
    isCorrect: boolean;
    conceptKey: string;
    explanationEn: string;
    explanationAr: string;
    learningGoal: string | null;
  };
};

export const finalLearningCheckDtoExcludesCorrectAnswerBeforeSubmission = (
  dto: LearnerFinalLearningAssignmentDto,
): boolean => {
  if (dto.attemptCount > 0 || dto.status === 'SKIPPED') {
    return true;
  }

  return dto.correctOptionKey == null && dto.latestResult == null;
};
