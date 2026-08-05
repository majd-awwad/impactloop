import type { Prisma } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';

import {
  assertProjectStepBelongsToProject,
  countProjectLearningPacksForProject,
  countProjectLearningSessionsForPack,
  createProjectLearningPack,
  createProjectLearningQuestion,
  findProjectLearningPackById,
  markProjectLearningPackReady,
  type CreateProjectLearningQuestionInput,
} from './project-learning-pack.repository.js';

const isUniqueConstraintError = (error: unknown): boolean =>
  error instanceof Error &&
  'code' in error &&
  (error as { code?: string }).code === 'P2002';

export const assertPackIsMutable = async (
  packId: string,
  client: Prisma.TransactionClient = prisma,
) => {
  const pack = await client.projectLearningPack.findUnique({
    where: { id: packId },
    select: { id: true, status: true },
  });

  if (!pack) {
    throw new AppError('Learning pack not found.', 404, 'LEARNING_PACK_NOT_FOUND');
  }

  if (pack.status !== 'GENERATING') {
    throw new AppError(
      'Learning pack content is immutable after generation.',
      409,
      'LEARNING_PACK_IMMUTABLE',
    );
  }
};

export const assertPackQuestionImmutable = async (packId: string) => {
  const [pack, sessionCount] = await Promise.all([
    findProjectLearningPackById(packId),
    countProjectLearningSessionsForPack(packId),
  ]);

  if (!pack) {
    throw new AppError('Learning pack not found.', 404, 'LEARNING_PACK_NOT_FOUND');
  }

  if (pack.status === 'READY' && sessionCount > 0) {
    throw new AppError(
      'Learning pack content is immutable once referenced by a session.',
      409,
      'LEARNING_PACK_IMMUTABLE',
    );
  }
};

export type CreateProjectLearningPackVersionInput = {
  projectId: string;
  contentHash: string;
  hashAlgorithm?: string;
  hashSchemaVersion?: number;
};

export const createProjectLearningPackVersion = async (
  input: CreateProjectLearningPackVersionInput,
) => {
  try {
    const versionNumber =
      (await countProjectLearningPacksForProject(input.projectId)) + 1;

    return await createProjectLearningPack({
      projectId: input.projectId,
      versionNumber,
      contentHash: input.contentHash,
      hashAlgorithm: input.hashAlgorithm,
      hashSchemaVersion: input.hashSchemaVersion,
      status: 'GENERATING',
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError(
        'A learning pack already exists for this project content version.',
        409,
        'LEARNING_PACK_DUPLICATE_CONTENT_HASH',
      );
    }

    throw error;
  }
};

export const addQuestionToGeneratingPack = async (
  projectId: string,
  input: CreateProjectLearningQuestionInput,
) => {
  await assertPackIsMutable(input.packId);

  if (input.stage === 'STEP') {
    if (!input.projectStepId) {
      throw new AppError(
        'STEP questions require a project step.',
        400,
        'LEARNING_QUESTION_STEP_REQUIRED',
      );
    }

    const stepBelongsToProject = await assertProjectStepBelongsToProject(
      projectId,
      input.projectStepId,
    );
    if (!stepBelongsToProject) {
      throw new AppError(
        'Project step does not belong to this project.',
        400,
        'LEARNING_QUESTION_STEP_INVALID',
      );
    }
  } else if (input.projectStepId) {
    throw new AppError(
      'START and FINAL questions cannot reference a project step.',
      400,
      'LEARNING_QUESTION_STEP_NOT_ALLOWED',
    );
  }

  assertCorrectOptionMatchesOptions(input);

  return createProjectLearningQuestion(input);
};

const assertCorrectOptionMatchesOptions = (
  input: CreateProjectLearningQuestionInput,
) => {
  const optionKeys = new Set(input.options.map((option) => option.optionKey));
  if (!optionKeys.has(input.correctOptionKey)) {
    throw new AppError(
      'Correct option key must match one of the question options.',
      400,
      'LEARNING_QUESTION_CORRECT_OPTION_INVALID',
    );
  }

  if (input.options.length < 2) {
    throw new AppError(
      'Questions require at least two answer options.',
      400,
      'LEARNING_QUESTION_OPTIONS_INVALID',
    );
  }
};

export const finalizeProjectLearningPack = async (packId: string) => {
  await assertPackIsMutable(packId);
  return markProjectLearningPackReady(packId);
};

export const getProjectLearningPackById = async (packId: string) => {
  const pack = await findProjectLearningPackById(packId);
  if (!pack) {
    throw new AppError('Learning pack not found.', 404, 'LEARNING_PACK_NOT_FOUND');
  }

  return pack;
};
