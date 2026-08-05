import type {
  Prisma,
  ProjectLearningPackStatus,
  ProjectLearningQuestionStage,
  ProjectLearningQuestionType,
} from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';

import { resolveProjectLearningOrderScopeKey } from './project-learning-order-scope.js';

export const projectLearningPackInclude = {
  questions: {
    include: {
      options: {
        orderBy: { displayOrder: 'asc' },
      },
    },
    orderBy: [
      { stage: 'asc' },
      { orderScopeKey: 'asc' },
      { packDisplayOrder: 'asc' },
    ],
  },
} as const satisfies Prisma.ProjectLearningPackInclude;

export type ProjectLearningPackRecord = Prisma.ProjectLearningPackGetPayload<{
  include: typeof projectLearningPackInclude;
}>;

export const findProjectLearningPackById = async (packId: string) =>
  prisma.projectLearningPack.findUnique({
    where: { id: packId },
    include: projectLearningPackInclude,
  });

export const findProjectLearningPackByProjectAndHash = async (
  projectId: string,
  contentHash: string,
) =>
  prisma.projectLearningPack.findUnique({
    where: {
      projectId_contentHash: {
        projectId,
        contentHash,
      },
    },
    include: projectLearningPackInclude,
  });

export const findLearningProjectForPackGeneration = async (projectId: string) =>
  prisma.learningProject.findFirst({
    where: {
      id: projectId,
      status: 'PUBLISHED',
      hiddenAt: null,
      archivedAt: null,
    },
    include: {
      requiredComponents: {
        orderBy: { createdAt: 'asc' },
      },
      steps: {
        orderBy: { stepNumber: 'asc' },
      },
    },
  });

export const markProjectLearningPackFailed = async (
  packId: string,
  input: {
    failureReason: string;
    lastGenerationErrorCode: string;
  },
  client: Prisma.TransactionClient = prisma,
) =>
  client.projectLearningPack.update({
    where: { id: packId },
    data: {
      status: 'FAILED',
      failedAt: new Date(),
      failureReason: input.failureReason,
      lastGenerationErrorCode: input.lastGenerationErrorCode,
      generationCompletedAt: new Date(),
    },
    include: projectLearningPackInclude,
  });

export const markProjectLearningPackGenerationStarted = async (
  packId: string,
  input: {
    providerName: string;
    modelName: string | null;
    promptVersion: string;
    generatorSchemaVersion: number;
  },
  client: Prisma.TransactionClient = prisma,
) =>
  client.projectLearningPack.update({
    where: { id: packId },
    data: {
      providerName: input.providerName,
      modelName: input.modelName,
      promptVersion: input.promptVersion,
      generatorSchemaVersion: input.generatorSchemaVersion,
      generationStartedAt: new Date(),
      generationAttemptCount: { increment: 1 },
      failedAt: null,
      failureReason: null,
      lastGenerationErrorCode: null,
    },
    include: projectLearningPackInclude,
  });

export const markProjectLearningPackReadyWithMetadata = async (
  packId: string,
  client: Prisma.TransactionClient = prisma,
) =>
  client.projectLearningPack.update({
    where: { id: packId },
    data: {
      status: 'READY',
      generatedAt: new Date(),
      generationCompletedAt: new Date(),
      failedAt: null,
      failureReason: null,
      lastGenerationErrorCode: null,
    },
    include: projectLearningPackInclude,
  });

export const markUnreferencedReadyPacksStale = async (
  projectId: string,
  currentPackId: string,
  currentContentHash: string,
  client: Prisma.TransactionClient = prisma,
) => {
  const candidates = await client.projectLearningPack.findMany({
    where: {
      projectId,
      status: 'READY',
      id: { not: currentPackId },
      contentHash: { not: currentContentHash },
    },
    select: {
      id: true,
      _count: {
        select: {
          learningSessions: true,
        },
      },
    },
  });

  const staleIds = candidates
    .filter((pack) => pack._count.learningSessions === 0)
    .map((pack) => pack.id);

  if (staleIds.length === 0) {
    return 0;
  }

  const result = await client.projectLearningPack.updateMany({
    where: { id: { in: staleIds } },
    data: {
      status: 'STALE',
      staleAt: new Date(),
      staleReason: 'Superseded by a newer learning pack version.',
    },
  });

  return result.count;
};

export const persistGeneratedLearningPackQuestions = async (
  packId: string,
  questions: CreateProjectLearningQuestionInput[],
  client: Prisma.TransactionClient = prisma,
) => {
  for (const question of questions) {
    await createProjectLearningQuestion(question, client);
  }
};

export const deleteGeneratingPackQuestions = async (
  packId: string,
  client: Prisma.TransactionClient = prisma,
) => {
  await client.projectLearningQuestion.deleteMany({
    where: { packId },
  });
};

export const resetFailedPackForRetry = async (
  packId: string,
  client: Prisma.TransactionClient = prisma,
) =>
  client.projectLearningPack.update({
    where: { id: packId },
    data: {
      status: 'GENERATING',
      failedAt: null,
      failureReason: null,
      lastGenerationErrorCode: null,
      generationStartedAt: null,
      generationCompletedAt: null,
    },
    include: projectLearningPackInclude,
  });

/** Local-dev only: clear attempt budget so an explicit retry can regenerate. */
export const resetFailedPackAttemptBudgetForLocalDev = async (
  packId: string,
  client: Prisma.TransactionClient = prisma,
) =>
  client.projectLearningPack.update({
    where: { id: packId },
    data: {
      generationAttemptCount: 0,
      failedAt: null,
      failureReason: null,
      lastGenerationErrorCode: null,
    },
    include: projectLearningPackInclude,
  });

export const countProjectLearningPacksForProject = async (projectId: string) =>
  prisma.projectLearningPack.count({ where: { projectId } });

export const countProjectLearningSessionsForPack = async (packId: string) =>
  prisma.projectBuildLearningSession.count({ where: { packId } });

export type CreateProjectLearningPackInput = {
  projectId: string;
  versionNumber: number;
  contentHash: string;
  hashAlgorithm?: string;
  hashSchemaVersion?: number;
  status?: ProjectLearningPackStatus;
  generatedAt?: Date | null;
};

export const createProjectLearningPack = async (
  input: CreateProjectLearningPackInput,
  client: Prisma.TransactionClient = prisma,
) =>
  client.projectLearningPack.create({
    data: {
      projectId: input.projectId,
      versionNumber: input.versionNumber,
      contentHash: input.contentHash,
      hashAlgorithm: input.hashAlgorithm ?? 'SHA-256',
      hashSchemaVersion: input.hashSchemaVersion ?? 1,
      status: input.status ?? 'GENERATING',
      generatedAt: input.generatedAt ?? null,
    },
    include: projectLearningPackInclude,
  });

export type CreateProjectLearningQuestionInput = {
  packId: string;
  stage: ProjectLearningQuestionStage;
  projectStepId?: string | null;
  questionType: ProjectLearningQuestionType;
  conceptKey: string;
  promptEn: string;
  promptAr: string;
  explanationEn: string;
  explanationAr: string;
  hintEn: string;
  hintAr: string;
  relativeDifficulty?: number;
  correctOptionKey: string;
  packDisplayOrder: number;
  options: Array<{
    optionKey: string;
    textEn: string;
    textAr: string;
    displayOrder: number;
  }>;
};

export const createProjectLearningQuestion = async (
  input: CreateProjectLearningQuestionInput,
  client: Prisma.TransactionClient = prisma,
) => {
  const orderScopeKey = resolveProjectLearningOrderScopeKey({
    stage: input.stage,
    projectStepId: input.projectStepId,
  });

  return client.projectLearningQuestion.create({
    data: {
      packId: input.packId,
      stage: input.stage,
      projectStepId: input.projectStepId ?? null,
      questionType: input.questionType,
      conceptKey: input.conceptKey,
      promptEn: input.promptEn,
      promptAr: input.promptAr,
      explanationEn: input.explanationEn,
      explanationAr: input.explanationAr,
      hintEn: input.hintEn,
      hintAr: input.hintAr,
      relativeDifficulty: input.relativeDifficulty ?? 2,
      correctOptionKey: input.correctOptionKey,
      orderScopeKey,
      packDisplayOrder: input.packDisplayOrder,
      options: {
        create: input.options,
      },
    },
    include: {
      options: {
        orderBy: { displayOrder: 'asc' },
      },
    },
  });
};

export const markProjectLearningPackReady = async (
  packId: string,
  client: Prisma.TransactionClient = prisma,
) =>
  client.projectLearningPack.update({
    where: { id: packId },
    data: {
      status: 'READY',
      generatedAt: new Date(),
      failedAt: null,
      failureReason: null,
    },
    include: projectLearningPackInclude,
  });

export const assertProjectStepBelongsToProject = async (
  projectId: string,
  projectStepId: string,
  client: Prisma.TransactionClient = prisma,
) => {
  const step = await client.projectStep.findFirst({
    where: {
      id: projectStepId,
      projectId,
    },
    select: { id: true },
  });

  return step != null;
};
