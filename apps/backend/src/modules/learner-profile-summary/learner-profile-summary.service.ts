import { AppError } from '../../utils/app-error.js';
import * as summaryRepository from './learner-profile-summary.repository.js';
import type {
  LearnerProfileCompletionStep,
  LearnerProfileCompletionSummary,
  LearnerProfileSummary,
} from './learner-profile-summary.types.js';

const PROFILE_COMPLETION_TOTAL_STEPS = 6 as const;

const hasTrimmedValue = (value: string | null | undefined): boolean =>
  typeof value === 'string' && value.trim().length > 0;

export const calculateProfileCompletion = (
  context: summaryRepository.ProfileCompletionContext,
  hasSavedLocation: boolean,
): LearnerProfileCompletionSummary => {
  const profile = context.learnerProfile;
  const orderedSteps: Array<{
    key: LearnerProfileCompletionStep;
    complete: boolean;
  }> = [
    { key: 'display_name', complete: hasTrimmedValue(context.displayName) },
    { key: 'phone', complete: hasTrimmedValue(context.phone) },
    {
      key: 'learning_basics',
      complete:
        hasTrimmedValue(profile?.learnerType) &&
        hasTrimmedValue(profile?.skillLevel),
    },
    {
      key: 'interests',
      complete:
        profile?.interests.some(
          (interest) =>
            typeof interest === 'string' && interest.trim().length > 0,
        ) === true,
    },
    { key: 'bio', complete: hasTrimmedValue(profile?.bio) },
    { key: 'saved_location', complete: hasSavedLocation },
  ];
  const missingSteps = orderedSteps
    .filter((step) => !step.complete)
    .map((step) => step.key);
  const completedSteps = PROFILE_COMPLETION_TOTAL_STEPS - missingSteps.length;

  return {
    completedSteps,
    totalSteps: PROFILE_COMPLETION_TOTAL_STEPS,
    percentage: Math.round(
      (completedSteps / PROFILE_COMPLETION_TOTAL_STEPS) * 100,
    ),
    missingSteps,
  };
};

export type LearnerProfileSummaryRepository = {
  findProfileCompletionContext: (
    userId: string,
  ) => Promise<Awaited<ReturnType<typeof summaryRepository.findProfileCompletionContext>>>;
  hasUsableSavedLocation: (userId: string) => Promise<boolean>;
  summarizeLearnerReservationCounts: (
    userId: string,
  ) => Promise<Awaited<ReturnType<typeof summaryRepository.summarizeLearnerReservationCounts>>>;
  countVisibleSavedProjects: (userId: string) => Promise<number>;
  countVisibleFollowedProjects: (userId: string) => Promise<number>;
  countVisibleLikedMaterials: (userId: string) => Promise<number>;
  countActiveBuilds: (userId: string) => Promise<number>;
  countCompletedBuilds: (userId: string) => Promise<number>;
  findLatestContinueProject: (
    userId: string,
  ) => Promise<Awaited<ReturnType<typeof summaryRepository.findLatestContinueProject>>>;
};

export const createLearnerProfileSummaryService = (
  repository: LearnerProfileSummaryRepository,
) => async (userId: string): Promise<LearnerProfileSummary> => {
  const context = await repository.findProfileCompletionContext(userId);
  if (!context) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }

  const [
    hasSavedLocation,
    reservationCounts,
    likedMaterialsCount,
    savedProjectsCount,
    followedProjectsCount,
    activeBuildsCount,
    completedBuildsCount,
    continueBuild,
  ] = await Promise.all([
    repository.hasUsableSavedLocation(userId),
    repository.summarizeLearnerReservationCounts(userId),
    repository.countVisibleLikedMaterials(userId),
    repository.countVisibleSavedProjects(userId),
    repository.countVisibleFollowedProjects(userId),
    repository.countActiveBuilds(userId),
    repository.countCompletedBuilds(userId),
    repository.findLatestContinueProject(userId),
  ]);

  const continueProject = continueBuild
    ? (() => {
        const totalSteps = continueBuild.project._count.steps;
        const completedSteps = continueBuild._count.stepProgress;
        return {
          projectId: continueBuild.projectId,
          buildId: continueBuild.id,
          title: continueBuild.project.title,
          imageUrl: continueBuild.project.coverImageUrl,
          lastActivityAt: continueBuild.updatedAt.toISOString(),
          progress: {
            completedSteps,
            totalSteps,
            percentage:
              totalSteps === 0
                ? 0
                : Math.round((completedSteps / totalSteps) * 100),
          },
        };
      })()
    : null;

  return {
    profileCompletion: calculateProfileCompletion(context, hasSavedLocation),
    journey: {
      ...reservationCounts,
      likedMaterialsCount,
      savedProjectsCount,
      followedProjectsCount,
      activeBuildsCount,
      completedBuildsCount,
    },
    continueProject,
  };
};

export const getLearnerProfileSummary =
  createLearnerProfileSummaryService(summaryRepository);
