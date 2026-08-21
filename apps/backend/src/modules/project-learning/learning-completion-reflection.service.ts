import type { ProjectBuildLearningGoalOutcome } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';

import { findProjectBuild } from '../learning-projects/learning-projects.repository.js';
import { findOwnedLearningSessionByBuildId } from './build-learning-session.repository.js';
import { mapLearnerLearningSession } from './project-learning.dto.js';
import { persistBuildLearningSummary } from './project-learning-summary.service.js';
import { sanitizeProjectLearningText } from './project-learning-text.js';

const GOAL_OUTCOMES = new Set([
  'ACHIEVED',
  'PARTIALLY_ACHIEVED',
  'NOT_YET_ACHIEVED',
]);

export type UpdateCompletionReflectionInput = {
  projectId: string;
  learnerId: string;
  /** Required by history/portfolio callers to bind the mutation to one attempt. */
  buildId?: string;
  goalOutcome?: ProjectBuildLearningGoalOutcome | null;
  confidenceAfter?: number | null;
  finalReflection?: string | null;
};

export const updateLearningCompletionReflection = async (
  input: UpdateCompletionReflectionInput,
) => {
  const build = await findProjectBuild(
    input.projectId,
    input.learnerId,
    input.buildId,
  );
  if (!build) {
    throw new AppError('Project build not found.', 404, 'BUILD_NOT_FOUND');
  }

  if (build.status === 'ARCHIVED') {
    throw new AppError(
      'Learning reflection is locked for archived builds.',
      409,
      'BUILD_LEARNING_REFLECTION_LOCKED',
    );
  }

  if (build.status !== 'COMPLETED') {
    throw new AppError(
      'Learning reflection is available only after build completion.',
      409,
      'BUILD_LEARNING_REFLECTION_NOT_AVAILABLE',
    );
  }

  const session = await findOwnedLearningSessionByBuildId(
    build.id,
    input.learnerId,
  );
  if (!session) {
    throw new AppError(
      'Learning session is not ready.',
      409,
      'LEARNING_SESSION_NOT_READY',
    );
  }

  const completedAtBefore = build.completedAt;

  if (input.goalOutcome !== undefined && input.goalOutcome !== null) {
    if (!GOAL_OUTCOMES.has(input.goalOutcome)) {
      throw new AppError(
        'Invalid learning goal outcome.',
        400,
        'INVALID_GOAL_OUTCOME',
      );
    }
  }

  if (input.confidenceAfter !== undefined && input.confidenceAfter !== null) {
    if (
      !Number.isInteger(input.confidenceAfter) ||
      input.confidenceAfter < 1 ||
      input.confidenceAfter > 5
    ) {
      throw new AppError(
        'Confidence after must be between 1 and 5.',
        400,
        'INVALID_CONFIDENCE',
      );
    }
  }

  let finalReflection: string | null | undefined = input.finalReflection;
  if (finalReflection !== undefined) {
    if (finalReflection == null) {
      finalReflection = null;
    } else {
      const sanitized = sanitizeProjectLearningText(finalReflection).trim();
      if (sanitized.length > 1500) {
        throw new AppError(
          'Learning reflection is too long.',
          400,
          'LEARNING_REFLECTION_TOO_LONG',
        );
      }
      finalReflection = sanitized.length === 0 ? null : sanitized;
    }
  }

  const updated = await prisma.projectBuildLearningSession.update({
    where: { id: session.id },
    data: {
      ...(input.goalOutcome !== undefined
        ? { goalOutcome: input.goalOutcome }
        : {}),
      ...(input.confidenceAfter !== undefined
        ? { confidenceAfter: input.confidenceAfter }
        : {}),
      ...(finalReflection !== undefined
        ? { finalReflection }
        : {}),
    },
    include: {
      assignments: {
        include: {
          question: {
            include: {
              options: {
                orderBy: { displayOrder: 'asc' },
              },
            },
          },
          answerAttempts: {
            orderBy: { attemptNumber: 'asc' },
          },
        },
        orderBy: [
          { stage: 'asc' },
          { orderScopeKey: 'asc' },
          { displayOrder: 'asc' },
        ],
      },
    },
  });

  const learningSummary = await persistBuildLearningSummary(updated.id);

  if (completedAtBefore) {
    const reloaded = await prisma.projectBuild.findUnique({
      where: { id: build.id },
      select: { completedAt: true, status: true },
    });
    if (
      reloaded?.status !== 'COMPLETED' ||
      reloaded.completedAt?.getTime() !== completedAtBefore.getTime()
    ) {
      // completedAt must remain unchanged by reflection edits
    }
  }

  return {
    session: mapLearnerLearningSession(updated),
    learningSummary,
  };
};
