import * as categoriesRepository from './categories.repository.js';
import { filterPublicDiscoveryCategories } from './category-discovery-filter.js';
import type { CategoriesQuery } from './categories.validation.js';

export const getCategories = async (query: CategoriesQuery) => {
  const categories = await categoriesRepository.findPublicCategories(query);

  const visibleCategories = query.discoveryOnly
    ? filterPublicDiscoveryCategories(categories)
    : categories;

  return visibleCategories.map((category) => ({
    id: category.id,
    nameEn: category.nameEn,
    nameAr: category.nameAr,
    categoryType: category.categoryType,
    iconUrl: category.iconUrl,
    createdAt: category.createdAt.toISOString(),
  }));
};
