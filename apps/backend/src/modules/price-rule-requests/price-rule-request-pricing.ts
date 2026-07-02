import type { MaterialCondition } from '../../generated/prisma/client.js';
import {
  applyConditionPriceMultiplier,
  conditionPriceMultiplier,
} from '../../constants/material-condition-factors.js';
import { decimalToNumber, formatNisPrice, roundCurrency } from '../../utils/decimal.js';

type PriceRuleRequestPricingSource = {
  status: string;
  aiSuggestedMaxUnitPriceNis: { toNumber(): number } | number | null;
  adminApprovedMaxUnitPriceNis?: { toNumber(): number } | number | null;
  aiResultJson?: unknown;
};

const extractBaseSuggestedFromAiResultJson = (
  aiResultJson: unknown,
): number | null => {
  if (
    !aiResultJson ||
    typeof aiResultJson !== 'object' ||
    Array.isArray(aiResultJson)
  ) {
    return null;
  }

  const suggestion = (aiResultJson as Record<string, unknown>).suggestion;
  if (!suggestion || typeof suggestion !== 'object' || Array.isArray(suggestion)) {
    return null;
  }

  const max = (suggestion as Record<string, unknown>).suggestedMaxAllowedUnitPriceNis;
  return typeof max === 'number' && max > 0 ? roundCurrency(max) : null;
};

/**
 * Raw AI/reference max unit price before condition multiplier.
 * Stored in aiSuggestedMaxUnitPriceNis and preserved after admin review.
 */
export const resolveBaseSuggestedMaxUnitPriceNis = (
  request: PriceRuleRequestPricingSource | null | undefined,
): number | null => {
  if (!request) {
    return null;
  }

  const storedBase = decimalToNumber(request.aiSuggestedMaxUnitPriceNis);
  const adminApproved = decimalToNumber(request.adminApprovedMaxUnitPriceNis);

  if (
    (request.status === 'APPROVED' || request.status === 'REJECTED') &&
    storedBase != null &&
    adminApproved != null &&
    storedBase === adminApproved
  ) {
    const recoveredBase = extractBaseSuggestedFromAiResultJson(request.aiResultJson);
    if (recoveredBase != null) {
      return recoveredBase;
    }
  }

  return storedBase;
};

/** @deprecated Use resolveBaseSuggestedMaxUnitPriceNis. Kept for existing imports. */
export const resolveApprovedMaxUnitPriceNis = resolveBaseSuggestedMaxUnitPriceNis;

/**
 * Final condition-adjusted price approved/entered by admin for this request.
 * Already includes the condition multiplier — do not multiply again.
 */
export const resolveAdminApprovedAdjustedMaxUnitPriceNis = (
  request: PriceRuleRequestPricingSource | null | undefined,
): number | null => {
  if (!request) {
    return null;
  }

  if (request.status !== 'APPROVED' && request.status !== 'REJECTED') {
    return null;
  }

  return decimalToNumber(request.adminApprovedMaxUnitPriceNis);
};

export const calculateAdjustedPrice = (
  basePrice: number,
  condition: MaterialCondition,
): number => applyConditionPriceMultiplier(basePrice, condition);

export const resolveConditionAdjustedMaxUnitPriceNis = (
  request: PriceRuleRequestPricingSource | null | undefined,
  condition: MaterialCondition,
): number | null => {
  const baseMax = resolveBaseSuggestedMaxUnitPriceNis(request);
  if (baseMax == null) {
    return null;
  }

  return calculateAdjustedPrice(baseMax, condition);
};

/**
 * Supplier-facing max allowed unit price.
 * Uses admin-approved adjusted price when present; otherwise condition-adjusted suggestion.
 */
export const resolveFinalAllowedMaxUnitPriceNis = (
  request: PriceRuleRequestPricingSource | null | undefined,
  condition: MaterialCondition | null | undefined,
): number | null => {
  const adminApproved = resolveAdminApprovedAdjustedMaxUnitPriceNis(request);
  if (adminApproved != null) {
    return adminApproved;
  }

  if (condition == null) {
    return resolveBaseSuggestedMaxUnitPriceNis(request);
  }

  return resolveConditionAdjustedMaxUnitPriceNis(request, condition);
};

export type ApprovedPriceRuleAcceptance =
  | { ok: true; maxAllowed: number; baseMax: number; conditionMultiplier: number }
  | {
      ok: false;
      reason: 'NO_APPROVED_MAX' | 'PRICE_TOO_HIGH';
      maxAllowed?: number;
      baseMax?: number;
      conditionMultiplier?: number;
    };

/** Shared rule: admin-reviewed price rule request allows publish when price <= final allowed max. */
export const evaluateApprovedPriceRuleRequest = (
  request: PriceRuleRequestPricingSource | null | undefined,
  price: number,
  condition: MaterialCondition,
): ApprovedPriceRuleAcceptance => {
  const baseMax = resolveBaseSuggestedMaxUnitPriceNis(request);
  const maxAllowed = resolveFinalAllowedMaxUnitPriceNis(request, condition);

  if (maxAllowed == null) {
    return { ok: false, reason: 'NO_APPROVED_MAX' };
  }

  const multiplier = conditionPriceMultiplier(condition);

  if (price > maxAllowed) {
    return {
      ok: false,
      reason: 'PRICE_TOO_HIGH',
      maxAllowed,
      baseMax: baseMax ?? undefined,
      conditionMultiplier: multiplier,
    };
  }

  return {
    ok: true,
    maxAllowed,
    baseMax: baseMax ?? maxAllowed,
    conditionMultiplier: multiplier,
  };
};

export { formatNisPrice };
