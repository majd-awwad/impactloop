import { prisma } from '../../database/prisma.js';
import { buildPublicMaterialWhere } from '../materials/public-material-visibility.js';

const publishedCreatorProjectWhere = {
  status: 'PUBLISHED' as const,
  hiddenAt: null,
  archivedAt: null,
  category: {
    isActive: true,
    categoryType: { in: ['PROJECT', 'BOTH'] as const },
  },
};

export const findPublicUserById = (userId: string) =>
  prisma.user.findFirst({
    where: {
      id: userId,
      accountStatus: 'ACTIVE',
    },
    select: {
      id: true,
      displayName: true,
      profileImageUrl: true,
      roles: {
        where: { role: { in: ['LEARNER', 'SUPPLIER'] } },
        select: { role: true },
        orderBy: { role: 'asc' },
      },
      learnerProfile: {
        select: {
          learnerType: true,
          skillLevel: true,
          bio: true,
          interests: true,
        },
      },
      supplierProfile: {
        select: {
          id: true,
          publicName: true,
          avatarImageUrl: true,
          verificationStatus: true,
          _count: {
            select: {
              materials: {
                where: buildPublicMaterialWhere('AVAILABLE'),
              },
            },
          },
        },
      },
      _count: {
        select: {
          createdLearningProjects: {
            where: publishedCreatorProjectWhere,
          },
        },
      },
    },
  });

export const countPublishedProjectLikesByCreatorId = (userId: string) =>
  prisma.projectLike.count({
    where: {
      project: {
        createdBy: userId,
        ...publishedCreatorProjectWhere,
      },
    },
  });
