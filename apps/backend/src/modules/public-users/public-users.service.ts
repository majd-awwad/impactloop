import { AppError } from '../../utils/app-error.js';
import { getLearningProjects } from '../learning-projects/learning-projects.service.js';
import type { PublicUserProjectsQuery } from './public-users.validation.js';
import * as publicUsersRepository from './public-users.repository.js';

const publicRoleOrder = ['LEARNER', 'SUPPLIER'] as const;

const trimToNull = (value?: string | null) => {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
};

const uniquePublicInterests = (interests: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const interest of interests) {
    const trimmed = interest.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(trimmed);
  }
  return result;
};

export const getPublicUserProfile = async (userId: string) => {
  const [user, publishedProjectsLikesCount] = await Promise.all([
    publicUsersRepository.findPublicUserById(userId),
    publicUsersRepository.countPublishedProjectLikesByCreatorId(userId),
  ]);
  if (!user) {
    throw new AppError('Public user profile not found.', 404, 'NOT_FOUND');
  }

  const assignedRoles = new Set(user.roles.map((assignment) => assignment.role));
  const supplier = user.supplierProfile;
  const learner = user.learnerProfile;

  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.profileImageUrl,
    publicRoles: publicRoleOrder.filter((role) => assignedRoles.has(role)),
    learnerType: trimToNull(learner?.learnerType),
    skillLevel: trimToNull(learner?.skillLevel),
    bio: trimToNull(learner?.bio),
    interests: uniquePublicInterests(learner?.interests ?? []),
    publishedProjectsCount: user._count.createdLearningProjects,
    publishedProjectsLikesCount,
    supplier: supplier
      ? {
          id: supplier.id,
          displayName: supplier.publicName?.trim() || user.displayName,
          avatarUrl: supplier.avatarImageUrl,
          isVerified: ['APPROVED', 'VERIFIED'].includes(
            supplier.verificationStatus,
          ),
          availableMaterialsCount: supplier._count.materials,
        }
      : null,
  };
};

export const getPublicUserProjects = async (
  userId: string,
  query: PublicUserProjectsQuery,
) => {
  await getPublicUserProfile(userId);
  return getLearningProjects({
    page: query.page,
    limit: query.limit,
    creatorId: userId,
  });
};
