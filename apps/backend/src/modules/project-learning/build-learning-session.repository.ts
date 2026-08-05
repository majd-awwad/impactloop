import type { Prisma, ProjectLearningQuestionStage } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';

import { resolveProjectLearningOrderScopeKey } from './project-learning-order-scope.js';

/** Narrow learner assignment include — feedback is boolean-only (no learner PII). */
export const learningAssignmentDetailInclude = {
  question: {
    include: {
      options: {
        orderBy: { displayOrder: 'asc' as const },
      },
    },
  },
  answerAttempts: {
    orderBy: { attemptNumber: 'asc' as const },
  },
  feedback: {
    where: {
      type: 'UNCLEAR' as const,
      clearedAt: null,
    },
    select: { id: true },
    take: 1,
  },
} as const satisfies Prisma.ProjectBuildLearningQuestionAssignmentInclude;

export const learningSessionInclude = {
  build: {
    select: {
      learnerId: true,
      projectId: true,
      project: {
        select: {
          steps: {
            select: {
              id: true,
              title: true,
            },
            orderBy: { stepNumber: 'asc' },
          },
        },
      },
    },
  },
  assignments: {
    include: learningAssignmentDetailInclude,
    orderBy: [
      { stage: 'asc' },
      { orderScopeKey: 'asc' },
      { displayOrder: 'asc' },
    ],
  },
} as const satisfies Prisma.ProjectBuildLearningSessionInclude;

export type ProjectBuildLearningSessionRecord =
  Prisma.ProjectBuildLearningSessionGetPayload<{
    include: typeof learningSessionInclude;
  }>;

export const findLearningSessionByBuildId = async (buildId: string) =>
  prisma.projectBuildLearningSession.findUnique({
    where: { buildId },
    include: learningSessionInclude,
  });

export const findOwnedLearningSessionByBuildId = async (
  buildId: string,
  learnerId: string,
) => {
  const session = await prisma.projectBuildLearningSession.findFirst({
    where: {
      buildId,
      build: { learnerId },
    },
    include: learningSessionInclude,
  });

  return session;
};

export const findOwnedLearningSessionById = async (
  sessionId: string,
  learnerId: string,
) =>
  prisma.projectBuildLearningSession.findFirst({
    where: {
      id: sessionId,
      build: { learnerId },
    },
    include: learningSessionInclude,
  });

export type CreateLearningSessionInput = {
  buildId: string;
  packId: string;
  learningGoal?: string | null;
  confidenceBefore?: number | null;
};

export const createLearningSession = async (
  input: CreateLearningSessionInput,
  client: Prisma.TransactionClient = prisma,
) =>
  client.projectBuildLearningSession.create({
    data: {
      buildId: input.buildId,
      packId: input.packId,
      learningGoal: input.learningGoal ?? null,
      confidenceBefore: input.confidenceBefore ?? null,
    },
    include: learningSessionInclude,
  });

export type CreateLearningAssignmentInput = {
  sessionId: string;
  questionId: string;
  stage: ProjectLearningQuestionStage;
  projectStepId?: string | null;
  displayOrder: number;
};

export const createLearningAssignment = async (
  input: CreateLearningAssignmentInput,
  client: Prisma.TransactionClient = prisma,
) => {
  const orderScopeKey = resolveProjectLearningOrderScopeKey({
    stage: input.stage,
    projectStepId: input.projectStepId,
  });

  return client.projectBuildLearningQuestionAssignment.create({
    data: {
      sessionId: input.sessionId,
      questionId: input.questionId,
      stage: input.stage,
      projectStepId: input.projectStepId ?? null,
      orderScopeKey,
      displayOrder: input.displayOrder,
    },
    include: learningAssignmentDetailInclude,
  });
};

export const markLearningAssignmentSkipped = async (
  assignmentId: string,
  client: Prisma.TransactionClient = prisma,
) =>
  client.projectBuildLearningQuestionAssignment.update({
    where: { id: assignmentId },
    data: { status: 'SKIPPED' },
    include: learningAssignmentDetailInclude,
  });

export const markLearningAssignmentHintViewed = async (
  assignmentId: string,
  client: Prisma.TransactionClient = prisma,
) =>
  client.projectBuildLearningQuestionAssignment.update({
    where: { id: assignmentId },
    data: { hintViewedAt: new Date() },
    include: learningAssignmentDetailInclude,
  });

export const updateLearningSessionProfile = async (
  sessionId: string,
  input: {
    learningGoal?: string | null;
    confidenceBefore?: number | null;
  },
  client: Prisma.TransactionClient = prisma,
) =>
  client.projectBuildLearningSession.update({
    where: { id: sessionId },
    data: {
      ...(input.learningGoal !== undefined
        ? { learningGoal: input.learningGoal }
        : {}),
      ...(input.confidenceBefore !== undefined
        ? { confidenceBefore: input.confidenceBefore }
        : {}),
    },
    include: {
      assignments: {
        include: learningAssignmentDetailInclude,
        orderBy: [
          { stage: 'asc' },
          { orderScopeKey: 'asc' },
          { displayOrder: 'asc' },
        ],
      },
    },
  });

export const countLearningAssignmentAttempts = async (
  assignmentId: string,
  client: Prisma.TransactionClient = prisma,
) =>
  client.projectBuildLearningAnswerAttempt.count({
    where: { assignmentId },
  });

export const createLearningAnswerAttempt = async (
  input: {
    assignmentId: string;
    attemptNumber: number;
    selectedOptionKey: string;
    isCorrect: boolean;
  },
  client: Prisma.TransactionClient = prisma,
) => {
  const attempt = await client.projectBuildLearningAnswerAttempt.create({
    data: {
      assignmentId: input.assignmentId,
      attemptNumber: input.attemptNumber,
      selectedOptionKey: input.selectedOptionKey,
      isCorrect: input.isCorrect,
    },
  });

  await client.projectBuildLearningQuestionAssignment.update({
    where: { id: input.assignmentId },
    data: { status: 'ANSWERED' },
  });

  return attempt;
};

const learningAssignmentWithSessionInclude = {
  ...learningAssignmentDetailInclude,
  session: {
    select: {
      id: true,
      buildId: true,
      build: {
        select: {
          learnerId: true,
          status: true,
        },
      },
    },
  },
} as const satisfies Prisma.ProjectBuildLearningQuestionAssignmentInclude;

export const findOwnedLearningAssignmentById = async (
  assignmentId: string,
  learnerId: string,
) =>
  prisma.projectBuildLearningQuestionAssignment.findFirst({
    where: {
      id: assignmentId,
      session: {
        build: { learnerId },
      },
    },
    include: learningAssignmentWithSessionInclude,
  });

export type StepLearningAssignmentRecord =
  Prisma.ProjectBuildLearningQuestionAssignmentGetPayload<{
    include: typeof learningAssignmentWithSessionInclude;
  }>;

export const findOwnedStepLearningAssignment = async (input: {
  buildId: string;
  learnerId: string;
  projectStepId: string;
}) =>
  prisma.projectBuildLearningQuestionAssignment.findFirst({
    where: {
      stage: 'STEP',
      projectStepId: input.projectStepId,
      session: {
        buildId: input.buildId,
        build: { learnerId: input.learnerId },
      },
    },
    include: learningAssignmentWithSessionInclude,
  });
