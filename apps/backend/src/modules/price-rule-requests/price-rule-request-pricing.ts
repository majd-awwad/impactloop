import { decimalToNumber } from '../../utils/decimal.js';

type PriceRuleRequestPricingSource = {
  status: string;
  aiSuggestedMaxUnitPriceNis: { toNumber(): number } | number | null;
};

/**
 * Admin-reviewed max unit price stored on the request after approval/rejection.
 * AI suggestion alone (PENDING) is not exposed as an approved limit.
 */
export const resolveApprovedMaxUnitPriceNis = (
  request: PriceRuleRequestPricingSource | null | undefined,
): number | null => {
  if (!request) {
    return null;
  }

  if (request.status !== 'APPROVED' && request.status !== 'REJECTED') {
    return null;
  }

  return decimalToNumber(request.aiSuggestedMaxUnitPriceNis);
};
