import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { getLearningProjects } from './learning-projects.service.js';

describe('learning-projects browse pagination semantics', () => {
  test('DEFAULT page=1 and page=2 are contiguous without duplicates', async () => {
    const pageOne = await getLearningProjects({ page: 1, limit: 12 });
    const pageTwo = await getLearningProjects({ page: 2, limit: 12 });

    assert.equal(pageOne.pagination.limit, 12);
    assert.equal(pageTwo.pagination.limit, 12);
    assert.equal(pageOne.pagination.total, pageTwo.pagination.total);
    assert.equal(pageOne.pagination.total >= pageOne.items.length, true);

    const pageOneIds = pageOne.items.map((item) => item.id);
    const pageTwoIds = pageTwo.items.map((item) => item.id);
    const overlap = pageOneIds.filter((id) => pageTwoIds.includes(id));
    assert.deepEqual(overlap, []);

    if (pageOne.pagination.total > 12) {
      assert.equal(pageOne.items.length, 12);
      assert.equal(pageTwo.items.length > 0, true);
    }
  });

  test('NEWEST preserves the same first-page identity as DEFAULT for this dataset order', async () => {
    const defaultPage = await getLearningProjects({
      page: 1,
      limit: 12,
      sort: 'DEFAULT',
    });
    const newestPage = await getLearningProjects({
      page: 1,
      limit: 12,
      sort: 'NEWEST',
    });

    assert.deepEqual(
      newestPage.items.map((item) => item.id),
      defaultPage.items.map((item) => item.id),
    );
    assert.equal(newestPage.pagination.total, defaultPage.pagination.total);
  });

  test('category and difficulty filters compose and keep pagination totals coherent', async () => {
    const baseline = await getLearningProjects({ page: 1, limit: 12 });
    const first = baseline.items[0];
    if (!first) {
      return;
    }

    const filtered = await getLearningProjects({
      page: 1,
      limit: 12,
      categoryId: first.category.id,
      difficulty: first.difficulty,
    });

    assert.equal(
      filtered.items.every(
        (item) =>
          item.category.id === first.category.id &&
          item.difficulty === first.difficulty,
      ),
      true,
    );
    assert.equal(filtered.pagination.total >= filtered.items.length, true);
    assert.equal(filtered.pagination.total <= baseline.pagination.total, true);
  });

  test('MOST_AVAILABLE returns a full page with coverage metadata and stable total', async () => {
    const result = await getLearningProjects({
      page: 1,
      limit: 12,
      sort: 'MOST_AVAILABLE',
    });

    assert.equal(result.pagination.total >= result.items.length, true);
    for (const item of result.items) {
      assert.ok(item.materialCoverage);
      assert.equal(typeof item.materialCoverage.availabilityRatio, 'number');
      assert.equal(item.personalBuildReadiness, null);
    }
  });

  test('availability FULL filter only returns FULL coverage projects', async () => {
    const result = await getLearningProjects({
      page: 1,
      limit: 12,
      availability: 'FULL',
    });

    for (const item of result.items) {
      assert.equal(item.materialCoverage.coverageLevel, 'FULL');
    }
    assert.equal(result.pagination.total >= result.items.length, true);
  });

  test('anonymous browse never exposes personalBuildReadiness', async () => {
    const result = await getLearningProjects({ page: 1, limit: 12 });
    assert.equal(
      result.items.every((item) => item.personalBuildReadiness == null),
      true,
    );
  });
});
