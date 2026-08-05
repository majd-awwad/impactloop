import type { ProjectBuildStatus } from '../../generated/prisma/client.js';

import type { BuildLearningSummaryDto } from '../project-learning/project-learning-summary.service.js';
import { LEARNING_SUMMARY_SCHEMA_VERSION } from '../project-learning/project-learning-summary.service.js';

export type LearnerBuildLearningListStatus =
  | 'NOT_AVAILABLE'
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'REVIEW_RECOMMENDED'
  | 'COMPLETED';

export type LearnerBuildLearningProgressCounts = {
  handled: number;
  total: number;
};

/** Compact My Builds card learning metadata — no questions/answers/concepts. */
export type LearnerBuildLearningListSummaryDto = {
  status: LearnerBuildLearningListStatus;
  hasLearningGoal: boolean;
  startCheck: LearnerBuildLearningProgressCounts;
  stepChecks: LearnerBuildLearningProgressCounts;
  finalCheck: LearnerBuildLearningProgressCounts;
  understoodConceptCount: number;
  reviewConceptCount: number;
  goalOutcome: string | null;
  hasReflection: boolean;
};

export type PortfolioLearningConceptDto = {
  conceptKey: string;
  labelEn: string;
  labelAr: string;
};

/** Private Portfolio learning story — only emitted when meaningful. */
export type PortfolioLearningStoryDto = {
  goal?: string;
  goalOutcome?: string;
  confidenceBefore?: number;
  confidenceAfter?: number;
  reflection?: string;
  startCheck?: LearnerBuildLearningProgressCounts;
  stepChecks?: LearnerBuildLearningProgressCounts;
  finalCheck?: LearnerBuildLearningProgressCounts;
  understoodConcepts?: PortfolioLearningConceptDto[];
  reviewConcepts?: PortfolioLearningConceptDto[];
};

export type LearningSessionListSelect = {
  id: string;
  learningGoal: string | null;
  confidenceBefore: number | null;
  confidenceAfter: number | null;
  goalOutcome: string | null;
  finalReflection: string | null;
  learningSummary: unknown;
};

const emptyCounts = (): LearnerBuildLearningProgressCounts => ({
  handled: 0,
  total: 0,
});

const readPersistedSummary = (
  learningSummary: unknown,
): BuildLearningSummaryDto | null => {
  if (
    !learningSummary ||
    typeof learningSummary !== 'object' ||
    Array.isArray(learningSummary)
  ) {
    return null;
  }

  const summary = learningSummary as BuildLearningSummaryDto;
  if (summary.schemaVersion !== LEARNING_SUMMARY_SCHEMA_VERSION) {
    return null;
  }

  return summary;
};

const progressFromSummary = (
  summary: BuildLearningSummaryDto | null,
  stage: 'startCheck' | 'stepChecks' | 'finalCheck',
): LearnerBuildLearningProgressCounts => {
  if (!summary) {
    return emptyCounts();
  }
  const stageProgress = summary[stage];
  return {
    handled: stageProgress?.handled ?? 0,
    total: stageProgress?.total ?? 0,
  };
};

const hasAnyHandledChecks = (summary: BuildLearningSummaryDto | null) => {
  if (!summary) {
    return false;
  }
  return (
    summary.startCheck.handled > 0 ||
    summary.stepChecks.handled > 0 ||
    summary.finalCheck.handled > 0
  );
};

const hasSessionPreferences = (session: LearningSessionListSelect) =>
  Boolean(
    (session.learningGoal && session.learningGoal.trim().length > 0) ||
      session.confidenceBefore != null ||
      session.confidenceAfter != null ||
      session.goalOutcome != null ||
      (session.finalReflection && session.finalReflection.trim().length > 0),
  );

export const deriveLearnerBuildLearningListStatus = (input: {
  buildStatus: ProjectBuildStatus | string;
  session: LearningSessionListSelect | null | undefined;
  summary: BuildLearningSummaryDto | null;
}): LearnerBuildLearningListStatus => {
  if (!input.session) {
    return 'NOT_AVAILABLE';
  }

  const reviewCount = input.summary?.reviewConcepts?.length ?? 0;
  if (reviewCount > 0) {
    return 'REVIEW_RECOMMENDED';
  }

  const isTerminal =
    input.buildStatus === 'COMPLETED' || input.buildStatus === 'ARCHIVED';
  const hasReflection = Boolean(input.session.finalReflection?.trim());
  const finalHandled = input.summary?.finalCheck.handled ?? 0;
  const hasGoalOutcome = input.session.goalOutcome != null;

  if (isTerminal && (hasReflection || finalHandled > 0 || hasGoalOutcome)) {
    return 'COMPLETED';
  }

  if (hasAnyHandledChecks(input.summary) || hasSessionPreferences(input.session)) {
    return 'IN_PROGRESS';
  }

  return 'NOT_STARTED';
};

export const mapMyBuildsLearningSummary = (input: {
  buildStatus: ProjectBuildStatus | string;
  session: LearningSessionListSelect | null | undefined;
}): LearnerBuildLearningListSummaryDto => {
  const session = input.session ?? null;
  const summary = session ? readPersistedSummary(session.learningSummary) : null;
  const status = deriveLearnerBuildLearningListStatus({
    buildStatus: input.buildStatus,
    session,
    summary,
  });

  return {
    status,
    hasLearningGoal: Boolean(session?.learningGoal?.trim()),
    startCheck: progressFromSummary(summary, 'startCheck'),
    stepChecks: progressFromSummary(summary, 'stepChecks'),
    finalCheck: progressFromSummary(summary, 'finalCheck'),
    understoodConceptCount: summary?.understoodConcepts?.length ?? 0,
    reviewConceptCount: summary?.reviewConcepts?.length ?? 0,
    goalOutcome: session?.goalOutcome ?? null,
    hasReflection: Boolean(session?.finalReflection?.trim()),
  };
};

const limitConcepts = (
  concepts: PortfolioLearningConceptDto[] | undefined,
  max = 12,
): PortfolioLearningConceptDto[] => {
  if (!concepts || concepts.length === 0) {
    return [];
  }
  return concepts.slice(0, max).map((concept) => ({
    conceptKey: concept.conceptKey,
    labelEn: concept.labelEn,
    labelAr: concept.labelAr,
  }));
};

export const mapPortfolioLearningStory = (input: {
  session: LearningSessionListSelect | null | undefined;
}): PortfolioLearningStoryDto | null => {
  const session = input.session;
  if (!session) {
    return null;
  }

  const summary = readPersistedSummary(session.learningSummary);
  const goal = session.learningGoal?.trim() || undefined;
  const reflection = session.finalReflection?.trim() || undefined;
  const understood = limitConcepts(summary?.understoodConcepts);
  const review = limitConcepts(summary?.reviewConcepts);

  const story: PortfolioLearningStoryDto = {};

  if (goal) {
    story.goal = goal;
  }
  if (session.goalOutcome) {
    story.goalOutcome = session.goalOutcome;
  }
  if (session.confidenceBefore != null) {
    story.confidenceBefore = session.confidenceBefore;
  }
  if (session.confidenceAfter != null) {
    story.confidenceAfter = session.confidenceAfter;
  }
  if (reflection) {
    story.reflection = reflection;
  }
  if (summary && summary.startCheck.total > 0) {
    story.startCheck = progressFromSummary(summary, 'startCheck');
  }
  if (summary && summary.stepChecks.total > 0) {
    story.stepChecks = progressFromSummary(summary, 'stepChecks');
  }
  if (summary && summary.finalCheck.total > 0) {
    story.finalCheck = progressFromSummary(summary, 'finalCheck');
  }
  if (understood.length > 0) {
    story.understoodConcepts = understood;
  }
  if (review.length > 0) {
    story.reviewConcepts = review;
  }

  if (Object.keys(story).length === 0) {
    return null;
  }

  return story;
};

export const learnerBuildLearningSessionListInclude = {
  select: {
    id: true,
    learningGoal: true,
    confidenceBefore: true,
    confidenceAfter: true,
    goalOutcome: true,
    finalReflection: true,
    learningSummary: true,
  },
} as const;
