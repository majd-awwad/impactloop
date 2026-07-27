import type {
  TaxonomyConceptRelationType,
  TaxonomyConceptStatus,
  TaxonomyConceptType,
} from '../../generated/prisma/client.js';

export const TAXONOMY_CONCEPT_RELATION_COMPATIBILITY = {
  INTEREST_RELEVANT_TO: {
    sourceTypes: ['INTEREST'],
    targetTypes: ['MATERIAL_FAMILY', 'MATERIAL_FORM'],
  },
  SATISFIED_BY: {
    sourceTypes: ['COMPONENT'],
    targetTypes: ['MATERIAL_FORM'],
  },
} as const satisfies Record<
  TaxonomyConceptRelationType,
  {
    sourceTypes: readonly TaxonomyConceptType[];
    targetTypes: readonly TaxonomyConceptType[];
  }
>;

export type TaxonomyConceptRelationEndpoint = {
  id: string;
  conceptType: TaxonomyConceptType;
  status: TaxonomyConceptStatus;
};

export type TaxonomyConceptRelationFailureCode =
  | 'SELF_RELATION'
  | 'SOURCE_TYPE_MISMATCH'
  | 'TARGET_TYPE_MISMATCH'
  | 'INACTIVE_SOURCE'
  | 'INACTIVE_TARGET';

export type TaxonomyConceptRelationCreateData = {
  relationType: TaxonomyConceptRelationType;
  sourceConceptId: string;
  sourceConceptType: TaxonomyConceptType;
  targetConceptId: string;
  targetConceptType: TaxonomyConceptType;
};

export type TaxonomyConceptRelationValidation =
  | {
      valid: true;
      createData: TaxonomyConceptRelationCreateData;
    }
  | {
      valid: false;
      code: TaxonomyConceptRelationFailureCode;
    };

export const validateTaxonomyConceptRelation = (input: {
  relationType: TaxonomyConceptRelationType;
  sourceConcept: TaxonomyConceptRelationEndpoint;
  targetConcept: TaxonomyConceptRelationEndpoint;
}): TaxonomyConceptRelationValidation => {
  const { relationType, sourceConcept, targetConcept } = input;
  const compatibility = TAXONOMY_CONCEPT_RELATION_COMPATIBILITY[relationType];

  if (sourceConcept.id === targetConcept.id) {
    return { valid: false, code: 'SELF_RELATION' };
  }
  if (!(compatibility.sourceTypes as readonly TaxonomyConceptType[]).includes(sourceConcept.conceptType)) {
    return { valid: false, code: 'SOURCE_TYPE_MISMATCH' };
  }
  if (!(compatibility.targetTypes as readonly TaxonomyConceptType[]).includes(targetConcept.conceptType)) {
    return { valid: false, code: 'TARGET_TYPE_MISMATCH' };
  }
  if (sourceConcept.status !== 'ACTIVE') {
    return { valid: false, code: 'INACTIVE_SOURCE' };
  }
  if (targetConcept.status !== 'ACTIVE') {
    return { valid: false, code: 'INACTIVE_TARGET' };
  }

  return {
    valid: true,
    createData: {
      relationType,
      sourceConceptId: sourceConcept.id,
      sourceConceptType: sourceConcept.conceptType,
      targetConceptId: targetConcept.id,
      targetConceptType: targetConcept.conceptType,
    },
  };
};
