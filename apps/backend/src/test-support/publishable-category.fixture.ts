import assert from 'node:assert/strict';

import { prisma } from '../database/prisma.js';

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
