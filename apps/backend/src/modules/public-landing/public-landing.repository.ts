import type { Prisma } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';
import { buildPublicMaterialWhere } from '../materials/public-material-visibility.js';
import * as materialsRepository from '../materials/materials.repository.js';
import * as learningProjectsRepository from '../learning-projects/learning-projects.repository.js';
import type { MaterialsQuery } from '../materials/materials.validation.js';
import type { LearningProjectsQuery } from '../learning-projects/learning-projects.validation.js';

const publicPublishedProjectWhere: Prisma.LearningProjectWhereInput = {
  status: 'PUBLISHED',
  hiddenAt: null,
  archivedAt: null,
  category: {
    isActive: true,
    categoryType: {
      in: ['PROJECT', 'BOTH'],
    },
  },
};

export const LANDING_FEATURED_LIMIT = 6;
export const LANDING_COMMUNITY_AVATAR_LIMIT = 4;

const isPublicAvatarUrl = (url: string | null | undefined): url is string => {
  const trimmed = url?.trim() ?? '';
  if (!trimmed) {
    return false;
  }

  return !trimmed.toLowerCase().includes('dicebear.com');
};

export const countAvailablePublicMaterials = async (): Promise<number> => {
  return prisma.material.count({
    where: buildPublicMaterialWhere('AVAILABLE'),
  });
};

export const countPublishedPublicProjects = async (): Promise<number> => {
  return prisma.learningProject.count({
    where: publicPublishedProjectWhere,
  });
};

export const countReusedMaterials = async (): Promise<number> => {
  return prisma.material.count({
    where: { status: 'REUSED' },
  });
};

export const findFeaturedPublicMaterials = async (query: MaterialsQuery) => {
  return materialsRepository.findMaterials(query);
};

export const findFeaturedPublishedProjects = async (
  query: LearningProjectsQuery,
) => {
  return learningProjectsRepository.findLearningProjects(query);
};

export const findPublicCommunityMembers = async () => {
  const users = await prisma.user.findMany({
    where: {
      accountStatus: 'ACTIVE',
      profileImageUrl: { not: null },
      roles: {
        some: {
          role: { in: ['LEARNER', 'SUPPLIER'] },
        },
      },
    },
    select: {
      displayName: true,
      profileImageUrl: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 24,
  });

  const members: Array<{ displayName: string; avatarUrl: string }> = [];
  const seenUrls = new Set<string>();

  for (const user of users) {
    if (!isPublicAvatarUrl(user.profileImageUrl)) {
      continue;
    }
    if (seenUrls.has(user.profileImageUrl)) {
      continue;
    }

    seenUrls.add(user.profileImageUrl);
    members.push({
      displayName: user.displayName,
      avatarUrl: user.profileImageUrl,
    });

    if (members.length >= LANDING_COMMUNITY_AVATAR_LIMIT) {
      break;
    }
  }

  return members;
};
