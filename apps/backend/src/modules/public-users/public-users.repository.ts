import { prisma } from '../../database/prisma.js';
import { buildPublicMaterialWhere } from '../materials/public-material-visibility.js';

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
            where: {
              status: 'PUBLISHED',
              hiddenAt: null,
              archivedAt: null,
              category: {
                isActive: true,
                categoryType: { in: ['PROJECT', 'BOTH'] },
              },
            },
          },
        },
      },
    },
  });
