/**
 * Pure taxonomy evidence for Learning Project ↔ Material matching.
 * Directional SATISFIED_BY: component concept → material form concepts.
 */

export type ProjectMaterialTaxonomyMatchKind =
  | 'CONCEPT_EXACT'
  | 'CONCEPT_COMPATIBLE'
  | 'TYPE_EXACT'
  | 'TYPE_ALIAS'
  | 'LEXICAL_FALLBACK';

export type TaxonomyMatchEvidence = {
  kind: ProjectMaterialTaxonomyMatchKind;
  /** Relevance points added on top of lexical scoring (0 for lexical-only). */
  scoreBoost: number;
  detail?: string;
};

export const CONCEPT_EXACT_SCORE_BOOST = 520;
export const CONCEPT_COMPATIBLE_SCORE_BOOST = 480;
export const TYPE_EXACT_SCORE_BOOST = 320;
export const TYPE_ALIAS_SCORE_BOOST = 280;

const normalizeTypeToken = (value: string) =>
  value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/gu, ' ');

/**
 * Evaluate concept + type evidence for a component↔material pair.
 * Prefer CONCEPT_EXACT > CONCEPT_COMPATIBLE > TYPE_EXACT > TYPE_ALIAS.
 */
export const evaluateProjectMaterialTaxonomyEvidence = (input: {
  componentConceptKeys: readonly string[];
  materialConceptKeys: readonly string[];
  /** Form keys that satisfy the component via SATISFIED_BY (and similar). */
  satisfiedByFormKeys: readonly string[];
  componentMaterialType: string;
  materialMaterialType: string;
  /** Optional aliases of the material's resolved/canonical type (normalized). */
  materialTypeAliases?: readonly string[];
}): TaxonomyMatchEvidence | null => {
  const componentKeys = new Set(
    input.componentConceptKeys.filter((key) => key.length > 0),
  );
  const materialKeys = new Set(
    input.materialConceptKeys.filter((key) => key.length > 0),
  );
  const satisfiedForms = new Set(
    input.satisfiedByFormKeys.filter((key) => key.length > 0),
  );

  for (const key of materialKeys) {
    if (componentKeys.has(key)) {
      return {
        kind: 'CONCEPT_EXACT',
        scoreBoost: CONCEPT_EXACT_SCORE_BOOST,
        detail: key,
      };
    }
  }

  for (const key of materialKeys) {
    if (satisfiedForms.has(key)) {
      return {
        kind: 'CONCEPT_COMPATIBLE',
        scoreBoost: CONCEPT_COMPATIBLE_SCORE_BOOST,
        detail: key,
      };
    }
  }

  const componentType = normalizeTypeToken(input.componentMaterialType);
  const materialType = normalizeTypeToken(input.materialMaterialType);
  const isGeneral =
    componentType.length === 0 ||
    componentType === 'general' ||
    componentType === 'unspecified';

  if (!isGeneral && materialType.length > 0) {
    if (componentType === materialType) {
      return {
        kind: 'TYPE_EXACT',
        scoreBoost: TYPE_EXACT_SCORE_BOOST,
        detail: materialType,
      };
    }

    const aliases = (input.materialTypeAliases ?? []).map(normalizeTypeToken);
    if (
      aliases.includes(componentType) ||
      (materialType.includes(componentType) && componentType.length >= 5) ||
      (componentType.includes(materialType) && materialType.length >= 5)
    ) {
      return {
        kind: 'TYPE_ALIAS',
        scoreBoost: TYPE_ALIAS_SCORE_BOOST,
        detail: `${componentType}~${materialType}`,
      };
    }
  }

  return null;
};

export const taxonomyMatchKindToReasonCode = (
  kind: ProjectMaterialTaxonomyMatchKind,
):
  | 'CONCEPT_EXACT'
  | 'CONCEPT_COMPATIBLE'
  | 'TYPE_EXACT'
  | 'TYPE_ALIAS'
  | 'LEXICAL_FALLBACK' => kind;
