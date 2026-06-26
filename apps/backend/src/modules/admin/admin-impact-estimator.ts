/**
 * Conservative MVP CO₂e estimates for admin dashboard impact metrics.
 *
 * These factors are NOT audited environmental data. They exist to give admins
 * a directional sense of reuse impact until material-weight data is available.
 */

/** kg CO₂e per reused unit (piece/sheet/kg treated as one unit for MVP). */
export const ADMIN_CO2_CATEGORY_FACTORS_KG_PER_UNIT = {
  electronics: 1.2,
  wood: 0.8,
  plastics: 0.6,
  fabric: 0.4,
  tools: 1.0,
  default: 0.5,
} as const;

export type AdminCo2CategoryFactorKey = keyof typeof ADMIN_CO2_CATEGORY_FACTORS_KG_PER_UNIT;

export type ReusedMaterialForCo2Estimate = {
  quantity: number;
  unit: string;
  categoryNameEn: string;
};

export const ADMIN_CO2_ESTIMATE_METHOD =
  'Conservative MVP estimates using category-based reuse factors applied to reused material quantities. Values are approximate and not audited environmental data.';

const normalizeCategoryName = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

export const resolveCo2CategoryFactorKey = (
  categoryNameEn: string,
): Exclude<AdminCo2CategoryFactorKey, 'default'> | 'default' => {
  const normalized = normalizeCategoryName(categoryNameEn);

  if (normalized.includes('electronic')) {
    return 'electronics';
  }
  if (normalized.includes('wood') || normalized.includes('timber') || normalized.includes('panel')) {
    return 'wood';
  }
  if (normalized.includes('plastic') || normalized.includes('acrylic')) {
    return 'plastics';
  }
  if (normalized.includes('fabric') || normalized.includes('textile')) {
    return 'fabric';
  }
  if (normalized.includes('tool') || normalized.includes('hardware') || normalized.includes('equipment')) {
    return 'tools';
  }

  return 'default';
};

export const getCo2FactorKgPerUnit = (categoryNameEn: string): number => {
  const key = resolveCo2CategoryFactorKey(categoryNameEn);
  return ADMIN_CO2_CATEGORY_FACTORS_KG_PER_UNIT[key];
};

export const estimateCo2KgFromReusedMaterials = (
  materials: ReusedMaterialForCo2Estimate[],
): { estimatedCo2Kg: number; estimatedCo2Label: string; estimatedCo2Method: string } => {
  let totalKg = 0;

  for (const material of materials) {
    const quantity = Number.isFinite(material.quantity) ? Math.max(material.quantity, 0) : 0;
    if (quantity === 0) {
      continue;
    }

    const factor = getCo2FactorKgPerUnit(material.categoryNameEn);
    totalKg += quantity * factor;
  }

  const rounded = Math.round(totalKg * 10) / 10;
  const label = `${rounded.toString()} kg CO₂e`;

  return {
    estimatedCo2Kg: rounded,
    estimatedCo2Label: label,
    estimatedCo2Method: ADMIN_CO2_ESTIMATE_METHOD,
  };
};
