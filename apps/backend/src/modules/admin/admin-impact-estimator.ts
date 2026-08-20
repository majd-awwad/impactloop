/**
 * Conservative MVP CO₂e estimates for Admin Impact Analytics.
 *
 * Verified reuse metrics are counted separately. This module only estimates
 * potential CO₂e avoided when a completed reuse event has:
 *   1. a convertible mass unit (kg or g), and
 *   2. a documented category factor in kg CO₂e per kg.
 *
 * No documented LCA / emission-factor source exists in this repository.
 * Production therefore ships with an empty factor map: estimates are withheld
 * rather than invented. Piece, sheet, box, set, meter, and other count/length
 * units are never converted to kilograms.
 *
 * Transportation and other lifecycle effects are not modeled.
 */

import { normalizeReservationUnit } from '../reservations/reservations.unit.js';

export const ADMIN_IMPACT_CO2_METHODOLOGY_VERSION =
  'admin-impact-co2e-v2-mass-only';

/**
 * kg CO₂e per kg of reused material, keyed by resolved category factor.
 *
 * Empty on purpose: current constants in git history were arbitrary per-unit
 * demo values with no cited source, and treated piece/sheet as if they were kg.
 * Do not populate this map without a documented methodology reference.
 */
export const ADMIN_CO2_CATEGORY_FACTORS_KG_PER_KG: Readonly<
  Record<string, number>
> = Object.freeze({});

export type AdminCo2CategoryFactorKey =
  | 'electronics'
  | 'wood'
  | 'plastics'
  | 'fabric'
  | 'tools'
  | 'default';

export type CompletedReuseForCo2Estimate = {
  quantity: number;
  unit: string;
  categoryNameEn: string;
};

export type Co2EstimateResult = {
  estimatedCo2eKg: number | null;
  estimatedCo2eLabel: string | null;
  includedReuseEvents: number;
  totalCompletedReuseEvents: number;
  coveragePercent: number;
  isEstimate: true;
  methodologyVersion: string;
  unavailableReason: 'NO_COMPLETED_EVENTS' | 'NO_ELIGIBLE_EVENTS' | null;
};

const normalizeCategoryName = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

export const resolveCo2CategoryFactorKey = (
  categoryNameEn: string,
): AdminCo2CategoryFactorKey => {
  const normalized = normalizeCategoryName(categoryNameEn);

  if (normalized.includes('electronic')) {
    return 'electronics';
  }
  if (
    normalized.includes('wood') ||
    normalized.includes('timber') ||
    normalized.includes('panel')
  ) {
    return 'wood';
  }
  if (normalized.includes('plastic') || normalized.includes('acrylic')) {
    return 'plastics';
  }
  if (normalized.includes('fabric') || normalized.includes('textile')) {
    return 'fabric';
  }
  if (
    normalized.includes('tool') ||
    normalized.includes('hardware') ||
    normalized.includes('equipment')
  ) {
    return 'tools';
  }

  return 'default';
};

/** Convert a completed quantity to kilograms, or null when unsafe. */
export const convertQuantityToKg = (
  quantity: number,
  unit: string,
): number | null => {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }

  const normalized = normalizeReservationUnit(unit);
  if (normalized === 'kg') {
    return quantity;
  }
  if (normalized === 'g') {
    return quantity / 1000;
  }

  return null;
};

export const getCo2FactorKgPerKg = (
  categoryNameEn: string,
  factors: Readonly<Record<string, number>> = ADMIN_CO2_CATEGORY_FACTORS_KG_PER_KG,
): number | null => {
  const key = resolveCo2CategoryFactorKey(categoryNameEn);
  const factor = factors[key];
  if (typeof factor !== 'number' || !Number.isFinite(factor) || factor < 0) {
    return null;
  }
  return factor;
};

const roundToOneDecimal = (value: number): number =>
  Math.round(value * 10) / 10;

const formatCo2Label = (kg: number): string => `${roundToOneDecimal(kg).toString()} kg CO₂e`;

export const estimateCo2eFromCompletedReuseEvents = (
  events: CompletedReuseForCo2Estimate[],
  factors: Readonly<Record<string, number>> = ADMIN_CO2_CATEGORY_FACTORS_KG_PER_KG,
): Co2EstimateResult => {
  const totalCompletedReuseEvents = events.length;
  let includedReuseEvents = 0;
  let totalKg = 0;

  for (const event of events) {
    const massKg = convertQuantityToKg(event.quantity, event.unit);
    if (massKg === null) {
      continue;
    }

    const factor = getCo2FactorKgPerKg(event.categoryNameEn, factors);
    if (factor === null) {
      continue;
    }

    includedReuseEvents += 1;
    totalKg += massKg * factor;
  }

  const coveragePercent =
    totalCompletedReuseEvents === 0
      ? 0
      : Math.round((includedReuseEvents / totalCompletedReuseEvents) * 100);

  if (totalCompletedReuseEvents === 0) {
    return {
      estimatedCo2eKg: null,
      estimatedCo2eLabel: null,
      includedReuseEvents: 0,
      totalCompletedReuseEvents: 0,
      coveragePercent: 0,
      isEstimate: true,
      methodologyVersion: ADMIN_IMPACT_CO2_METHODOLOGY_VERSION,
      unavailableReason: 'NO_COMPLETED_EVENTS',
    };
  }

  if (includedReuseEvents === 0) {
    return {
      estimatedCo2eKg: null,
      estimatedCo2eLabel: null,
      includedReuseEvents: 0,
      totalCompletedReuseEvents,
      coveragePercent: 0,
      isEstimate: true,
      methodologyVersion: ADMIN_IMPACT_CO2_METHODOLOGY_VERSION,
      unavailableReason: 'NO_ELIGIBLE_EVENTS',
    };
  }

  const rounded = roundToOneDecimal(totalKg);

  return {
    estimatedCo2eKg: rounded,
    estimatedCo2eLabel: formatCo2Label(rounded),
    includedReuseEvents,
    totalCompletedReuseEvents,
    coveragePercent,
    isEstimate: true,
    methodologyVersion: ADMIN_IMPACT_CO2_METHODOLOGY_VERSION,
    unavailableReason: null,
  };
};

/**
 * Dashboard overview still consumes a compact CO₂ snapshot. It now uses the
 * same conservative rules as Impact Analytics (mass units + documented factors)
 * instead of treating piece/sheet as kilograms.
 */
export const estimateCo2KgFromReusedMaterials = (
  materials: CompletedReuseForCo2Estimate[],
  factors: Readonly<Record<string, number>> = ADMIN_CO2_CATEGORY_FACTORS_KG_PER_KG,
): {
  estimatedCo2Kg: number;
  estimatedCo2Label: string;
  estimatedCo2Method: string;
} => {
  const result = estimateCo2eFromCompletedReuseEvents(materials, factors);
  const kg = result.estimatedCo2eKg ?? 0;

  return {
    estimatedCo2Kg: kg,
    estimatedCo2Label: result.estimatedCo2eLabel ?? formatCo2Label(0),
    estimatedCo2Method:
      'Conservative mass-only MVP estimate. CO₂e is calculated only for completed reuse with kg/g quantity and a documented category factor. Unsupported units are excluded. Values are not certified environmental measurements.',
  };
};
