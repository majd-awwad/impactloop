import { prisma } from '../../database/prisma.js';

export const QUESTION_QUALITY_MIN_SAMPLE = 10;

export type ProjectLearningQuestionQualityClassification =
  | 'INSUFFICIENT_DATA'
  | 'HEALTHY'
  | 'NEEDS_REVIEW'
  | 'DEPRIORITIZED';

export type ProjectLearningQuestionQualityMetrics = {
  questionId: string;
  assignmentCount: number;
  handledCount: number;
  answeredCount: number;
  skippedCount: number;
  hintViewedCount: number;
  firstAttemptCorrectCount: number;
  eventualCorrectCount: number;
  incorrectOnlyCount: number;
  aiExplanationRequestedCount: number;
  unclearReportCount: number;
  lastAssignedAt: string | null;
  lastAnsweredAt: string | null;
  handledRate: number | null;
  skipRate: number | null;
  hintRate: number | null;
  firstAttemptCorrectRate: number | null;
  eventualCorrectRate: number | null;
  unclearReportRate: number | null;
  classification: ProjectLearningQuestionQualityClassification;
};

export type PackLearningQualitySummary = {
  packId: string;
  totalQuestions: number;
  insufficientDataCount: number;
  healthyCount: number;
  needsReviewCount: number;
  deprioritizedCount: number;
  unclearReportCount: number;
  questionCoverage: {
    start: number;
    step: number;
    final: number;
  };
  reviewRecommended: boolean;
};

const rate = (numerator: number, denominator: number): number | null => {
  if (denominator <= 0) {
    return null;
  }
  return numerator / denominator;
};

/**
 * Deterministic quality classification (LH-20).
 * Conservative thresholds; never treats difficulty alone as poor quality.
 */
export const classifyProjectLearningQuestionQuality = (input: {
  assignmentCount: number;
  handledCount: number;
  skipRate: number | null;
  hintRate: number | null;
  eventualCorrectRate: number | null;
  unclearReportRate: number | null;
  firstAttemptCorrectRate: number | null;
}): ProjectLearningQuestionQualityClassification => {
  if (input.assignmentCount < QUESTION_QUALITY_MIN_SAMPLE) {
    return 'INSUFFICIENT_DATA';
  }

  const unclearHigh = (input.unclearReportRate ?? 0) >= 0.25;
  const unclearVeryHigh = (input.unclearReportRate ?? 0) >= 0.4;
  const skipHigh = (input.skipRate ?? 0) >= 0.6;
  const hintHigh = (input.hintRate ?? 0) >= 0.75;
  const eventualLow =
    input.handledCount >= QUESTION_QUALITY_MIN_SAMPLE &&
    (input.eventualCorrectRate ?? 1) <= 0.2;
  const contradictory =
    unclearHigh && (input.firstAttemptCorrectRate ?? 0) >= 0.7;

  const severeSignals = [
    unclearVeryHigh,
    skipHigh && eventualLow,
    unclearHigh && skipHigh,
    unclearHigh && eventualLow,
    contradictory && skipHigh,
  ].filter(Boolean).length;

  if (severeSignals >= 2 || unclearVeryHigh) {
    return 'DEPRIORITIZED';
  }

  if (unclearHigh || skipHigh || eventualLow || (hintHigh && unclearHigh)) {
    return 'NEEDS_REVIEW';
  }

  return 'HEALTHY';
};

export const qualityClassRank = (
  classification: ProjectLearningQuestionQualityClassification,
): number => {
  switch (classification) {
    case 'HEALTHY':
      return 0;
    case 'INSUFFICIENT_DATA':
      return 1;
    case 'NEEDS_REVIEW':
      return 2;
    case 'DEPRIORITIZED':
      return 3;
    default:
      return 1;
  }
};

type AssignmentMetricRow = {
  id: string;
  questionId: string;
  status: string;
  hintViewedAt: Date | null;
  aiExplanationRequestedAt: Date | null;
  createdAt: Date;
  answerAttempts: Array<{ isCorrect: boolean; submittedAt: Date; attemptNumber: number }>;
  feedback: Array<{ clearedAt: Date | null }>;
};

export const computeQuestionQualityFromAssignments = (
  questionId: string,
  assignments: AssignmentMetricRow[],
): ProjectLearningQuestionQualityMetrics => {
  let handledCount = 0;
  let answeredCount = 0;
  let skippedCount = 0;
  let hintViewedCount = 0;
  let firstAttemptCorrectCount = 0;
  let eventualCorrectCount = 0;
  let incorrectOnlyCount = 0;
  let aiExplanationRequestedCount = 0;
  let unclearReportCount = 0;
  let lastAssignedAt: Date | null = null;
  let lastAnsweredAt: Date | null = null;

  for (const assignment of assignments) {
    if (!lastAssignedAt || assignment.createdAt > lastAssignedAt) {
      lastAssignedAt = assignment.createdAt;
    }

    if (assignment.hintViewedAt) {
      hintViewedCount += 1;
    }
    if (assignment.aiExplanationRequestedAt) {
      aiExplanationRequestedCount += 1;
    }
    if (assignment.feedback.some((item) => item.clearedAt == null)) {
      unclearReportCount += 1;
    }

    const attempts = [...assignment.answerAttempts].sort(
      (left, right) => left.attemptNumber - right.attemptNumber,
    );
    const hasAttempt = attempts.length > 0;
    const hasCorrect = attempts.some((attempt) => attempt.isCorrect);
    const isSkippedOnly = assignment.status === 'SKIPPED' && !hasAttempt;

    if (hasAttempt) {
      answeredCount += 1;
      handledCount += 1;
      const first = attempts[0]!;
      if (first.isCorrect) {
        firstAttemptCorrectCount += 1;
      }
      if (hasCorrect) {
        eventualCorrectCount += 1;
      } else {
        incorrectOnlyCount += 1;
      }
      for (const attempt of attempts) {
        if (!lastAnsweredAt || attempt.submittedAt > lastAnsweredAt) {
          lastAnsweredAt = attempt.submittedAt;
        }
      }
    } else if (isSkippedOnly) {
      skippedCount += 1;
      handledCount += 1;
    }
  }

  const assignmentCount = assignments.length;
  const skipRate = rate(skippedCount, assignmentCount);
  const hintRate = rate(hintViewedCount, assignmentCount);
  const handledRate = rate(handledCount, assignmentCount);
  const firstAttemptCorrectRate = rate(firstAttemptCorrectCount, answeredCount);
  const eventualCorrectRate = rate(eventualCorrectCount, answeredCount);
  const unclearReportRate = rate(unclearReportCount, assignmentCount);

  const classification = classifyProjectLearningQuestionQuality({
    assignmentCount,
    handledCount,
    skipRate,
    hintRate,
    eventualCorrectRate,
    unclearReportRate,
    firstAttemptCorrectRate,
  });

  return {
    questionId,
    assignmentCount,
    handledCount,
    answeredCount,
    skippedCount,
    hintViewedCount,
    firstAttemptCorrectCount,
    eventualCorrectCount,
    incorrectOnlyCount,
    aiExplanationRequestedCount,
    unclearReportCount,
    lastAssignedAt: lastAssignedAt?.toISOString() ?? null,
    lastAnsweredAt: lastAnsweredAt?.toISOString() ?? null,
    handledRate,
    skipRate,
    hintRate,
    firstAttemptCorrectRate,
    eventualCorrectRate,
    unclearReportRate,
    classification,
  };
};

/**
 * Query-derived metrics (Option A): aggregate from Assignments/Attempts/Feedback.
 * No AI calls. No learner identity in the returned DTO.
 */
export const getProjectLearningQuestionQuality = async (
  questionId: string,
): Promise<ProjectLearningQuestionQualityMetrics> => {
  const assignments = await prisma.projectBuildLearningQuestionAssignment.findMany({
    where: { questionId },
    select: {
      id: true,
      questionId: true,
      status: true,
      hintViewedAt: true,
      aiExplanationRequestedAt: true,
      createdAt: true,
      answerAttempts: {
        select: {
          isCorrect: true,
          submittedAt: true,
          attemptNumber: true,
        },
        orderBy: { attemptNumber: 'asc' },
      },
      feedback: {
        where: { type: 'UNCLEAR' },
        select: { clearedAt: true },
      },
    },
  });

  return computeQuestionQualityFromAssignments(questionId, assignments);
};

export const getProjectLearningQuestionQualitiesForPack = async (
  packId: string,
): Promise<{
  questions: ProjectLearningQuestionQualityMetrics[];
  summary: PackLearningQualitySummary;
}> => {
  const packQuestions = await prisma.projectLearningQuestion.findMany({
    where: { packId },
    select: {
      id: true,
      stage: true,
    },
    orderBy: [{ stage: 'asc' }, { packDisplayOrder: 'asc' }],
  });

  const questionIds = packQuestions.map((question) => question.id);
  const assignments = questionIds.length
    ? await prisma.projectBuildLearningQuestionAssignment.findMany({
        where: { questionId: { in: questionIds } },
        select: {
          id: true,
          questionId: true,
          status: true,
          hintViewedAt: true,
          aiExplanationRequestedAt: true,
          createdAt: true,
          answerAttempts: {
            select: {
              isCorrect: true,
              submittedAt: true,
              attemptNumber: true,
            },
            orderBy: { attemptNumber: 'asc' },
          },
          feedback: {
            where: { type: 'UNCLEAR' },
            select: { clearedAt: true },
          },
        },
      })
    : [];

  const byQuestion = new Map<string, AssignmentMetricRow[]>();
  for (const assignment of assignments) {
    const list = byQuestion.get(assignment.questionId) ?? [];
    list.push(assignment);
    byQuestion.set(assignment.questionId, list);
  }

  const questions = packQuestions.map((question) =>
    computeQuestionQualityFromAssignments(
      question.id,
      byQuestion.get(question.id) ?? [],
    ),
  );

  const summary: PackLearningQualitySummary = {
    packId,
    totalQuestions: questions.length,
    insufficientDataCount: questions.filter(
      (item) => item.classification === 'INSUFFICIENT_DATA',
    ).length,
    healthyCount: questions.filter((item) => item.classification === 'HEALTHY')
      .length,
    needsReviewCount: questions.filter(
      (item) => item.classification === 'NEEDS_REVIEW',
    ).length,
    deprioritizedCount: questions.filter(
      (item) => item.classification === 'DEPRIORITIZED',
    ).length,
    unclearReportCount: questions.reduce(
      (sum, item) => sum + item.unclearReportCount,
      0,
    ),
    questionCoverage: {
      start: packQuestions.filter((item) => item.stage === 'START').length,
      step: packQuestions.filter((item) => item.stage === 'STEP').length,
      final: packQuestions.filter((item) => item.stage === 'FINAL').length,
    },
    reviewRecommended: questions.some(
      (item) =>
        item.classification === 'NEEDS_REVIEW' ||
        item.classification === 'DEPRIORITIZED',
    ),
  };

  return { questions, summary };
};
