import assert from 'node:assert/strict';

import { prisma } from '../database/prisma.js';

const TAXONOMY_BOOTSTRAP_HINT =
  'Run `npm run test:db:bootstrap` on the test database.';

/**
 * Returns a category that satisfies material publish taxonomy requirements.
 * Requires test DB taxonomy bootstrap (`npm run test:db:bootstrap`).
 */
export const findPublishableMaterialCategoryId = async (): Promise<string> => {
  const category = await prisma.category.findFirst({
    where: {
      categoryType: { in: ['MATERIAL', 'BOTH'] },
      isActive: true,
      parentId: null,
      materialFamilyConceptId: { not: null },
      materialFamilyConcept: {
        status: 'ACTIVE',
        conceptType: 'MATERIAL_FAMILY',
      },
    },
    select: { id: true },
    orderBy: { nameEn: 'asc' },
  });

  assert.ok(
    category,
    'Expected a publishable material category. Run `npm run test:db:bootstrap` on the test database.',
  );

  return category.id;
};

export const findActiveProjectTopicConcept = async () => {
  const topic = await prisma.taxonomyConcept.findFirst({
    where: {
      conceptType: 'PROJECT_TOPIC',
      status: 'ACTIVE',
    },
    select: { id: true, canonicalKey: true },
    orderBy: { canonicalKey: 'asc' },
  });

  assert.ok(topic, `Expected an ACTIVE PROJECT_TOPIC concept. ${TAXONOMY_BOOTSTRAP_HINT}`);

  return topic;
};

/**
 * Creates a PROJECT (or BOTH) category with valid project-topic taxonomy ownership.
 * Required when tests mutate draft projects through the domain service (title/components/steps saves).
 */
export const createTaxonomyReadyProjectCategory = async (input: {
  nameEn: string;
  nameAr: string;
  categoryType?: 'PROJECT' | 'BOTH';
  isActive?: boolean;
}) => {
  const topic = await findActiveProjectTopicConcept();

  return prisma.category.create({
    data: {
      nameEn: input.nameEn,
      nameAr: input.nameAr,
      categoryType: input.categoryType ?? 'PROJECT',
      isActive: input.isActive ?? true,
      projectTopicConceptId: topic.id,
    },
  });
};
