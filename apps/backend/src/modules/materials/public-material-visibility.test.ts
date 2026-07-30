import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  PUBLIC_MATERIAL_STATUSES,
  buildPublicMaterialWhere,
} from './public-material-visibility.js';

describe('public material visibility', () => {
  test('keeps legitimate workflow materials visible by default', () => {
    assert.deepEqual(PUBLIC_MATERIAL_STATUSES, [
      'AVAILABLE',
      'PENDING_RESERVATION',
      'RESERVED',
    ]);
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
});
