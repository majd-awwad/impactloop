import { prisma } from '../../database/prisma.js';
import type { TaxonomyConceptType } from '../../generated/prisma/client.js';
import {
  TAXONOMY_COMPATIBILITY_RELATION_SEEDS,
  type TaxonomyCompatibilityRelationSeed,
} from './taxonomy-compatibility-relations.data.js';
import {
  TAXONOMY_CONCEPT_RELATION_COMPATIBILITY,
  validateTaxonomyConceptRelation,
} from './taxonomy-concept-relation.js';
import {
  TAXONOMY_CONCEPT_SEEDS,
  type TaxonomyConceptSeed,
} from './taxonomy-foundation.data.js';
import { isValidTaxonomyCanonicalKey } from './taxonomy-normalization.js';

const relationIdentity = (relation: TaxonomyCompatibilityRelationSeed) =>
  `${relation.relationType}:${relation.sourceCanonicalKey}->${relation.targetCanonicalKey}`;

export const prepareTaxonomyCompatibilityRelations = (
  relations: readonly TaxonomyCompatibilityRelationSeed[],
): readonly TaxonomyCompatibilityRelationSeed[] => {
  const identities = new Set<string>();

  for (const relation of relations) {
    if (!isValidTaxonomyCanonicalKey(relation.sourceCanonicalKey)) {
      throw new Error(`Invalid taxonomy source canonical key: ${relation.sourceCanonicalKey}`);
    }
    if (!isValidTaxonomyCanonicalKey(relation.targetCanonicalKey)) {
      throw new Error(`Invalid taxonomy target canonical key: ${relation.targetCanonicalKey}`);
    }
    if (relation.sourceCanonicalKey === relation.targetCanonicalKey) {
      throw new Error(`Self taxonomy relation is not allowed: ${relationIdentity(relation)}`);
    }

    const compatibility = TAXONOMY_CONCEPT_RELATION_COMPATIBILITY[relation.relationType];
    if (!(compatibility.sourceTypes as readonly TaxonomyConceptType[]).includes(
      relation.sourceConceptType,
    )) {
      throw new Error(`Invalid taxonomy relation source type: ${relationIdentity(relation)}`);
    }
    if (!(compatibility.targetTypes as readonly TaxonomyConceptType[]).includes(
      relation.targetConceptType,
    )) {
      throw new Error(`Invalid taxonomy relation target type: ${relationIdentity(relation)}`);
    }

    const identity = relationIdentity(relation);
    if (identities.has(identity)) {
      throw new Error(`Duplicate taxonomy compatibility relation: ${identity}`);
    }
    identities.add(identity);
  }

  return relations;
};

const mappingValues = (
  seed: TaxonomyConceptSeed,
  field: 'componentTypeValues' | 'materialTypeNames',
) => seed.mappingRules.flatMap((rule) => rule[field] ?? []);

export const assertSatisfiedByFoundationAuthority = (
  relations: readonly TaxonomyCompatibilityRelationSeed[],
  foundationSeeds: readonly TaxonomyConceptSeed[] = TAXONOMY_CONCEPT_SEEDS,
): void => {
  const forms = foundationSeeds.filter((seed) => seed.conceptType === 'MATERIAL_FORM');

  for (const relation of relations.filter(({ relationType }) => relationType === 'SATISFIED_BY')) {
    const source = foundationSeeds.find(({ canonicalKey }) => canonicalKey === relation.sourceCanonicalKey);
    const target = foundationSeeds.find(({ canonicalKey }) => canonicalKey === relation.targetCanonicalKey);

    if (!source || source.conceptType !== 'COMPONENT') {
      throw new Error(`Missing COMPONENT authority: ${relation.sourceCanonicalKey}`);
    }
    if (!target || target.conceptType !== 'MATERIAL_FORM') {
      throw new Error(`Missing MATERIAL_FORM authority: ${relation.targetCanonicalKey}`);
    }

    const componentTypeValues = [...new Set(mappingValues(source, 'componentTypeValues'))];
    if (componentTypeValues.length !== 1) {
      throw new Error(`Ambiguous component type authority: ${relation.sourceCanonicalKey}`);
    }

    const [componentTypeValue] = componentTypeValues;
    const matchingForms = forms.filter((form) =>
      mappingValues(form, 'materialTypeNames').includes(componentTypeValue!),
    );

    if (matchingForms.length !== 1) {
      throw new Error(`Ambiguous material form authority: ${relation.sourceCanonicalKey}`);
    }
    if (matchingForms[0]!.canonicalKey !== target.canonicalKey) {
      throw new Error(
        `Incorrect material form authority for ${relation.sourceCanonicalKey}: ${target.canonicalKey}`,
      );
    }
  }
};

prepareTaxonomyCompatibilityRelations(TAXONOMY_COMPATIBILITY_RELATION_SEEDS);
assertSatisfiedByFoundationAuthority(TAXONOMY_COMPATIBILITY_RELATION_SEEDS);

export type TaxonomyCompatibilitySeedResult = {
  expectedCount: number;
  existingCount: number;
  createdCount: number;
};

export const seedTaxonomyCompatibilityRelations = async (
  relations: readonly TaxonomyCompatibilityRelationSeed[] = TAXONOMY_COMPATIBILITY_RELATION_SEEDS,
): Promise<TaxonomyCompatibilitySeedResult> => {
  const preparedRelations = prepareTaxonomyCompatibilityRelations(relations);

  return prisma.$transaction(async (tx) => {
    const canonicalKeys = [
      ...new Set(
        preparedRelations.flatMap(({ sourceCanonicalKey, targetCanonicalKey }) => [
          sourceCanonicalKey,
          targetCanonicalKey,
        ]),
      ),
    ];
    const concepts = await tx.taxonomyConcept.findMany({
      where: { canonicalKey: { in: canonicalKeys } },
      select: {
        id: true,
        canonicalKey: true,
        conceptType: true,
        status: true,
      },
    });
    const conceptsByKey = new Map(concepts.map((concept) => [concept.canonicalKey, concept]));
    let existingCount = 0;
    let createdCount = 0;

    for (const relation of preparedRelations) {
      const sourceConcept = conceptsByKey.get(relation.sourceCanonicalKey);
      const targetConcept = conceptsByKey.get(relation.targetCanonicalKey);

      if (!sourceConcept) {
        throw new Error(`Missing taxonomy concept: ${relation.sourceCanonicalKey}`);
      }
      if (!targetConcept) {
        throw new Error(`Missing taxonomy concept: ${relation.targetCanonicalKey}`);
      }
      if (sourceConcept.conceptType !== relation.sourceConceptType) {
        throw new Error(
          `Taxonomy concept type mismatch for ${relation.sourceCanonicalKey}: expected ${relation.sourceConceptType}, found ${sourceConcept.conceptType}`,
        );
      }
      if (targetConcept.conceptType !== relation.targetConceptType) {
        throw new Error(
          `Taxonomy concept type mismatch for ${relation.targetCanonicalKey}: expected ${relation.targetConceptType}, found ${targetConcept.conceptType}`,
        );
      }

      const validation = validateTaxonomyConceptRelation({
        relationType: relation.relationType,
        sourceConcept,
        targetConcept,
      });
      if (!validation.valid) {
        throw new Error(
          `Invalid taxonomy compatibility relation ${relation.sourceCanonicalKey} -> ${relation.targetCanonicalKey}: ${validation.code}`,
        );
      }

      const existing = await tx.taxonomyConceptRelation.findUnique({
        where: {
          relationType_sourceConceptId_targetConceptId: {
            relationType: relation.relationType,
            sourceConceptId: sourceConcept.id,
            targetConceptId: targetConcept.id,
          },
        },
        select: { id: true },
      });
      if (existing) {
        existingCount += 1;
        continue;
      }

      await tx.taxonomyConceptRelation.create({ data: validation.createData });
      createdCount += 1;
    }

    return {
      expectedCount: preparedRelations.length,
      existingCount,
      createdCount,
    };
  });
};
