import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';

import {
  createLearningSessionForBuild,
  getOwnedLearningSessionForBuild,
} from './build-learning-session.service.js';
import { findOwnedLearningSessionByBuildId } from './build-learning-session.repository.js';
import {
  buildDeterministicLearningAssignments,
  countStartAssignments,
} from './project-learning-assignment-selection.js';
import {
  ensureLearningPackForSessionSetup,
  ensureReadyLearningPackForProject,
} from './project-learning-pack-ensure.service.js';
import { isProjectLearningLocalDeterministicMode } from './project-learning-pack-generator.factory.js';
import {
  findProjectLearningPackById,
  findProjectLearningPackByProjectAndHash,
} from './project-learning-pack.repository.js';
import {
  buildProjectLearningCanonicalSnapshot,
  buildProjectLearningHashPayload,
} from './project-learning-snapshot.js';
import { computeProjectLearningContentHash } from './project-learning-canonical.js';
import { findLearningProjectForPackGeneration } from './project-learning-pack.repository.js';
import type {
  LearningSetupMetadata,
  SetupLearningSessionResult,
} from './project-learning-setup.types.js';

const isUniqueConstraintError = (error: unknown): boolean =>
  error instanceof Error &&
  'code' in error &&
  (error as { code?: string }).code === 'P2002';

export type SetupLearningSessionForBuildInput = {
  buildId: string;
  learnerId: string;
  learningGoal?: string | null;
  confidenceBefore?: number | null;
};

const buildSetupMetadata = (input: {
  status: LearningSetupMetadata['status'];
  sessionId?: string | null;
  packVersion?: number | null;
  startQuestionCount?: number;
  reasonCode?: string | null;
  retryAfterSeconds?: number | null;
  retryable?: boolean;
}): LearningSetupMetadata => ({
  status: input.status,
  sessionId: input.sessionId ?? null,
  packVersion: input.packVersion ?? null,
  startQuestionCount: input.startQuestionCount ?? 0,
  reasonCode: input.reasonCode ?? null,
  retryAfterSeconds: input.retryAfterSeconds ?? null,
  retryable: input.retryable ?? false,
});

const resolveUnavailableReason = (input: {
  errorCode?: string | null;
  packStatus?: string | null;
  attemptCount?: number;
}): { reasonCode: string; retryable: boolean } => {
  const code = input.errorCode ?? null;

  if (input.packStatus === 'STALE') {
    return { reasonCode: 'LEARNING_PACK_STALE', retryable: false };
  }

  if (code === 'PROJECT_NOT_ELIGIBLE' || code === 'PROJECT_HAS_NO_STEPS') {
    return { reasonCode: code, retryable: false };
  }

  if (code === 'LEARNING_PACK_RETRY_LIMIT_REACHED') {
    return {
      reasonCode: code,
      retryable: isProjectLearningLocalDeterministicMode(),
    };
  }

  if (
    code === 'LEARNING_PACK_PROVIDER_UNAVAILABLE' ||
    code === 'LEARNING_PACK_VALIDATION_FAILED' ||
    code === 'LEARNING_PACK_GENERATION_FAILED' ||
    code === 'LEARNING_PACK_UNAVAILABLE' ||
    !code
  ) {
    return {
      reasonCode: code ?? 'LEARNING_PACK_UNAVAILABLE',
      retryable: true,
    };
  }

  return {
    reasonCode: code,
    retryable: isProjectLearningLocalDeterministicMode(),
  };
};

const mapSessionToSetup = (
  session: NonNullable<Awaited<ReturnType<typeof getOwnedLearningSessionForBuild>>>,
  packVersion: number,
): SetupLearningSessionResult => ({
  status: 'READY',
  session,
  setup: buildSetupMetadata({
    status: 'READY',
    sessionId: session.id,
    packVersion,
    startQuestionCount: session.assignments.filter(
      (assignment) => assignment.stage === 'START',
    ).length,
  }),
});

export const resolveLearningSetupMetadataForBuild = async (input: {
  buildId: string;
  learnerId: string;
}): Promise<LearningSetupMetadata> => {
  const session = await getOwnedLearningSessionForBuild(
    input.buildId,
    input.learnerId,
  );
  if (session) {
    const pack = await findProjectLearningPackById(session.packId);
    return buildSetupMetadata({
      status: 'READY',
      sessionId: session.id,
      packVersion: pack?.versionNumber ?? null,
      startQuestionCount: session.assignments.filter(
        (assignment) => assignment.stage === 'START',
      ).length,
    });
  }

  const build = await prisma.projectBuild.findFirst({
    where: {
      id: input.buildId,
      learnerId: input.learnerId,
    },
    select: {
      projectId: true,
    },
  });

  if (!build) {
    throw new AppError('Project build not found.', 404, 'BUILD_NOT_FOUND');
  }

  const project = await findLearningProjectForPackGeneration(build.projectId);
  if (!project || project.steps.length === 0) {
    return buildSetupMetadata({
      status: 'NOT_REQUESTED',
      reasonCode: 'PROJECT_NOT_ELIGIBLE',
    });
  }

  const contentHash = computeProjectLearningContentHash(
    buildProjectLearningHashPayload(
      buildProjectLearningCanonicalSnapshot(project),
    ),
  );

  const existingPack = await findProjectLearningPackByProjectAndHash(
    build.projectId,
    contentHash,
  );

  if (!existingPack) {
    return buildSetupMetadata({ status: 'NOT_REQUESTED' });
  }

  if (existingPack.status === 'READY') {
    const startCount = existingPack.questions.filter(
      (question) => question.stage === 'START',
    ).length;
    return buildSetupMetadata({
      status: 'NOT_REQUESTED',
      packVersion: existingPack.versionNumber,
      startQuestionCount: startCount,
      reasonCode: 'LEARNING_SESSION_NOT_STARTED',
    });
  }

  if (existingPack.status === 'GENERATING') {
    return buildSetupMetadata({
      status: 'PREPARING',
      packVersion: existingPack.versionNumber,
      reasonCode: 'LEARNING_PACK_GENERATING',
      retryAfterSeconds: 5,
    });
  }

  return buildSetupMetadata({
    status: 'UNAVAILABLE',
    packVersion: existingPack.versionNumber,
    ...resolveUnavailableReason({
      errorCode: existingPack.lastGenerationErrorCode,
      packStatus: existingPack.status,
      attemptCount: existingPack.generationAttemptCount,
    }),
  });
};

export const setupLearningSessionForBuild = async (
  input: SetupLearningSessionForBuildInput,
): Promise<SetupLearningSessionResult> => {
  const existingSession = await findOwnedLearningSessionByBuildId(
    input.buildId,
    input.learnerId,
  );
  if (existingSession) {
    const mapped = await getOwnedLearningSessionForBuild(
      input.buildId,
      input.learnerId,
    );
    if (!mapped) {
      throw new AppError('Learning session not found.', 404, 'LEARNING_SESSION_NOT_FOUND');
    }

    const pack = await findProjectLearningPackById(existingSession.packId);
    return mapSessionToSetup(mapped, pack?.versionNumber ?? 1);
  }

  const build = await prisma.projectBuild.findFirst({
    where: {
      id: input.buildId,
      learnerId: input.learnerId,
    },
    select: {
      id: true,
      projectId: true,
      project: {
        select: {
          steps: {
            orderBy: { stepNumber: 'asc' },
            select: { id: true },
          },
        },
      },
    },
  });

  if (!build) {
    throw new AppError('Project build not found.', 404, 'BUILD_NOT_FOUND');
  }

  const packResult = await ensureLearningPackForSessionSetup(build.projectId);

  if (packResult.status === 'GENERATING') {
    return {
      status: 'PREPARING',
      setup: buildSetupMetadata({
        status: 'PREPARING',
        packVersion: null,
        reasonCode: 'LEARNING_PACK_GENERATING',
        retryAfterSeconds: packResult.retryAfterSeconds,
        retryable: false,
      }),
    };
  }

  if (packResult.status === 'FAILED') {
    const unavailable = resolveUnavailableReason({
      errorCode: packResult.errorCode,
      attemptCount: undefined,
    });
    return {
      status: 'UNAVAILABLE',
      setup: buildSetupMetadata({
        status: 'UNAVAILABLE',
        reasonCode: unavailable.reasonCode,
        retryable:
          unavailable.retryable &&
          (packResult.retryEligible || isProjectLearningLocalDeterministicMode()),
      }),
    };
  }

  if (packResult.status === 'INELIGIBLE') {
    return {
      status: 'UNAVAILABLE',
      setup: buildSetupMetadata({
        status: 'UNAVAILABLE',
        reasonCode: packResult.reasonCode,
        retryable: false,
      }),
    };
  }

  const pack = await findProjectLearningPackById(packResult.packId);
  if (!pack || pack.projectId !== build.projectId) {
    throw new AppError('Learning pack not found.', 404, 'LEARNING_PACK_NOT_FOUND');
  }

  const assignments = await buildDeterministicLearningAssignments({
    pack,
    buildId: build.id,
    projectStepIds: build.project.steps.map((step) => step.id),
  });

  try {
    const session = await createLearningSessionForBuild({
      buildId: build.id,
      learnerId: input.learnerId,
      packId: pack.id,
      learningGoal: input.learningGoal,
      confidenceBefore: input.confidenceBefore,
      assignments,
    });

    return mapSessionToSetup(session, pack.versionNumber);
  } catch (error) {
    if (
      error instanceof AppError &&
      error.code === 'LEARNING_SESSION_ALREADY_EXISTS'
    ) {
      const mapped = await getOwnedLearningSessionForBuild(
        input.buildId,
        input.learnerId,
      );
      if (!mapped) {
        throw error;
      }
      return mapSessionToSetup(mapped, pack.versionNumber);
    }

    if (isUniqueConstraintError(error)) {
      const mapped = await getOwnedLearningSessionForBuild(
        input.buildId,
        input.learnerId,
      );
      if (!mapped) {
        throw error;
      }
      return mapSessionToSetup(mapped, pack.versionNumber);
    }

    throw error;
  }
};

export const attachLearningSetupToBuild = async (
  build: { id: string },
  learnerId: string,
) => resolveLearningSetupMetadataForBuild({
  buildId: build.id,
  learnerId,
});

export const resolveLearningSetupAfterBuildStart = async (
  build: { id: string; projectId: string },
) => {
  const packResult = await ensureReadyLearningPackForProject(build.projectId);

  if (packResult.status === 'READY') {
    return buildSetupMetadata({
      status: 'NOT_REQUESTED',
      packVersion: packResult.versionNumber,
      startQuestionCount: packResult.questionCounts.start,
      reasonCode: 'LEARNING_SESSION_NOT_STARTED',
    });
  }

  if (packResult.status === 'GENERATING') {
    return buildSetupMetadata({
      status: 'PREPARING',
      reasonCode: 'LEARNING_PACK_GENERATING',
      retryAfterSeconds: packResult.retryAfterSeconds,
    });
  }

  if (packResult.status === 'FAILED') {
    const unavailable = resolveUnavailableReason({
      errorCode: packResult.errorCode,
    });
    return buildSetupMetadata({
      status: 'UNAVAILABLE',
      reasonCode: unavailable.reasonCode,
      retryable:
        unavailable.retryable &&
        (packResult.retryEligible || isProjectLearningLocalDeterministicMode()),
    });
  }

  return buildSetupMetadata({
    status: 'UNAVAILABLE',
    reasonCode: packResult.reasonCode,
    retryable: false,
  });
};

export const attemptLearningSetupAfterBuildStart = resolveLearningSetupAfterBuildStart;
