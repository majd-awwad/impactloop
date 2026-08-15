import { prisma } from '../../database/prisma.js';
import {
  buildAuthoritativeLegacyCategoryIndex,
  resolveLegacyBackfillExpectation,
} from './category-taxonomy-ownership.js';

export type SeedCategoryTaxonomyOwnershipResult = {
  materialOwned: number;
  projectOwned: number;
};

/**
 * Apply authoritative category → taxonomy concept ownership FKs.
 * Migrations intentionally skip this on empty DBs; seed owns the link for local reset.
 */
export const seedCategoryTaxonomyOwnership = async (options?: {
  onlyCategoryNamesEn?: readonly string[];
}): Promise<SeedCategoryTaxonomyOwnershipResult> => {
    const legacyIndex = buildAuthoritativeLegacyCategoryIndex();
    const concepts = await prisma.taxonomyConcept.findMany({
      where: {
        conceptType: { in: ['MATERIAL_FAMILY', 'PROJECT_TOPIC'] },
        status: 'ACTIVE',
      },
      select: {
        id: true,
        canonicalKey: true,
        conceptType: true,
      },
    });
    const conceptsByCanonicalKey = new Map(
      concepts.map((concept) => [concept.canonicalKey, concept]),
    );

    const categories = await prisma.category.findMany({
      where: {
        isActive: true,
        parentId: null,
        categoryType: { in: ['MATERIAL', 'PROJECT'] },
        ...(options?.onlyCategoryNamesEn
          ? { nameEn: { in: [...options.onlyCategoryNamesEn] } }
          : {}),
      },
      select: {
        id: true,
        nameEn: true,
        categoryType: true,
        materialFamilyConceptId: true,
        projectTopicConceptId: true,
      },
      orderBy: [{ nameEn: 'asc' }, { id: 'asc' }],
    });

    let materialOwned = 0;
    let projectOwned = 0;

    for (const category of categories) {
      if (category.categoryType === 'MATERIAL') {
        const expectation = resolveLegacyBackfillExpectation(
          legacyIndex,
          'materialFamily',
          category.nameEn,
        );
        if (!expectation || expectation.resolution !== 'UNIQUE') {
          throw new Error(
            `CATEGORY_OWNERSHIP_SEED_MISSING_MAPPING: category_name=${category.nameEn}, category_type=MATERIAL`,
          );
        }
        const canonicalKey = expectation.matches[0]!.canonicalKey;
        const concept = conceptsByCanonicalKey.get(canonicalKey);
        if (!concept || concept.conceptType !== 'MATERIAL_FAMILY') {
          throw new Error(
            `CATEGORY_OWNERSHIP_SEED_MISSING_CONCEPT: category_name=${category.nameEn}, canonical_key=${canonicalKey}`,
          );
        }
        if (
          category.materialFamilyConceptId === concept.id
          && category.projectTopicConceptId === null
        ) {
          materialOwned += 1;
          continue;
        }
        await prisma.category.update({
          where: { id: category.id },
          data: {
            materialFamilyConceptId: concept.id,
            projectTopicConceptId: null,
          },
        });
        materialOwned += 1;
        continue;
      }

      const expectation = resolveLegacyBackfillExpectation(
        legacyIndex,
        'projectTopic',
        category.nameEn,
      );
      if (!expectation || expectation.resolution !== 'UNIQUE') {
        throw new Error(
          `CATEGORY_OWNERSHIP_SEED_MISSING_MAPPING: category_name=${category.nameEn}, category_type=PROJECT`,
        );
      }
      const canonicalKey = expectation.matches[0]!.canonicalKey;
      const concept = conceptsByCanonicalKey.get(canonicalKey);
      if (!concept || concept.conceptType !== 'PROJECT_TOPIC') {
        throw new Error(
          `CATEGORY_OWNERSHIP_SEED_MISSING_CONCEPT: category_name=${category.nameEn}, canonical_key=${canonicalKey}`,
        );
      }
      if (
        category.projectTopicConceptId === concept.id
        && category.materialFamilyConceptId === null
      ) {
        projectOwned += 1;
        continue;
      }
      await prisma.category.update({
        where: { id: category.id },
        data: {
          projectTopicConceptId: concept.id,
          materialFamilyConceptId: null,
        },
      });
      projectOwned += 1;
    }

    const expectedMaterial = categories.filter(
      (category) => category.categoryType === 'MATERIAL',
    ).length;
    const expectedProject = categories.filter(
      (category) => category.categoryType === 'PROJECT',
    ).length;

    if (materialOwned !== expectedMaterial || projectOwned !== expectedProject) {
      throw new Error(
        `CATEGORY_OWNERSHIP_SEED_POSTCONDITION_FAILED: material_owned=${materialOwned}, project_owned=${projectOwned}, expected_material=${expectedMaterial}, expected_project=${expectedProject}`,
      );
    }

    return { materialOwned, projectOwned };
  };
