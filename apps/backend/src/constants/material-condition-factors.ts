import type { MaterialCondition } from '../generated/prisma/client.js';

import { roundCurrency } from '../utils/decimal.js';

export const MATERIAL_CONDITION_FACTORS: Record<MaterialCondition, number> = {
  NEW: 1.0,
  LIKE_NEW: 0.85,
  GOOD: 0.65,
  USED: 0.5,
  NEEDS_REPAIR: 0.35,
};

/** Multiplier applied to base/reference max price for a material condition. */
export const conditionPriceMultiplier = (
  condition: MaterialCondition,
): number => MATERIAL_CONDITION_FACTORS[condition];

export const applyConditionPriceMultiplier = (
  baseMaxPrice: number,
  condition: MaterialCondition,
): number => roundCurrency(baseMaxPrice * conditionPriceMultiplier(condition));

export const DEFAULT_CURRENCY = 'NIS';
export const DEFAULT_CURRENCY_SYMBOL = '₪';
export const OTHER_CATEGORY_NAME_EN = 'Other';
