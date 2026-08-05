import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';

import { findOwnedLearningAssignmentById } from './build-learning-session.repository.js';
import {
  assertAdminMutationNotAllowed,
  type LearningAccessRole,
} from './project-learning.authorization.js';

const loadOwnedAssignmentForFeedback = async (input: {
  assignmentId: string;
  learnerId: string;
  role: LearningAccessRole;
}) => {
  assertAdminMutationNotAllowed(input.role);

  const assignment = await findOwnedLearningAssignmentById(
    input.assignmentId,
    input.learnerId,
  );
  if (!assignment) {
    throw new AppError('Learning assignment not found.', 404, 'NOT_FOUND');
  }

  const buildStatus = assignment.session.build.status;
  if (buildStatus === 'ARCHIVED') {
    throw new AppError(
      'Learning feedback is locked for archived builds.',
      409,
      'BUILD_LEARNING_CHECK_LOCKED',
    );
  }

  return assignment;
};

export const reportLearningAssignmentUnclear = async (input: {
  assignmentId: string;
  learnerId: string;
  role: LearningAccessRole;
}) => {
  const assignment = await loadOwnedAssignmentForFeedback(input);

  const existing = await prisma.projectBuildLearningQuestionFeedback.findUnique({
    where: {
      assignmentId_type: {
        assignmentId: assignment.id,
        type: 'UNCLEAR',
      },
    },
  });

  if (existing && existing.clearedAt == null) {
    return {
      assignmentId: assignment.id,
      reported: true,
      createdAt: existing.createdAt.toISOString(),
    };
  }

  const saved = existing
    ? await prisma.projectBuildLearningQuestionFeedback.update({
        where: { id: existing.id },
        data: {
          clearedAt: null,
          learnerId: input.learnerId,
        },
      })
    : await prisma.projectBuildLearningQuestionFeedback.create({
        data: {
          assignmentId: assignment.id,
          learnerId: input.learnerId,
          type: 'UNCLEAR',
        },
      });

  return {
    assignmentId: assignment.id,
    reported: true,
    createdAt: saved.createdAt.toISOString(),
  };
};

export const clearLearningAssignmentUnclearReport = async (input: {
  assignmentId: string;
  learnerId: string;
  role: LearningAccessRole;
}) => {
  const assignment = await loadOwnedAssignmentForFeedback(input);

  const existing = await prisma.projectBuildLearningQuestionFeedback.findUnique({
    where: {
      assignmentId_type: {
        assignmentId: assignment.id,
        type: 'UNCLEAR',
      },
    },
  });

  if (!existing || existing.clearedAt != null) {
    return {
      assignmentId: assignment.id,
      reported: false,
      createdAt: existing?.createdAt.toISOString() ?? null,
    };
  }

  const cleared = await prisma.projectBuildLearningQuestionFeedback.update({
    where: { id: existing.id },
    data: { clearedAt: new Date() },
  });

  return {
    assignmentId: assignment.id,
    reported: false,
    createdAt: cleared.createdAt.toISOString(),
  };
};

export const markLearningAssignmentAiExplanationRequested = async (input: {
  assignmentId: string;
  learnerId: string;
}) => {
  const assignment = await findOwnedLearningAssignmentById(
    input.assignmentId,
    input.learnerId,
  );
  if (!assignment) {
    return;
  }

  if (assignment.aiExplanationRequestedAt) {
    return;
  }

  await prisma.projectBuildLearningQuestionAssignment.update({
    where: { id: assignment.id },
    data: { aiExplanationRequestedAt: new Date() },
  });
};

export const getLearningAssignmentUnclearReported = async (
  assignmentId: string,
): Promise<boolean> => {
  const row = await prisma.projectBuildLearningQuestionFeedback.findUnique({
    where: {
      assignmentId_type: {
        assignmentId,
        type: 'UNCLEAR',
      },
    },
    select: { clearedAt: true },
  });
  return Boolean(row && row.clearedAt == null);
};
