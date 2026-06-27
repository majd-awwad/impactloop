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

export type ApprovedPriceRuleAcceptance =
  | { ok: true; maxAllowed: number }
  | { ok: false; reason: 'NO_APPROVED_MAX' | 'PRICE_TOO_HIGH'; maxAllowed?: number };

/** Shared rule: admin-reviewed price rule request allows publish when price <= max. */
export const evaluateApprovedPriceRuleRequest = (
  request: PriceRuleRequestPricingSource | null | undefined,
  price: number,
): ApprovedPriceRuleAcceptance => {
  const maxAllowed = resolveApprovedMaxUnitPriceNis(request);
  if (maxAllowed == null) {
    return { ok: false, reason: 'NO_APPROVED_MAX' };
  }

  if (price > maxAllowed) {
    return { ok: false, reason: 'PRICE_TOO_HIGH', maxAllowed };
  }

  return { ok: true, maxAllowed };
};
