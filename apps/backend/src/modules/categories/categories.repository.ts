import { prisma } from '../../database/prisma.js';

export const findActiveMaterialCategories = async () => {
  return prisma.category.findMany({
    where: {
      isActive: true,
      categoryType: {
        in: ['MATERIAL', 'BOTH'],
      },
    },
    orderBy: {
      nameEn: 'asc',
    },
  });
};
