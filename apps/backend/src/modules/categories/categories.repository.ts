import type { CategoryType } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';

export const findMaterialCategories = async (categoryType: CategoryType) => {
  return prisma.category.findMany({
    where: {
      categoryType,
      parentId: null,
    },
    orderBy: { nameEn: 'asc' },
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
      categoryType: true,
      iconUrl: true,
    },
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
