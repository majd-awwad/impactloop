import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';

import {
  resolveLearningSummaryForSession,
  type BuildLearningSummaryDto,
} from '../project-learning/project-learning-summary.service.js';

export type AdminBuildLearningDetailDto = {
  learnerId: string;
  learnerDisplayName: string | null;
  learnerEmail: string | null;
  buildId: string;
  projectId: string;
  projectTitle: string;
  attemptNumber: number;
  buildStatus: string;
  packVersion: number | null;
  sessionId: string | null;
  sessionCreatedAt: string | null;
  sessionUpdatedAt: string | null;
  learningGoal: string | null;
  confidenceBefore: number | null;
  confidenceAfter: number | null;
  goalOutcome: string | null;
  finalReflection: string | null;
  startCheck: { handled: number; total: number } | null;
  stepChecks: { handled: number; total: number } | null;
  finalCheck: { handled: number; total: number } | null;
  understoodConcepts: Array<{
    conceptKey: string;
    labelEn: string;
    labelAr: string;
  }>;
  reviewConcepts: Array<{
    conceptKey: string;
    labelEn: string;
    labelAr: string;
  }>;
  packQuality: {
    packId: string;
    totalQuestions: number;
    insufficientDataCount: number;
    healthyCount: number;
    needsReviewCount: number;
    deprioritizedCount: number;
    unclearReportCount: number;
    questionCoverage: { start: number; step: number; final: number };
    reviewRecommended: boolean;
  } | null;
};

const progressSlice = (
  summary: BuildLearningSummaryDto | null,
  stage: 'startCheck' | 'stepChecks' | 'finalCheck',
) => {
  if (!summary) {
    return null;
  }
  return {
    handled: summary[stage].handled,
    total: summary[stage].total,
  };
};

/**
 * Admin read-only learning inspection for one learner build.
 * Computes missing summary on demand; never mutates; never calls AI.
 */
export const getAdminBuildLearningDetail = async (input: {
  learnerUserId: string;
  buildId: string;
}): Promise<AdminBuildLearningDetailDto> => {
  const build = await prisma.projectBuild.findFirst({
    where: {
      id: input.buildId,
      learnerId: input.learnerUserId,
    },
    select: {
      id: true,
      projectId: true,
      attemptNumber: true,
      status: true,
      learnerId: true,
      learner: {
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      },
      project: {
        select: {
          id: true,
          title: true,
        },
      },
      learningSession: {
        select: {
          id: true,
          packId: true,
          learningGoal: true,
          confidenceBefore: true,
          confidenceAfter: true,
          goalOutcome: true,
          finalReflection: true,
          learningSummary: true,
          createdAt: true,
          updatedAt: true,
          pack: {
            select: {
              versionNumber: true,
            },
          },
        },
      },
    },
  });

  if (!build) {
    throw new AppError('Project build not found.', 404, 'BUILD_NOT_FOUND');
  }

  const session = build.learningSession;
  let summary: BuildLearningSummaryDto | null = null;
  if (session) {
    summary = await resolveLearningSummaryForSession(session);
  }

  const displayName = build.learner.displayName?.trim() || null;

  let packQuality: AdminBuildLearningDetailDto['packQuality'] = null;
  if (session?.packId) {
    const { getProjectLearningQuestionQualitiesForPack } = await import(
      '../project-learning/project-learning-question-quality.service.js'
    );
    const quality = await getProjectLearningQuestionQualitiesForPack(
      session.packId,
    );
    packQuality = {
      packId: quality.summary.packId,
      totalQuestions: quality.summary.totalQuestions,
      insufficientDataCount: quality.summary.insufficientDataCount,
      healthyCount: quality.summary.healthyCount,
      needsReviewCount: quality.summary.needsReviewCount,
      deprioritizedCount: quality.summary.deprioritizedCount,
      unclearReportCount: quality.summary.unclearReportCount,
      questionCoverage: quality.summary.questionCoverage,
      reviewRecommended: quality.summary.reviewRecommended,
    };
  }

  return {
    learnerId: build.learnerId,
    learnerDisplayName: displayName || null,
    learnerEmail: build.learner.email,
    buildId: build.id,
    projectId: build.project.id,
    projectTitle: build.project.title,
    attemptNumber: build.attemptNumber,
    buildStatus: build.status,
    packVersion: session?.pack.versionNumber ?? null,
    sessionId: session?.id ?? null,
    sessionCreatedAt: session?.createdAt.toISOString() ?? null,
    sessionUpdatedAt: session?.updatedAt.toISOString() ?? null,
    learningGoal: session?.learningGoal ?? null,
    confidenceBefore: session?.confidenceBefore ?? null,
    confidenceAfter: session?.confidenceAfter ?? null,
    goalOutcome: session?.goalOutcome ?? null,
    finalReflection: session?.finalReflection ?? null,
    startCheck: progressSlice(summary, 'startCheck'),
    stepChecks: progressSlice(summary, 'stepChecks'),
    finalCheck: progressSlice(summary, 'finalCheck'),
    understoodConcepts: (summary?.understoodConcepts ?? []).slice(0, 20),
    reviewConcepts: (summary?.reviewConcepts ?? []).slice(0, 20),
    packQuality,
  };
};

export const listAdminLearnerBuildsWithLearning = async (input: {
  learnerUserId: string;
  page: number;
  limit: number;
}) => {
  const where = { learnerId: input.learnerUserId };
  const skip = (input.page - 1) * input.limit;

  const [items, total] = await Promise.all([
    prisma.projectBuild.findMany({
      where,
      select: {
        id: true,
        projectId: true,
        attemptNumber: true,
        status: true,
        startedAt: true,
        completedAt: true,
        archivedAt: true,
        updatedAt: true,
        project: {
          select: {
            id: true,
            title: true,
          },
        },
        learningSession: {
          select: {
            id: true,
            learningGoal: true,
            goalOutcome: true,
            confidenceBefore: true,
            confidenceAfter: true,
            finalReflection: true,
            learningSummary: true,
            pack: {
              select: { versionNumber: true },
            },
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      skip,
      take: input.limit,
    }),
    prisma.projectBuild.count({ where }),
  ]);

  return {
    items: items.map((build) => {
      const summary =
        build.learningSession?.learningSummary &&
        typeof build.learningSession.learningSummary === 'object' &&
        !Array.isArray(build.learningSession.learningSummary)
          ? (build.learningSession.learningSummary as BuildLearningSummaryDto)
          : null;

      return {
        buildId: build.id,
        projectId: build.projectId,
        projectTitle: build.project.title,
        attemptNumber: build.attemptNumber,
        buildStatus: build.status,
        startedAt: build.startedAt.toISOString(),
        completedAt: build.completedAt?.toISOString() ?? null,
        archivedAt: build.archivedAt?.toISOString() ?? null,
        updatedAt: build.updatedAt.toISOString(),
        hasLearningSession: Boolean(build.learningSession),
        packVersion: build.learningSession?.pack.versionNumber ?? null,
        learningGoal: build.learningSession?.learningGoal ?? null,
        goalOutcome: build.learningSession?.goalOutcome ?? null,
        hasReflection: Boolean(build.learningSession?.finalReflection?.trim()),
        understoodConceptCount: summary?.understoodConcepts?.length ?? 0,
        reviewConceptCount: summary?.reviewConcepts?.length ?? 0,
        finalCheckHandled: summary?.finalCheck.handled ?? 0,
        finalCheckTotal: summary?.finalCheck.total ?? 0,
      };
    }),
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    },
  };
};
