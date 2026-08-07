import type { ProjectBuildStatus } from '../../generated/prisma/client.js';

import {
  buildCompletionPhotoContentPath,
} from '../learning-projects/build-completion-uploads.storage.js';
import {
  archiveProjectBuild,
  findOwnedBuildById,
  listLearnerBuilds,
  pauseProjectBuild,
  resumeProjectBuild,
} from '../learning-projects/project-build-lifecycle.js';
import {
  getOwnedProjectBuildByBuildId,
  hydrateLearnerProjectBuildFromRecord,
} from '../learning-projects/learning-projects.service.js';
import {
  mapMyBuildsLearningSummary,
  mapPortfolioLearningStory,
} from './learner-build-learning-summary.js';

type ListBuildRow = Awaited<ReturnType<typeof listLearnerBuilds>>['items'][number];

const mapListItemBase = (build: ListBuildRow) => {
  const snapshot = build.completionSnapshot?.snapshot as
    | Record<string, unknown>
    | undefined;
  const story = build.completionStory;
  const firstPhoto = story?.photos[0];
  const previewPhoto = firstPhoto
    ? buildCompletionPhotoContentPath(build.id, firstPhoto.id)
    : null;

  return {
    id: build.id,
    projectId: build.projectId,
    attemptNumber: build.attemptNumber,
    status: build.status,
    startedAt: build.startedAt.toISOString(),
    updatedAt: build.updatedAt.toISOString(),
    completedAt: build.completedAt?.toISOString() ?? null,
    pausedAt: build.pausedAt?.toISOString() ?? null,
    archivedAt: build.archivedAt?.toISOString() ?? null,
    project: {
      id: build.project.id,
      title: build.project.title,
      shortDescription: build.project.shortDescription,
      coverImageUrl: build.project.coverImageUrl,
      estimatedDurationMinutes: build.project.estimatedDurationMinutes,
      difficulty: build.project.difficulty,
    },
    itemCount: build._count.items,
    stepProgressCount: build._count.stepProgress,
    completionStoryPreview: story?.reflection
      ? story.reflection.slice(0, 160)
      : null,
    previewPhotoUrl: previewPhoto,
    impactSummary: snapshot ?? null,
  };
};

const mapMyBuildsListItem = (build: ListBuildRow) => ({
  ...mapListItemBase(build),
  learning: mapMyBuildsLearningSummary({
    buildStatus: build.status,
    session: build.learningSession,
  }),
});

const mapPortfolioListItem = (build: ListBuildRow) => {
  const learning = mapPortfolioLearningStory({
    session: build.learningSession,
  });

  return {
    ...mapListItemBase(build),
    ...(learning ? { learning } : {}),
  };
};

export const getLearnerBuildsList = async (input: {
  learnerId: string;
  status?: ProjectBuildStatus | 'ACTIVE';
  page: number;
  limit: number;
}) => {
  const result = await listLearnerBuilds(input);

  return {
    items: result.items.map(mapMyBuildsListItem),
    pagination: {
      page: input.page,
      limit: input.limit,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / input.limit)),
    },
  };
};

export const getLearnerBuildDetail = async (buildId: string, learnerId: string) => {
  const build = await findOwnedBuildById(buildId, learnerId);

  if (!build) {
    return null;
  }

  return hydrateLearnerProjectBuildFromRecord(build, learnerId);
};

export const pauseLearnerBuild = async (buildId: string, learnerId: string) => {
  const build = await pauseProjectBuild(buildId, learnerId);
  invalidateLearnerHomeCache(learnerId);
  return hydrateLearnerProjectBuildFromRecord(build, learnerId);
};

export const resumeLearnerBuild = async (buildId: string, learnerId: string) => {
  const build = await resumeProjectBuild(buildId, learnerId);
  invalidateLearnerHomeCache(learnerId);
  return hydrateLearnerProjectBuildFromRecord(build, learnerId);
};

export const archiveLearnerBuild = async (buildId: string, learnerId: string) => {
  const build = await archiveProjectBuild(buildId, learnerId);
  invalidateLearnerHomeCache(learnerId);
  return hydrateLearnerProjectBuildFromRecord(build, learnerId);
};

export const getLearnerPortfolio = async (input: {
  learnerId: string;
  page: number;
  limit: number;
}) => {
  const result = await listLearnerBuilds({
    learnerId: input.learnerId,
    status: 'COMPLETED',
    page: input.page,
    limit: input.limit,
  });

  return {
    items: result.items.map(mapPortfolioListItem),
    pagination: {
      page: input.page,
      limit: input.limit,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / input.limit)),
    },
  };
};

export const getLearnerBuildByIdMapped = getOwnedProjectBuildByBuildId;
