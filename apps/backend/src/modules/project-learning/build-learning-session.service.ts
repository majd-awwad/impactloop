import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';

import {
  countLearningAssignmentAttempts,
  createLearningAnswerAttempt,
  createLearningAssignment,
  createLearningSession,
  findLearningSessionByBuildId,
  findOwnedLearningAssignmentById,
  findOwnedLearningSessionByBuildId,
  learningAssignmentDetailInclude,
  learningSessionInclude,
  markLearningAssignmentHintViewed,
  type CreateLearningAssignmentInput,
  updateLearningSessionProfile,
} from './build-learning-session.repository.js';
import {
  assertAdminMutationNotAllowed,
  assertLearnerCanAccessLearningSession,
  assertRoleCanMutateLearningSession,
  type LearningAccessRole,
} from './project-learning.authorization.js';
import {
  mapLearnerLearningAnswerAttempt,
  mapLearnerLearningAssignment,
  mapLearnerLearningSession,
} from './project-learning.dto.js';
import { gradeProjectLearningAnswer } from './project-learning-grading.js';
import { getProjectLearningPackById } from './project-learning-pack.service.js';
import { persistBuildLearningSummary } from './project-learning-summary.service.js';

export const getOwnedLearningSessionForBuild = async (
  buildId: string,
  learnerId: string,
) => {
  const session = await findOwnedLearningSessionByBuildId(buildId, learnerId);
  if (!session) {
    return null;
  }

  return mapLearnerLearningSession(session);
};

export type CreateLearningSessionForBuildInput = {
  buildId: string;
  learnerId: string;
  packId: string;
  learningGoal?: string | null;
  confidenceBefore?: number | null;
  assignments: Array<{
    questionId: string;
    stage: CreateLearningAssignmentInput['stage'];
    projectStepId?: string | null;
    displayOrder: number;
  }>;
};

export const createLearningSessionForBuild = async (
  input: CreateLearningSessionForBuildInput,
) => {
  const build = await prisma.projectBuild.findFirst({
    where: {
      id: input.buildId,
      learnerId: input.learnerId,
    },
    select: {
      id: true,
      projectId: true,
      learningSession: {
        select: { id: true },
      },
    },
  });

  if (!build) {
    throw new AppError('Project build not found.', 404, 'BUILD_NOT_FOUND');
  }

  if (build.learningSession) {
    throw new AppError(
      'This build already has a learning session.',
      409,
      'LEARNING_SESSION_ALREADY_EXISTS',
    );
  }

  const pack = await getProjectLearningPackById(input.packId);
  if (pack.projectId !== build.projectId) {
    throw new AppError('Learning pack not found.', 404, 'LEARNING_PACK_NOT_FOUND');
  }

  if (pack.status !== 'READY') {
    throw new AppError(
      'Learning pack is not ready for sessions.',
      409,
      'LEARNING_PACK_NOT_READY',
    );
  }

  const questionIds = new Set(pack.questions.map((question) => question.id));
  for (const assignment of input.assignments) {
    if (!questionIds.has(assignment.questionId)) {
      throw new AppError(
        'Assigned question does not belong to the selected pack.',
        400,
        'LEARNING_ASSIGNMENT_QUESTION_INVALID',
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    const session = await createLearningSession(
      {
        buildId: input.buildId,
        packId: input.packId,
        learningGoal: input.learningGoal,
        confidenceBefore: input.confidenceBefore,
      },
      tx,
    );

    for (const assignment of input.assignments) {
      await createLearningAssignment(
        {
          sessionId: session.id,
          questionId: assignment.questionId,
          stage: assignment.stage,
          projectStepId: assignment.projectStepId,
          displayOrder: assignment.displayOrder,
        },
        tx,
      );
    }

    const hydrated = await tx.projectBuildLearningSession.findUniqueOrThrow({
      where: { id: session.id },
      include: learningSessionInclude,
    });

    return mapLearnerLearningSession(hydrated);
  });
};

export const skipLearningAssignment = async (input: {
  assignmentId: string;
  learnerId: string;
  role: LearningAccessRole;
  allowOnCompleted?: boolean;
}) => {
  assertAdminMutationNotAllowed(input.role);

  const assignment = await findOwnedLearningAssignmentById(
    input.assignmentId,
    input.learnerId,
  );
  if (!assignment) {
    throw new AppError('Learning assignment not found.', 404, 'LEARNING_ASSIGNMENT_NOT_FOUND');
  }

  assertRoleCanMutateLearningSession({
    role: input.role,
    learnerId: input.learnerId,
    sessionLearnerId: assignment.session.build.learnerId,
  });

  const buildStatus = assignment.session.build.status;
  if (buildStatus === 'ARCHIVED') {
    throw new AppError(
      'Learning check is read-only for this build.',
      409,
      'BUILD_LEARNING_CHECK_LOCKED',
    );
  }
  if (buildStatus === 'COMPLETED' && !input.allowOnCompleted) {
    throw new AppError(
      'Learning check is read-only for this build.',
      409,
      'BUILD_LEARNING_CHECK_LOCKED',
    );
  }

  if (assignment.status === 'SKIPPED') {
    return assignment;
  }

  if (assignment.answerAttempts.length > 0) {
    throw new AppError(
      'Answered assignments cannot be skipped.',
      409,
      'LEARNING_ASSIGNMENT_ALREADY_ANSWERED',
    );
  }

  return prisma.projectBuildLearningQuestionAssignment.update({
    where: { id: assignment.id },
    data: { status: 'SKIPPED' },
    include: learningAssignmentDetailInclude,
  }).then(async (updated) => {
    await persistBuildLearningSummary(assignment.session.id);
    return updated;
  });
};

export const submitLearningAnswerAttempt = async (input: {
  assignmentId: string;
  learnerId: string;
  role: LearningAccessRole;
  selectedOptionKey: string;
  allowAfterSkip?: boolean;
  allowOnCompleted?: boolean;
}) => {
  assertAdminMutationNotAllowed(input.role);

  const assignment = await findOwnedLearningAssignmentById(
    input.assignmentId,
    input.learnerId,
  );
  if (!assignment) {
    throw new AppError('Learning assignment not found.', 404, 'LEARNING_ASSIGNMENT_NOT_FOUND');
  }

  assertRoleCanMutateLearningSession({
    role: input.role,
    learnerId: input.learnerId,
    sessionLearnerId: assignment.session.build.learnerId,
  });

  const buildStatus = assignment.session.build.status;
  if (buildStatus === 'ARCHIVED') {
    throw new AppError(
      'Learning check is read-only for this build.',
      409,
      'BUILD_LEARNING_CHECK_LOCKED',
    );
  }
  if (buildStatus === 'COMPLETED' && !input.allowOnCompleted) {
    throw new AppError(
      'Learning check is read-only for this build.',
      409,
      'BUILD_LEARNING_CHECK_LOCKED',
    );
  }

  const hasCorrectAttempt = assignment.answerAttempts.some(
    (attempt) => attempt.isCorrect,
  );
  if (hasCorrectAttempt) {
    const latestCorrect = assignment.answerAttempts.find(
      (attempt) => attempt.isCorrect,
    );
    return {
      attempt: mapLearnerLearningAnswerAttempt(latestCorrect!),
      assignment: mapLearnerLearningAssignment(assignment),
    };
  }

  if (assignment.status === 'SKIPPED' && !input.allowAfterSkip) {
    throw new AppError(
      'Skipped assignments cannot receive answers.',
      409,
      'LEARNING_ASSIGNMENT_SKIPPED',
    );
  }

  const grading = gradeProjectLearningAnswer(
    {
      correctOptionKey: assignment.question.correctOptionKey,
      options: assignment.question.options,
    },
    input.selectedOptionKey,
  );

  const existingAttempts = await countLearningAssignmentAttempts(assignment.id);
  const attemptNumber = existingAttempts + 1;

  return createLearningAnswerAttempt({
    assignmentId: assignment.id,
    attemptNumber,
    selectedOptionKey: input.selectedOptionKey.trim(),
    isCorrect: grading.isCorrect,
  }).then(async (attempt) => {
    const refreshed = await findOwnedLearningAssignmentById(
      assignment.id,
      input.learnerId,
    );
    if (!refreshed) {
      throw new AppError(
        'Learning assignment not found.',
        404,
        'LEARNING_ASSIGNMENT_NOT_FOUND',
      );
    }

    await persistBuildLearningSummary(assignment.session.id);

    return {
      attempt: mapLearnerLearningAnswerAttempt(attempt),
      assignment: mapLearnerLearningAssignment(refreshed),
    };
  });
};

export const viewLearningAssignmentHint = async (input: {
  assignmentId: string;
  learnerId: string;
  role: LearningAccessRole;
  allowOnCompleted?: boolean;
}) => {
  assertAdminMutationNotAllowed(input.role);

  const assignment = await findOwnedLearningAssignmentById(
    input.assignmentId,
    input.learnerId,
  );
  if (!assignment) {
    throw new AppError('Learning assignment not found.', 404, 'LEARNING_ASSIGNMENT_NOT_FOUND');
  }

  assertRoleCanMutateLearningSession({
    role: input.role,
    learnerId: input.learnerId,
    sessionLearnerId: assignment.session.build.learnerId,
  });

  const buildStatus = assignment.session.build.status;
  if (buildStatus === 'ARCHIVED') {
    throw new AppError(
      'Learning check is read-only for this build.',
      409,
      'BUILD_LEARNING_CHECK_LOCKED',
    );
  }
  if (buildStatus === 'COMPLETED' && !input.allowOnCompleted) {
    throw new AppError(
      'Learning check is read-only for this build.',
      409,
      'BUILD_LEARNING_CHECK_LOCKED',
    );
  }

  const updated =
    assignment.hintViewedAt == null
      ? await markLearningAssignmentHintViewed(assignment.id)
      : assignment;

  return mapLearnerLearningAssignment(updated);
};

export const skipLearningAssignmentForLearner = async (input: {
  assignmentId: string;
  learnerId: string;
  role: LearningAccessRole;
}) => {
  const assignment = await skipLearningAssignment(input);
  return mapLearnerLearningAssignment(assignment);
};

export const updateLearningSessionPreferences = async (input: {
  buildId: string;
  learnerId: string;
  learningGoal?: string | null;
  confidenceBefore?: number | null;
}) => {
  const session = await assertLearnerOwnsLearningSessionByBuild(
    input.buildId,
    input.learnerId,
  );

  if (
    input.confidenceBefore != null &&
    (input.confidenceBefore < 1 || input.confidenceBefore > 5)
  ) {
    throw new AppError(
      'Confidence before must be between 1 and 5.',
      400,
      'LEARNING_SESSION_CONFIDENCE_INVALID',
    );
  }

  if (input.learningGoal != null && input.learningGoal.length > 500) {
    throw new AppError(
      'Learning goal is too long.',
      400,
      'LEARNING_SESSION_GOAL_INVALID',
    );
  }

  const updated = await updateLearningSessionProfile(session.id, {
    learningGoal: input.learningGoal,
    confidenceBefore: input.confidenceBefore,
  });

  return mapLearnerLearningSession(updated);
};

export const loadStableLearningAssignments = async (
  buildId: string,
  learnerId: string,
) => {
  const firstLoad = await getOwnedLearningSessionForBuild(buildId, learnerId);
  const secondLoad = await getOwnedLearningSessionForBuild(buildId, learnerId);

  return {
    firstLoad,
    secondLoad,
  };
};

export const assertLearningSessionPackPinned = async (
  sessionId: string,
  expectedPackId: string,
) => {
  const session = await prisma.projectBuildLearningSession.findUnique({
    where: { id: sessionId },
    select: { packId: true },
  });

  if (!session) {
    throw new AppError('Learning session not found.', 404, 'LEARNING_SESSION_NOT_FOUND');
  }

  if (session.packId !== expectedPackId) {
    throw new AppError(
      'Learning session pack version changed unexpectedly.',
      409,
      'LEARNING_SESSION_PACK_VERSION_CHANGED',
    );
  }
};

export const getLearningSessionByBuildIdInternal = findLearningSessionByBuildId;

export const assertLearnerOwnsLearningSessionByBuild = async (
  buildId: string,
  learnerId: string,
) => {
  const session = await findOwnedLearningSessionByBuildId(buildId, learnerId);
  if (!session) {
    throw new AppError('Learning session not found.', 404, 'LEARNING_SESSION_NOT_FOUND');
  }

  assertLearnerCanAccessLearningSession({
    learnerId,
    sessionLearnerId: session.build.learnerId,
  });

  return session;
};
