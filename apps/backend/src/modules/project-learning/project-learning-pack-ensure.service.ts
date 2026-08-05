import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { logger } from '../../observability/logger.js';

import {
  computeProjectLearningContentHash,
  PROJECT_LEARNING_HASH_SCHEMA_VERSION,
} from './project-learning-canonical.js';
import {
  buildProjectLearningCanonicalSnapshot,
  buildProjectLearningHashPayload,
} from './project-learning-snapshot.js';
import {
  PROJECT_LEARNING_PACK_GENERATOR_SCHEMA_VERSION,
  PROJECT_LEARNING_PACK_PROMPT_VERSION,
} from './project-learning-pack-generation.schema.js';
import { validateGeneratedLearningPack } from './project-learning-pack-validation.js';
import {
  getProjectLearningPackGenerator,
  isProjectLearningLocalDeterministicMode,
} from './project-learning-pack-generator.factory.js';
import {
  countQuestionsByStage,
  type EnsureLearningPackResult,
} from './project-learning-pack-ensure.types.js';
import {
  countProjectLearningPacksForProject,
  countProjectLearningSessionsForPack,
  createProjectLearningPack,
  deleteGeneratingPackQuestions,
  findLearningProjectForPackGeneration,
  findProjectLearningPackByProjectAndHash,
  markProjectLearningPackFailed,
  markProjectLearningPackGenerationStarted,
  markProjectLearningPackReadyWithMetadata,
  markUnreferencedReadyPacksStale,
  persistGeneratedLearningPackQuestions,
  resetFailedPackAttemptBudgetForLocalDev,
  resetFailedPackForRetry,
  type CreateProjectLearningQuestionInput,
} from './project-learning-pack.repository.js';

export const MAX_LEARNING_PACK_GENERATION_ATTEMPTS = 3;
const GENERATING_RETRY_AFTER_SECONDS = 5;

const isUniqueConstraintError = (error: unknown): boolean =>
  error instanceof Error &&
  'code' in error &&
  (error as { code?: string }).code === 'P2002';

const sanitizeFailureReason = (error: unknown): { message: string; code: string } => {
  if (error instanceof AppError) {
    return {
      message: error.message.slice(0, 500),
      code: error.code,
    };
  }

  return {
    message: 'Learning pack generation failed.',
    code: 'LEARNING_PACK_GENERATION_FAILED',
  };
};

const mapPackToReadyResult = (
  pack: NonNullable<Awaited<ReturnType<typeof findProjectLearningPackByProjectAndHash>>>,
): EnsureLearningPackResult => ({
  status: 'READY',
  packId: pack.id,
  projectId: pack.projectId,
  versionNumber: pack.versionNumber,
  contentHash: pack.contentHash,
  questionCounts: countQuestionsByStage(pack.questions),
});

const mapPackToGeneratingResult = (
  pack: { id: string; projectId: string; contentHash: string },
): EnsureLearningPackResult => ({
  status: 'GENERATING',
  packId: pack.id,
  projectId: pack.projectId,
  contentHash: pack.contentHash,
  retryAfterSeconds: GENERATING_RETRY_AFTER_SECONDS,
});

const mapPackToFailedResult = (
  pack: {
    id: string;
    projectId: string;
    contentHash: string;
    generationAttemptCount: number;
    lastGenerationErrorCode: string | null;
  },
): EnsureLearningPackResult => ({
  status: 'FAILED',
  packId: pack.id,
  projectId: pack.projectId,
  contentHash: pack.contentHash,
  errorCode: pack.lastGenerationErrorCode ?? 'LEARNING_PACK_GENERATION_FAILED',
  retryEligible: pack.generationAttemptCount < MAX_LEARNING_PACK_GENERATION_ATTEMPTS,
});

const toPersistedQuestions = (
  packId: string,
  generated: ReturnType<typeof validateGeneratedLearningPack>,
): CreateProjectLearningQuestionInput[] =>
  generated.questions.map((question) => ({
    packId,
    stage: question.stage,
    projectStepId: question.projectStepId ?? null,
    questionType: question.questionType,
    conceptKey: question.conceptKey,
    promptEn: question.promptEn,
    promptAr: question.promptAr,
    explanationEn: question.explanationEn,
    explanationAr: question.explanationAr,
    hintEn: question.hintEn,
    hintAr: question.hintAr,
    relativeDifficulty: question.relativeDifficulty,
    correctOptionKey: question.correctOptionKey,
    packDisplayOrder: question.packDisplayOrder,
    options: question.options,
  }));

const acquireGeneratingPack = async (input: {
  projectId: string;
  contentHash: string;
}) => {
  try {
    const versionNumber =
      (await countProjectLearningPacksForProject(input.projectId)) + 1;
    return {
      pack: await createProjectLearningPack({
        projectId: input.projectId,
        versionNumber,
        contentHash: input.contentHash,
        hashSchemaVersion: PROJECT_LEARNING_HASH_SCHEMA_VERSION,
        status: 'GENERATING',
      }),
      isWinner: true,
    };
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const existing = await findProjectLearningPackByProjectAndHash(
      input.projectId,
      input.contentHash,
    );
    if (!existing) {
      throw error;
    }

    return { pack: existing, isWinner: false };
  }
};

const runPackGeneration = async (input: {
  projectId: string;
  packId: string;
  contentHash: string;
  snapshot: ReturnType<typeof buildProjectLearningCanonicalSnapshot>;
}) => {
  const provider = getProjectLearningPackGenerator();

  await markProjectLearningPackGenerationStarted(input.packId, {
    providerName: provider.name,
    modelName: null,
    promptVersion: PROJECT_LEARNING_PACK_PROMPT_VERSION,
    generatorSchemaVersion: PROJECT_LEARNING_PACK_GENERATOR_SCHEMA_VERSION,
  });

  try {
    const generation = await provider.generateProjectLearningPack({
      snapshot: input.snapshot,
      contentHash: input.contentHash,
      promptVersion: PROJECT_LEARNING_PACK_PROMPT_VERSION,
      generatorSchemaVersion: PROJECT_LEARNING_PACK_GENERATOR_SCHEMA_VERSION,
    });

    const validated = validateGeneratedLearningPack(
      generation.data,
      input.snapshot,
    );

    await prisma.$transaction(async (tx) => {
      await deleteGeneratingPackQuestions(input.packId, tx);
      await persistGeneratedLearningPackQuestions(
        input.packId,
        toPersistedQuestions(input.packId, validated),
        tx,
      );
      await markProjectLearningPackReadyWithMetadata(input.packId, tx);
      await markUnreferencedReadyPacksStale(
        input.projectId,
        input.packId,
        input.contentHash,
        tx,
      );
      await tx.projectLearningPack.update({
        where: { id: input.packId },
        data: {
          modelName: generation.model,
          generationCompletedAt: new Date(),
        },
      });
    });

    const readyPack = await findProjectLearningPackByProjectAndHash(
      input.projectId,
      input.contentHash,
    );
    if (!readyPack || readyPack.status !== 'READY') {
      throw new AppError(
        'Learning pack generation completed without a READY pack.',
        500,
        'LEARNING_PACK_GENERATION_INCOMPLETE',
      );
    }

    return mapPackToReadyResult(readyPack);
  } catch (error) {
    const failure = sanitizeFailureReason(error);
    logger.warn(
      {
        projectId: input.projectId,
        packId: input.packId,
        code: failure.code,
      },
      'Learning pack generation failed',
    );

    await prisma.$transaction(async (tx) => {
      await deleteGeneratingPackQuestions(input.packId, tx);
      await markProjectLearningPackFailed(
        input.packId,
        {
          failureReason: failure.message,
          lastGenerationErrorCode: failure.code,
        },
        tx,
      );
    });

    const failedPack = await findProjectLearningPackByProjectAndHash(
      input.projectId,
      input.contentHash,
    );
    if (!failedPack) {
      throw error;
    }

    return mapPackToFailedResult(failedPack);
  }
};

export const ensureReadyLearningPackForProject = async (
  projectId: string,
): Promise<EnsureLearningPackResult> => {
  const project = await findLearningProjectForPackGeneration(projectId);
  if (!project) {
    return {
      status: 'INELIGIBLE',
      reasonCode: 'PROJECT_NOT_ELIGIBLE',
    };
  }

  if (project.steps.length === 0) {
    return {
      status: 'INELIGIBLE',
      reasonCode: 'PROJECT_HAS_NO_STEPS',
    };
  }

  const snapshot = buildProjectLearningCanonicalSnapshot(project);
  const contentHash = computeProjectLearningContentHash(
    buildProjectLearningHashPayload(snapshot),
  );

  const existing = await findProjectLearningPackByProjectAndHash(
    projectId,
    contentHash,
  );

  if (existing?.status === 'READY') {
    return mapPackToReadyResult(existing);
  }

  if (existing?.status === 'STALE') {
    const sessionCount = await countProjectLearningSessionsForPack(existing.id);
    if (sessionCount === 0) {
      await resetFailedPackForRetry(existing.id);
      return runPackGeneration({
        projectId,
        packId: existing.id,
        contentHash,
        snapshot,
      });
    }

    return {
      status: 'INELIGIBLE',
      reasonCode: 'LEARNING_PACK_STALE',
    };
  }

  if (existing?.status === 'GENERATING') {
    return mapPackToGeneratingResult(existing);
  }

  if (existing?.status === 'FAILED') {
    return mapPackToFailedResult(existing);
  }

  const acquired = await acquireGeneratingPack({ projectId, contentHash });
  if (!acquired.isWinner) {
    if (acquired.pack.status === 'READY') {
      return mapPackToReadyResult(acquired.pack);
    }
    if (acquired.pack.status === 'FAILED') {
      return mapPackToFailedResult(acquired.pack);
    }
    return mapPackToGeneratingResult(acquired.pack);
  }

  return runPackGeneration({
    projectId,
    packId: acquired.pack.id,
    contentHash,
    snapshot,
  });
};

export const retryFailedLearningPackGeneration = async (
  projectId: string,
  packId: string,
): Promise<EnsureLearningPackResult> => {
  const pack = await findProjectLearningPackByProjectAndHash(
    projectId,
    (
      await prisma.projectLearningPack.findUniqueOrThrow({
        where: { id: packId },
        select: { contentHash: true },
      })
    ).contentHash,
  );

  if (!pack || pack.id !== packId || pack.projectId !== projectId) {
    throw new AppError('Learning pack not found.', 404, 'LEARNING_PACK_NOT_FOUND');
  }

  if (pack.status !== 'FAILED') {
    throw new AppError(
      'Only failed learning packs can be retried.',
      409,
      'LEARNING_PACK_RETRY_NOT_ALLOWED',
    );
  }

  const sessionCount = await countProjectLearningSessionsForPack(pack.id);
  if (sessionCount > 0) {
    throw new AppError(
      'Cannot retry a learning pack pinned by an existing session.',
      409,
      'LEARNING_PACK_PINNED_BY_SESSION',
    );
  }

  if (pack.generationAttemptCount >= MAX_LEARNING_PACK_GENERATION_ATTEMPTS) {
    if (!isProjectLearningLocalDeterministicMode()) {
      throw new AppError(
        'Learning pack generation retry limit reached.',
        409,
        'LEARNING_PACK_RETRY_LIMIT_REACHED',
      );
    }

    await resetFailedPackAttemptBudgetForLocalDev(pack.id);
  }

  const project = await findLearningProjectForPackGeneration(projectId);
  if (!project) {
    return {
      status: 'INELIGIBLE',
      reasonCode: 'PROJECT_NOT_ELIGIBLE',
    };
  }

  const snapshot = buildProjectLearningCanonicalSnapshot(project);
  const contentHash = computeProjectLearningContentHash(
    buildProjectLearningHashPayload(snapshot),
  );

  if (pack.contentHash !== contentHash) {
    return ensureReadyLearningPackForProject(projectId);
  }

  await resetFailedPackForRetry(pack.id);

  return runPackGeneration({
    projectId,
    packId: pack.id,
    contentHash,
    snapshot,
  });
};

/**
 * Setup/retry entry: ordinary ensure first; explicit setup may retry FAILED
 * packs when attempt budget remains. Local deterministic mode may also reset
 * the attempt budget for unpinned FAILED packs.
 */
export const ensureLearningPackForSessionSetup = async (
  projectId: string,
): Promise<EnsureLearningPackResult> => {
  const result = await ensureReadyLearningPackForProject(projectId);
  if (result.status !== 'FAILED') {
    return result;
  }

  if (
    !result.retryEligible &&
    !isProjectLearningLocalDeterministicMode()
  ) {
    return result;
  }

  try {
    return await retryFailedLearningPackGeneration(projectId, result.packId);
  } catch (error) {
    if (
      error instanceof AppError &&
      (error.code === 'LEARNING_PACK_RETRY_LIMIT_REACHED' ||
        error.code === 'LEARNING_PACK_PINNED_BY_SESSION' ||
        error.code === 'LEARNING_PACK_RETRY_NOT_ALLOWED')
    ) {
      return result;
    }
    throw error;
  }
};

export const resolveProjectLearningContentHash = async (projectId: string) => {
  const project = await findLearningProjectForPackGeneration(projectId);
  if (!project) {
    throw new AppError('Learning project not found.', 404, 'NOT_FOUND');
  }

  const snapshot = buildProjectLearningCanonicalSnapshot(project);
  return {
    snapshot,
    contentHash: computeProjectLearningContentHash(
      buildProjectLearningHashPayload(snapshot),
    ),
  };
};
