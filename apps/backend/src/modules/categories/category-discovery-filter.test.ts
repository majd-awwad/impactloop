import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  filterPublicDiscoveryCategories,
  isPublicDiscoveryCategoryName,
} from './category-discovery-filter.js';
import { categoriesQuerySchema } from './categories.validation.js';

describe('category discovery filter', () => {
  test('discoveryOnly query flag parses', () => {
    const result = categoriesQuerySchema.safeParse({
      discoveryOnly: 'true',
      rootOnly: 'true',
      type: 'MATERIAL',
    });

    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.discoveryOnly, true);
      assert.equal(result.data.rootOnly, true);
    }
  });

  test('hides internal test/admin category names', () => {
    assert.equal(
      isPublicDiscoveryCategoryName('[test-admin-approvals] Final Category'),
      false,
    );
    assert.equal(isPublicDiscoveryCategoryName('[live-conv-1784648863167] cat'), false);
    assert.equal(isPublicDiscoveryCategoryName('[temp-arabic-authoring-repro] Projects'), false);
    assert.equal(isPublicDiscoveryCategoryName('QA Test Category'), false);
    assert.equal(isPublicDiscoveryCategoryName('Admin Tools'), false);
    assert.equal(isPublicDiscoveryCategoryName('Electronics'), true);
  });

  test('dedupes categories by normalized English label', () => {
    const filtered = filterPublicDiscoveryCategories([
      { id: '1', nameEn: 'Wood' },
      { id: '2', nameEn: ' wood ' },
      { id: '3', nameEn: 'Electronics' },
    ]);

    assert.equal(filtered.length, 2);
    assert.deepEqual(
      filtered.map((category) => category.nameEn),
      ['Wood', 'Electronics'],
    );
  });
});
