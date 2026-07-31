import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { dedupeMaterialSections } from './learner-home.deduplication.js';
import type { LearnerHomeMaterialItem } from './learner-home.types.js';

const materialItem = (
  id: string,
  score: number,
  reasons: string[] = [],
): LearnerHomeMaterialItem => ({
  type: 'material',
  score,
  reasons,
  material: { id, title: id },
});

describe('learner-home deduplication', () => {
  test('prefers saved-project materials in materials_for_saved_projects and backfills suggested', () => {
    const shared = materialItem('shared', 120, ['Useful for saved project']);
    const suggestedOnly = materialItem('suggested-only', 90, ['Matches interest']);
    const savedOnly = materialItem('saved-only', 80, ['Matches component']);
    const freeOnly = materialItem('free-only', 70, ['Free material']);

    const deduped = dedupeMaterialSections({
      materialsForSavedProjects: [shared, savedOnly],
      suggestedMaterials: [shared, suggestedOnly],
      freeMaterialsNearYou: [shared, freeOnly],
      limits: {
        materialsForSavedProjects: 2,
        suggestedMaterials: 1,
        freeMaterialsNearYou: 1,
      },
    });

    assert.deepEqual(
      deduped.materialsForSavedProjects.map((item) => item.material.id),
      ['shared', 'saved-only'],
    );
    assert.deepEqual(
      deduped.suggestedMaterials.map((item) => item.material.id),
      ['suggested-only'],
    );
    assert.deepEqual(
      deduped.freeMaterialsNearYou.map((item) => item.material.id),
      ['free-only'],
    );
  });

  test('allows fallback duplicates only when alternatives are exhausted', () => {
    const onlyItem = materialItem('only-item', 100);

    const deduped = dedupeMaterialSections({
      materialsForSavedProjects: [onlyItem],
      suggestedMaterials: [onlyItem],
      freeMaterialsNearYou: [onlyItem],
      limits: {
        materialsForSavedProjects: 1,
        suggestedMaterials: 1,
        freeMaterialsNearYou: 1,
      },
    });

    assert.equal(deduped.materialsForSavedProjects.length, 1);
    assert.equal(deduped.suggestedMaterials.length, 1);
    assert.equal(deduped.freeMaterialsNearYou.length, 1);
    assert.equal(deduped.suggestedMaterials[0]?.material.id, 'only-item');
  });
});
