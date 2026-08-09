import { COMMON_ERROR_CODES } from '../../contracts/errors/common-error-codes.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';

export const PROJECT_HELP_SESSION_AUTHOR_SOURCE = 'PROJECT_CREATED_BY' as const;

export type ProjectHelpSessionAuthorSource =
  typeof PROJECT_HELP_SESSION_AUTHOR_SOURCE;

export type ProjectHelpSessionAuthorUnavailableReason =
  'AUTHOR_UNAVAILABLE';

export type ResolveProjectHelpSessionAuthorResult =
  | {
      available: true;
      authorId: string;
      source: ProjectHelpSessionAuthorSource;
      displayName: string;
      profileImageUrl: string | null;
    }
  | {
      available: false;
      reason: ProjectHelpSessionAuthorUnavailableReason;
    };

type ProjectAuthorRecord = {
  id: string;
  createdBy: string;
  createdByUser: {
    id: string;
    displayName: string;
    profileImageUrl: string | null;
    accountStatus: string;
    roles: { role: string }[];
  };
};

const mapAuthorFromProject = (
  project: ProjectAuthorRecord,
): ResolveProjectHelpSessionAuthorResult => {
  const creator = project.createdByUser;

  if (creator.id !== project.createdBy) {
    return { available: false, reason: 'AUTHOR_UNAVAILABLE' };
  }

  const hasLearnerRole = creator.roles.some((role) => role.role === 'LEARNER');
  if (!hasLearnerRole || creator.accountStatus !== 'ACTIVE') {
    return { available: false, reason: 'AUTHOR_UNAVAILABLE' };
  }

  return {
    available: true,
    authorId: project.createdBy,
    source: PROJECT_HELP_SESSION_AUTHOR_SOURCE,
    displayName: creator.displayName,
    profileImageUrl: creator.profileImageUrl,
  };
};

export const resolveProjectHelpSessionAuthorByProject = (
  project: ProjectAuthorRecord,
): ResolveProjectHelpSessionAuthorResult => mapAuthorFromProject(project);

export const resolveProjectHelpSessionAuthor = async (
  projectId: string,
): Promise<ResolveProjectHelpSessionAuthorResult> => {
  const project = await prisma.learningProject.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      createdBy: true,
      reviewedBy: true,
      createdByUser: {
        select: {
          id: true,
          displayName: true,
          profileImageUrl: true,
          accountStatus: true,
          roles: {
            select: { role: true },
          },
        },
      },
    },
  });

  if (!project) {
    throw new AppError(
      'Learning project not found.',
      404,
      COMMON_ERROR_CODES.notFound,
    );
  }

  return mapAuthorFromProject(project);
};

export const assertCanonicalProjectAuthor = async (
  projectId: string,
  userId: string,
) => {
  const author = await resolveProjectHelpSessionAuthor(projectId);
  if (!author.available) {
    throw new AppError(
      'Learning project submission not found',
      404,
      COMMON_ERROR_CODES.notFound,
    );
  }
  if (author.authorId !== userId) {
    throw new AppError(
      'Learning project submission not found',
      404,
      COMMON_ERROR_CODES.notFound,
    );
  }
  return author;
};
