import * as categoriesRepository from './categories.repository.js';

export const getCategories = async () => {
  const categories =
    await categoriesRepository.findActiveMaterialCategories();

  return categories.map((category) => ({
    id: category.id,
    nameEn: category.nameEn,
    nameAr: category.nameAr,
    categoryType: category.categoryType,
    iconUrl: category.iconUrl,
    createdAt: category.createdAt.toISOString(),
  }));
};
