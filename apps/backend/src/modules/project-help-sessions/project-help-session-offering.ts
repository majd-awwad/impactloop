import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';

import {
  assertCanonicalProjectAuthor,
  resolveProjectHelpSessionAuthor,
} from './project-help-session-author.js';

export const PROJECT_HELP_SESSION_MIN_WEEKLY_LIMIT = 1;
export const PROJECT_HELP_SESSION_MAX_WEEKLY_LIMIT = 10;
export const PROJECT_HELP_SESSION_DEFAULT_WEEKLY_LIMIT = 3;

export type ProjectHelpSessionOfferingSettings = {
  isEnabled: boolean;
  allow15Minutes: boolean;
  allow30Minutes: boolean;
  weeklyLimit: number;
};

export const DEFAULT_PROJECT_HELP_SESSION_OFFERING: ProjectHelpSessionOfferingSettings =
  {
    isEnabled: false,
    allow15Minutes: false,
    allow30Minutes: false,
    weeklyLimit: PROJECT_HELP_SESSION_DEFAULT_WEEKLY_LIMIT,
  };

export type ProjectHelpSessionAvailabilityReason =
  | 'AUTHOR_UNAVAILABLE'
  | 'DISABLED'
  | 'NO_DURATION_AVAILABLE';

export type ProjectHelpSessionAvailability = {
  available: boolean;
  reason?: ProjectHelpSessionAvailabilityReason;
  allowedDurations?: number[];
  weeklyLimit?: number;
  authorDisplayName?: string;
  authorProfileImageUrl?: string | null;
};

const allowedDurationsFromOffering = (
  offering: ProjectHelpSessionOfferingSettings,
) => {
  const durations: number[] = [];
  if (offering.allow15Minutes) {
    durations.push(15);
  }
  if (offering.allow30Minutes) {
    durations.push(30);
  }
  return durations;
};

export const validateOfferingSettings = (
  input: ProjectHelpSessionOfferingSettings,
) => {
  if (
    input.weeklyLimit < PROJECT_HELP_SESSION_MIN_WEEKLY_LIMIT ||
    input.weeklyLimit > PROJECT_HELP_SESSION_MAX_WEEKLY_LIMIT
  ) {
    throw new AppError(
      `Weekly limit must be between ${PROJECT_HELP_SESSION_MIN_WEEKLY_LIMIT} and ${PROJECT_HELP_SESSION_MAX_WEEKLY_LIMIT}.`,
      400,
      'HELP_SESSION_WEEKLY_LIMIT_OUT_OF_RANGE',
    );
  }

  if (input.isEnabled && !input.allow15Minutes && !input.allow30Minutes) {
    throw new AppError(
      'At least one session duration must be enabled.',
      400,
      'HELP_SESSION_NO_DURATION_ENABLED',
    );
  }
};

const mapStoredOffering = (offering: {
  isEnabled: boolean;
  allow15Minutes: boolean;
  allow30Minutes: boolean;
  weeklyLimit: number;
}): ProjectHelpSessionOfferingSettings => ({
  isEnabled: offering.isEnabled,
  allow15Minutes: offering.allow15Minutes,
  allow30Minutes: offering.allow30Minutes,
  weeklyLimit: offering.weeklyLimit,
});

export const getEffectiveOfferingForProject = async (projectId: string) => {
  const stored = await prisma.projectHelpSessionOffering.findUnique({
    where: { projectId },
  });
  return stored ? mapStoredOffering(stored) : DEFAULT_PROJECT_HELP_SESSION_OFFERING;
};

export const getProjectHelpSessionAvailability = async (
  projectId: string,
  viewerLearnerId?: string,
): Promise<ProjectHelpSessionAvailability> => {
  const author = await resolveProjectHelpSessionAuthor(projectId);
  if (!author.available) {
    return {
      available: false,
      reason: 'AUTHOR_UNAVAILABLE',
    };
  }

  if (viewerLearnerId && author.authorId === viewerLearnerId) {
    return {
      available: false,
      reason: 'AUTHOR_UNAVAILABLE',
      authorDisplayName: author.displayName,
      authorProfileImageUrl: author.profileImageUrl,
    };
  }

  const offering = await getEffectiveOfferingForProject(projectId);
  const allowedDurations = allowedDurationsFromOffering(offering);

  if (!offering.isEnabled) {
    return {
      available: false,
      reason: 'DISABLED',
      authorDisplayName: author.displayName,
      authorProfileImageUrl: author.profileImageUrl,
    };
  }

  if (allowedDurations.length === 0) {
    return {
      available: false,
      reason: 'NO_DURATION_AVAILABLE',
      authorDisplayName: author.displayName,
      authorProfileImageUrl: author.profileImageUrl,
    };
  }

  return {
    available: true,
    allowedDurations,
    weeklyLimit: offering.weeklyLimit,
    authorDisplayName: author.displayName,
    authorProfileImageUrl: author.profileImageUrl,
  };
};

export const getAuthorHelpSessionSettings = async (
  projectId: string,
  userId: string,
) => {
  await assertCanonicalProjectAuthor(projectId, userId);
  const offering = await getEffectiveOfferingForProject(projectId);
  return {
    projectId,
    ...offering,
  };
};

export const upsertAuthorHelpSessionSettings = async (
  projectId: string,
  userId: string,
  input: ProjectHelpSessionOfferingSettings,
) => {
  const author = await assertCanonicalProjectAuthor(projectId, userId);
  validateOfferingSettings(input);

  const offering = await prisma.projectHelpSessionOffering.upsert({
    where: { projectId },
    create: {
      projectId,
      authorId: author.authorId,
      isEnabled: input.isEnabled,
      allow15Minutes: input.allow15Minutes,
      allow30Minutes: input.allow30Minutes,
      weeklyLimit: input.weeklyLimit,
    },
    update: {
      authorId: author.authorId,
      isEnabled: input.isEnabled,
      allow15Minutes: input.allow15Minutes,
      allow30Minutes: input.allow30Minutes,
      weeklyLimit: input.weeklyLimit,
    },
  });

  return {
    projectId,
    ...mapStoredOffering(offering),
  };
};
