import { createHash } from 'node:crypto';

import type { ProjectLearningPackRecord } from './project-learning-pack.repository.js';
import type { CreateLearningSessionForBuildInput } from './build-learning-session.service.js';
import {
  getProjectLearningQuestionQuality,
  qualityClassRank,
  type ProjectLearningQuestionQualityClassification,
} from './project-learning-question-quality.service.js';

const stableIndex = (seed: string, length: number): number => {
  if (length <= 0) {
    return 0;
  }

  const digest = createHash('sha256').update(seed).digest();
  return digest.readUInt32BE(0) % length;
};

const sortQuestions = (questions: ProjectLearningPackRecord['questions']) =>
  [...questions].sort((left, right) => {
    if (left.stage !== right.stage) {
      return left.stage.localeCompare(right.stage);
    }

    if (left.orderScopeKey !== right.orderScopeKey) {
      return left.orderScopeKey.localeCompare(right.orderScopeKey);
    }

    return left.packDisplayOrder - right.packDisplayOrder;
  });

type QuestionCandidate = ProjectLearningPackRecord['questions'][number] & {
  qualityClass?: ProjectLearningQuestionQualityClassification;
};

/**
 * Prefer HEALTHY → INSUFFICIENT_DATA → NEEDS_REVIEW → DEPRIORITIZED,
 * then deterministic Build-specific index within the best available class.
 * Never omits the only available Question. Never calls AI.
 */
export const selectStepQuestionWithQuality = (input: {
  candidates: QuestionCandidate[];
  buildId: string;
  projectStepId: string;
}): QuestionCandidate => {
  const ranked = [...input.candidates].sort((left, right) => {
    const leftRank = qualityClassRank(left.qualityClass ?? 'INSUFFICIENT_DATA');
    const rightRank = qualityClassRank(
      right.qualityClass ?? 'INSUFFICIENT_DATA',
    );
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    if (left.orderScopeKey !== right.orderScopeKey) {
      return left.orderScopeKey.localeCompare(right.orderScopeKey);
    }
    return left.packDisplayOrder - right.packDisplayOrder;
  });

  const bestRank = qualityClassRank(
    ranked[0]?.qualityClass ?? 'INSUFFICIENT_DATA',
  );
  const bestClass = ranked.filter(
    (question) =>
      qualityClassRank(question.qualityClass ?? 'INSUFFICIENT_DATA') ===
      bestRank,
  );

  const selectedIndex = stableIndex(
    `${input.buildId}:${input.projectStepId}:step`,
    bestClass.length,
  );
  return bestClass[selectedIndex]!;
};

export const buildDeterministicLearningAssignments = async (input: {
  pack: ProjectLearningPackRecord;
  buildId: string;
  projectStepIds: string[];
}): Promise<CreateLearningSessionForBuildInput['assignments']> => {
  const assignments: CreateLearningSessionForBuildInput['assignments'] = [];
  const questions = sortQuestions(input.pack.questions);

  const qualityById = new Map<
    string,
    ProjectLearningQuestionQualityClassification
  >();

  const stepQuestionIdsNeedingMetrics = new Set<string>();
  for (const projectStepId of input.projectStepIds) {
    const stepQuestions = questions.filter(
      (question) =>
        question.stage === 'STEP' && question.projectStepId === projectStepId,
    );
    if (stepQuestions.length > 1) {
      for (const question of stepQuestions) {
        stepQuestionIdsNeedingMetrics.add(question.id);
      }
    }
  }

  await Promise.all(
    [...stepQuestionIdsNeedingMetrics].map(async (questionId) => {
      const metrics = await getProjectLearningQuestionQuality(questionId);
      qualityById.set(questionId, metrics.classification);
    }),
  );

  const startQuestions = questions.filter((question) => question.stage === 'START');
  for (const [index, question] of startQuestions.entries()) {
    assignments.push({
      questionId: question.id,
      stage: 'START',
      displayOrder: index + 1,
    });
  }

  for (const projectStepId of input.projectStepIds) {
    const stepQuestions = questions
      .filter(
        (question) =>
          question.stage === 'STEP' && question.projectStepId === projectStepId,
      )
      .map((question) => ({
        ...question,
        qualityClass: qualityById.get(question.id) ?? 'INSUFFICIENT_DATA',
      }));
    if (stepQuestions.length === 0) {
      continue;
    }

    const question = selectStepQuestionWithQuality({
      candidates: stepQuestions,
      buildId: input.buildId,
      projectStepId,
    });
    assignments.push({
      questionId: question.id,
      stage: 'STEP',
      projectStepId,
      displayOrder: 1,
    });
  }

  const finalQuestions = questions.filter((question) => question.stage === 'FINAL');
  for (const [index, question] of finalQuestions.entries()) {
    assignments.push({
      questionId: question.id,
      stage: 'FINAL',
      displayOrder: index + 1,
    });
  }

  return assignments;
};

/** Sync helper for unit tests with injected quality classes. */
export const buildDeterministicLearningAssignmentsFromCandidates = (input: {
  pack: ProjectLearningPackRecord;
  buildId: string;
  projectStepIds: string[];
  qualityByQuestionId?: Record<
    string,
    ProjectLearningQuestionQualityClassification
  >;
}): CreateLearningSessionForBuildInput['assignments'] => {
  const assignments: CreateLearningSessionForBuildInput['assignments'] = [];
  const questions = sortQuestions(input.pack.questions);

  const startQuestions = questions.filter((question) => question.stage === 'START');
  for (const [index, question] of startQuestions.entries()) {
    assignments.push({
      questionId: question.id,
      stage: 'START',
      displayOrder: index + 1,
    });
  }

  for (const projectStepId of input.projectStepIds) {
    const stepQuestions = questions
      .filter(
        (question) =>
          question.stage === 'STEP' && question.projectStepId === projectStepId,
      )
      .map((question) => ({
        ...question,
        qualityClass:
          input.qualityByQuestionId?.[question.id] ?? 'INSUFFICIENT_DATA',
      }));
    if (stepQuestions.length === 0) {
      continue;
    }
    const question = selectStepQuestionWithQuality({
      candidates: stepQuestions,
      buildId: input.buildId,
      projectStepId,
    });
    assignments.push({
      questionId: question.id,
      stage: 'STEP',
      projectStepId,
      displayOrder: 1,
    });
  }

  const finalQuestions = questions.filter((question) => question.stage === 'FINAL');
  for (const [index, question] of finalQuestions.entries()) {
    assignments.push({
      questionId: question.id,
      stage: 'FINAL',
      displayOrder: index + 1,
    });
  }

  return assignments;
};

export const countStartAssignments = (
  assignments: CreateLearningSessionForBuildInput['assignments'],
): number => assignments.filter((assignment) => assignment.stage === 'START').length;
