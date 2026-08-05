import type { Prisma } from '../../generated/prisma/client.js';

export type LearnerLearningQuestionOptionDto = {
  optionKey: string;
  textEn: string;
  textAr: string;
  displayOrder: number;
};

export type LearnerLearningQuestionDto = {
  id: string;
  stage: string;
  projectStepId: string | null;
  questionType: string;
  conceptKey: string;
  promptEn: string;
  promptAr: string;
  explanationEn: string;
  explanationAr: string;
  hintEn: string;
  hintAr: string;
  relativeDifficulty: number;
  options: LearnerLearningQuestionOptionDto[];
};

export type AdminLearningQuestionReadDto = LearnerLearningQuestionDto & {
  correctOptionKey: string;
};

export type LearnerLearningAnswerAttemptDto = {
  id: string;
  attemptNumber: number;
  selectedOptionKey: string;
  isCorrect: boolean;
  submittedAt: string;
};

export type LearnerLearningAssignmentDto = {
  id: string;
  questionId: string;
  stage: string;
  projectStepId: string | null;
  orderScopeKey: string;
  displayOrder: number;
  status: string;
  hintViewedAt: string | null;
  /** Own-assignment unclear flag only; never aggregate counts. */
  unclearReported: boolean;
  /** Step title for STEP-stage review; omitted when not applicable. */
  stepTitle?: string | null;
  /** Correct option key after a submitted incorrect attempt only. */
  reviewCorrectOptionKey?: string | null;
  question: LearnerLearningQuestionDto;
  answerAttempts: LearnerLearningAnswerAttemptDto[];
};

export type LearnerLearningSessionDto = {
  id: string;
  buildId: string;
  packId: string;
  learningGoal: string | null;
  confidenceBefore: number | null;
  confidenceAfter: number | null;
  goalOutcome: string | null;
  finalReflection: string | null;
  learningSummary: Prisma.JsonValue | null;
  assignments: LearnerLearningAssignmentDto[];
  createdAt: string;
  updatedAt: string;
};

type QuestionWithOptions = Prisma.ProjectLearningQuestionGetPayload<{
  include: { options: true };
}>;

export const mapLearnerLearningQuestionOption = (
  option: QuestionWithOptions['options'][number],
): LearnerLearningQuestionOptionDto => ({
  optionKey: option.optionKey,
  textEn: option.textEn,
  textAr: option.textAr,
  displayOrder: option.displayOrder,
});

export const mapLearnerLearningQuestion = (
  question: QuestionWithOptions,
): LearnerLearningQuestionDto => ({
  id: question.id,
  stage: question.stage,
  projectStepId: question.projectStepId,
  questionType: question.questionType,
  conceptKey: question.conceptKey,
  promptEn: question.promptEn,
  promptAr: question.promptAr,
  explanationEn: question.explanationEn,
  explanationAr: question.explanationAr,
  hintEn: question.hintEn,
  hintAr: question.hintAr,
  relativeDifficulty: question.relativeDifficulty,
  options: question.options
    .slice()
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map(mapLearnerLearningQuestionOption),
});

export const mapAdminLearningQuestionRead = (
  question: QuestionWithOptions,
): AdminLearningQuestionReadDto => ({
  ...mapLearnerLearningQuestion(question),
  correctOptionKey: question.correctOptionKey,
});

export const mapLearnerLearningAnswerAttempt = (
  attempt: Prisma.ProjectBuildLearningAnswerAttemptGetPayload<object>,
): LearnerLearningAnswerAttemptDto => ({
  id: attempt.id,
  attemptNumber: attempt.attemptNumber,
  selectedOptionKey: attempt.selectedOptionKey,
  isCorrect: attempt.isCorrect,
  submittedAt: attempt.submittedAt.toISOString(),
});

type LearnerAssignmentSource = {
  id: string;
  questionId: string;
  stage: string;
  projectStepId: string | null;
  orderScopeKey: string;
  displayOrder: number;
  status: string;
  hintViewedAt: Date | null;
  question: QuestionWithOptions;
  answerAttempts: Array<
    Prisma.ProjectBuildLearningAnswerAttemptGetPayload<object>
  >;
  feedback?: ReadonlyArray<{ id?: string; clearedAt?: Date | null }>;
};

const mapUnclearReported = (assignment: LearnerAssignmentSource): boolean =>
  Array.isArray(assignment.feedback) && assignment.feedback.length > 0;

export const resolveReviewCorrectOptionKey = (
  assignment: LearnerAssignmentSource,
): string | null => {
  if (assignment.answerAttempts.length === 0) {
    return null;
  }

  const latestAttempt = assignment.answerAttempts
    .slice()
    .sort((left, right) => left.attemptNumber - right.attemptNumber)
    .at(-1);

  if (latestAttempt == null || latestAttempt.isCorrect) {
    return null;
  }

  return assignment.question.correctOptionKey;
};

type LearnerLearningAssignmentMapContext = {
  stepTitlesById?: ReadonlyMap<string, string>;
};

export const mapLearnerLearningAssignment = (
  assignment: LearnerAssignmentSource,
  context?: LearnerLearningAssignmentMapContext,
): LearnerLearningAssignmentDto => ({
  id: assignment.id,
  questionId: assignment.questionId,
  stage: assignment.stage,
  projectStepId: assignment.projectStepId,
  orderScopeKey: assignment.orderScopeKey,
  displayOrder: assignment.displayOrder,
  status: assignment.status,
  hintViewedAt: assignment.hintViewedAt?.toISOString() ?? null,
  unclearReported: mapUnclearReported(assignment),
  stepTitle:
    assignment.projectStepId != null
      ? (context?.stepTitlesById?.get(assignment.projectStepId) ?? null)
      : null,
  reviewCorrectOptionKey: resolveReviewCorrectOptionKey(assignment),
  question: mapLearnerLearningQuestion(assignment.question),
  answerAttempts: assignment.answerAttempts
    .slice()
    .sort((left, right) => left.attemptNumber - right.attemptNumber)
    .map(mapLearnerLearningAnswerAttempt),
});

const resolveStepTitlesById = (session: {
  build?: {
    project?: {
      steps?: Array<{ id: string; title: string }>;
    };
  };
}): ReadonlyMap<string, string> => {
  const steps = session.build?.project?.steps ?? [];
  return new Map(steps.map((step) => [step.id, step.title]));
};

export const mapLearnerLearningSession = (session: {
  id: string;
  buildId: string;
  packId: string;
  learningGoal: string | null;
  confidenceBefore: number | null;
  confidenceAfter: number | null;
  goalOutcome?: string | null;
  finalReflection: string | null;
  learningSummary: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  assignments: LearnerAssignmentSource[];
  build?: {
    project?: {
      steps?: Array<{ id: string; title: string }>;
    };
  };
}): LearnerLearningSessionDto => {
  const stepTitlesById = resolveStepTitlesById(session);

  return {
  id: session.id,
  buildId: session.buildId,
  packId: session.packId,
  learningGoal: session.learningGoal,
  confidenceBefore: session.confidenceBefore,
  confidenceAfter: session.confidenceAfter,
  goalOutcome: session.goalOutcome ?? null,
  finalReflection: session.finalReflection,
  learningSummary: session.learningSummary,
  assignments: session.assignments
    .slice()
    .sort((left, right) => {
      if (left.stage !== right.stage) {
        return left.stage.localeCompare(right.stage);
      }

      if (left.orderScopeKey !== right.orderScopeKey) {
        return left.orderScopeKey.localeCompare(right.orderScopeKey);
      }

      return left.displayOrder - right.displayOrder;
    })
    .map((assignment) =>
      mapLearnerLearningAssignment(assignment, { stepTitlesById }),
    ),
  createdAt: session.createdAt.toISOString(),
  updatedAt: session.updatedAt.toISOString(),
  };
};

export const learnerDtoExcludesCorrectAnswerMetadata = (
  question: LearnerLearningQuestionDto,
): boolean => {
  return !('correctOptionKey' in question);
};
