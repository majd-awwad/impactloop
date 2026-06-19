import type { MaterialCondition } from '../generated/prisma/client.js';

export const MATERIAL_CONDITION_FACTORS: Record<MaterialCondition, number> = {
  NEW: 1.0,
  LIKE_NEW: 0.85,
  GOOD: 0.7,
  USED: 0.5,
  NEEDS_REPAIR: 0.3,
};

export const DEFAULT_CURRENCY = 'NIS';
export const DEFAULT_CURRENCY_SYMBOL = '₪';
export const OTHER_CATEGORY_NAME_EN = 'Other';
