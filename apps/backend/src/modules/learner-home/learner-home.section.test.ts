import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { AppError } from '../../utils/app-error.js';
import {
  dedupeMaterialItems,
  dedupeSectionItemsById,
  pickMaterialSectionItems,
} from './learner-home.deduplication.js';
import {
  resolveFreeMaterialsSectionTitle,
  selectSuggestedProjectItems,
} from './learner-home.section-builders.js';
import type { LearnerHomeMaterialItem } from './learner-home.types.js';
import {
  parseLearnerHomeSectionKey,
  parseLearnerHomeSectionQuery,
} from './learner-home.validation.js';

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

describe('learner-home validation', () => {
  test('parseLearnerHomeSectionKey accepts supported keys', () => {
    assert.equal(
      parseLearnerHomeSectionKey('suggested_materials'),
      'suggested_materials',
    );
  });

  test('parseLearnerHomeSectionKey rejects unsupported keys', () => {
    assert.throws(
      () => parseLearnerHomeSectionKey('unknown_section'),
      (error: unknown) =>
        error instanceof AppError && error.statusCode === 400,
    );
  });

  test('parseLearnerHomeSectionQuery defaults limit to 20', () => {
    assert.deepEqual(parseLearnerHomeSectionQuery({}), { limit: 20, offset: 0 });
  });

  test('parseLearnerHomeSectionQuery accepts limit 10 and 50', () => {
    assert.deepEqual(parseLearnerHomeSectionQuery({ limit: 10 }), {
      limit: 10,
      offset: 0,
    });
    assert.deepEqual(parseLearnerHomeSectionQuery({ limit: 50 }), {
      limit: 50,
      offset: 0,
    });
  });
});

describe('learner-home section builders', () => {
  test('selectSuggestedProjectItems prefers unsaved projects', () => {
    const unsaved = [
      {
        type: 'project' as const,
        score: 90,
        reasons: ['Matches your Robotics interest'],
        project: { id: 'project-1', isSaved: false },
      },
    ];
    const saved = [
      {
        type: 'project' as const,
        score: 80,
        reasons: ['Popular with learners'],
        project: { id: 'project-2', isSaved: true },
      },
    ];

    const selected = selectSuggestedProjectItems(unsaved, saved, 2);

    assert.deepEqual(
      selected.map((item) => item.project.id),
      ['project-1', 'project-2'],
    );
    assert.equal(selected[0]?.project.isSaved, false);
    assert.equal(selected[1]?.project.isSaved, true);
  });

  test('selectSuggestedProjectsPreservingOrder keeps ML relative order within unsaved and saved bands', async () => {
    const { selectSuggestedProjectsPreservingOrder } = await import(
      './learner-home.service.js'
    );
    const orderedPool = [
      {
        type: 'project' as const,
        score: 10,
        reasons: ['ml'],
        project: { id: 'saved-high', isSaved: true },
      },
      {
        type: 'project' as const,
        score: 9,
        reasons: ['ml'],
        project: { id: 'unsaved-b', isSaved: false },
      },
      {
        type: 'project' as const,
        score: 8,
        reasons: ['ml'],
        project: { id: 'unsaved-a', isSaved: false },
      },
      {
        type: 'project' as const,
        score: 7,
        reasons: ['ml'],
        project: { id: 'saved-low', isSaved: true },
      },
    ];
    const selected = selectSuggestedProjectsPreservingOrder(
      orderedPool,
      new Set(['saved-high', 'saved-low']),
      3,
    );
    // Unsaved-first business policy; within unsaved, ML order (b before a) is preserved.
    // Saved fill keeps ML order among saved (high before low).
    assert.deepEqual(
      selected.map((item) => item.project.id),
      ['unsaved-b', 'unsaved-a', 'saved-high'],
    );
  });

  test('resolveFreeMaterialsSectionTitle avoids near wording without near items', () => {
    assert.equal(
      resolveFreeMaterialsSectionTitle({
        hasSavedLocation: true,
        hasNearItems: false,
        defaultTitle: 'Free materials near you',
      }),
      'Free materials you may like',
    );
  });

  test('dedupeSectionItemsById removes duplicate material ids', () => {
    const items = dedupeSectionItemsById(
      [
        { id: 'a', material: { id: 'mat-1' } },
        { id: 'b', material: { id: 'mat-1' } },
        { id: 'c', material: { id: 'mat-2' } },
      ],
      5,
      (item) => String(item.material.id),
    );

    assert.deepEqual(
      items.map((item) => item.material.id),
      ['mat-1', 'mat-2'],
    );
  });

  test('home preview material pick supports up to 4 unique items', () => {
    const pool = Array.from({ length: 8 }, (_, index) =>
      materialItem(`material-${index}`, 100 - index),
    );

    const selected = pickMaterialSectionItems(pool, 4, new Set());

    assert.equal(selected.length, 4);
    assert.equal(new Set(selected.map((item) => item.material.id)).size, 4);
  });
});
