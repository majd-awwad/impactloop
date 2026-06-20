import type { CategoryType } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';

const resolveAllowedCategoryTypes = (
  type?: 'MATERIAL' | 'PROJECT',
): CategoryType[] => {
  if (type === 'MATERIAL') {
    return ['MATERIAL', 'BOTH'];
  }

  if (type === 'PROJECT') {
    return ['PROJECT', 'BOTH'];
  }

  return ['MATERIAL', 'PROJECT', 'BOTH'];
};

export const findPublicCategories = async (input: {
  type?: 'MATERIAL' | 'PROJECT';
  rootOnly: boolean;
}) => {
  return prisma.category.findMany({
    where: {
      isActive: true,
      categoryType: {
        in: resolveAllowedCategoryTypes(input.type),
      },
      ...(input.rootOnly ? { parentId: null } : {}),
    },
    orderBy: { nameEn: 'asc' },
  });
};

export const findCategoryById = async (categoryId: string) => {
  return prisma.category.findUnique({
    where: { id: categoryId },
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
      categoryType: true,
    },
  });
};

export const isOtherCategory = (nameEn: string): boolean => {
  return nameEn.trim().toLowerCase() === 'other';
};
