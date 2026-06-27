import * as categoriesRepository from './categories.repository.js';
import type { CategoriesQuery } from './categories.validation.js';

export const getCategories = async (query: CategoriesQuery) => {
  const categories = await categoriesRepository.findPublicCategories(query);

  return categories.map((category) => ({
    id: category.id,
    nameEn: category.nameEn,
    nameAr: category.nameAr,
    categoryType: category.categoryType,
    iconUrl: category.iconUrl,
    createdAt: category.createdAt.toISOString(),
  }));
};
