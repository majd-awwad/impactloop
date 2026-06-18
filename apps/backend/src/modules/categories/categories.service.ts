import type { CategoryType } from '../../generated/prisma/client.js';

import * as categoriesRepository from './categories.repository.js';

export type MaterialCategoryDto = {
  id: string;
  nameEn: string;
  nameAr: string;
  categoryType: CategoryType;
  iconUrl: string | null;
};

export const listMaterialCategories = async (): Promise<MaterialCategoryDto[]> => {
  return categoriesRepository.findMaterialCategories('MATERIAL');
};
