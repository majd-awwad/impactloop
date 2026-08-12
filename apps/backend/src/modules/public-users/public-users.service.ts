import { AppError } from '../../utils/app-error.js';
import { getLearningProjects } from '../learning-projects/learning-projects.service.js';
import type { PublicUserProjectsQuery } from './public-users.validation.js';
import * as publicUsersRepository from './public-users.repository.js';

const publicRoleOrder = ['LEARNER', 'SUPPLIER'] as const;

export const getPublicUserProfile = async (userId: string) => {
  const user = await publicUsersRepository.findPublicUserById(userId);
  if (!user) {
    throw new AppError('Public user profile not found.', 404, 'NOT_FOUND');
  }

  const assignedRoles = new Set(user.roles.map((assignment) => assignment.role));
  const supplier = user.supplierProfile;

  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.profileImageUrl,
    publicRoles: publicRoleOrder.filter((role) => assignedRoles.has(role)),
    publishedProjectsCount: user._count.createdLearningProjects,
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
