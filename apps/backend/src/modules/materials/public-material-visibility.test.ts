import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  PUBLIC_MATERIAL_CATEGORY_TYPES,
  PUBLIC_MATERIAL_STATUSES,
  buildPublicMaterialWhere,
  isPublicMaterialStatus,
} from './public-material-visibility.js';

describe('public material visibility', () => {
  test('keeps legitimate workflow materials visible by default', () => {
    assert.deepEqual(PUBLIC_MATERIAL_STATUSES, [
      'AVAILABLE',
      'PENDING_RESERVATION',
      'RESERVED',
    ]);
    assert.deepEqual(PUBLIC_MATERIAL_CATEGORY_TYPES, ['MATERIAL', 'BOTH']);
    assert.deepEqual(buildPublicMaterialWhere(), {
      status: { in: [...PUBLIC_MATERIAL_STATUSES] },
      category: {
        isActive: true,
        categoryType: { in: ['MATERIAL', 'BOTH'] },
      },
    });
  });

  test('preserves an explicitly requested public status', () => {
    assert.deepEqual(buildPublicMaterialWhere('AVAILABLE'), {
      status: 'AVAILABLE',
      category: {
        isActive: true,
        categoryType: { in: ['MATERIAL', 'BOTH'] },
      },
    });
  });

  test('classifies only public workflow statuses as visible', () => {
    assert.equal(isPublicMaterialStatus('AVAILABLE'), true);
    assert.equal(isPublicMaterialStatus('PENDING_RESERVATION'), true);
    assert.equal(isPublicMaterialStatus('RESERVED'), true);
    assert.equal(isPublicMaterialStatus('REUSED'), false);
    assert.equal(isPublicMaterialStatus('UNAVAILABLE'), false);
    assert.equal(isPublicMaterialStatus(null), false);
  });
});
