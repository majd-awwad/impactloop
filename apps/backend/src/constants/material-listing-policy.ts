import {
  DEFAULT_CURRENCY,
  DEFAULT_CURRENCY_SYMBOL,
} from "./material-condition-factors.js";

export const MATERIAL_LISTING_POLICY = {
  currency: DEFAULT_CURRENCY,
  currencySymbol: DEFAULT_CURRENCY_SYMBOL,
  freeAllowed: true,
  paidAllowed: true,
  otherAllowedForFree: true,
  otherAllowedForPaid: false,
  paidRequiresApprovedMaterialType: true,
  paidRequiresActivePriceRule: true,
  message:
    "Free listings may use Other. Paid listings are verified internally against reviewed price references.",
} as const;
