import { COMMON_ERROR_CODES } from '../../contracts/errors/common-error-codes.js';
import { AppError } from '../../utils/app-error.js';

import * as materialTypesRepository from './material-types.repository.js';

export type MaterialTypeSearchItemDto = {
  id: string;
  nameEn: string;
  nameAr: string | null;
  normalizedName: string;
  defaultUnit: string;
  category: {
    id: string;
    nameEn: string;
    nameAr: string;
  };
  hasActivePriceRule: boolean;
  aliases: string[];
};

export const searchMaterialTypes = async (input: {
  categoryId?: string;
  q?: string;
}): Promise<{ items: MaterialTypeSearchItemDto[] }> => {
  const items = await materialTypesRepository.findActiveMaterialTypes({
    categoryId: input.categoryId,
    query: input.q,
  });

  return {
    items: items.map((item) => ({
      id: item.id,
      nameEn: item.nameEn,
      nameAr: item.nameAr,
      normalizedName: item.normalizedName,
      defaultUnit: item.defaultUnit,
      category: item.category,
      hasActivePriceRule: item.priceRules.length > 0,
      aliases: item.aliases.map((alias) => alias.alias),
    })),
  };
};

export const getActivePriceRuleForMaterialType = async (materialTypeId: string) => {
  const materialType = await materialTypesRepository.findMaterialTypeById(materialTypeId);

  if (!materialType) {
    throw new AppError(
      'Material type not found',
      404,
      COMMON_ERROR_CODES.notFound,
    );
  }

  const rule = await materialTypesRepository.findActivePriceRuleForMaterialType(
    materialTypeId,
  );

  return rule ? materialTypesRepository.mapPriceRuleDto(rule) : null;
};
